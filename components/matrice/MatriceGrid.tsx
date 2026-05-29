'use client'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { MatriceRow } from './MatriceRow'
import { DayHeader } from './DayHeader'
import { useMatrice } from '@/hooks/useMatrice'
import { useNucleo } from '@/hooks/useNucleo'
import { updateMatriceCell, setNightShift, clearNightSmonto } from '@/lib/firebase/firestore'
import type { AutosostOperator, AutosostAssignment } from '@/lib/firebase/firestore'
import { NIGHT } from '@/lib/shifts/nightShift'
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
  const daysInMonth = new Date(year, month, 0).getDate()
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

  // Part-time operators go to the bottom (stable: preserves the name order within each group)
  const sortedOperators = [...operators].sort((a, b) => {
    const aPT = a.contractType === 'parttime' ? 1 : 0
    const bPT = b.contractType === 'parttime' ? 1 : 0
    return aPT - bPT
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
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `160px repeat(${daysInMonth}, minmax(36px, 1fr))` }}
      >
        <div className="h-9 flex items-center px-2 text-xs font-semibold text-slate-500">Operatore</div>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const date = new Date(year, month - 1, day)
          const isToday = date.toDateString() === today.toDateString()
          return <DayHeader key={day} day={day} date={date} isToday={isToday} isColHovered={hovered?.day === day} />
        })}
        {sortedOperators.map((op, idx) => {
          const isPT = op.contractType === 'parttime'
          const prevPT = idx > 0 && sortedOperators[idx - 1].contractType === 'parttime'
          const showPTSeparator = isPT && !prevPT
          return (
            <Fragment key={op.id}>
              {showPTSeparator && (
                <div
                  style={{ gridColumn: '1 / -1' }}
                  className="mt-3 pb-0.5 px-2 flex items-end text-[10px] font-semibold text-purple-500 uppercase tracking-wide border-t border-slate-200 pt-2"
                >
                  Part-time
                </div>
              )}
              <MatriceRow
                operator={op}
                matrice={matrice}
                daysInMonth={daysInMonth}
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

        {/* Riga "Autosostituzione": celle interattive sui giorni con turni scoperti */}
        {showAutosostRow && (
          <>
            <div style={{ gridColumn: '1 / -1' }} className="mt-3 border-t border-slate-200" />
            <div className="h-9 flex items-center px-2 text-xs font-semibold text-red-600 sticky left-0 z-10 bg-slate-50">
              Autosostituzione
            </div>
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              return (
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
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
