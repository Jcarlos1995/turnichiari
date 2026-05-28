import {
  doc, getDoc, setDoc, getDocs,
  collection, query, where, orderBy,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore'
import { db } from './config'
import type { Nucleo, Operator, MatriceMonth, MatriceDayEntry } from '@/lib/types'

export async function getNucleo(nucleoId: string): Promise<Nucleo | null> {
  const snap = await getDoc(doc(db, 'nuclei', nucleoId))
  return snap.exists() ? { id: snap.id, ...snap.data() } as Nucleo : null
}

export async function getOperators(nucleoId: string): Promise<Operator[]> {
  const snap = await getDocs(
    query(
      collection(db, 'nuclei', nucleoId, 'operators'),
      where('active', '==', true),
      orderBy('name')
    )
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Operator)
}

export function subscribeMatrice(
  nucleoId: string,
  yearMonth: string,
  callback: (data: MatriceMonth) => void
): Unsubscribe {
  const ref = doc(db, 'nuclei', nucleoId, 'matrice', yearMonth)
  return onSnapshot(ref, snap => {
    callback(snap.exists() ? snap.data() as MatriceMonth : {})
  })
}

export async function updateMatriceCell(
  nucleoId: string,
  yearMonth: string,
  operatorId: string,
  day: number,
  entry: MatriceDayEntry
): Promise<void> {
  const ref = doc(db, 'nuclei', nucleoId, 'matrice', yearMonth)
  await setDoc(ref, {
    [operatorId]: { [day]: entry }
  }, { merge: true })
}

/**
 * Bulk-writes generated shift entries for a month.
 * Only writes cells that are currently absent from existingMatrice.
 * Each entry is marked with isManualOverride: false.
 */
export async function bulkUpdateMatrice(
  nucleoId: string,
  yearMonth: string,
  generated: Record<string, Record<number, string>>,  // { operatorId: { day: shiftCode } }
  existingMatrice: MatriceMonth
): Promise<void> {
  const ref = doc(db, 'nuclei', nucleoId, 'matrice', yearMonth)

  const updates: Record<string, Record<number, MatriceDayEntry>> = {}

  for (const [operatorId, dayMap] of Object.entries(generated)) {
    const existing = existingMatrice[operatorId] ?? {}
    for (const [dayStr, code] of Object.entries(dayMap)) {
      const day = Number(dayStr)
      if (!existing[day]) {
        if (!updates[operatorId]) updates[operatorId] = {}
        updates[operatorId][day] = {
          code,
          updatedAt: Date.now(),
          isManualOverride: false,
        }
      }
    }
  }

  if (Object.keys(updates).length === 0) return

  await setDoc(ref, updates, { merge: true })
}

/**
 * Saves an operator's cycle configuration and current month phase.
 */
export async function updateOperatorCycle(
  nucleoId: string,
  operatorId: string,
  cycle: string[],
  cyclePhase: number,
  cycleMonth: string
): Promise<void> {
  const ref = doc(db, 'nuclei', nucleoId, 'operators', operatorId)
  await setDoc(ref, { cycle, cyclePhase, cycleMonth }, { merge: true })
}
