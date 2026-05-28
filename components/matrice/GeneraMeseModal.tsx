'use client'
import { useState } from 'react'
import { generateFulltimeMonth, generateParttimeMonth, getDaysInMonth, nextMonthPhase } from '@/lib/cycle/cycleEngine'
import { bulkUpdateMatrice, updateOperatorCycle } from '@/lib/firebase/firestore'
import type { Operator, MatriceMonth, AppUser } from '@/lib/types'

interface GeneraMeseModalProps {
  nucleoId: string
  year: number
  month: number
  operators: Operator[]
  existingMatrice: MatriceMonth
  currentUser: AppUser
  onClose: () => void
  onGenerated: () => void
}

export function GeneraMeseModal({
  nucleoId, year, month, operators, existingMatrice, currentUser, onClose, onGenerated
}: GeneraMeseModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })

  const fulltimeOps = operators.filter(op =>
    (op.contractType === 'fulltime' || op.contractType === 'standard') &&
    op.cycle && op.cyclePhase !== undefined
  )
  const parttimeOps = operators.filter(op =>
    op.contractType === 'parttime' && op.weeklyPattern
  )
  const unconfigured = operators.filter(op =>
    ((op.contractType === 'fulltime' || op.contractType === 'standard') &&
     (!op.cycle || op.cyclePhase === undefined)) ||
    (op.contractType === 'parttime' && !op.weeklyPattern)
  )

  const totalConfigured = fulltimeOps.length + parttimeOps.length

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      // Build generated map { operatorId: { day: shiftCode } }
      const generated: Record<string, Record<number, string>> = {}

      for (const op of fulltimeOps) {
        generated[op.id] = generateFulltimeMonth(op, year, month)
      }
      for (const op of parttimeOps) {
        generated[op.id] = generateParttimeMonth(op, year, month)
      }

      // Write to Firestore (skips existing cells)
      await bulkUpdateMatrice(nucleoId, yearMonth, generated, existingMatrice)

      // Update next month's phase for fulltime operators
      const daysThisMonth = getDaysInMonth(year, month)
      const nextYear = month === 12 ? year + 1 : year
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYearMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}`

      for (const op of fulltimeOps) {
        const newPhase = nextMonthPhase(op.cyclePhase!, daysThisMonth)
        await updateOperatorCycle(nucleoId, op.id, op.cycle!, newPhase, nextYearMonth)
      }

      onGenerated()
      onClose()
    } catch (e) {
      setError('Errore durante la generazione. Riprova.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-1">Genera mese</h2>
        <p className="text-sm text-slate-500 mb-4 capitalize">{monthLabel}</p>

        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1 mb-4">
          <div className="flex justify-between">
            <span className="text-slate-600">Operatori full-time configurati</span>
            <span className="font-semibold text-slate-800">{fulltimeOps.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Operatori part-time configurati</span>
            <span className="font-semibold text-slate-800">{parttimeOps.length}</span>
          </div>
          {unconfigured.length > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Non configurati (saltati)</span>
              <span className="font-semibold">{unconfigured.length}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Le celle già compilate non verranno toccate. Potrai modificare manualmente le eccezioni (ferie, permessi, ecc.) dopo la generazione.
        </p>

        {error && (
          <p className="text-xs text-red-600 mb-3">{error}</p>
        )}

        {totalConfigured === 0 ? (
          <div className="text-sm text-amber-700 bg-amber-50 rounded p-3 mb-4">
            Nessun operatore configurato. Vai su <strong>Impostazioni → Cicli turni</strong> per configurare i cicli prima di generare.
          </div>
        ) : null}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || totalConfigured === 0}
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generazione...' : `Genera ${totalConfigured} operatori`}
          </button>
        </div>
      </div>
    </div>
  )
}
