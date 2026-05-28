'use client'
import { useCallback, useEffect } from 'react'
import { MatriceRow } from './MatriceRow'
import { DayHeader } from './DayHeader'
import { useMatrice } from '@/hooks/useMatrice'
import { useNucleo } from '@/hooks/useNucleo'
import { updateMatriceCell } from '@/lib/firebase/firestore'
import type { AppUser, Operator, MatriceMonth } from '@/lib/types'

interface MatriceGridProps {
  nucleoId: string
  year: number
  month: number
  currentUser: AppUser
  onDataReady?: (operators: Operator[], matrice: MatriceMonth) => void
}

export function MatriceGrid({ nucleoId, year, month, currentUser, onDataReady }: MatriceGridProps) {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`
  const { matrice, operators, loading: matriceLoading } = useMatrice(nucleoId, yearMonth)
  const { allShiftTypes, loading: nucleoLoading } = useNucleo(nucleoId)
  const today = new Date()
  const daysInMonth = new Date(year, month, 0).getDate()
  const canEdit = currentUser.role === 'raa' || currentUser.role === 'coordinatrice'

  useEffect(() => {
    if (!matriceLoading && !nucleoLoading && onDataReady) {
      onDataReady(operators, matrice)
    }
  }, [operators, matrice, matriceLoading, nucleoLoading, onDataReady])

  const handleCellSelect = useCallback(async (
    operatorId: string,
    day: number,
    entry: { code: string; note?: string; updatedAt: number }
  ) => {
    await updateMatriceCell(nucleoId, yearMonth, operatorId, day, {
      ...entry,
      updatedBy: currentUser.uid,
    })
  }, [nucleoId, yearMonth, currentUser.uid])

  if (matriceLoading || nucleoLoading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Caricamento matrice...</div>
  }

  return (
    <div className="flex-1 overflow-auto p-3">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `160px repeat(${daysInMonth}, minmax(36px, 1fr))` }}
      >
        <div className="h-9 flex items-center px-2 text-xs font-semibold text-slate-500">Operatore</div>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const date = new Date(year, month - 1, day)
          const isToday = date.toDateString() === today.toDateString()
          return <DayHeader key={day} day={day} date={date} isToday={isToday} />
        })}
        {operators.map(op => (
          <MatriceRow
            key={op.id}
            operator={op}
            matrice={matrice}
            daysInMonth={daysInMonth}
            year={year}
            month={month}
            allShiftTypes={allShiftTypes}
            editable={canEdit}
            onCellSelect={handleCellSelect}
          />
        ))}
      </div>
    </div>
  )
}
