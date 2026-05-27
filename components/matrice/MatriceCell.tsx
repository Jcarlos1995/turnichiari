'use client'
import { useState, useRef, useEffect } from 'react'
import { CellDropdown } from './CellDropdown'
import type { ShiftType, MatriceDayEntry } from '@/lib/types'
import type { LegalViolation } from '@/lib/validation/legal'

interface MatriceCellProps {
  entry: MatriceDayEntry | undefined
  shiftType: ShiftType
  editable: boolean
  onSelect: (entry: MatriceDayEntry) => void
  violations?: Record<string, LegalViolation[]>
  allShiftTypes?: ShiftType[]
}

export function MatriceCell({ entry, shiftType, editable, onSelect, violations = {}, allShiftTypes = [] }: MatriceCellProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div
      ref={ref}
      style={{ backgroundColor: shiftType.color }}
      onClick={() => editable && setOpen(o => !o)}
      className={`relative h-8 rounded flex items-center justify-center text-xs font-bold select-none
        border border-black/5 transition-all
        ${editable ? 'cursor-pointer hover:brightness-95 hover:shadow-sm' : 'cursor-default'}
        ${open ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
      title={entry?.note}
    >
      {entry?.code ?? '—'}
      {open && editable && (
        <CellDropdown
          shiftTypes={allShiftTypes}
          violations={violations}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
