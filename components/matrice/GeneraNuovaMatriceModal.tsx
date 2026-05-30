'use client'
import { useState, useEffect } from 'react'
import { generateNuovaMatrice, type ExceptionRange, type GenerationReport } from '@/lib/genera/nuovaMatrice'
import { ptMonthSchedule } from '@/lib/genera/ptSchedule'
import { overwriteMatriceMonth, saveGenerationReport, resolvePtPhases, getExceptions, getMatriceMonth } from '@/lib/firebase/firestore'
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

export function GeneraNuovaMatriceModal({
  nucleoId, year, month, operators, shiftCatalog, currentUser, onClose, onGenerated,
}: Props) {
  const [savedExceptions, setSavedExceptions] = useState<ExceptionRange[]>([])
  const [loadingEx, setLoadingEx] = useState(true)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<GenerationReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<{ cells: number; overrides: number }>({ cells: 0, overrides: 0 })
  const [confirmed, setConfirmed] = useState(false)

  const monthLabel = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`

  useEffect(() => {
    let active = true
    getExceptions(nucleoId, yearMonth).then(ex => { if (active) { setSavedExceptions(ex); setLoadingEx(false) } })
    getMatriceMonth(nucleoId, yearMonth).then(m => {
      if (!active) return
      let cells = 0, overrides = 0
      for (const days of Object.values(m)) {
        for (const entry of Object.values(days)) {
          cells++
          if (entry.isManualOverride) overrides++
        }
      }
      setExisting({ cells, overrides })
    })
    return () => { active = false }
  }, [nucleoId, yearMonth])

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const ranges = savedExceptions

      // Orario fisso dei part-time: fasi risolte/persistite + ptFixed (con eccezioni PT sovrapposte)
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

      // Continuità legale: leggi l'ultimo giorno del mese precedente per ogni operatore
      const prevYear = month === 1 ? year - 1 : year
      const prevMonth = month === 1 ? 12 : month - 1
      const prevDays = new Date(prevYear, prevMonth, 0).getDate()
      const prevMatrice = await getMatriceMonth(nucleoId, `${prevYear}-${String(prevMonth).padStart(2, '0')}`)
      const prevLastByOp: Record<string, string> = {}
      for (const op of operators) {
        const code = prevMatrice[op.id]?.[prevDays]?.code
        if (code) prevLastByOp[op.id] = code
      }

      const { matrice, report } = generateNuovaMatrice({
        operators: operators.map(o => ({ id: o.id, contractType: o.contractType })),
        year, month, exceptions: ranges, shiftCatalog, ptFixed, prevLastByOp,
      })
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[85vh] overflow-auto">
        <h2 className="text-base font-bold text-slate-900 mb-1">Genera nuova matrice</h2>
        <p className="text-sm text-slate-500 mb-4 capitalize">{monthLabel}</p>

        {report === null ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
              Questo <strong>sovrascrive l&apos;intero mese</strong> da zero, ignorando i mesi precedenti.
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 mb-4">
              {loadingEx
                ? 'Caricamento eccezioni...'
                : <>Userà <strong>{savedExceptions.length}</strong> eccezioni salvate per questo mese. Modificale con il pulsante <strong>&quot;Eccezioni&quot;</strong>.</>}
            </div>

            {existing.cells > 0 && (
              <label className="flex items-start gap-2 border-2 border-red-300 bg-red-50 rounded-lg p-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-red-600 flex-shrink-0"
                />
                <span className="text-xs text-red-700">
                  Confermo la sovrascrittura dell&apos;intero mese.
                  {existing.overrides > 0 && (
                    <> <strong>Perderai {existing.overrides} modifiche manuali</strong> fatte a mano.</>
                  )}
                </span>
              </label>
            )}

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} disabled={loading}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annulla</button>
              <button onClick={handleGenerate} disabled={loading || loadingEx || (existing.cells > 0 && !confirmed)}
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
