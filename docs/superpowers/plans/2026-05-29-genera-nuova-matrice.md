# Genera Nuova Matrice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere "Genera nuova matrice": genera il mese visualizzato da zero, ripartendo i turni tra gli operatori per coprire la domanda fissa, rispettando regole legali e contratti, con eccezioni pre-inserite e report dei posti scoperti.

**Architecture:** Motore euristico greedy giorno-per-giorno (funzione pura in `lib/genera/nuovaMatrice.ts`). UI: il bottone "Genera mese" diventa un dropdown a due voci; "Genera nuova matrice" apre un modal (editor eccezioni → genera → report con riquadro rosso). Persistenza: sovrascrive l'intero mese + salva un report dei posti scoperti mostrato come banner rosso sulla matrice.

**Tech Stack:** Next.js 16, Firebase Firestore v12, TypeScript, Jest (jsdom).

**Spec:** `docs/superpowers/specs/2026-05-29-genera-nuova-matrice-design.md`

---

## File Structure

| File | Azione | Responsabilità |
|------|--------|----------------|
| `lib/genera/nuovaMatrice.ts` (+test) | Crea | Motore puro `generateNuovaMatrice` + costanti copertura |
| `lib/firebase/firestore.ts` | Modifica | `overwriteMatriceMonth`, `saveGenerationReport`, `getGenerationReport` |
| `firestore.rules` | Modifica | Regole per `matriceMeta/{yyyy-MM}` |
| `components/matrice/GeneraNuovaMatriceModal.tsx` | Crea | Editor eccezioni + genera + report rosso |
| `app/(app)/matrice/page.tsx` | Modifica | Bottone dropdown (2 voci) + banner rosso scoperti |

---

## Task 1: Motore `generateNuovaMatrice`

**Files:**
- Create: `lib/genera/nuovaMatrice.ts`
- Test: `lib/genera/__tests__/nuovaMatrice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/genera/__tests__/nuovaMatrice.test.ts`:

```typescript
import { generateNuovaMatrice } from '../nuovaMatrice'
import type { ShiftType, ContractType } from '@/lib/types'

const CATALOG: ShiftType[] = [
  { code: 'M1', label: 'M1', startTime: '06:30', endTime: '13:30', color: '#a', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'M2', label: 'M2', startTime: '07:00', endTime: '14:00', color: '#b', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'MP', label: 'MP', startTime: '07:00', endTime: '12:00', color: '#c', operatorsPerDay: 1, isPartTime: true, isSystem: false },
  { code: 'P1', label: 'P1', startTime: '14:00', endTime: '21:00', color: '#d', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'P2', label: 'P2', startTime: '14:30', endTime: '21:00', color: '#e', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'N1', label: 'N1', startTime: '21:00', endTime: '00:00', color: '#f', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'N2', label: 'N2', startTime: '00:00', endTime: '06:30', color: '#g', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'R', label: 'Riposo', startTime: '', endTime: '', color: '#h', operatorsPerDay: 0, isPartTime: false, isSystem: true },
  { code: 'F', label: 'Ferie', startTime: '', endTime: '', color: '#i', operatorsPerDay: 0, isPartTime: false, isSystem: true },
]

function ops(nFT: number, nPT: number) {
  const out: { id: string; contractType: ContractType }[] = []
  for (let i = 0; i < nFT; i++) out.push({ id: `ft${i}`, contractType: 'fulltime' })
  for (let i = 0; i < nPT; i++) out.push({ id: `pt${i}`, contractType: 'parttime' })
  return out
}

function countOnDay(matrice: Record<string, Record<number, string>>, day: number, code: string): number {
  return Object.values(matrice).filter(days => days[day] === code).length
}

describe('generateNuovaMatrice', () => {
  it('covers each shift on day 1 with sufficient staff', () => {
    const { matrice } = generateNuovaMatrice({
      operators: ops(12, 2), year: 2026, month: 6, exceptions: [], shiftCatalog: CATALOG,
    })
    expect(countOnDay(matrice, 1, 'N1')).toBe(1)
    expect(countOnDay(matrice, 1, 'M1')).toBe(2)
    expect(countOnDay(matrice, 1, 'M2')).toBe(1)
    expect(countOnDay(matrice, 1, 'MP')).toBe(1)
    expect(countOnDay(matrice, 1, 'P1')).toBe(1)
    expect(countOnDay(matrice, 1, 'P2')).toBe(2)
  })

  it('places the night block N1→N2→R for the night operator', () => {
    const { matrice } = generateNuovaMatrice({
      operators: ops(12, 2), year: 2026, month: 6, exceptions: [], shiftCatalog: CATALOG,
    })
    const nightOpId = Object.keys(matrice).find(id => matrice[id][1] === 'N1')!
    expect(matrice[nightOpId][2]).toBe('N2')
    expect(matrice[nightOpId][3]).toBe('R')
  })

  it('never auto-assigns a night to a part-time operator', () => {
    const { matrice } = generateNuovaMatrice({
      operators: ops(12, 2), year: 2026, month: 6, exceptions: [], shiftCatalog: CATALOG,
    })
    for (let d = 1; d <= 30; d++) {
      expect(countOnDay({ pt0: matrice.pt0, pt1: matrice.pt1 }, d, 'N1')).toBe(0)
    }
  })

  it('honors exceptions: blocked days carry the exception code', () => {
    const { matrice } = generateNuovaMatrice({
      operators: ops(12, 2), year: 2026, month: 6,
      exceptions: [{ operatorId: 'ft0', code: 'F', fromDay: 5, toDay: 7 }],
      shiftCatalog: CATALOG,
    })
    expect(matrice.ft0[5]).toBe('F')
    expect(matrice.ft0[6]).toBe('F')
    expect(matrice.ft0[7]).toBe('F')
  })

  it('reports uncovered slots when staff is insufficient', () => {
    const { report } = generateNuovaMatrice({
      operators: ops(2, 0), year: 2026, month: 6, exceptions: [], shiftCatalog: CATALOG,
    })
    expect(report.uncovered.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/genera/__tests__/nuovaMatrice.test.ts`
Expected: FAIL — "Cannot find module '../nuovaMatrice'".

- [ ] **Step 3: Write the implementation**

Create `lib/genera/nuovaMatrice.ts`:

```typescript
import { getDaysInMonth } from '@/lib/cycle/cycleEngine'
import { weeksOfMonth } from '@/lib/bancaore/bancaOre'
import { shiftDurationHours } from '@/lib/shifts/shiftHours'
import { checkMinRestBetweenShifts } from '@/lib/validation/legal'
import type { ContractType, ShiftType } from '@/lib/types'

/** Required headcount per day shift (fixed, 7 days a week). */
export const DAY_COVERAGE: Record<string, number> = { P2: 2, M1: 2, M2: 1, P1: 1, MP: 1 }
/** Fill order: scarce (2-people) shifts first. */
export const DAY_SLOT_ORDER = ['P2', 'M1', 'M2', 'P1', 'MP']
export const NIGHT_START = 'N1'
export const NIGHT_SMONTO = 'N2'
const MAX_WEEKLY_HOURS = 48
const MAX_CONSECUTIVE_WORK = 6

export interface GeneraOperator { id: string; contractType: ContractType }
export interface ExceptionRange { operatorId: string; code: string; fromDay: number; toDay: number }
export interface UncoveredSlot { day: number; shift: string; missing: number }
export interface GenerationReport { uncovered: UncoveredSlot[] }
export interface GenerationOutput {
  matrice: Record<string, Record<number, string>>
  report: GenerationReport
}

export function generateNuovaMatrice(params: {
  operators: GeneraOperator[]
  year: number
  month: number
  exceptions: ExceptionRange[]
  shiftCatalog: ShiftType[]
}): GenerationOutput {
  const { operators, year, month, exceptions, shiftCatalog } = params
  const N = getDaysInMonth(year, month)

  const typeByCode: Record<string, ShiftType> = {}
  const hours: Record<string, number> = {}
  for (const s of shiftCatalog) { typeByCode[s.code] = s; hours[s.code] = shiftDurationHours(s) }

  const weeks = weeksOfMonth(year, month)
  const weekOfDay: Record<number, number> = {}
  weeks.forEach((w, i) => w.forEach(d => { weekOfDay[d] = i }))
  const weekTarget = (op: GeneraOperator, wi: number) =>
    (op.contractType === 'parttime' ? 28 : 40) * (weeks[wi].length / 7)

  const assigned: Record<string, Record<number, string>> = {}
  const weekHours: Record<string, number[]> = {}
  const nightsWeek: Record<string, number[]> = {}
  const consec: Record<string, number> = {}
  for (const op of operators) {
    assigned[op.id] = {}
    weekHours[op.id] = weeks.map(() => 0)
    nightsWeek[op.id] = weeks.map(() => 0)
    consec[op.id] = 0
  }

  const exDay: Record<string, Record<number, string>> = {}
  for (const ex of exceptions) {
    exDay[ex.operatorId] ??= {}
    for (let d = ex.fromDay; d <= ex.toDay; d++) exDay[ex.operatorId][d] = ex.code
  }

  const isFT = (op: GeneraOperator) => op.contractType !== 'parttime'

  function placeWork(opId: string, d: number, code: string) {
    assigned[opId][d] = code
    weekHours[opId][weekOfDay[d]] += hours[code] ?? 0
  }

  function legalOk(op: GeneraOperator, d: number, code: string): boolean {
    if (assigned[op.id][d]) return false
    if (exDay[op.id]?.[d]) return false
    const prev = assigned[op.id][d - 1]
    if (prev) {
      const pv = typeByCode[prev]
      const nv = typeByCode[code]
      if (pv && nv && checkMinRestBetweenShifts(pv, nv)) return false
    }
    const wi = weekOfDay[d]
    if (weekHours[op.id][wi] + (hours[code] ?? 0) > MAX_WEEKLY_HOURS) return false
    if (consec[op.id] >= MAX_CONSECUTIVE_WORK && (hours[code] ?? 0) > 0) return false
    return true
  }

  function hoursDebt(op: GeneraOperator, d: number): number {
    const wi = weekOfDay[d]
    return weekHours[op.id][wi] - weekTarget(op, wi) // più negativo = più "in debito"
  }

  const uncovered: UncoveredSlot[] = []

  for (let d = 1; d <= N; d++) {
    const wi = weekOfDay[d]

    // 1. eccezioni (e celle già forzate da nottate precedenti)
    for (const op of operators) {
      const ex = exDay[op.id]?.[d]
      if (ex && !assigned[op.id][d]) assigned[op.id][d] = ex
    }

    // 2. notte: 1 FT inizia N1; blocco N1→N2→R
    const nightCandidates = operators.filter(op =>
      isFT(op) &&
      !assigned[op.id][d] &&
      !exDay[op.id]?.[d] &&
      (d + 1 > N || (!assigned[op.id][d + 1] && !exDay[op.id]?.[d + 1])) &&
      legalOk(op, d, NIGHT_START)
    )
    if (nightCandidates.length) {
      nightCandidates.sort((a, b) =>
        (nightsWeek[a.id][wi] - nightsWeek[b.id][wi]) ||
        (hoursDebt(a, d) - hoursDebt(b, d))
      )
      const chosen = nightCandidates[0]
      placeWork(chosen.id, d, NIGHT_START)
      nightsWeek[chosen.id][wi] += 1
      if (d + 1 <= N) placeWork(chosen.id, d + 1, NIGHT_SMONTO)
      if (d + 2 <= N) assigned[chosen.id][d + 2] = 'R'
    } else {
      uncovered.push({ day: d, shift: 'Notte', missing: 1 })
    }

    // 3. posti di giorno
    for (const shift of DAY_SLOT_ORDER) {
      const need = DAY_COVERAGE[shift]
      let filled = 0
      for (let slot = 0; slot < need; slot++) {
        const candidates = operators.filter(op => legalOk(op, d, shift))
        if (!candidates.length) break
        candidates.sort((a, b) => {
          if (shift === 'MP') {
            const pa = a.contractType === 'parttime' ? 0 : 1
            const pb = b.contractType === 'parttime' ? 0 : 1
            if (pa !== pb) return pa - pb
          }
          return hoursDebt(a, d) - hoursDebt(b, d)
        })
        placeWork(candidates[0].id, d, shift)
        filled++
      }
      if (filled < need) uncovered.push({ day: d, shift, missing: need - filled })
    }

    // 4. riposo per i non assegnati
    for (const op of operators) {
      if (!assigned[op.id][d]) assigned[op.id][d] = 'R'
    }

    // 5. aggiorna giorni lavorativi consecutivi
    for (const op of operators) {
      const code = assigned[op.id][d]
      if ((hours[code] ?? 0) > 0) consec[op.id] += 1
      else consec[op.id] = 0
    }
  }

  return { matrice: assigned, report: { uncovered } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/genera/__tests__/nuovaMatrice.test.ts`
Expected: PASS (5 tests). If a coverage assertion fails because the greedy left a slot uncovered on day 1 with 14 operators (should not happen — 9 slots, 14 ops), debug the engine, not the test.

- [ ] **Step 5: Commit**

```bash
git add lib/genera/nuovaMatrice.ts lib/genera/__tests__/nuovaMatrice.test.ts
git commit -m "feat(genera): generateNuovaMatrice greedy scheduler (pure)"
```

---

## Task 2: Persistenza Firestore

**Files:**
- Modify: `lib/firebase/firestore.ts`
- Modify: `firestore.rules`

- [ ] **Step 1: Add the helpers**

First, add this import at the TOP of `lib/firebase/firestore.ts` (with the other imports, after the `nightShift` import line):

```typescript
import type { GenerationReport } from '@/lib/genera/nuovaMatrice'
```

Then append the helper functions to the END of `lib/firebase/firestore.ts`:

```typescript
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
```

- [ ] **Step 2: Add the security rule**

In `firestore.rules`, inside `match /nuclei/{nucleoId} {`, next to the `bancaOre` block, add:

```
      match /matriceMeta/{yearMonth} {
        allow read: if isAuth();
        allow write: if canWrite(nucleoId);
      }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/firebase/firestore.ts firestore.rules
git commit -m "feat(firestore): overwriteMatriceMonth + generation report helpers"
```

---

## Task 3: Modal "Genera nuova matrice"

**Files:**
- Create: `components/matrice/GeneraNuovaMatriceModal.tsx`

- [ ] **Step 1: Create the modal**

Create `components/matrice/GeneraNuovaMatriceModal.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { generateNuovaMatrice, type ExceptionRange, type GenerationReport } from '@/lib/genera/nuovaMatrice'
import { overwriteMatriceMonth, saveGenerationReport } from '@/lib/firebase/firestore'
import type { Operator, ShiftType, AppUser } from '@/lib/types'

interface Props {
  nucleoId: string
  year: number
  month: number
  operators: Operator[]
  shiftCatalog: ShiftType[]
  currentUser: AppUser
  onClose: () => void
  onGenerated: () => void
}

const EXCEPTION_TYPES = ['F', '104', 'ML', 'CO', 'PE']
const EXCEPTION_LABELS: Record<string, string> = {
  F: 'Ferie', '104': 'Legge 104', ML: 'Malattia', CO: 'Congedo', PE: 'Permesso',
}

interface DraftException { operatorId: string; code: string; fromDay: number; toDay: number }

export function GeneraNuovaMatriceModal({
  nucleoId, year, month, operators, shiftCatalog, currentUser, onClose, onGenerated,
}: Props) {
  const [exceptions, setExceptions] = useState<DraftException[]>([])
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<GenerationReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const monthLabel = new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(year, month, 0).getDate()

  function addException() {
    if (operators.length === 0) return
    setExceptions(prev => [...prev, { operatorId: operators[0].id, code: 'F', fromDay: 1, toDay: 1 }])
  }
  function updateException(i: number, patch: Partial<DraftException>) {
    setExceptions(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  }
  function removeException(i: number) {
    setExceptions(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const ranges: ExceptionRange[] = exceptions.map(e => ({
        operatorId: e.operatorId, code: e.code,
        fromDay: Math.min(e.fromDay, e.toDay), toDay: Math.max(e.fromDay, e.toDay),
      }))
      const { matrice, report } = generateNuovaMatrice({
        operators: operators.map(o => ({ id: o.id, contractType: o.contractType })),
        year, month, exceptions: ranges, shiftCatalog,
      })
      const yearMonth = `${year}-${String(month).padStart(2, '0')}`
      await overwriteMatriceMonth(nucleoId, yearMonth, matrice, currentUser.uid)
      await saveGenerationReport(nucleoId, yearMonth, report)
      setReport(report)
      onGenerated()
    } catch (e) {
      console.error(e)
      setError('Errore durante la generazione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-auto">
        <h2 className="text-base font-bold text-slate-900 mb-1">Genera nuova matrice</h2>
        <p className="text-sm text-slate-500 mb-4 capitalize">{monthLabel}</p>

        {report === null ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
              Questo <strong>sovrascrive l&apos;intero mese</strong> da zero, ignorando i mesi precedenti.
            </div>

            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Eccezioni</h3>
              <button onClick={addException} className="text-xs text-blue-600 hover:underline">+ Aggiungi</button>
            </div>

            <div className="space-y-2 mb-4">
              {exceptions.length === 0 && (
                <p className="text-xs text-slate-400">Nessuna eccezione. Aggiungi ferie, 104, malattia, ecc.</p>
              )}
              {exceptions.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <select
                    value={e.operatorId}
                    onChange={ev => updateException(i, { operatorId: ev.target.value })}
                    className="flex-1 border border-slate-200 rounded px-1.5 py-1"
                  >
                    {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <select
                    value={e.code}
                    onChange={ev => updateException(i, { code: ev.target.value })}
                    className="border border-slate-200 rounded px-1.5 py-1"
                  >
                    {EXCEPTION_TYPES.map(c => <option key={c} value={c}>{EXCEPTION_LABELS[c]}</option>)}
                  </select>
                  <input type="number" min={1} max={daysInMonth} value={e.fromDay}
                    onChange={ev => updateException(i, { fromDay: Number(ev.target.value) })}
                    className="w-12 border border-slate-200 rounded px-1 py-1" title="Dal giorno" />
                  <input type="number" min={1} max={daysInMonth} value={e.toDay}
                    onChange={ev => updateException(i, { toDay: Number(ev.target.value) })}
                    className="w-12 border border-slate-200 rounded px-1 py-1" title="Al giorno" />
                  <button onClick={() => removeException(i)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} disabled={loading}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annulla</button>
              <button onClick={handleGenerate} disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {loading ? 'Generazione...' : 'Genera'}
              </button>
            </div>
          </>
        ) : (
          <>
            {report.uncovered.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-4">
                ✓ Matrice generata. Tutti i turni sono coperti.
              </div>
            ) : (
              <div className="border-2 border-red-400 bg-red-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-red-700 mb-1">
                  ⚠ {report.uncovered.length} turni da coprire manualmente (autosostituzione):
                </p>
                <ul className="text-xs text-red-600 space-y-0.5 max-h-40 overflow-auto">
                  {report.uncovered.map((u, i) => (
                    <li key={i}>Giorno {u.day} — {u.shift} (mancano {u.missing})</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onClose}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700">Chiudi</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/matrice/GeneraNuovaMatriceModal.tsx
git commit -m "feat(matrice): GeneraNuovaMatriceModal (exceptions editor + report)"
```

---

## Task 4: Bottone dropdown + banner scoperti nella pagina matrice

**Files:**
- Modify: `app/(app)/matrice/page.tsx`

- [ ] **Step 1: Add imports and state**

In `app/(app)/matrice/page.tsx`, add to the imports:

```tsx
import { GeneraNuovaMatriceModal } from '@/components/matrice/GeneraNuovaMatriceModal'
import { getGenerationReport } from '@/lib/firebase/firestore'
import { useNucleo } from '@/hooks/useNucleo'
import type { UncoveredSlot } from '@/lib/genera/nuovaMatrice'
```

Inside the component, after the existing `const [showGenModal, setShowGenModal] = useState(false)` line, add:

```tsx
  const [showNuovaModal, setShowNuovaModal] = useState(false)
  const [showGenMenu, setShowGenMenu] = useState(false)
  const [uncovered, setUncovered] = useState<UncoveredSlot[]>([])
  const { allShiftTypes } = useNucleo(user?.nucleoId ?? 'nucleo-b')

  const genYearMonth = `${year}-${String(month).padStart(2, '0')}`
  useEffect(() => {
    const nid = user?.nucleoId ?? 'nucleo-b'
    let active = true
    getGenerationReport(nid, genYearMonth).then(r => { if (active) setUncovered(r.uncovered) })
    return () => { active = false }
  }, [user, genYearMonth, showNuovaModal])
```

Add `useEffect` to the React import at the top: change `import { useState, useRef } from 'react'` to `import { useState, useRef, useEffect } from 'react'`.

- [ ] **Step 2: Replace the "Genera mese" button with a dropdown**

Find the `{canGenerate && ( <button ...>⚡ Genera mese</button> )}` block and replace it with:

```tsx
        {canGenerate && (
          <div className="ml-auto relative">
            <button
              onClick={() => setShowGenMenu(m => !m)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <span>⚡</span><span>Genera</span><span className="text-[10px]">▾</span>
            </button>
            {showGenMenu && (
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[200px]">
                <button
                  onClick={() => { setShowGenMenu(false); setShowGenModal(true) }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100"
                >
                  Genera mese <span className="text-slate-400">(cicli)</span>
                </button>
                <button
                  onClick={() => { setShowGenMenu(false); setShowNuovaModal(true) }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100"
                >
                  Genera nuova matrice <span className="text-slate-400">(da zero)</span>
                </button>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 3: Add the uncovered banner above the grid**

Immediately before the `<MatriceGrid ... />` element, add:

```tsx
      {uncovered.length > 0 && (
        <div className="mx-3 mt-2 border-2 border-red-400 bg-red-50 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-red-700">
            ⚠ {uncovered.length} turni scoperti da coprire (autosostituzione):
          </p>
          <p className="text-[11px] text-red-600 mt-0.5">
            {uncovered.slice(0, 12).map(u => `G${u.day} ${u.shift}`).join(' · ')}
            {uncovered.length > 12 ? ` … +${uncovered.length - 12}` : ''}
          </p>
        </div>
      )}
```

- [ ] **Step 4: Add the new modal next to the existing GeneraMeseModal**

After the existing `{showGenModal && ( <GeneraMeseModal ... /> )}` block, add:

```tsx
      {showNuovaModal && (
        <GeneraNuovaMatriceModal
          nucleoId={nucleoId}
          year={year}
          month={month}
          operators={operatorsRef.current}
          shiftCatalog={allShiftTypes}
          currentUser={user}
          onClose={() => setShowNuovaModal(false)}
          onGenerated={() => { /* il banner si aggiorna via effetto su showNuovaModal */ }}
        />
      )}
```

- [ ] **Step 5: Typecheck, full tests, build**

Run: `npx tsc --noEmit && npx jest && npm run build`
Expected: no type errors; all suites PASS; build "Compiled successfully".

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/matrice/page.tsx"
git commit -m "feat(matrice): generation dropdown (mese / nuova matrice) + uncovered banner"
```

---

## Task 5: Deploy

**Files:** none

- [ ] **Step 1: Push + deploy**

```bash
git push
npx firebase deploy --only hosting,firestore:rules
```
Expected: "Deploy complete!".

- [ ] **Step 2: Manual verification**

On `https://turnichiari-79193.web.app` (hard refresh), as RAA/Coordinatrice:
1. The matrice header shows a **Genera ▾** button → menu with "Genera mese (cicli)" and "Genera nuova matrice (da zero)".
2. "Genera nuova matrice" opens the modal; add an exception (operator + tipo + giorni) and press **Genera**.
3. The month is regenerated from scratch; each day shows the coverage (2×M1, 1×M2, 1×MP, 1×P1, 2×P2, 1 night with N1→N2→R block).
4. PT operators never receive an automatic night.
5. The exception operator shows the exception code on the chosen days.
6. If some shifts could not be covered, the modal shows a **red-bordered box** listing them, and a **red banner** appears above the matrice.

---

## Notes for the implementer

- The engine is best-effort (greedy): it satisfies hard rules (coverage attempt, eligibility, 11h rest, max 48h/week, ≤6 consecutive workdays, night→smonto→rest) and approximates soft targets (weekly hours, fairness). Uncovered slots are reported, never forced illegally.
- Weekly hours are tracked per-cell (N1=3h on day D, N2=6.5h on day D+1), consistent with `computeBancaOre`.
- A night started on the last day of the month has no smonto/rest in this month (cross-month is out of scope, as the generator ignores adjacent months).
- `overwriteMatriceMonth` uses `setDoc` WITHOUT merge to clear the whole month before writing.
- Do NOT modify the cycle engine or `GeneraMeseModal` (the existing "Genera mese" stays as-is).
- Exception-hours crediting to weekly targets is intentionally NOT applied in v1 (tunable; bounded by the 48h/consecutive caps).
```
