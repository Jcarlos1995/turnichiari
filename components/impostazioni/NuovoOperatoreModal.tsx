'use client'
import { useState, useEffect } from 'react'
import { createOperator, listNuclei } from '@/lib/firebase/firestore'
import { generateUsername } from '@/lib/utils/username'
import type { AppUser, ContractType, Nucleo } from '@/lib/types'

interface NuovoOperatoreModalProps {
  nucleoId: string      // pre-filled for RAA; Coordinatrice overrides via dropdown
  currentUser: AppUser
  onClose: () => void
  onCreated: () => void
}

export function NuovoOperatoreModal({
  nucleoId, currentUser, onClose, onCreated,
}: NuovoOperatoreModalProps) {
  const [cognome, setCognome] = useState('')
  const [nome, setNome] = useState('')
  const [contractType, setContractType] = useState<ContractType>('fulltime')
  const [selectedNucleoId, setSelectedNucleoId] = useState(nucleoId)
  const [hasFSCertification, setHasFSCertification] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuclei, setNuclei] = useState<Nucleo[]>([])

  const isCoordinatrice = currentUser.role === 'coordinatrice'

  // Fetch nucleo list for coordinatrice dropdown
  useEffect(() => {
    if (isCoordinatrice) {
      listNuclei().then(setNuclei).catch(() => {
        // silently fall back to raw nucleoId if fetch fails
      })
    }
  }, [isCoordinatrice])

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [loading, onClose])

  // Live username preview (updates as user types)
  const username = cognome.trim() && nome.trim()
    ? generateUsername(nome.trim(), cognome.trim())
    : ''
  const previewEmail = username ? `${username}@turnichiari.it` : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cognome.trim() || !nome.trim()) return
    setLoading(true)
    setError(null)
    try {
      await createOperator(selectedNucleoId, {
        nome: nome.trim(),
        cognome: cognome.trim(),
        contractType,
        hasFSCertification,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la registrazione.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 id="modal-title" className="text-base font-bold text-slate-900 mb-4">Nuovo operatore</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Cognome */}
          <div>
            <label htmlFor="cognome" className="block text-xs font-medium text-slate-700 mb-1">Cognome *</label>
            <input
              id="cognome"
              value={cognome}
              onChange={e => setCognome(e.target.value)}
              required
              autoFocus
              placeholder="es. Rossi"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Nome */}
          <div>
            <label htmlFor="nome" className="block text-xs font-medium text-slate-700 mb-1">Nome *</label>
            <input
              id="nome"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              placeholder="es. Mario"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Tipo contratto */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tipo contratto *</label>
            <select
              value={contractType}
              onChange={e => setContractType(e.target.value as ContractType)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="fulltime">Full-time</option>
              <option value="parttime">Part-time</option>
            </select>
          </div>

          {/* Nucleo — only for Coordinatrice */}
          {isCoordinatrice && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nucleo *</label>
              <select
                value={selectedNucleoId}
                onChange={e => setSelectedNucleoId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {nuclei.length === 0 && (
                  <option value={nucleoId}>{nucleoId}</option>
                )}
                {nuclei.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Certificazione antincendio */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="fsCert"
              checked={hasFSCertification}
              onChange={e => setHasFSCertification(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-blue-600"
            />
            <label htmlFor="fsCert" className="text-xs text-slate-700">
              Certificazione antincendio ★
            </label>
          </div>

          {/* Live preview */}
          {username && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Username</span>
                <span className="font-mono font-semibold text-slate-800">{username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="font-mono text-slate-700">{previewEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Password iniziale</span>
                <span className="font-mono text-slate-700">{username}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
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
              disabled={loading || !cognome.trim() || !nome.trim()}
              className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Registrazione...' : 'Registra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
