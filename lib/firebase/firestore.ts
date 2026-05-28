import {
  doc, getDoc, setDoc, getDocs,
  collection, query, where, orderBy,
  onSnapshot, writeBatch,
  type Unsubscribe
} from 'firebase/firestore'
import { db } from './config'
import type { Nucleo, Operator, MatriceMonth, MatriceDayEntry, ContractType } from '@/lib/types'

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

/**
 * Subscribes to real-time updates of active operators in a nucleo.
 * Returns an unsubscribe function.
 */
export function subscribeOperators(
  nucleoId: string,
  callback: (operators: Operator[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'nuclei', nucleoId, 'operators'),
    where('active', '==', true),
    orderBy('name')
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Operator))
  })
}

/**
 * Returns all nuclei — used for Coordinatrice's nucleo selection dropdown.
 */
export async function listNuclei(): Promise<Nucleo[]> {
  const snap = await getDocs(collection(db, 'nuclei'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Nucleo)
}

/**
 * Registers a new operator:
 * 1. Generates username (cognome[0:5] + nome[0:3])
 * 2. Creates Firebase Auth account via secondary app (retries up to 9x on collision)
 * 3. Writes users/{uid} and nuclei/{nucleoId}/operators/{uid}
 *
 * Throws if all 9 username variants are already taken.
 */
export async function createOperator(
  nucleoId: string,
  data: {
    nome: string
    cognome: string
    contractType: ContractType
    hasFSCertification: boolean
  }
): Promise<{ uid: string; username: string }> {
  const { generateUsername } = await import('@/lib/utils/username')
  const { createAuthUserSecondary } = await import('./createUserSecondary')

  const baseUsername = generateUsername(data.nome, data.cognome)

  if (baseUsername.length === 0) {
    throw new Error('Nome o cognome non contengono lettere valide (a-z).')
  }

  let uid: string | null = null
  let finalUsername: string | null = null

  for (let attempt = 0; attempt <= 9; attempt++) {
    const username = attempt === 0 ? baseUsername : `${baseUsername}${attempt}`
    const email = `${username}@turnichiari.it`
    try {
      uid = await createAuthUserSecondary(email, username)
      finalUsername = username
      break
    } catch (e: unknown) {
      const code = (e as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        if (attempt === 9) {
          throw new Error(
            'Username già in uso dopo 9 tentativi. Modifica nome o cognome.'
          )
        }
        continue
      }
      throw e  // re-throw unexpected errors
    }
  }

  if (!uid || !finalUsername) throw new Error('Impossibile creare il profilo.')

  const name = `${data.cognome} ${data.nome}`
  const email = `${finalUsername}@turnichiari.it`

  // NOTE: Non-atomic between Auth and Firestore — if the batch below fails,
  // the Auth account will be orphaned and must be manually deleted from the
  // Firebase Console (Authentication tab, find by email). A future Cloud
  // Function implementation would fix this by using a single transaction.
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid), {
    email,
    name,
    role: 'oss',
    nucleoId,
  })
  batch.set(doc(db, 'nuclei', nucleoId, 'operators', uid), {
    id: uid,
    name,
    nucleoId,
    contractType: data.contractType,
    active: true,
    hasFSCertification: data.hasFSCertification,
  })
  try {
    await batch.commit()
  } catch (e) {
    throw new Error(
      `Profilo Auth creato (uid: ${uid}) ma registrazione Firestore fallita. ` +
      `Eliminare manualmente l'account dalla Firebase Console.`
    )
  }

  return { uid, username: finalUsername }
}
