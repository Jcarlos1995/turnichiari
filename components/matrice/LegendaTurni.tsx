'use client'
import { useState } from 'react'
import type { ShiftType } from '@/lib/types'

const EXCEPTION_CODES = ['F', 'ML', 'PE', '104', 'CO', 'INF', 'LU', 'AS']

export function LegendaTurni({ shiftTypes }: { shiftTypes: ShiftType[] }) {
  const [open, setOpen] = useState(false)

  // Turni di lavoro prima (con orario), poi assenze/sistema
  const work = shiftTypes.filter(s => !s.isSystem)
  const system = shiftTypes.filter(s => s.isSystem)
  const ordered = [...work, ...system]

  return (
    <div className="px-4 pt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        aria-expanded={open}
      >
        <span>🎨</span>
        <span>Legenda turni</span>
        <span className="text-[10px]">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 bg-white border border-slate-200 rounded-lg p-3">
          {ordered.map(s => {
            const isException = EXCEPTION_CODES.includes(s.code)
            const hours = s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : null
            return (
              <div key={s.code} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="inline-block w-4 h-4 rounded border border-black/10 flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className={`font-bold ${isException ? 'text-red-600' : 'text-slate-800'}`}>{s.code}</span>
                <span className="text-slate-500">{s.label}</span>
                {hours && <span className="text-slate-400">{hours}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
