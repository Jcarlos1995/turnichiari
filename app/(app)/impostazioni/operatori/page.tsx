'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { subscribeOperators } from '@/lib/firebase/firestore'
import { NuovoOperatoreModal } from '@/components/impostazioni/NuovoOperatoreModal'
import { EditaOperatoreModal } from '@/components/impostazioni/EditaOperatoreModal'
import type { Operator } from '@/lib/types'

export default function OperatoriPage() {
  const { user } = useAuth()
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuovoModal, setShowNuovoModal] = useState(false)
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null)

  const nucleoId = user?.nucleoId

  useEffect(() => {
    if (!user || user.role === 'oss' || !nucleoId) return
    setLoading(true)
    const unsub = subscribeOperators(nucleoId, ops => {
      setOperators(ops)
      setLoading(false)
    }, true)
    return unsub
  }, [nucleoId, user])

  if (!user || user.role === 'oss') {
    return <div className="p-6 text-sm text-slate-500">Accesso non autorizzato.</div>
  }

  if (!nucleoId) {
    return <div className="p-6 text-sm text-slate-500">Seleziona un nucleo dalla matrice per gestire gli operatori.</div>
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Caricamento...</div>
  }

  const activeCount = operators.filter(op => op.active !== false).length

  return (
    <div className="flex-1 overflow-auto p-6 max-w-3xl">
      {/* Back link */}
      <Link
        href="/matrice"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
      >
        ← Matrice
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Operatori</h1>
          <p className="text-sm text-slate-500">
            {activeCount} attivi · {operators.length} totali
          </p>
        </div>
        <button
          onClick={() => setShowNuovoModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          <span>＋</span>
          <span>Nuovo operatore</span>
        </button>
      </div>

      {/* Operators list */}
      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {operators.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Nessun operatore. Usa &quot;Nuovo operatore&quot; per aggiungere il primo.
          </p>
        ) : (
          operators.map(op => {
            const isInactive = op.active === false
            return (
              <div key={op.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`flex-1 text-sm font-medium ${isInactive ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {op.name}
                  {op.hasFSCertification && (
                    <span className="ml-1 text-yellow-500 text-xs">★</span>
                  )}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  op.contractType === 'parttime'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {op.contractType === 'parttime' ? 'PT' : 'FT'}
                </span>
                {isInactive ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-500">
                    Inattivo
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700">
                    Attivo
                  </span>
                )}
                <button
                  onClick={() => setEditingOperator(op)}
                  title="Modifica operatore"
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                >
                  ✏️
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Nuovo operatore modal */}
      {showNuovoModal && user && nucleoId && (
        <NuovoOperatoreModal
          nucleoId={nucleoId}
          currentUser={user}
          onClose={() => setShowNuovoModal(false)}
          onCreated={() => setShowNuovoModal(false)}
        />
      )}

      {/* Edita operatore modal */}
      {editingOperator && nucleoId && (
        <EditaOperatoreModal
          operator={editingOperator}
          nucleoId={nucleoId}
          onClose={() => setEditingOperator(null)}
          onSaved={() => setEditingOperator(null)}
        />
      )}
    </div>
  )
}
