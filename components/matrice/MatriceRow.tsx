'use client'
import { memo, useMemo } from 'react'
import { MatriceCell } from './MatriceCell'
import { getViolationsForCell } from '@/lib/validation/legal'
import type { Operator, ShiftType, MatriceMonth, MatriceDayEntry } from '@/lib/types'
import type { LegalViolation } from '@/lib/validation/legal'

interface MatriceRowProps {
  operator: Operator
  matrice: MatriceMonth
  days: number[]          // giorni da mostrare in questa riga (es. una settimana)
  year: number
  month: number
  allShiftTypes: ShiftType[]
  editable: boolean
  onCellSelect: (operatorId: string, day: number, entry: { code: string; note?: string; updatedAt: number }, previousCode?: string) => void
  onCellNight: (operatorId: string, day: number, isOverride: boolean) => void
  hoveredOperatorId: string | null
  hoveredDay: number | null
  onCellHover: (operatorId: string, day: number) => void
}

const FALLBACK_SHIFT: ShiftType = {
  code: '—', label: '', startTime: '', endTime: '', color: '#f8fafc',
  operatorsPerDay: 0, isPartTime: false, isSystem: true
}

interface CellData {
  day: number
  entry: MatriceDayEntry | undefined
  shiftType: ShiftType
  violations: Record<string, LegalViolation[]>
}

function MatriceRowImpl({
  operator, matrice, days, allShiftTypes, editable, onCellSelect, onCellNight,
  hoveredOperatorId, hoveredDay, onCellHover,
}: MatriceRowProps) {
  const operatorData = matrice[operator.id] ?? {}
  const rowHovered = hoveredOperatorId === operator.id

  // Heavy per-cell computation (entries, shift types, legal violations).
  // Memoized so hover-driven re-renders only re-apply highlight classes
  // instead of recomputing violations for every cell.
  const cells = useMemo<CellData[]>(() => {
    return days.map((day) => {
      const entry = operatorData[day]
      const code = entry?.code ?? 'R'
      const shiftType = allShiftTypes.find(s => s.code === code) ?? FALLBACK_SHIFT

      const prevEntry = operatorData[day - 1]
      const prevShift = prevEntry
        ? (allShiftTypes.find(s => s.code === prevEntry.code) ?? null)
        : null

      const weekStart = Math.max(1, day - 6)
      const weekShifts = Array.from({ length: day - weekStart + 1 }, (_, k) => {
        const d = weekStart + k
        const c = operatorData[d]?.code ?? 'R'
        return allShiftTypes.find(s => s.code === c) ?? FALLBACK_SHIFT
      })

      const violations = Object.fromEntries(
        allShiftTypes.map(s => [s.code, getViolationsForCell(prevShift, s, weekShifts)])
      )

      return { day, entry, shiftType, violations }
    })
  }, [operatorData, days, allShiftTypes])

  return (
    <div className="contents">
      <div className={`h-8 flex items-center px-2 border rounded text-xs font-medium truncate sticky left-0 z-10 transition-colors
        ${rowHovered ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-slate-100 text-slate-700'}`}>
        {operator.name}
      </div>
      {cells.map(({ day, entry, shiftType, violations }) => (
        <MatriceCell
          key={day}
          entry={entry}
          shiftType={shiftType}
          editable={editable}
          onSelect={(e) => onCellSelect(operator.id, day, { ...e, updatedAt: Date.now() }, entry?.code)}
          onSelectNight={(isOverride) => onCellNight(operator.id, day, isOverride)}
          contractType={operator.contractType}
          violations={violations}
          allShiftTypes={allShiftTypes}
          highlighted={rowHovered || hoveredDay === day}
          onHover={() => onCellHover(operator.id, day)}
        />
      ))}
    </div>
  )
}

export const MatriceRow = memo(MatriceRowImpl)
