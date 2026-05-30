import { useState, useEffect } from 'react'
import { getNucleo } from '@/lib/firebase/firestore'
import { SYSTEM_SHIFTS, N1_SHIFT, N2_SHIFT, type Nucleo, type ShiftType } from '@/lib/types'

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
  const base: ShiftType[] = [
    ...(nucleo?.shiftTypes ?? []),
    ...SYSTEM_SHIFTS,
  ]
  // Assicura che N1/N2 esistano nel catalogo (alcuni nuclei non li hanno),
  // così le celle notte non cadono sul colore fallback grigio.
  const codes = new Set(base.map(s => s.code))
  if (!codes.has('N1')) base.push(N1_SHIFT)
  if (!codes.has('N2')) base.push(N2_SHIFT)
  const allShiftTypes: ShiftType[] = base.map(s =>
    NIGHT_COLORS[s.code] ? { ...s, color: NIGHT_COLORS[s.code] } : s
  )

  return { nucleo, allShiftTypes, loading }
}
