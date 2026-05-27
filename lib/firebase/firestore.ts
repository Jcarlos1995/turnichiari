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
