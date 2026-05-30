'use client'
import { useState, useEffect } from 'react'
import { getExceptions, setExceptions } from '@/lib/firebase/firestore'
import type { ExceptionRange } from '@/lib/genera/nuovaMatrice'
import type { Operator } from '@/lib/types'

interface Props {
  nucleoId: string
  year: number
  month: number
  operators: Operator[]
  onClose: () => void
}

const EXCEPTION_TYPES = ['F', '104', 'ML', 'CO', 'PE']
const EXCEPTION_LABELS: Record<string, string> = {
  F: 'Ferie', '104': 'Legge 104', ML: 'Malattia', CO: 'Congedo', PE: 'Permesso',
}

export function EccezioniModal({ nucleoId, year, month, operators, onClose }: Props) {
  const [items, setItems] = useState<ExceptionRange[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const monthLabel = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(year, month, 0).getDate()
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`

  useEffect(() => {
    let active = true
    getExceptions(nucleoId, yearMonth).then(loaded => { if (active) { setItems(loaded); setLoading(false) } })
    return () => { active = false }
  }, [nucleoId, yearMonth])

  function add() {
    if (operators.length === 0) return
    setItems(prev => [...prev, { operatorId: operators[0].id, code: 'F', fromDay: 1, toDay: 1 }])
  }
  function update(i: number, patch: Partial<ExceptionRange>) {
    setItems(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  }
  function remove(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const normalized = items.map(e => ({
        operatorId: e.operatorId, code: e.code,
        fromDay: Math.min(e.fromDay, e.toDay), toDay: Math.max(e.fromDay, e.toDay),
      }))
      await setExceptions(nucleoId, yearMonth, normalized)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-auto">
        <h2 className="text-base font-bold text-slate-900 mb-1">Eccezioni del mese</h2>
        <p className="text-sm text-slate-500 mb-4 capitalize">{monthLabel}</p>

        {loading ? (
          <p className="text-sm text-slate-400">Caricamento...</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">
                Ferie / 104 / malattia / congedo / permessi
              </h3>
              <button
                onClick={add}
                disabled={operators.length === 0}
                title={operators.length === 0 ? 'Aggiungi prima degli operatori' : 'Aggiungi eccezione'}
                className="text-xs text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline disabled:cursor-not-allowed"
              >
                + Aggiungi
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {operators.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                  Nessun operatore nel nucleo. Aggiungi prima gli operatori (sezione <strong>Operatori</strong>): le eccezioni si assegnano a un operatore.
                </p>
              ) : items.length === 0 && (
                <p className="text-xs text-slate-400">Nessuna eccezione salvata per questo mese.</p>
              )}
              {items.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <select
                    value={e.operatorId}
                    onChange={ev => update(i, { operatorId: ev.target.value })}
                    className="flex-1 border border-slate-200 rounded px-1.5 py-1"
                  >
                    {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <select
                    value={e.code}
                    onChange={ev => update(i, { code: ev.target.value })}
                    className="border border-slate-200 rounded px-1.5 py-1"
                  >
                    {EXCEPTION_TYPES.map(c => <option key={c} value={c}>{EXCEPTION_LABELS[c]}</option>)}
                  </select>
                  <input type="number" min={1} max={daysInMonth} value={e.fromDay}
                    onChange={ev => update(i, { fromDay: Number(ev.target.value) })}
                    className="w-12 border border-slate-200 rounded px-1 py-1" title="Dal giorno" />
                  <input type="number" min={1} max={daysInMonth} value={e.toDay}
                    onChange={ev => update(i, { toDay: Number(ev.target.value) })}
                    className="w-12 border border-slate-200 rounded px-1 py-1" title="Al giorno" />
                  <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} disabled={saving}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annulla</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva eccezioni'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
