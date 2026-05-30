import {
  doc, getDoc, setDoc, getDocs, addDoc, deleteDoc,
  collection, query, where, orderBy,
  onSnapshot, writeBatch, deleteField,
  type Unsubscribe
} from 'firebase/firestore'
import { db } from './config'
import type { Nucleo, Operator, MatriceMonth, MatriceDayEntry, ContractType } from '@/lib/types'
import { NIGHT, nextSmontoTarget } from '@/lib/shifts/nightShift'
import type { GenerationReport, ExceptionRange } from '@/lib/genera/nuovaMatrice'
import { weeksOfMonth } from '@/lib/bancaore/bancaOre'
import { continueStartPhase, type PtPhase } from '@/lib/genera/ptSchedule'

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

/** One-shot read of a matrice month document. Returns {} if absent. */
export async function getMatriceMonth(nucleoId: string, yearMonth: string): Promise<MatriceMonth> {
  const snap = await getDoc(doc(db, 'nuclei', nucleoId, 'matrice', yearMonth))
  return snap.exists() ? (snap.data() as MatriceMonth) : {}
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
 * Subscribes to real-time updates of operators in a nucleo.
 * By default only returns active operators.
 * Pass includeInactive = true to return all operators (active + inactive).
 */
export function subscribeOperators(
  nucleoId: string,
  callback: (operators: Operator[]) => void,
  includeInactive = false
): Unsubscribe {
  const q = includeInactive
    ? query(collection(db, 'nuclei', nucleoId, 'operators'), orderBy('name'))
    : query(
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
    isAutosostituzione?: boolean
    role?: 'oss' | 'raa'
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
  const role = data.role ?? 'oss'
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid), {
    email,
    name,
    role,
    nucleoId,
  })
  if (role === 'raa') {
    // La RAA gestisce il nucleo: nessun documento operatore (non entra nella matrice)
  } else if (data.isAutosostituzione) {
    // Operatore jolly: va nel pool condiviso (cross-nucleo), NON tra gli operatori
    // del nucleo, così non entra nella rotazione/generazione automatica.
    batch.set(doc(db, 'autosostituzione', uid), {
      name,
      username: finalUsername,
    })
  } else {
    batch.set(doc(db, 'nuclei', nucleoId, 'operators', uid), {
      id: uid,
      name,
      nucleoId,
      contractType: data.contractType,
      active: true,
      hasFSCertification: data.hasFSCertification,
    })
  }
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

/**
 * Updates an operator's editable fields.
 * - Updates nuclei/{nucleoId}/operators/{uid} with all provided fields.
 * - If name is provided, also updates users/{uid}.name atomically (writeBatch).
 */
export async function updateOperator(
  nucleoId: string,
  uid: string,
  data: {
    name?: string
    contractType?: ContractType
    hasFSCertification?: boolean
    active?: boolean
  }
): Promise<void> {
  const batch = writeBatch(db)

  // Always update the operator document
  batch.set(doc(db, 'nuclei', nucleoId, 'operators', uid), data, { merge: true })

  // Sync name to users/{uid} if name is being changed
  if (data.name !== undefined) {
    batch.set(doc(db, 'users', uid), { name: data.name }, { merge: true })
  }

  await batch.commit()
}

/** Formats a year+month (1-based) as the 'YYYY-MM' matrice document id. */
function matriceYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * Assigns a manual night shift: writes N1 on (year, month, day) and N2 (smonto)
 * on the following day — which may fall into the next month/year. Both cells are
 * written atomically via writeBatch. Always overwrites existing content.
 * isOverride is applied as isManualOverride on both cells.
 */
export async function setNightShift(
  nucleoId: string,
  year: number,
  month: number,
  day: number,
  operatorId: string,
  updatedBy: string,
  isOverride: boolean
): Promise<void> {
  const target = nextSmontoTarget(year, month, day)
  const updatedAt = Date.now()
  const batch = writeBatch(db)

  batch.set(
    doc(db, 'nuclei', nucleoId, 'matrice', matriceYearMonth(year, month)),
    { [operatorId]: { [day]: { code: NIGHT.start, updatedAt, updatedBy, isManualOverride: isOverride } } },
    { merge: true }
  )
  batch.set(
    doc(db, 'nuclei', nucleoId, 'matrice', matriceYearMonth(target.year, target.month)),
    { [operatorId]: { [target.day]: { code: NIGHT.smonto, updatedAt, updatedBy, isManualOverride: isOverride } } },
    { merge: true }
  )

  await batch.commit()
}

/**
 * Removes the smonto (N2) paired with an N1 at (year, month, day).
 * Relies on the pair invariant: an N1 always has an N2 the following day,
 * so the deleteField is safe without an extra read. Called only when the
 * previous code of the edited cell was NIGHT.start.
 */
export async function clearNightSmonto(
  nucleoId: string,
  year: number,
  month: number,
  day: number,
  operatorId: string
): Promise<void> {
  const target = nextSmontoTarget(year, month, day)
  const batch = writeBatch(db)

  batch.set(
    doc(db, 'nuclei', nucleoId, 'matrice', matriceYearMonth(target.year, target.month)),
    { [operatorId]: { [target.day]: deleteField() } },
    { merge: true }
  )

  await batch.commit()
}

export interface BancaOreEntry {
  manualAdjust: number
  closing: number
}
export type BancaOreMonthDoc = Record<string, BancaOreEntry>

/** Reads the banca-ore document for a month. Returns {} if it doesn't exist. */
export async function getBancaOreMonth(
  nucleoId: string,
  yearMonth: string
): Promise<BancaOreMonthDoc> {
  const snap = await getDoc(doc(db, 'nuclei', nucleoId, 'bancaOre', yearMonth))
  return snap.exists() ? (snap.data() as BancaOreMonthDoc) : {}
}

/** Merges one operator's banca-ore entry (manualAdjust and/or closing) for a month. */
export async function setBancaOreEntry(
  nucleoId: string,
  yearMonth: string,
  operatorId: string,
  data: Partial<BancaOreEntry>
): Promise<void> {
  await setDoc(
    doc(db, 'nuclei', nucleoId, 'bancaOre', yearMonth),
    { [operatorId]: data },
    { merge: true }
  )
}

/**
 * Overwrites the ENTIRE matrice month with a freshly generated schedule.
 * Clears any previous content (setDoc without merge). generated = { opId: { day: code } }.
 */
export async function overwriteMatriceMonth(
  nucleoId: string,
  yearMonth: string,
  generated: Record<string, Record<number, string>>,
  updatedBy: string
): Promise<void> {
  const updatedAt = Date.now()
  const payload: Record<string, Record<number, MatriceDayEntry>> = {}
  for (const [opId, days] of Object.entries(generated)) {
    payload[opId] = {}
    for (const [day, code] of Object.entries(days)) {
      payload[opId][Number(day)] = { code, updatedAt, updatedBy, isManualOverride: false }
    }
  }
  await setDoc(doc(db, 'nuclei', nucleoId, 'matrice', yearMonth), payload) // no merge → overwrite
}

/** Saves the generation report (uncovered slots) for a month. */
export async function saveGenerationReport(
  nucleoId: string,
  yearMonth: string,
  report: GenerationReport
): Promise<void> {
  await setDoc(doc(db, 'nuclei', nucleoId, 'matriceMeta', yearMonth), report)
}

/** Reads the generation report for a month. Returns { uncovered: [] } if absent. */
export async function getGenerationReport(
  nucleoId: string,
  yearMonth: string
): Promise<GenerationReport> {
  const snap = await getDoc(doc(db, 'nuclei', nucleoId, 'matriceMeta', yearMonth))
  return snap.exists() ? (snap.data() as GenerationReport) : { uncovered: [] }
}

// ── RAA list (solo Coordinatrice può leggere tutti gli users) ───────────────
export interface RaaUser { id: string; name: string; email: string; nucleoId: string | null }

/** Subscribes to the list of RAA users (role == 'raa'). Coordinatrice only. */
export function subscribeRaaList(callback: (raas: RaaUser[]) => void): Unsubscribe {
  const q = query(collection(db, 'users'), where('role', '==', 'raa'))
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RaaUser, 'id'>) }))
    list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    callback(list)
  })
}

// ── Autosostituzione (pool condiviso cross-nucleo) ──────────────────────────
export interface AutosostOperator { id: string; name: string }

/** Subscribes to the shared autosostituzione operator pool (all nuclei). */
export function subscribeAutosost(callback: (ops: AutosostOperator[]) => void): Unsubscribe {
  const q = query(collection(db, 'autosostituzione'), orderBy('name'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AutosostOperator)))
}

/** Adds an operator to the shared autosostituzione pool. */
export async function addAutosost(name: string): Promise<void> {
  await addDoc(collection(db, 'autosostituzione'), { name })
}

/** Removes an operator from the shared autosostituzione pool. */
export async function removeAutosost(id: string): Promise<void> {
  await deleteDoc(doc(db, 'autosostituzione', id))
}

// ── Assegnazioni di autosostituzione per nucleo/mese ────────────────────────
export interface AutosostAssignment { day: number; shift: string; autoOpId: string; autoOpName: string }

/** Reads the autosostituzione assignments for a month. Returns [] if absent. */
export async function getAutosostAssignments(nucleoId: string, yearMonth: string): Promise<AutosostAssignment[]> {
  const snap = await getDoc(doc(db, 'nuclei', nucleoId, 'autosostAssign', yearMonth))
  return snap.exists() ? ((snap.data() as { items?: AutosostAssignment[] }).items ?? []) : []
}

/** Writes the autosostituzione assignments for a month (overwrites). */
export async function setAutosostAssignments(nucleoId: string, yearMonth: string, items: AutosostAssignment[]): Promise<void> {
  await setDoc(doc(db, 'nuclei', nucleoId, 'autosostAssign', yearMonth), { items })
}

/** Reads the saved exceptions (ferie/104/…) for a month. Returns [] if absent. */
export async function getExceptions(nucleoId: string, yearMonth: string): Promise<ExceptionRange[]> {
  const snap = await getDoc(doc(db, 'nuclei', nucleoId, 'eccezioni', yearMonth))
  return snap.exists() ? ((snap.data() as { items?: ExceptionRange[] }).items ?? []) : []
}

/** Saves the exceptions list for a month (overwrites). */
export async function setExceptions(nucleoId: string, yearMonth: string, items: ExceptionRange[]): Promise<void> {
  await setDoc(doc(db, 'nuclei', nucleoId, 'eccezioni', yearMonth), { items })
}

export type PtPhaseDoc = Record<string, PtPhase>

/** Reads the part-time phase map for a month. Returns {} if absent. */
export async function getPtPhase(nucleoId: string, yearMonth: string): Promise<PtPhaseDoc> {
  const snap = await getDoc(doc(db, 'nuclei', nucleoId, 'ptPhase', yearMonth))
  return snap.exists() ? (snap.data() as PtPhaseDoc) : {}
}

/** Writes the part-time phase map for a month (overwrites). */
export async function setPtPhase(nucleoId: string, yearMonth: string, phases: PtPhaseDoc): Promise<void> {
  await setDoc(doc(db, 'nuclei', nucleoId, 'ptPhase', yearMonth), phases)
}

/**
 * Resolves each part-time operator's first-week phase for a month, and persists it:
 * 1. if the month already has a stored phase for all PT → reuse (stable re-generation);
 * 2. else continue the alternation from the previous month if it has data;
 * 3. else random (A to one, B to the other), persisted so re-generation stays stable.
 */
export async function resolvePtPhases(
  nucleoId: string,
  year: number,
  month: number,
  ptOpIds: string[]
): Promise<PtPhaseDoc> {
  const ym = `${year}-${String(month).padStart(2, '0')}`
  const current = await getPtPhase(nucleoId, ym)
  if (ptOpIds.length > 0 && ptOpIds.every(id => current[id])) return current

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const prev = await getPtPhase(nucleoId, `${prevYear}-${String(prevMonth).padStart(2, '0')}`)

  const result: PtPhaseDoc = {}
  if (ptOpIds.some(id => prev[id])) {
    const prevWeekCount = weeksOfMonth(prevYear, prevMonth).length
    for (const id of ptOpIds) {
      result[id] = continueStartPhase(prev[id] ?? 'A', prevWeekCount)
    }
  } else {
    const flip = Math.random() < 0.5
    ptOpIds.forEach((id, i) => {
      result[id] = ((i % 2 === 0) === flip) ? 'A' : 'B'
    })
  }

  await setPtPhase(nucleoId, ym, result)
  return result
}
