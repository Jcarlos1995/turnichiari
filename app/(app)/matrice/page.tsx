'use client'
import { useState, useRef, useEffect } from 'react'
import { MatriceGrid } from '@/components/matrice/MatriceGrid'
import { GeneraMeseModal } from '@/components/matrice/GeneraMeseModal'
import { GeneraNuovaMatriceModal } from '@/components/matrice/GeneraNuovaMatriceModal'
import { EccezioniModal } from '@/components/matrice/EccezioniModal'
import { useAuth } from '@/hooks/useAuth'
import { useNucleo } from '@/hooks/useNucleo'
import { getGenerationReport, subscribeAutosost, getAutosostAssignments, setAutosostAssignments as saveAutosostAssignments, type AutosostOperator, type AutosostAssignment } from '@/lib/firebase/firestore'
import type { Operator, MatriceMonth } from '@/lib/types'
import type { UncoveredSlot } from '@/lib/genera/nuovaMatrice'

const today = new Date()
const CURRENT_YEAR  = today.getFullYear()
const CURRENT_MONTH = today.getMonth() + 1

export default function MatricePage() {
  const { user } = useAuth()
  const [year, setYear]   = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(CURRENT_MONTH)
  const [showGenModal, setShowGenModal] = useState(false)
  const [showNuovaModal, setShowNuovaModal] = useState(false)
  const [showEccezioniModal, setShowEccezioniModal] = useState(false)
  const [showGenMenu, setShowGenMenu] = useState(false)
  const [uncovered, setUncovered] = useState<UncoveredSlot[]>([])
  const [autosostPool, setAutosostPool] = useState<AutosostOperator[]>([])
  const [autosostAssignments, setAutosostAssignments] = useState<AutosostAssignment[]>([])
  const [autosostError, setAutosostError] = useState<string | null>(null)
  const { allShiftTypes } = useNucleo(user?.nucleoId ?? 'nucleo-b')

  // Keep latest operators + matrice from the grid
  const operatorsRef = useRef<Operator[]>([])
  const matriceRef   = useRef<MatriceMonth>({})

  const genYearMonth = `${year}-${String(month).padStart(2, '0')}`
  useEffect(() => {
    const nid = user?.nucleoId ?? 'nucleo-b'
    let active = true
    getGenerationReport(nid, genYearMonth).then(r => { if (active) setUncovered(r.uncovered) })
    getAutosostAssignments(nid, genYearMonth).then(a => { if (active) setAutosostAssignments(a) })
    return () => { active = false }
  }, [user, genYearMonth, showNuovaModal])

  useEffect(() => subscribeAutosost(setAutosostPool), [])

  if (!user) return null

  const nucleoId = user.nucleoId ?? 'nucleo-b'
  const canGenerate = user.role === 'raa' || user.role === 'coordinatrice'

  // Slot ancora scoperti = scoperti dalla generazione meno le assegnazioni di autosostituzione
  const remainingSlots = uncovered.flatMap(u => {
    const assigned = autosostAssignments.filter(a => a.day === u.day && a.shift === u.shift).length
    const rem = Math.max(0, u.missing - assigned)
    return Array.from({ length: rem }, () => ({ day: u.day, shift: u.shift }))
  })

  async function handleAutosostAssign(day: number, shift: string, op: AutosostOperator) {
    // Un jolly non può coprire più di un turno lo stesso giorno NELLO STESSO nucleo
    // (può però coprire lo stesso turno in un altro nucleo — doc separato, non validato qui).
    if (autosostAssignments.some(a => a.day === day && a.autoOpId === op.id)) {
      setAutosostError(`${op.name} copre già un turno il giorno ${day} in questo nucleo.`)
      return
    }
    setAutosostError(null)
    const next = [...autosostAssignments, { day, shift, autoOpId: op.id, autoOpName: op.name }]
    setAutosostAssignments(next)
    await saveAutosostAssignments(nucleoId, genYearMonth, next)
  }

  async function handleAutosostUnassign(day: number, shift: string, autoOpId: string) {
    setAutosostError(null)
    let removed = false
    const next = autosostAssignments.filter(a => {
      if (!removed && a.day === day && a.shift === shift && a.autoOpId === autoOpId) { removed = true; return false }
      return true
    })
    setAutosostAssignments(next)
    await saveAutosostAssignments(nucleoId, genYearMonth, next)
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === CURRENT_YEAR && month === CURRENT_MONTH
  const label = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center gap-3">
        {/* Navigatore mese (controllo segmentato) */}
        <div className="inline-flex items-center rounded-lg border border-slate-200 overflow-hidden bg-white">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors text-lg leading-none"
            title="Mese precedente"
          >
            ‹
          </button>
          <h1 className="text-sm font-semibold text-slate-800 w-40 text-center capitalize border-x border-slate-200 py-1.5 select-none">
            {label}
          </h1>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors text-lg leading-none"
            title="Mese successivo"
          >
            ›
          </button>
        </div>

        {!isCurrentMonth && (
          <button
            onClick={() => { setYear(CURRENT_YEAR); setMonth(CURRENT_MONTH) }}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 transition-colors"
            title="Vai al mese corrente"
          >
            <span aria-hidden>↺</span> Oggi
          </button>
        )}

        {canGenerate && (
          <button
            onClick={() => setShowEccezioniModal(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span>📋</span><span>Eccezioni</span>
          </button>
        )}
        {canGenerate && (
          <div className="relative">
            <button
              onClick={() => setShowGenMenu(m => !m)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <span>⚡</span><span>Genera</span><span className="text-[10px]">▾</span>
            </button>
            {showGenMenu && (
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[200px]">
                <button
                  onClick={() => { setShowGenMenu(false); setShowGenModal(true) }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100"
                >
                  Genera mese <span className="text-slate-400">(cicli)</span>
                </button>
                <button
                  onClick={() => { setShowGenMenu(false); setShowNuovaModal(true) }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100"
                >
                  Genera nuova matrice <span className="text-slate-400">(da zero)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {remainingSlots.length > 0 && (
        <div className="mx-3 mt-2 border-2 border-red-400 bg-red-50 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-red-700">
            ⚠ {remainingSlots.length} turni scoperti da coprire (autosostituzione):
          </p>
          <p className="text-[11px] text-red-600 mt-0.5">
            {remainingSlots.slice(0, 12).map(s => `G${s.day} ${s.shift}`).join(' · ')}
            {remainingSlots.length > 12 ? ` … +${remainingSlots.length - 12}` : ''}
          </p>
        </div>
      )}

      {autosostError && (
        <div className="mx-3 mt-2 border border-red-300 bg-red-50 rounded-lg px-3 py-1.5 text-xs text-red-700">
          ⚠ {autosostError}
        </div>
      )}

      <MatriceGrid
        nucleoId={nucleoId}
        year={year}
        month={month}
        currentUser={user}
        uncovered={uncovered}
        autosostPool={autosostPool}
        autosostAssignments={autosostAssignments}
        onAutosostAssign={handleAutosostAssign}
        onAutosostUnassign={handleAutosostUnassign}
        onDataReady={(ops, mat) => {
          operatorsRef.current = ops
          matriceRef.current = mat
        }}
      />

      {showGenModal && (
        <GeneraMeseModal
          nucleoId={nucleoId}
          year={year}
          month={month}
          operators={operatorsRef.current}
          existingMatrice={matriceRef.current}
          currentUser={user}
          onClose={() => setShowGenModal(false)}
          onGenerated={() => setShowGenModal(false)}
        />
      )}

      {showNuovaModal && (
        <GeneraNuovaMatriceModal
          nucleoId={nucleoId}
          year={year}
          month={month}
          operators={operatorsRef.current}
          shiftCatalog={allShiftTypes}
          currentUser={user}
          onClose={() => setShowNuovaModal(false)}
          onGenerated={() => { /* il banner si aggiorna via effetto su showNuovaModal */ }}
        />
      )}

      {showEccezioniModal && (
        <EccezioniModal
          nucleoId={nucleoId}
          year={year}
          month={month}
          operators={operatorsRef.current}
          onClose={() => setShowEccezioniModal(false)}
        />
      )}
    </div>
  )
}
