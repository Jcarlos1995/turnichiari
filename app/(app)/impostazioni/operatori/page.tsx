'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { subscribeOperators, subscribeAutosost, removeAutosost, subscribeRaaList, type AutosostOperator, type RaaUser } from '@/lib/firebase/firestore'
import { NuovoOperatoreModal } from '@/components/impostazioni/NuovoOperatoreModal'
import { EditaOperatoreModal } from '@/components/impostazioni/EditaOperatoreModal'
import type { Operator } from '@/lib/types'

export default function OperatoriPage() {
  const { user } = useAuth()
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuovoModal, setShowNuovoModal] = useState(false)
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null)
  const [autosost, setAutosost] = useState<AutosostOperator[]>([])
  const [showAutoModal, setShowAutoModal] = useState(false)
  const [raaList, setRaaList] = useState<RaaUser[]>([])
  const isCoordinatrice = user?.role === 'coordinatrice'

  // Il coordinatore non ha un nucleo proprio: default a nucleo-b per gestire gli operatori
  const nucleoId = user?.nucleoId ?? 'nucleo-b'

  useEffect(() => {
    if (!user || user.role === 'oss' || !nucleoId) return
    setLoading(true)
    const unsub = subscribeOperators(nucleoId, ops => {
      setOperators(ops)
      setLoading(false)
    }, true)
    return unsub
  }, [nucleoId, user])

  useEffect(() => {
    if (!user || user.role === 'oss') return
    return subscribeAutosost(setAutosost)
  }, [user])

  useEffect(() => {
    if (!isCoordinatrice) return
    return subscribeRaaList(setRaaList)
  }, [isCoordinatrice])

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
    <div className="flex-1 overflow-auto p-6">
      {/* Back link */}
      <Link
        href="/matrice"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
      >
        ← Matrice
      </Link>

      <div className={`grid grid-cols-1 gap-6 items-start ${isCoordinatrice ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
      <div className="min-w-0">
      {/* Header */}
      <h2 className="text-base font-bold text-slate-900">Operatori</h2>
      <p className="text-sm text-slate-500 mb-3 min-h-[2.5rem]">
        {activeCount} attivi · {operators.length} totali
      </p>
      <button
        onClick={() => setShowNuovoModal(true)}
        className="mb-3 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
      >
        <span>＋</span>
        <span>Nuovo operatore</span>
      </button>

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
      </div>

      {/* Autosostituzione pool (condiviso tra le 3 RAA) — colonna destra */}
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900">Autosostituzione</h2>
        <p className="text-sm text-slate-500 mb-3 min-h-[2.5rem]">
          Operatori jolly condivisi tra i nuclei per coprire i turni scoperti.
        </p>
        <button
          onClick={() => setShowAutoModal(true)}
          className="w-full mb-3 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          <span>＋</span>
          <span>Nuovo operatore auto</span>
        </button>
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {autosost.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nessun operatore di autosostituzione.</p>
          ) : (
            autosost.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm font-medium text-slate-800">{a.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pink-100 text-pink-700">AUTO</span>
                <button
                  onClick={() => removeAutosost(a.id)}
                  title="Rimuovi"
                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Colonna RAA — solo per la Coordinatrice */}
      {isCoordinatrice && (
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">RAA</h2>
          <p className="text-sm text-slate-500 mb-3 min-h-[2.5rem]">
            Responsabili di nucleo. Creale con &quot;Nuovo operatore&quot; → Ruolo: RAA.
          </p>
          <div className="h-9 mb-3" aria-hidden />
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {raaList.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nessuna RAA registrata.</p>
            ) : (
              raaList.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-sm font-medium text-slate-800 truncate">{r.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-100 text-indigo-700">
                    {r.nucleoId ? `Nucleo ${r.nucleoId.split('-')[1]?.toUpperCase() ?? ''}` : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
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

      {/* Nuovo operatore AUTO modal (checkbox pre-marcato) */}
      {showAutoModal && user && nucleoId && (
        <NuovoOperatoreModal
          nucleoId={nucleoId}
          currentUser={user}
          defaultAutosostituzione
          onClose={() => setShowAutoModal(false)}
          onCreated={() => setShowAutoModal(false)}
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
