'use client'
import { MatriceGrid } from '@/components/matrice/MatriceGrid'
import { useAuth } from '@/hooks/useAuth'

const today = new Date()
const currentYear = today.getFullYear()
const currentMonth = today.getMonth() + 1

export default function MatricePage() {
  const { user } = useAuth()
  const year = currentYear
  const month = currentMonth

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
