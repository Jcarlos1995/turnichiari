import { useState, useEffect } from 'react'
import { getNucleo } from '@/lib/firebase/firestore'
import { SYSTEM_SHIFTS, type Nucleo, type ShiftType } from '@/lib/types'

export function useNucleo(nucleoId: string | null) {
  const [nucleo, setNucleo] = useState<Nucleo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!nucleoId) { setLoading(false); return }
    getNucleo(nucleoId)
      .then(n => { setNucleo(n) })
      .finally(() => { setLoading(false) })
  }, [nucleoId])

  const allShiftTypes: ShiftType[] = [
    ...(nucleo?.shiftTypes ?? []),
    ...SYSTEM_SHIFTS,
  ]

  return { nucleo, allShiftTypes, loading }
}
