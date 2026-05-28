'use client'
import { useState, useEffect } from 'react'
import { updateOperator } from '@/lib/firebase/firestore'
import type { ContractType, Operator } from '@/lib/types'

interface EditaOperatoreModalProps {
  operator: Operator
  nucleoId: string
  onClose: () => void
  onSaved: () => void
}

export function EditaOperatoreModal({
  operator, nucleoId, onClose, onSaved,
}: EditaOperatoreModalProps) {
  const [name, setName] = useState(operator.name)
  const [contractType, setContractType] = useState<ContractType>(
    operator.contractType === 'standard' ? 'fulltime' : operator.contractType as ContractType
  )
  const [hasFSCertification, setHasFSCertification] = useState(
    operator.hasFSCertification ?? false
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [loading, onClose])

  // Focus trap
  useEffect(() => {
    const modal = document.getElementById('edita-operatore-modal')
    if (!modal) return
    const focusableSelectors = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const focusable = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelectors))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    modal.addEventListener('keydown', handleTab)
    return () => modal.removeEventListener('keydown', handleTab)
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await updateOperator(nucleoId, operator.id, {
        name: name.trim(),
        contractType,
        hasFSCertification,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive() {
    setLoading(true)
    setError(null)
    try {
      await updateOperator(nucleoId, operator.id, { active: !operator.active })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div
        id="edita-operatore-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edita-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
      >
        <h2 id="edita-modal-title" className="text-base font-bold text-slate-900 mb-4">
          Modifica operatore
        </h2>

        <form onSubmit={handleSave} className="space-y-3">
          {/* Nome */}
          <div>
            <label htmlFor="edit-name" className="block text-xs font-medium text-slate-700 mb-1">
              Nome completo *
            </label>
            <input
              id="edit-name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Tipo contratto */}
          <div>
            <label htmlFor="edit-contract" className="block text-xs font-medium text-slate-700 mb-1">
              Tipo contratto *
            </label>
            <select
              id="edit-contract"
              value={contractType}
              onChange={e => setContractType(e.target.value as ContractType)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="fulltime">Full-time</option>
              <option value="parttime">Part-time</option>
            </select>
          </div>

          {/* Certificazione antincendio */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-fsCert"
              checked={hasFSCertification}
              onChange={e => setHasFSCertification(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-blue-600"
            />
            <label htmlFor="edit-fsCert" className="text-xs text-slate-700">
              Certificazione antincendio ★
            </label>
          </div>

          {/* Email — read-only info */}
          <div className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-100 text-slate-500">
            L&apos;email di accesso non è modificabile da qui.
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-between pt-2">
            {/* Disattiva / Riattiva */}
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={loading}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                operator.active
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              {operator.active ? 'Disattiva' : 'Riattiva'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
