'use client'
import { useState, useRef, useEffect } from 'react'
import { CellDropdown } from './CellDropdown'
import type { ShiftType, MatriceDayEntry, ContractType } from '@/lib/types'
import type { LegalViolation } from '@/lib/validation/legal'
import { NIGHT } from '@/lib/shifts/nightShift'

interface MatriceCellProps {
  entry: MatriceDayEntry | undefined
  shiftType: ShiftType
  editable: boolean
  onSelect: (entry: MatriceDayEntry) => void
  onSelectNight?: (isOverride: boolean) => void
  contractType?: ContractType
  violations?: Record<string, LegalViolation[]>
  allShiftTypes?: ShiftType[]
  highlighted?: boolean
  onHover?: () => void
}

export function MatriceCell({ entry, shiftType, editable, onSelect, onSelectNight, contractType, violations = {}, allShiftTypes = [], highlighted = false, onHover }: MatriceCellProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isOverride = entry?.isManualOverride === true
  const isSmonto = entry?.code === NIGHT.smonto
  // Eccezioni/assenze: testo in rosso (lo sfondo resta quello del turno)
  const EXCEPTION_CODES = ['F', 'ML', 'PE', '104', 'CO', 'INF', 'LU', 'AS']
  const isException = entry?.code !== undefined && EXCEPTION_CODES.includes(entry.code)

  return (
    <div
      ref={ref}
      style={{ backgroundColor: shiftType.color }}
      onClick={() => editable && !isSmonto && setOpen(o => !o)}
      onMouseEnter={onHover}
      className={`relative h-8 rounded flex items-center justify-center text-xs font-bold select-none
        border border-black/5 transition-all
        ${editable && !isSmonto ? 'cursor-pointer hover:brightness-95 hover:shadow-sm' : 'cursor-default'}
        ${isException ? 'text-red-600' : ''}
        ${open ? 'ring-2 ring-blue-500 ring-offset-1 z-50'
          : highlighted ? 'ring-1 ring-inset ring-blue-400/70 brightness-95' : ''}`}
      title={isSmonto ? 'Smonto notte — modifica il turno N1 del giorno precedente' : entry?.note}
    >
      {entry?.code ?? '—'}

      {/* Smonto (N2) marker — read-only tail of the night shift */}
      {isSmonto && (
        <span className="absolute bottom-0.5 left-0.5 text-[8px] leading-none" aria-hidden>🌙</span>
      )}

      {/* Manual override indicator */}
      {isOverride && (
        <span
          className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400"
          title={entry?.originalCode ? `Originale: ${entry.originalCode}` : 'Modificato manualmente'}
        />
      )}

      {open && editable && !isSmonto && (
        <CellDropdown
          currentCode={entry?.code}
          shiftTypes={allShiftTypes}
          violations={violations}
          onSelect={onSelect}
          onSelectNight={onSelectNight}
          contractType={contractType}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
