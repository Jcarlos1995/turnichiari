'use client'
import { useState } from 'react'
import { MatriceGrid } from '@/components/matrice/MatriceGrid'
import { useAuth } from '@/hooks/useAuth'

export default function MatricePage() {
  const { user } = useAuth()
  const today = new Date()
  const [year] = useState(today.getFullYear())
  const [month] = useState(today.getMonth() + 1)

  if (!user) return null

  const nucleoId = user.nucleoId ?? 'nucleo-b'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-700">
          Matrice — {new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
        </h1>
      </div>
      <MatriceGrid nucleoId={nucleoId} year={year} month={month} currentUser={user} />
    </div>
  )
}
