'use client'
import { useState } from 'react'
import { updateOperatorCycle } from '@/lib/firebase/firestore'
import { DEFAULT_CYCLE } from '@/lib/types'
import type { Operator } from '@/lib/types'

const WORK_SHIFT_OPTIONS = ['M1', 'M2', 'MP', 'P1', 'P2']
const PHASE_LABELS = ['0 → R', '1 → M1', '2 → M2', '3 → P1', '4 → N1', '5 → N2']
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const ALL_SHIFT_OPTIONS = ['M1', 'M2', 'MP', 'P1', 'P2', 'R', 'N1', 'N2']

interface CicloOperatoreRowProps {
  operator: Operator
  nucleoId: string
  currentYearMonth: string
}

export function CicloOperatoreRow({ operator, nucleoId, currentYearMonth }: CicloOperatoreRowProps) {
  const isFulltime = operator.contractType === 'fulltime' || operator.contractType === 'standard'

  const [cycle, setCycle] = useState<string[]>(
    operator.cycle ?? [...DEFAULT_CYCLE]
  )
  const [phase, setPhase] = useState<number>(operator.cyclePhase ?? 0)
  const [weeklyPattern, setWeeklyPattern] = useState<string[]>(
    operator.weeklyPattern ?? ['R', 'R', 'R', 'R', 'R', 'R', 'R']
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      if (isFulltime) {
        await updateOperatorCycle(nucleoId, operator.id, cycle, phase, currentYearMonth)
      } else {
        await updateOperatorCycle(nucleoId, operator.id, weeklyPattern, 0, currentYearMonth)
        const { doc, setDoc } = await import('firebase/firestore')
        const { db } = await import('@/lib/firebase/config')
        await setDoc(
          doc(db, 'nuclei', nucleoId, 'operators', operator.id),
          { weeklyPattern, contractType: 'parttime' },
          { merge: true }
        )
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function updateCyclePos(pos: number, value: string) {
    setCycle(prev => prev.map((v, i) => i === pos ? value : v))
  }

  function updateWeekday(day: number, value: string) {
    setWeeklyPattern(prev => prev.map((v, i) => i === day ? value : v))
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="w-32 text-sm font-medium text-slate-700 truncate flex-shrink-0">
        {operator.name}
        {operator.hasFSCertification && <span className="ml-1 text-yellow-500 text-xs">★</span>}
      </div>

      <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
        isFulltime ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
      }`}>
        {isFulltime ? 'FT' : 'PT'}
      </div>

      {isFulltime ? (
        <>
          <select
            value={phase}
            onChange={e => setPhase(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white flex-shrink-0 w-28"
            title="Fase del ciclo il giorno 1 del mese"
          >
            {PHASE_LABELS.map((label, i) => (
              <option key={i} value={i}>{label}</option>
            ))}
          </select>

          {[1, 2, 3].map(pos => (
            <select
              key={pos}
              value={cycle[pos] ?? 'M1'}
              onChange={e => updateCyclePos(pos, e.target.value)}
              className="text-xs border border-slate-200 rounded px-1 py-1 bg-white w-16"
              title={`Posizione ${pos} del ciclo`}
            >
              {WORK_SHIFT_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ))}

          <div className="flex gap-0.5 flex-shrink-0" title="Anteprima ciclo">
            {['R', cycle[1], cycle[2], cycle[3], 'N1', 'N2'].map((code, i) => (
              <span key={i} className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                code === 'R'        ? 'bg-slate-200 text-slate-500' :
                code === 'N1' || code === 'N2' ? 'bg-blue-200 text-blue-700' :
                code?.startsWith('M') ? 'bg-yellow-100 text-yellow-700' :
                'bg-orange-100 text-orange-700'
              }`}>{code}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="flex gap-1">
          {DAY_LABELS.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-slate-400">{day}</span>
              <select
                value={weeklyPattern[i] ?? 'R'}
                onChange={e => updateWeekday(i, e.target.value)}
                className="text-[10px] border border-slate-200 rounded px-0.5 py-0.5 bg-white w-12"
              >
                {ALL_SHIFT_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className={`ml-auto text-xs px-2 py-1 rounded transition-colors flex-shrink-0 ${
          saved
            ? 'bg-green-100 text-green-700'
            : 'bg-slate-900 text-white hover:bg-slate-700'
        }`}
      >
        {saving ? '...' : saved ? '✓ Salvato' : 'Salva'}
      </button>
    </div>
  )
}
