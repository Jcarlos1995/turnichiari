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

  // Colore "fosforescente" per i turni notte (override del catalogo)
  const NIGHT_COLORS: Record<string, string> = { N1: '#eaff00', N2: '#f2ff66' }
  const allShiftTypes: ShiftType[] = [
    ...(nucleo?.shiftTypes ?? []),
    ...SYSTEM_SHIFTS,
  ].map(s => (NIGHT_COLORS[s.code] ? { ...s, color: NIGHT_COLORS[s.code] } : s))

  return { nucleo, allShiftTypes, loading }
}
