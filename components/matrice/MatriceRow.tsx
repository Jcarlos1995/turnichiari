import { MatriceCell } from './MatriceCell'
import { getViolationsForCell } from '@/lib/validation/legal'
import type { Operator, ShiftType, MatriceMonth } from '@/lib/types'

interface MatriceRowProps {
  operator: Operator
  matrice: MatriceMonth
  daysInMonth: number
  year: number
  month: number
  allShiftTypes: ShiftType[]
  editable: boolean
  onCellSelect: (operatorId: string, day: number, entry: { code: string; note?: string; updatedAt: number }) => void
}

const FALLBACK_SHIFT: ShiftType = {
  code: '—', label: '', startTime: '', endTime: '', color: '#f8fafc',
  operatorsPerDay: 0, isPartTime: false, isSystem: true
}

export function MatriceRow({ operator, matrice, daysInMonth, year, month, allShiftTypes, editable, onCellSelect }: MatriceRowProps) {
  const operatorData = matrice[operator.id] ?? {}

  return (
    <div className="contents">
      <div className="h-8 flex items-center px-2 bg-white border border-slate-100 rounded text-xs font-medium text-slate-700 truncate sticky left-0 z-10">
        {operator.name}
      </div>
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        const entry = operatorData[day]
        const code = entry?.code ?? 'R'
        const shiftType = allShiftTypes.find(s => s.code === code) ?? FALLBACK_SHIFT

        const prevEntry = operatorData[day - 1]
        const prevShift = prevEntry
          ? (allShiftTypes.find(s => s.code === prevEntry.code) ?? null)
          : null

        // Gather up to 7 days of shifts ending at this day for weekly checks
        const weekStart = Math.max(1, day - 6)
        const weekShifts = Array.from({ length: day - weekStart + 1 }, (_, k) => {
          const d = weekStart + k
          const c = operatorData[d]?.code ?? 'R'
          return allShiftTypes.find(s => s.code === c) ?? FALLBACK_SHIFT
        })

        const violations = Object.fromEntries(
          allShiftTypes.map(s => [
            s.code,
            getViolationsForCell(prevShift, s, weekShifts)
          ])
        )

        return (
          <MatriceCell
            key={day}
            entry={entry}
            shiftType={shiftType}
            editable={editable}
            onSelect={(e) => onCellSelect(operator.id, day, { ...e, updatedAt: Date.now() })}
            violations={violations}
            allShiftTypes={allShiftTypes}
          />
        )
      })}
    </div>
  )
}
