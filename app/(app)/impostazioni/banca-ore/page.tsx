'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useMatrice } from '@/hooks/useMatrice'
import { useNucleo } from '@/hooks/useNucleo'
import { hoursByCode } from '@/lib/shifts/shiftHours'
import { computeBancaOre } from '@/lib/bancaore/bancaOre'
import { getBancaOreMonth, setBancaOreEntry, type BancaOreMonthDoc } from '@/lib/firebase/firestore'

const today = new Date()
const YEAR = today.getFullYear()
const MONTH = today.getMonth() + 1
const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`
const CURRENT_YM = ym(YEAR, MONTH)
const PREV_YM = MONTH === 1 ? ym(YEAR - 1, 12) : ym(YEAR, MONTH - 1)

export default function BancaOrePage() {
  const { user } = useAuth()
  const nucleoId = user?.nucleoId ?? 'nucleo-b' // segue il pattern della pagina cicli
  const { matrice, operators, loading } = useMatrice(nucleoId, CURRENT_YM)
  const { allShiftTypes } = useNucleo(nucleoId)

  const [carryIn, setCarryIn] = useState<Record<string, number>>({})
  const [manualAdjust, setManualAdjust] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!nucleoId) return
    let active = true
    Promise.all([getBancaOreMonth(nucleoId, PREV_YM), getBancaOreMonth(nucleoId, CURRENT_YM)])
      .then(([prev, curr]: [BancaOreMonthDoc, BancaOreMonthDoc]) => {
        if (!active) return
        const ci: Record<string, number> = {}
        const ma: Record<string, number> = {}
        for (const [id, e] of Object.entries(prev)) ci[id] = e.closing ?? 0
        for (const [id, e] of Object.entries(curr)) ma[id] = e.manualAdjust ?? 0
        setCarryIn(ci)
        setManualAdjust(ma)
      })
    return () => { active = false }
  }, [nucleoId])

  const hours = useMemo(() => hoursByCode(allShiftTypes), [allShiftTypes])

  const rows = useMemo(() => {
    return operators.map(op => {
      const operatorDays: Record<number, string> = {}
      const data = matrice[op.id] ?? {}
      for (const [d, entry] of Object.entries(data)) operatorDays[Number(d)] = entry.code
      const result = computeBancaOre({
        contractType: op.contractType,
        operatorDays,
        year: YEAR,
        month: MONTH,
        carryIn: carryIn[op.id] ?? 0,
        manualAdjust: manualAdjust[op.id] ?? 0,
        hoursByCode: hours,
      })
      return { op, result }
    })
  }, [operators, matrice, hours, carryIn, manualAdjust])

  async function handleSave() {
    if (!nucleoId) return
    setSaving(true)
    try {
      for (const { op, result } of rows) {
        await setBancaOreEntry(nucleoId, CURRENT_YM, op.id, {
          manualAdjust: manualAdjust[op.id] ?? 0,
          closing: result.closing,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!user || user.role === 'oss') {
    return <div className="p-6 text-sm text-slate-500">Accesso non autorizzato.</div>
  }
  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Caricamento...</div>
  }

  const monthLabel = new Date(YEAR, MONTH - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })

  return (
    <div className="flex-1 overflow-auto p-6 max-w-4xl">
      <Link href="/matrice" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4">
        ← Matrice
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Banca ore</h1>
          <p className="text-sm text-slate-500 capitalize">{monthLabel}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvataggio...' : 'Salva saldi'}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Operatore</th>
              <th className="text-right font-semibold px-3 py-2">Iniziale</th>
              <th className="text-right font-semibold px-3 py-2">Maturato</th>
              <th className="text-right font-semibold px-3 py-2">Usato</th>
              <th className="text-right font-semibold px-3 py-2">Rettifica</th>
              <th className="text-right font-semibold px-3 py-2">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ op, result }) => {
              const matured = result.accrualFestivo + result.accrualStraord
              return (
                <tr key={op.id}>
                  <td className="px-3 py-2 text-slate-800">
                    {op.name}
                    <span className="ml-1 text-[10px] text-slate-400">
                      {op.contractType === 'parttime' ? 'PT' : 'FT'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">{(carryIn[op.id] ?? 0).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-green-600">+{matured.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-red-500">-{result.usage.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.5"
                      value={manualAdjust[op.id] ?? 0}
                      onChange={e => setManualAdjust(prev => ({ ...prev, [op.id]: Number(e.target.value) }))}
                      className="w-16 text-right text-sm border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${result.closing < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {result.closing.toFixed(1)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Saldo in ore. Maturato = festivi/domeniche lavorati + straordinario settimanale.
        Usato = celle BO (full-time) / RC (part-time). Premi &quot;Salva saldi&quot; per registrare il riporto al mese successivo.
      </p>
    </div>
  )
}
