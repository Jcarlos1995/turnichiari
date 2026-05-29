# Turno Notte (N1 + N2 in coppia) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando si assegna manualmente il turno "Notte" a un operatore, collocare automaticamente N1 nel giorno scelto e N2 (smonto) nel giorno successivo, con supporto cross-month.

**Architecture:** Modulo logico puro (`lib/shifts/nightShift.ts`) per il calcolo dello smonto + helper Firestore atomici (`writeBatch`) per scrivere/cancellare la coppia su uno o due documenti di mese. La UI espone una sola voce "Notte" nel dropdown, rende il N2 in sola lettura, e `MatriceGrid` instrada le azioni (notte / pulizia coppia / scrittura normale).

**Tech Stack:** Next.js 16, Firebase Firestore SDK v12, TypeScript, Jest (jsdom).

**Spec:** `docs/superpowers/specs/2026-05-29-turno-notte-smonto-design.md`

---

## File Structure

| File | Azione | Responsabilità |
|------|--------|----------------|
| `lib/shifts/nightShift.ts` | Crea | Costante `NIGHT` + funzione pura `nextSmontoTarget` |
| `lib/shifts/__tests__/nightShift.test.ts` | Crea | Test casi limite date |
| `lib/firebase/firestore.ts` | Modifica | `setNightShift`, `clearNightSmonto` |
| `lib/firebase/__tests__/nightShift.firestore.test.ts` | Crea | Test batch (SDK mockato) |
| `lib/validation/legal.ts` | Modifica | Usare `NIGHT` invece di stringhe hardcoded |
| `components/matrice/CellDropdown.tsx` | Modifica | Voce unica "Notte", nasconde N1/N2 |
| `components/matrice/__tests__/CellDropdown.test.tsx` | Crea | Test presenza "Notte" / assenza N1/N2 |
| `components/matrice/MatriceCell.tsx` | Modifica | N2 sola lettura + prop `onSelectNight` |
| `components/matrice/__tests__/MatriceCell.test.tsx` | Modifica | Test N2 non apre dropdown |
| `components/matrice/MatriceRow.tsx` | Modifica | Propaga `previousCode` + `onCellNight` |
| `components/matrice/MatriceGrid.tsx` | Modifica | Routing in `handleCellSelect` + `handleCellNight` |

---

## Task 1: Modulo `nightShift` — costante + calcolo smonto (puro)

**Files:**
- Create: `lib/shifts/nightShift.ts`
- Test: `lib/shifts/__tests__/nightShift.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/shifts/__tests__/nightShift.test.ts`:

```typescript
import { NIGHT, nextSmontoTarget } from '../nightShift'

describe('NIGHT constant', () => {
  it('defines the night pair codes', () => {
    expect(NIGHT.start).toBe('N1')
    expect(NIGHT.smonto).toBe('N2')
  })
})

describe('nextSmontoTarget', () => {
  it('returns the next day in the same month mid-month', () => {
    expect(nextSmontoTarget(2026, 6, 15)).toEqual({ year: 2026, month: 6, day: 16 })
  })

  it('rolls to day 1 of next month on the last day (30-day month)', () => {
    expect(nextSmontoTarget(2026, 6, 30)).toEqual({ year: 2026, month: 7, day: 1 })
  })

  it('rolls to day 1 of next month on the last day (31-day month)', () => {
    expect(nextSmontoTarget(2026, 1, 31)).toEqual({ year: 2026, month: 2, day: 1 })
  })

  it('rolls to Jan 1 of next year on Dec 31', () => {
    expect(nextSmontoTarget(2026, 12, 31)).toEqual({ year: 2027, month: 1, day: 1 })
  })

  it('handles February in a non-leap year (28 days)', () => {
    expect(nextSmontoTarget(2026, 2, 28)).toEqual({ year: 2026, month: 3, day: 1 })
  })

  it('handles February in a leap year (29 days)', () => {
    expect(nextSmontoTarget(2028, 2, 28)).toEqual({ year: 2028, month: 2, day: 29 })
    expect(nextSmontoTarget(2028, 2, 29)).toEqual({ year: 2028, month: 3, day: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/shifts/__tests__/nightShift.test.ts`
Expected: FAIL — "Cannot find module '../nightShift'".

- [ ] **Step 3: Write minimal implementation**

Create `lib/shifts/nightShift.ts`:

```typescript
import { getDaysInMonth } from '@/lib/cycle/cycleEngine'

/** Single source of truth for the night-shift pair codes. */
export const NIGHT = { start: 'N1', smonto: 'N2' } as const

/**
 * Given the day a night shift starts (N1), returns where its smonto (N2) goes:
 * normally the next day, but day 1 of the next month if N1 is on the last day,
 * and Jan 1 of the next year if N1 is on Dec 31. `month` is 1-based.
 */
export function nextSmontoTarget(
  year: number,
  month: number,
  day: number
): { year: number; month: number; day: number } {
  const daysInMonth = getDaysInMonth(year, month)
  if (day < daysInMonth) {
    return { year, month, day: day + 1 }
  }
  if (month < 12) {
    return { year, month: month + 1, day: 1 }
  }
  return { year: year + 1, month: 1, day: 1 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/shifts/__tests__/nightShift.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/shifts/nightShift.ts lib/shifts/__tests__/nightShift.test.ts
git commit -m "feat(shifts): nightShift module — NIGHT + nextSmontoTarget"
```

---

## Task 2: `legal.ts` usa la costante `NIGHT`

**Files:**
- Modify: `lib/validation/legal.ts:49-50`

- [ ] **Step 1: Run existing legal tests (baseline green)**

Run: `npx jest lib/validation/__tests__/legal.test.ts`
Expected: PASS (baseline before refactor).

- [ ] **Step 2: Replace hardcoded strings with NIGHT**

At the top of `lib/validation/legal.ts`, add the import after the existing imports:

```typescript
import { NIGHT } from '@/lib/shifts/nightShift'
```

Then replace the hardcoded check (currently line 50):

```typescript
  // N1→N2 is one continuous night shift crossing midnight — no rest check needed
  if (prevShift.code === 'N1' && nextShift.code === 'N2') return null
```

with:

```typescript
  // N1→N2 is one continuous night shift crossing midnight — no rest check needed
  if (prevShift.code === NIGHT.start && nextShift.code === NIGHT.smonto) return null
```

- [ ] **Step 3: Run legal tests again**

Run: `npx jest lib/validation/__tests__/legal.test.ts`
Expected: PASS — unchanged behavior.

- [ ] **Step 4: Commit**

```bash
git add lib/validation/legal.ts
git commit -m "refactor(legal): use NIGHT constant for N1->N2 exception"
```

---

## Task 3: Helper Firestore `setNightShift` + `clearNightSmonto`

**Files:**
- Modify: `lib/firebase/firestore.ts`
- Test: `lib/firebase/__tests__/nightShift.firestore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/firebase/__tests__/nightShift.firestore.test.ts`:

```typescript
// Mock the firebase config so importing firestore.ts does NOT initialize a real app.
jest.mock('@/lib/firebase/config', () => ({ db: {} }))

const mockSet = jest.fn()
const mockCommit = jest.fn().mockResolvedValue(undefined)

// Mock the Firebase SDK. `doc` returns a string path so we can assert on it.
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...path: string[]) => path.join('/')),
  writeBatch: jest.fn(() => ({ set: mockSet, commit: mockCommit })),
  deleteField: jest.fn(() => '__DELETE__'),
  // Other named exports referenced by firestore.ts at import time:
  getDoc: jest.fn(), setDoc: jest.fn(), getDocs: jest.fn(),
  collection: jest.fn(), query: jest.fn(), where: jest.fn(),
  orderBy: jest.fn(), onSnapshot: jest.fn(),
}))

import { setNightShift, clearNightSmonto } from '../firestore'

describe('setNightShift', () => {
  beforeEach(() => { mockSet.mockClear(); mockCommit.mockClear() })

  it('writes N1 and N2 on consecutive days in the same month', async () => {
    await setNightShift('nucleo-b', 2026, 6, 15, 'op1', 'uid1', false)
    expect(mockSet).toHaveBeenCalledTimes(2)
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      'nuclei/nucleo-b/matrice/2026-06',
      { op1: { 15: expect.objectContaining({ code: 'N1', updatedBy: 'uid1', isManualOverride: false }) } },
      { merge: true }
    )
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      'nuclei/nucleo-b/matrice/2026-06',
      { op1: { 16: expect.objectContaining({ code: 'N2', updatedBy: 'uid1', isManualOverride: false }) } },
      { merge: true }
    )
    expect(mockCommit).toHaveBeenCalledTimes(1)
  })

  it('writes N2 into the next month when N1 is on the last day', async () => {
    await setNightShift('nucleo-b', 2026, 6, 30, 'op1', 'uid1', true)
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      'nuclei/nucleo-b/matrice/2026-06',
      { op1: { 30: expect.objectContaining({ code: 'N1', isManualOverride: true }) } },
      { merge: true }
    )
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      'nuclei/nucleo-b/matrice/2026-07',
      { op1: { 1: expect.objectContaining({ code: 'N2', isManualOverride: true }) } },
      { merge: true }
    )
  })
})

describe('clearNightSmonto', () => {
  beforeEach(() => { mockSet.mockClear(); mockCommit.mockClear() })

  it('deletes the smonto cell on the next day', async () => {
    await clearNightSmonto('nucleo-b', 2026, 6, 15, 'op1')
    expect(mockSet).toHaveBeenCalledWith(
      'nuclei/nucleo-b/matrice/2026-06',
      { op1: { 16: '__DELETE__' } },
      { merge: true }
    )
    expect(mockCommit).toHaveBeenCalledTimes(1)
  })

  it('deletes the smonto in the next month when N1 is on the last day', async () => {
    await clearNightSmonto('nucleo-b', 2026, 12, 31, 'op1')
    expect(mockSet).toHaveBeenCalledWith(
      'nuclei/nucleo-b/matrice/2027-01',
      { op1: { 1: '__DELETE__' } },
      { merge: true }
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/firebase/__tests__/nightShift.firestore.test.ts`
Expected: FAIL — `setNightShift`/`clearNightSmonto` are not exported from `../firestore`.

- [ ] **Step 3: Write minimal implementation**

In `lib/firebase/firestore.ts`, update the import from `firebase/firestore` to add `deleteField`:

```typescript
import {
  doc, getDoc, setDoc, getDocs,
  collection, query, where, orderBy,
  onSnapshot, writeBatch, deleteField,
  type Unsubscribe
} from 'firebase/firestore'
```

Add the night-shift import near the other top-of-file imports:

```typescript
import { NIGHT, nextSmontoTarget } from '@/lib/shifts/nightShift'
```

Append these to the end of `lib/firebase/firestore.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/firebase/__tests__/nightShift.firestore.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/firebase/firestore.ts lib/firebase/__tests__/nightShift.firestore.test.ts
git commit -m "feat(firestore): setNightShift + clearNightSmonto (atomic, cross-month)"
```

---

## Task 4: `CellDropdown` — voce unica "Notte"

**Files:**
- Modify: `components/matrice/CellDropdown.tsx`
- Test: `components/matrice/__tests__/CellDropdown.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/matrice/__tests__/CellDropdown.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { CellDropdown } from '../CellDropdown'
import type { ShiftType } from '@/lib/types'

const shiftTypes: ShiftType[] = [
  { code: 'M1', label: 'Mattina 1', startTime: '06:30', endTime: '13:30', color: '#fef3c7', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'N1', label: 'Notte 1', startTime: '21:00', endTime: '00:00', color: '#dbeafe', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'N2', label: 'Notte 2', startTime: '00:00', endTime: '06:30', color: '#bfdbfe', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'R', label: 'Riposo', startTime: '', endTime: '', color: '#f1f5f9', operatorsPerDay: 0, isPartTime: false, isSystem: true },
]

function setup(props: Partial<React.ComponentProps<typeof CellDropdown>> = {}) {
  const onSelect = jest.fn()
  const onSelectNight = jest.fn()
  const onClose = jest.fn()
  render(
    <CellDropdown
      currentCode={undefined}
      shiftTypes={shiftTypes}
      violations={{}}
      onSelect={onSelect}
      onSelectNight={onSelectNight}
      onClose={onClose}
      {...props}
    />
  )
  return { onSelect, onSelectNight, onClose }
}

describe('CellDropdown night option', () => {
  it('shows a single "Notte" option and hides N1/N2 buttons', () => {
    setup()
    expect(screen.getByText('Notte')).toBeInTheDocument()
    expect(screen.queryByText('N1')).not.toBeInTheDocument()
    expect(screen.queryByText('N2')).not.toBeInTheDocument()
  })

  it('calls onSelectNight(false) when current cell is empty', () => {
    const { onSelectNight } = setup({ currentCode: undefined })
    fireEvent.click(screen.getByText('Notte'))
    expect(onSelectNight).toHaveBeenCalledWith(false)
  })

  it('calls onSelectNight(true) when overwriting an existing shift', () => {
    const { onSelectNight } = setup({ currentCode: 'M1' })
    fireEvent.click(screen.getByText('Notte'))
    expect(onSelectNight).toHaveBeenCalledWith(true)
  })

  it('does not call onSelectNight when the night option is blocked by a violation', () => {
    const { onSelectNight } = setup({
      violations: { N1: [{ rule: 'MIN_REST_11H', message: 'x', hoursAvailable: 5, hoursRequired: 11 }] },
    })
    fireEvent.click(screen.getByText('Notte'))
    expect(onSelectNight).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest components/matrice/__tests__/CellDropdown.test.tsx`
Expected: FAIL — `onSelectNight` prop doesn't exist / no "Notte" button.

- [ ] **Step 3: Write implementation**

Edit `components/matrice/CellDropdown.tsx`. Add the import at the top:

```tsx
import { NIGHT } from '@/lib/shifts/nightShift'
```

Update the props interface to add `onSelectNight`:

```tsx
interface CellDropdownProps {
  currentCode?: string          // current cell code (before this selection)
  shiftTypes: ShiftType[]
  violations: Record<string, LegalViolation[]>
  onSelect: (entry: MatriceDayEntry) => void
  onSelectNight?: (isOverride: boolean) => void
  onClose: () => void
}
```

(`onSelectNight` is optional so existing component tests that don't supply it still typecheck; in production it is always provided.)

Update the destructured params and the `workShifts` filter so N1/N2 are excluded, and add a night helper. Replace:

```tsx
export function CellDropdown({ currentCode, shiftTypes, violations, onSelect, onClose }: CellDropdownProps) {
  const [note, setNote] = useState('')

  const workShifts = shiftTypes.filter(s => !s.isSystem)
  const systemShifts = shiftTypes.filter(s => s.isSystem)
```

with:

```tsx
export function CellDropdown({ currentCode, shiftTypes, violations, onSelect, onSelectNight, onClose }: CellDropdownProps) {
  const [note, setNote] = useState('')

  const workShifts = shiftTypes.filter(s => !s.isSystem && s.code !== NIGHT.start && s.code !== NIGHT.smonto)
  const systemShifts = shiftTypes.filter(s => s.isSystem)
  const nightShift = shiftTypes.find(s => s.code === NIGHT.start)
  const nightBlocked = (violations[NIGHT.start]?.length ?? 0) > 0

  function handleNight() {
    if (nightBlocked) return
    const isOverride = currentCode !== undefined && currentCode !== '—'
    onSelectNight?.(isOverride)
    onClose()
  }
```

Then, immediately after the `workShifts.map(...)` block (before the `<div className="border-t border-slate-100 my-1" />` that precedes "Assenze"), insert the synthetic Notte button:

```tsx
      {nightShift && (
        <button
          onClick={handleNight}
          disabled={nightBlocked}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm
            ${nightBlocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 active:bg-slate-200'}`}
        >
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: nightShift.color }} />
          <span className="font-medium">Notte</span>
          <span className="text-slate-400 text-xs ml-auto">21:00–06:30</span>
          {nightBlocked && <span className="text-red-400 text-xs">⚠</span>}
        </button>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest components/matrice/__tests__/CellDropdown.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/matrice/CellDropdown.tsx components/matrice/__tests__/CellDropdown.test.tsx
git commit -m "feat(matrice): single 'Notte' option in cell dropdown"
```

---

## Task 5: `MatriceCell` — N2 sola lettura + `onSelectNight`

**Files:**
- Modify: `components/matrice/MatriceCell.tsx`
- Test: `components/matrice/__tests__/MatriceCell.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `components/matrice/__tests__/MatriceCell.test.tsx` a new describe block (keep existing tests). Add these imports if not already present at the top of the file: `import { render, screen, fireEvent } from '@testing-library/react'` and the `MatriceCell` import already exists.

```tsx
describe('MatriceCell smonto (N2) read-only', () => {
  const n2Shift = {
    code: 'N2', label: 'Notte 2', startTime: '00:00', endTime: '06:30',
    color: '#bfdbfe', operatorsPerDay: 1, isPartTime: false, isSystem: false,
  }

  it('does not open the dropdown when an N2 cell is clicked', () => {
    render(
      <MatriceCell
        entry={{ code: 'N2', updatedAt: 1 }}
        shiftType={n2Shift}
        editable={true}
        onSelect={jest.fn()}
        onSelectNight={jest.fn()}
        allShiftTypes={[n2Shift]}
      />
    )
    // Click the cell (shows the code 'N2')
    fireEvent.click(screen.getByText('N2'))
    // Dropdown would render "Notte" / "Assenze"; assert it did NOT appear
    expect(screen.queryByText('Assenze')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest components/matrice/__tests__/MatriceCell.test.tsx`
Expected: FAIL — `onSelectNight` prop missing and/or N2 cell opens the dropdown.

- [ ] **Step 3: Write implementation**

Edit `components/matrice/MatriceCell.tsx`. Add the import at top:

```tsx
import { NIGHT } from '@/lib/shifts/nightShift'
```

Update the props interface and signature to add `onSelectNight`:

```tsx
interface MatriceCellProps {
  entry: MatriceDayEntry | undefined
  shiftType: ShiftType
  editable: boolean
  onSelect: (entry: MatriceDayEntry) => void
  onSelectNight?: (isOverride: boolean) => void
  violations?: Record<string, LegalViolation[]>
  allShiftTypes?: ShiftType[]
  highlighted?: boolean
  onHover?: () => void
}

export function MatriceCell({ entry, shiftType, editable, onSelect, onSelectNight, violations = {}, allShiftTypes = [], highlighted = false, onHover }: MatriceCellProps) {
```

Add a smonto flag after `const isOverride = ...`:

```tsx
  const isSmonto = entry?.code === NIGHT.smonto
```

Update the click handler so smonto cells never open the dropdown:

```tsx
      onClick={() => editable && !isSmonto && setOpen(o => !o)}
```

Update the `title` and cursor: change the wrapper `title={entry?.note}` to:

```tsx
      title={isSmonto ? 'Smonto notte — modifica il turno N1 del giorno precedente' : entry?.note}
```

In the cell content, after the `{entry?.code ?? '—'}` line, add a moon marker for smonto cells:

```tsx
      {isSmonto && (
        <span className="absolute bottom-0.5 left-0.5 text-[8px] leading-none" aria-hidden>🌙</span>
      )}
```

Finally, pass `onSelect` AND `onSelectNight` to the dropdown. Replace the `<CellDropdown ... />` usage with:

```tsx
      {open && editable && !isSmonto && (
        <CellDropdown
          currentCode={entry?.code}
          shiftTypes={allShiftTypes}
          violations={violations}
          onSelect={onSelect}
          onSelectNight={onSelectNight}
          onClose={() => setOpen(false)}
        />
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest components/matrice/__tests__/MatriceCell.test.tsx`
Expected: PASS — existing tests still green, new smonto test green.

- [ ] **Step 5: Commit**

```bash
git add components/matrice/MatriceCell.tsx components/matrice/__tests__/MatriceCell.test.tsx
git commit -m "feat(matrice): N2 smonto cell read-only + pass onSelectNight"
```

---

## Task 6: `MatriceRow` — propaga `previousCode` + `onCellNight`

**Files:**
- Modify: `components/matrice/MatriceRow.tsx`

- [ ] **Step 1: Update the props interface**

In `components/matrice/MatriceRow.tsx`, change the `onCellSelect` signature (add a 4th `previousCode` arg) and add `onCellNight`:

```tsx
  onCellSelect: (operatorId: string, day: number, entry: { code: string; note?: string; updatedAt: number }, previousCode?: string) => void
  onCellNight: (operatorId: string, day: number, isOverride: boolean) => void
  hoveredOperatorId: string | null
  hoveredDay: number | null
  onCellHover: (operatorId: string, day: number) => void
```

Add `onCellNight` to the destructured params:

```tsx
function MatriceRowImpl({
  operator, matrice, daysInMonth, allShiftTypes, editable, onCellSelect, onCellNight,
  hoveredOperatorId, hoveredDay, onCellHover,
}: MatriceRowProps) {
```

- [ ] **Step 2: Wire the cell callbacks**

In the `cells.map(...)` JSX, update the `MatriceCell` props — add `previousCode` to `onSelect` and add `onSelectNight`:

```tsx
        <MatriceCell
          key={day}
          entry={entry}
          shiftType={shiftType}
          editable={editable}
          onSelect={(e) => onCellSelect(operator.id, day, { ...e, updatedAt: Date.now() }, entry?.code)}
          onSelectNight={(isOverride) => onCellNight(operator.id, day, isOverride)}
          violations={violations}
          allShiftTypes={allShiftTypes}
          highlighted={rowHovered || hoveredDay === day}
          onHover={() => onCellHover(operator.id, day)}
        />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL — `MatriceGrid` does not yet pass `onCellNight` (fixed in Task 7). This is expected; proceed.

- [ ] **Step 4: Commit**

```bash
git add components/matrice/MatriceRow.tsx
git commit -m "feat(matrice): MatriceRow propagates previousCode + onCellNight"
```

---

## Task 7: `MatriceGrid` — routing notte / pulizia coppia / normale

**Files:**
- Modify: `components/matrice/MatriceGrid.tsx`

- [ ] **Step 1: Update imports**

In `components/matrice/MatriceGrid.tsx`, change the firestore import to add the night helpers, and import `NIGHT`:

```tsx
import { updateMatriceCell, setNightShift, clearNightSmonto } from '@/lib/firebase/firestore'
import { NIGHT } from '@/lib/shifts/nightShift'
```

- [ ] **Step 2: Update `handleCellSelect` + add `handleCellNight`**

Replace the existing `handleCellSelect` useCallback with the following (adds `previousCode` + clear-pair logic), and add `handleCellNight` right after it:

```tsx
  const handleCellSelect = useCallback(async (
    operatorId: string,
    day: number,
    entry: { code: string; note?: string; updatedAt: number },
    previousCode?: string
  ) => {
    try {
      // If the edited cell was an N1, its paired N2 (next day) must be cleared.
      if (previousCode === NIGHT.start) {
        await clearNightSmonto(nucleoId, year, month, day, operatorId)
      }
      await updateMatriceCell(nucleoId, yearMonth, operatorId, day, {
        ...entry,
        updatedBy: currentUser.uid,
      })
    } catch (err) {
      console.error('Errore salvataggio cella matrice:', err)
    }
  }, [nucleoId, yearMonth, year, month, currentUser.uid])

  const handleCellNight = useCallback(async (
    operatorId: string,
    day: number,
    isOverride: boolean
  ) => {
    try {
      await setNightShift(nucleoId, year, month, day, operatorId, currentUser.uid, isOverride)
    } catch (err) {
      console.error('Errore salvataggio turno notte:', err)
    }
  }, [nucleoId, year, month, currentUser.uid])
```

- [ ] **Step 3: Pass `onCellNight` to `MatriceRow`**

In the `operators.map(op => ...)` JSX, add the `onCellNight` prop to `MatriceRow`:

```tsx
          <MatriceRow
            key={op.id}
            operator={op}
            matrice={matrice}
            daysInMonth={daysInMonth}
            year={year}
            month={month}
            allShiftTypes={allShiftTypes}
            editable={canEdit}
            onCellSelect={handleCellSelect}
            onCellNight={handleCellNight}
            hoveredOperatorId={hovered?.operatorId ?? null}
            hoveredDay={hovered?.day ?? null}
            onCellHover={handleCellHover}
          />
```

- [ ] **Step 4: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx jest`
Expected: PASS — typecheck clean, all test suites green.

- [ ] **Step 5: Commit**

```bash
git add components/matrice/MatriceGrid.tsx
git commit -m "feat(matrice): route night selection + clear paired smonto"
```

---

## Task 8: Build, deploy e verifica criteri di accettazione

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: "Compiled successfully", 8/8 static pages generated, no type errors.

- [ ] **Step 2: Deploy hosting**

Run: `npx firebase deploy --only hosting`
Expected: "Deploy complete!" with hosting URL.

- [ ] **Step 3: Manual verification against acceptance criteria**

On `https://turnichiari-79193.web.app` (hard refresh), logged in as RAA/Coordinatrice, verify:
1. Selecting "Notte" on a mid-month day D → cell D shows N1, cell D+1 shows N2.
2. Selecting "Notte" on the last day of the month → switch to next month: day 1 shows N2.
3. Clicking an N2 cell does not open the dropdown and shows the smonto tooltip.
4. Changing an N1 cell to another shift → the paired N2 (next day) disappears.
5. N1 and N2 no longer appear as individual options in the dropdown.
6. "Notte" is disabled when it would violate the 11h rest vs the previous day.
7. "Genera mese" still works exactly as before.

- [ ] **Step 4: Commit (if any verification fixes were needed)**

Only if Step 3 surfaced issues requiring code changes; otherwise no commit. Use systematic-debugging for any failure.

---

## Notes for the implementer

- The matrice document path is `nuclei/{nucleoId}/matrice/{YYYY-MM}`; the day is a numeric key inside `{ [operatorId]: { [day]: entry } }`.
- `ignoreUndefinedProperties` is already enabled on Firestore (see `lib/firebase/config.ts`), so optional undefined fields won't break writes.
- "Genera mese" uses `bulkUpdateMatrice` and the cycle engine — do NOT modify them; they already place N1/N2 correctly.
- Cross-month legal validation (day 1 seeing the previous month's last shift) is explicitly OUT OF SCOPE.
