'use client'
import { useState } from 'react'
import type { ShiftType, MatriceDayEntry, ContractType } from '@/lib/types'
import type { LegalViolation } from '@/lib/validation/legal'
import { NIGHT } from '@/lib/shifts/nightShift'

interface CellDropdownProps {
  currentCode?: string          // current cell code (before this selection)
  shiftTypes: ShiftType[]
  violations: Record<string, LegalViolation[]>
  onSelect: (entry: MatriceDayEntry) => void
  onSelectNight?: (isOverride: boolean) => void
  contractType?: ContractType
  onClose: () => void
}

export function CellDropdown({ currentCode, shiftTypes, violations, onSelect, onSelectNight, contractType, onClose }: CellDropdownProps) {
  const [note, setNote] = useState('')

  const workShifts = shiftTypes.filter(s => !s.isSystem && s.code !== NIGHT.start && s.code !== NIGHT.smonto)
  const systemShifts = shiftTypes.filter(s => {
    if (!s.isSystem) return false
    if (s.code === 'BO') return contractType === 'fulltime' || contractType === 'standard'
    if (s.code === 'RC') return contractType === 'parttime'
    return true
  })
  const nightShift = shiftTypes.find(s => s.code === NIGHT.start)
  const nightBlocked = (violations[NIGHT.start]?.length ?? 0) > 0

  function handleNight() {
    if (nightBlocked) return
    const isOverride = currentCode !== undefined && currentCode !== '—'
    onSelectNight?.(isOverride)
    onClose()
  }

  function handleSelect(code: string) {
    if (violations[code]?.length) return
    const isOverride = currentCode !== undefined && currentCode !== '—'
    onSelect({
      code,
      note: note || undefined,
      updatedAt: Date.now(),
      isManualOverride: isOverride,
      originalCode: isOverride ? currentCode : undefined,
    })
    onClose()
  }

  const allViolations = Object.values(violations).flat()

  return (
    <div
      className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[160px] py-1"
      onClick={e => e.stopPropagation()}
    >
      <p className="text-[10px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wide">Turni lavoro</p>
      {workShifts.map(s => {
        const blocked = (violations[s.code]?.length ?? 0) > 0
        return (
          <button
            key={s.code}
            onClick={() => handleSelect(s.code)}
            disabled={blocked}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm
              ${blocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 active:bg-slate-200'}`}
          >
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="font-medium">{s.code}</span>
            <span className="text-slate-400 text-xs ml-auto">{s.startTime}–{s.endTime}</span>
            {blocked && <span className="text-red-400 text-xs">⚠</span>}
          </button>
        )
      })}

      {nightShift && (
        <button
          onClick={handleNight}
          disabled={nightBlocked}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm
            ${nightBlocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 active:bg-slate-200'}`}
        >
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: nightShift.color }} />
          <span className="font-medium">Notte</span>
          <span className="text-slate-400 text-xs ml-auto">21:00–06:30</span>
          {nightBlocked && <span className="text-red-400 text-xs">⚠</span>}
        </button>
      )}

      <div className="border-t border-slate-100 my-1" />
      <p className="text-[10px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wide">Assenze</p>
      {systemShifts.map(s => {
        const blocked = (violations[s.code]?.length ?? 0) > 0
        return (
          <button
            key={s.code}
            onClick={() => handleSelect(s.code)}
            disabled={blocked}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm
              ${blocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 active:bg-slate-200'}`}
          >
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600">{s.code}</span>
            <span className="text-slate-400 text-xs ml-1">{s.label}</span>
            {blocked && <span className="text-red-400 text-xs">⚠</span>}
          </button>
        )
      })}

      {allViolations.length > 0 && (
        <div className="border-t border-slate-100 mx-2 my-1 p-2 bg-red-50 rounded text-xs text-red-700 space-y-1">
          {allViolations.map((v, i) => <p key={i}>{v.message}</p>)}
        </div>
      )}

      <div className="border-t border-slate-100 px-3 py-2">
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Nota opzionale..."
          className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
    </div>
  )
}
