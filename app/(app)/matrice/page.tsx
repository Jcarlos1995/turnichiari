'use client'
import { useState, useRef } from 'react'
import { MatriceGrid } from '@/components/matrice/MatriceGrid'
import { GeneraMeseModal } from '@/components/matrice/GeneraMeseModal'
import { useAuth } from '@/hooks/useAuth'
import type { Operator, MatriceMonth } from '@/lib/types'

const today = new Date()
const CURRENT_YEAR  = today.getFullYear()
const CURRENT_MONTH = today.getMonth() + 1

export default function MatricePage() {
  const { user } = useAuth()
  const [year, setYear]   = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(CURRENT_MONTH)
  const [showGenModal, setShowGenModal] = useState(false)

  // Keep latest operators + matrice from the grid
  const operatorsRef = useRef<Operator[]>([])
  const matriceRef   = useRef<MatriceMonth>({})

  if (!user) return null

  const nucleoId = user.nucleoId ?? 'nucleo-b'
  const canGenerate = user.role === 'raa' || user.role === 'coordinatrice'

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === CURRENT_YEAR && month === CURRENT_MONTH
  const label = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-3">
        <button
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors text-base font-bold"
          title="Mese precedente"
        >
          ‹
        </button>

        <h1 className="text-sm font-semibold text-slate-700 w-44 text-center capitalize">
          {label}
        </h1>

        <button
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors text-base font-bold"
          title="Mese successivo"
        >
          ›
        </button>

        {!isCurrentMonth && (
          <button
            onClick={() => { setYear(CURRENT_YEAR); setMonth(CURRENT_MONTH) }}
            className="ml-1 text-xs text-blue-600 hover:underline"
          >
            Oggi
          </button>
        )}

        {canGenerate && (
          <button
            onClick={() => setShowGenModal(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <span>⚡</span>
            <span>Genera mese</span>
          </button>
        )}
      </div>

      <MatriceGrid
        nucleoId={nucleoId}
        year={year}
        month={month}
        currentUser={user}
        onDataReady={(ops, mat) => {
          operatorsRef.current = ops
          matriceRef.current = mat
        }}
      />

      {showGenModal && (
        <GeneraMeseModal
          nucleoId={nucleoId}
          year={year}
          month={month}
          operators={operatorsRef.current}
          existingMatrice={matriceRef.current}
          currentUser={user}
          onClose={() => setShowGenModal(false)}
          onGenerated={() => setShowGenModal(false)}
        />
      )}
    </div>
  )
}
