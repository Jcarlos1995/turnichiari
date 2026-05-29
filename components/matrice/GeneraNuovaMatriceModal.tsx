'use client'
import { useState } from 'react'
import { generateNuovaMatrice, type ExceptionRange, type GenerationReport } from '@/lib/genera/nuovaMatrice'
import { ptMonthSchedule } from '@/lib/genera/ptSchedule'
import { overwriteMatriceMonth, saveGenerationReport, resolvePtPhases } from '@/lib/firebase/firestore'
import type { Operator, ShiftType, AppUser } from '@/lib/types'

interface Props {
  nucleoId: string
  year: number
  month: number
  operators: Operator[]
  shiftCatalog: ShiftType[]
  currentUser: AppUser
  onClose: () => void
  onGenerated: () => void
}

const EXCEPTION_TYPES = ['F', '104', 'ML', 'CO', 'PE']
const EXCEPTION_LABELS: Record<string, string> = {
  F: 'Ferie', '104': 'Legge 104', ML: 'Malattia', CO: 'Congedo', PE: 'Permesso',
}

interface DraftException { operatorId: string; code: string; fromDay: number; toDay: number }

export function GeneraNuovaMatriceModal({
  nucleoId, year, month, operators, shiftCatalog, currentUser, onClose, onGenerated,
}: Props) {
  const [exceptions, setExceptions] = useState<DraftException[]>([])
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<GenerationReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const monthLabel = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(year, month, 0).getDate()

  function addException() {
    if (operators.length === 0) return
    setExceptions(prev => [...prev, { operatorId: operators[0].id, code: 'F', fromDay: 1, toDay: 1 }])
  }
  function updateException(i: number, patch: Partial<DraftException>) {
    setExceptions(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  }
  function removeException(i: number) {
    setExceptions(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const ranges: ExceptionRange[] = exceptions.map(e => ({
        operatorId: e.operatorId, code: e.code,
        fromDay: Math.min(e.fromDay, e.toDay), toDay: Math.max(e.fromDay, e.toDay),
      }))

      // Orario fisso dei part-time: risolvi le fasi (continuità/random, persistito) e
      // costruisci ptFixed (pattern + eventuali eccezioni del PT sovrapposte).
      const ptOps = operators.filter(o => o.contractType === 'parttime')
      const phases = await resolvePtPhases(nucleoId, year, month, ptOps.map(o => o.id))
      const ptFixed: Record<string, Record<number, string>> = {}
      for (const op of ptOps) {
        const sched = ptMonthSchedule(year, month, phases[op.id] ?? 'A')
        for (const r of ranges.filter(x => x.operatorId === op.id)) {
          for (let d = r.fromDay; d <= r.toDay; d++) sched[d] = r.code
        }
        ptFixed[op.id] = sched
      }

      const { matrice, report } = generateNuovaMatrice({
        operators: operators.map(o => ({ id: o.id, contractType: o.contractType })),
        year, month, exceptions: ranges, shiftCatalog, ptFixed,
      })
      const yearMonth = `${year}-${String(month).padStart(2, '0')}`
      await overwriteMatriceMonth(nucleoId, yearMonth, matrice, currentUser.uid)
      await saveGenerationReport(nucleoId, yearMonth, report)
      setReport(report)
      onGenerated()
    } catch (e) {
      console.error(e)
      setError('Errore durante la generazione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-auto">
        <h2 className="text-base font-bold text-slate-900 mb-1">Genera nuova matrice</h2>
        <p className="text-sm text-slate-500 mb-4 capitalize">{monthLabel}</p>

        {report === null ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
              Questo <strong>sovrascrive l&apos;intero mese</strong> da zero, ignorando i mesi precedenti.
            </div>

            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Eccezioni</h3>
              <button onClick={addException} className="text-xs text-blue-600 hover:underline">+ Aggiungi</button>
            </div>

            <div className="space-y-2 mb-4">
              {exceptions.length === 0 && (
                <p className="text-xs text-slate-400">Nessuna eccezione. Aggiungi ferie, 104, malattia, ecc.</p>
              )}
              {exceptions.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <select
                    value={e.operatorId}
                    onChange={ev => updateException(i, { operatorId: ev.target.value })}
                    className="flex-1 border border-slate-200 rounded px-1.5 py-1"
                  >
                    {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <select
                    value={e.code}
                    onChange={ev => updateException(i, { code: ev.target.value })}
                    className="border border-slate-200 rounded px-1.5 py-1"
                  >
                    {EXCEPTION_TYPES.map(c => <option key={c} value={c}>{EXCEPTION_LABELS[c]}</option>)}
                  </select>
                  <input type="number" min={1} max={daysInMonth} value={e.fromDay}
                    onChange={ev => updateException(i, { fromDay: Number(ev.target.value) })}
                    className="w-12 border border-slate-200 rounded px-1 py-1" title="Dal giorno" />
                  <input type="number" min={1} max={daysInMonth} value={e.toDay}
                    onChange={ev => updateException(i, { toDay: Number(ev.target.value) })}
                    className="w-12 border border-slate-200 rounded px-1 py-1" title="Al giorno" />
                  <button onClick={() => removeException(i)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} disabled={loading}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annulla</button>
              <button onClick={handleGenerate} disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {loading ? 'Generazione...' : 'Genera'}
              </button>
            </div>
          </>
        ) : (
          <>
            {report.uncovered.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-4">
                ✓ Matrice generata. Tutti i turni sono coperti.
              </div>
            ) : (
              <div className="border-2 border-red-400 bg-red-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-red-700 mb-1">
                  ⚠ {report.uncovered.length} turni da coprire manualmente (autosostituzione):
                </p>
                <ul className="text-xs text-red-600 space-y-0.5 max-h-40 overflow-auto">
                  {report.uncovered.map((u, i) => (
                    <li key={i}>Giorno {u.day} — {u.shift} (mancano {u.missing})</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onClose}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700">Chiudi</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
