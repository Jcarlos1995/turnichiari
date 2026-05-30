import { useState, useEffect } from 'react'
import { getNucleo } from '@/lib/firebase/firestore'
import { SYSTEM_SHIFTS, N1_SHIFT, N2_SHIFT, M1_5_SHIFT, P2_5_SHIFT, type Nucleo, type ShiftType } from '@/lib/types'

export function useNucleo(nucleoId: string | null) {
  const [nucleo, setNucleo] = useState<Nucleo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!nucleoId) { setLoading(false); return }
    getNucleo(nucleoId)
      .then(n => { setNucleo(n) })
      .finally(() => { setLoading(false) })
  }, [nucleoId])

  // Override colori dei turni (solo visivo; il catalogo Firestore non cambia)
  const COLOR_OVERRIDES: Record<string, string> = {
    N1: '#eaff00',     // notte — neon
    N2: '#f2ff66',     // smonto — neon chiaro
    M1: '#5eead4',     // verde petrolio (chiaro)
    'M1.5': '#fb923c', // arancione
    M2: '#c4b5fd',     // viola
    MP: '#fbcfe8',     // rosa bebè
    P1: '#d1d5db',     // grigio
    P2: '#bae6fd',     // celeste
    'P2.5': '#3b82f6', // blu elettrico
  }
  const base: ShiftType[] = [
    ...(nucleo?.shiftTypes ?? []),
    ...SYSTEM_SHIFTS,
  ]
  // Assicura che N1/N2 esistano nel catalogo (alcuni nuclei non li hanno),
  // così le celle notte non cadono sul colore fallback grigio.
  const codes = new Set(base.map(s => s.code))
  if (!codes.has('N1')) base.push(N1_SHIFT)
  if (!codes.has('N2')) base.push(N2_SHIFT)
  if (!codes.has('M1.5')) base.push(M1_5_SHIFT)
  if (!codes.has('P2.5')) base.push(P2_5_SHIFT)
  const allShiftTypes: ShiftType[] = base.map(s =>
    COLOR_OVERRIDES[s.code] ? { ...s, color: COLOR_OVERRIDES[s.code] } : s
  )

  return { nucleo, allShiftTypes, loading }
}
