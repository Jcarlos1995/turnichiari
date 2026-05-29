'use client'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { MatriceRow } from './MatriceRow'
import { DayHeader } from './DayHeader'
import { useMatrice } from '@/hooks/useMatrice'
import { useNucleo } from '@/hooks/useNucleo'
import { updateMatriceCell, setNightShift, clearNightSmonto } from '@/lib/firebase/firestore'
import type { AutosostOperator, AutosostAssignment } from '@/lib/firebase/firestore'
import { NIGHT } from '@/lib/shifts/nightShift'
import { weeksOfMonth } from '@/lib/bancaore/bancaOre'
import { AutosostCell } from './AutosostCell'
import type { AppUser, Operator, MatriceMonth } from '@/lib/types'
import type { UncoveredSlot } from '@/lib/genera/nuovaMatrice'

interface MatriceGridProps {
  nucleoId: string
  year: number
  month: number
  currentUser: AppUser
  uncovered?: UncoveredSlot[]
  autosostPool?: AutosostOperator[]
  autosostAssignments?: AutosostAssignment[]
  onAutosostAssign?: (day: number, shift: string, op: AutosostOperator) => void
  onAutosostUnassign?: (day: number, shift: string, autoOpId: string) => void
  onDataReady?: (operators: Operator[], matrice: MatriceMonth) => void
}

export function MatriceGrid({
  nucleoId, year, month, currentUser, uncovered = [],
  autosostPool = [], autosostAssignments = [], onAutosostAssign, onAutosostUnassign,
  onDataReady,
}: MatriceGridProps) {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`
  const { matrice, operators, loading: matriceLoading } = useMatrice(nucleoId, yearMonth)
  const { allShiftTypes, loading: nucleoLoading } = useNucleo(nucleoId)
  const today = new Date()
  const canEdit = currentUser.role === 'raa' || currentUser.role === 'coordinatrice'

  // Crosshair hover: highlight the row + column under the mouse
  const [hovered, setHovered] = useState<{ operatorId: string; day: number } | null>(null)
  const handleCellHover = useCallback((operatorId: string, day: number) => {
    setHovered({ operatorId, day })
  }, [])
  const handleCellLeave = useCallback(() => setHovered(null), [])

  useEffect(() => {
    if (!matriceLoading && !nucleoLoading && onDataReady) {
      onDataReady(operators, matrice)
    }
  }, [operators, matrice, matriceLoading, nucleoLoading, onDataReady])

  const handleCellSelect = useCallback(async (
    operatorId: string,
    day: number,
    entry: { code: string; note?: string; updatedAt: number },
    previousCode?: string
  ) => {
    try {
      // If the edited cell was an N1, its paired N2 (next day) must be cleared.
      if (previousCode === NIGHT.start) {
        await clearNightSmonto(nucleoId, year, month, day, operatorId)
      }
      await updateMatriceCell(nucleoId, yearMonth, operatorId, day, {
        ...entry,
        updatedBy: currentUser.uid,
      })
    } catch (err) {
      // Non lasciare che la scrittura fallisca silenziosamente: senza questo
      // log, un errore (es. permessi, valore non valido) farebbe restare la
      // cella su '—' senza alcun segnale per l'utente o lo sviluppatore.
      console.error('Errore salvataggio cella matrice:', err)
    }
  }, [nucleoId, yearMonth, year, month, currentUser.uid])

  const handleCellNight = useCallback(async (
    operatorId: string,
    day: number,
    isOverride: boolean
  ) => {
    try {
      await setNightShift(nucleoId, year, month, day, operatorId, currentUser.uid, isOverride)
    } catch (err) {
      console.error('Errore salvataggio turno notte:', err)
    }
  }, [nucleoId, year, month, currentUser.uid])

  // Settimane Lun–Dom. Se il mese non inizia di lunedì, i giorni iniziali
  // (prima del primo lunedì) vengono uniti alla prima settimana completa,
  // così il primo blocco arriva fino alla prima domenica senza orfani.
  const rawWeeks = weeksOfMonth(year, month)
  let weeks = rawWeeks
  if (rawWeeks.length > 1) {
    const firstDay = rawWeeks[0][0]
    const startsMonday = (new Date(year, month - 1, firstDay).getDay() + 6) % 7 === 0
    if (!startsMonday) {
      weeks = [[...rawWeeks[0], ...rawWeeks[1]], ...rawWeeks.slice(2)]
    }
  }

  // Giorno della prima notte (N1) di un operatore DENTRO un insieme di giorni; Infinity se nessuna
  const firstNightDayIn = (opId: string, days: number[]): number => {
    const data = matrice[opId] ?? {}
    let min = Infinity
    for (const d of days) {
      if (data[d]?.code === NIGHT.start && d < min) min = d
    }
    return min
  }

  // Ordine per una settimana: FT prima (per giorno della prima notte di quella settimana,
  // poi alfabetico), part-time in fondo (alfabetico).
  const sortForWeek = (days: number[]): Operator[] =>
    [...operators].sort((a, b) => {
      const aPT = a.contractType === 'parttime' ? 1 : 0
      const bPT = b.contractType === 'parttime' ? 1 : 0
      if (aPT !== bPT) return aPT - bPT
      if (aPT === 1) return a.name.localeCompare(b.name)
      const an = firstNightDayIn(a.id, days)
      const bn = firstNightDayIn(b.id, days)
      if (an !== bn) return an - bn
      return a.name.localeCompare(b.name)
    })

  // Per-day: remaining uncovered shifts (after subtracting autosost assignments) + assignments
  const assignmentsByDay: Record<number, AutosostAssignment[]> = {}
  for (const a of autosostAssignments) (assignmentsByDay[a.day] ??= []).push(a)

  const remainingByDay: Record<number, string[]> = {}
  for (const u of uncovered) {
    const assignedSame = (assignmentsByDay[u.day] ?? []).filter(a => a.shift === u.shift).length
    const remaining = u.missing - assignedSame
    for (let k = 0; k < remaining; k++) (remainingByDay[u.day] ??= []).push(u.shift)
  }

  const showAutosostRow = uncovered.length > 0 || autosostAssignments.length > 0

  if (matriceLoading || nucleoLoading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Caricamento matrice...</div>
  }

  return (
    <div className="flex-1 overflow-auto p-3" onMouseLeave={handleCellLeave}>
      {weeks.map((weekDays, wi) => {
        const weekSorted = sortForWeek(weekDays)
        const weekHasAutosost = showAutosostRow && weekDays.some(
          d => (remainingByDay[d]?.length ?? 0) > 0 || (assignmentsByDay[d]?.length ?? 0) > 0
        )
        return (
          <div key={wi} className="border border-slate-200 rounded-xl bg-white shadow-sm p-3 mb-5 overflow-x-auto">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `160px repeat(${weekDays.length}, minmax(36px, 1fr))` }}
            >
            <div className="h-9 flex items-center px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Sett. {wi + 1}
            </div>
            {weekDays.map(day => {
              const date = new Date(year, month - 1, day)
              const isToday = date.toDateString() === today.toDateString()
              return <DayHeader key={day} day={day} date={date} isToday={isToday} isColHovered={hovered?.day === day} />
            })}

            {weekSorted.map((op, idx) => {
              const isPT = op.contractType === 'parttime'
              const prevPT = idx > 0 && weekSorted[idx - 1].contractType === 'parttime'
              const showPTSeparator = isPT && !prevPT
              return (
                <Fragment key={op.id}>
                  {showPTSeparator && (
                    <div
                      style={{ gridColumn: '1 / -1' }}
                      className="mt-2 pb-0.5 px-2 flex items-end text-[10px] font-semibold text-purple-500 uppercase tracking-wide border-t border-slate-200 pt-1.5"
                    >
                      Part-time
                    </div>
                  )}
                  <MatriceRow
                    operator={op}
                    matrice={matrice}
                    days={weekDays}
                    year={year}
                    month={month}
                    allShiftTypes={allShiftTypes}
                    editable={canEdit}
                    onCellSelect={handleCellSelect}
                    onCellNight={handleCellNight}
                    hoveredOperatorId={hovered?.operatorId ?? null}
                    hoveredDay={hovered?.day ?? null}
                    onCellHover={handleCellHover}
                  />
                </Fragment>
              )
            })}

            {weekHasAutosost && (
              <>
                <div style={{ gridColumn: '1 / -1' }} className="mt-2 border-t border-slate-200" />
                <div className="h-9 flex items-center px-2 text-[10px] font-semibold uppercase tracking-wide text-red-600 sticky left-0 z-10 bg-slate-50">
                  Autosostituzione
                </div>
                {weekDays.map(day => (
                  <AutosostCell
                    key={day}
                    day={day}
                    uncoveredShifts={remainingByDay[day] ?? []}
                    assignments={assignmentsByDay[day] ?? []}
                    pool={autosostPool}
                    editable={canEdit}
                    onAssign={(d, s, op) => onAutosostAssign?.(d, s, op)}
                    onUnassign={(d, s, id) => onAutosostUnassign?.(d, s, id)}
                  />
                ))}
              </>
            )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
