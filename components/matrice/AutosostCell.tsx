'use client'
import { useState } from 'react'
import type { AutosostOperator, AutosostAssignment } from '@/lib/firebase/firestore'

interface Props {
  day: number
  uncoveredShifts: string[]              // shift codes ancora scoperti (dopo le assegnazioni)
  assignments: AutosostAssignment[]      // assegnazioni di autosostituzione di questo giorno
  pool: AutosostOperator[]
  editable: boolean
  onAssign: (day: number, shift: string, op: AutosostOperator) => void
  onUnassign: (day: number, shift: string, autoOpId: string) => void
}

export function AutosostCell({ day, uncoveredShifts, assignments, pool, editable, onAssign, onUnassign }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  if (uncoveredShifts.length === 0 && assignments.length === 0) {
    return <div className="h-9" />
  }

  return (
    <div className="h-9 flex flex-col items-center justify-center gap-0.5 relative py-0.5">
      {assignments.map((a, i) => (
        <button
          key={`a${i}`}
          disabled={!editable}
          onClick={() => onUnassign(day, a.shift, a.autoOpId)}
          title={`${a.shift} — ${a.autoOpName} (clicca per rimuovere)`}
          className="text-[8px] leading-none px-1 py-0.5 rounded bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
        >
          {a.shift}:{a.autoOpName.split(' ')[0]}
        </button>
      ))}

      {uncoveredShifts.map((shift, i) => (
        <div key={`u${i}`} className="relative">
          <button
            disabled={!editable}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            title={`Scoperto: ${shift}`}
            className="text-[9px] leading-none font-bold text-red-600 border-2 border-red-500 rounded px-1 py-0.5 hover:bg-red-50 disabled:opacity-60"
          >
            {shift}
          </button>
          {openIdx === i && (
            <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[150px]">
              <p className="text-[10px] text-slate-500 mb-1">Copri <strong>{shift}</strong> con:</p>
              {pool.length === 0 ? (
                <p className="text-[10px] text-slate-400">Nessun operatore di autosostituzione. Aggiungili in Operatori.</p>
              ) : (
                <select
                  autoFocus
                  defaultValue=""
                  onChange={(e) => {
                    const op = pool.find(p => p.id === e.target.value)
                    if (op) { onAssign(day, shift, op); setOpenIdx(null) }
                  }}
                  className="w-full text-xs border border-slate-200 rounded px-1 py-1"
                >
                  <option value="" disabled>Seleziona…</option>
                  {pool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
