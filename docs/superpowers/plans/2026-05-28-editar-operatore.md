# Editar Operatore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow RAA and Coordinatrice to edit operator data (name, contract type, FS certification, active status) from `/impostazioni/operatori`, and add ← Matrice back-links to all settings pages.

**Architecture:** New `updateOperator` Firestore helper + `includeInactive` flag on `subscribeOperators` → `EditaOperatoreModal` component pre-filled with current data → operators page shows all operators (strikethrough for inactive) + ✏️ button per row → Firestore rules updated to allow RAA to update operator names → deploy.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, Firebase Firestore client SDK v10, Jest.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/firebase/firestore.ts` | Modify | Add `updateOperator`; add `includeInactive` param to `subscribeOperators` |
| `components/impostazioni/EditaOperatoreModal.tsx` | **Create** | Pre-filled edit modal with name/contract/cert fields + disattiva/riattiva button |
| `app/(app)/impostazioni/operatori/page.tsx` | Modify | Show all operators (strikethrough inactive), ✏️ button, ← Matrice link |
| `app/(app)/impostazioni/cicli/page.tsx` | Modify | Add ← Matrice link |
| `firestore.rules` | Modify | Allow RAA to update `name` field in `users/{uid}` for OSS in their nucleo |

---

## Task 1: Firestore Helpers — updateOperator + subscribeOperators param

**Files:**
- Modify: `lib/firebase/firestore.ts`

### Background

Two changes to `firestore.ts`:

1. **`updateOperator`**: updates `nuclei/{nucleoId}/operators/{uid}` (all fields) and `users/{uid}` (only `name` if provided) atomically via `writeBatch`.

2. **`subscribeOperators`** currently has `where('active', '==', true)` hardcoded. Add optional `includeInactive = false` param: when `true`, omit the active filter so inactive operators also appear. Callers that don't pass the arg keep existing behavior.

- [ ] **Step 1: Read `lib/firebase/firestore.ts` to confirm current imports and function signatures**

Open the file. Verify:
- `writeBatch` is already imported from `firebase/firestore` ✓ (line 4)
- `subscribeOperators` signature is `(nucleoId, callback): Unsubscribe` (lines 103–115)
- `ContractType` is in the type imports (line 8)

- [ ] **Step 2: Update `subscribeOperators` signature — add `includeInactive` param**

Replace the existing `subscribeOperators` function (lines 103–115) with:

```typescript
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
```

- [ ] **Step 3: Append `updateOperator` at the end of `lib/firebase/firestore.ts`**

```typescript
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
```

- [ ] **Step 4: TypeScript check**

```bash
cd "D:\Repositories\gestione di orarios\turni-chiari"
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: 46 tests pass (no regressions — `subscribeOperators` callers without the 3rd arg still work because `includeInactive` defaults to `false`)

- [ ] **Step 6: Commit**

```bash
git add lib/firebase/firestore.ts
git commit -m "feat(firestore): add updateOperator, add includeInactive param to subscribeOperators"
```

---

## Task 2: EditaOperatoreModal Component

**Files:**
- Create: `components/impostazioni/EditaOperatoreModal.tsx`

### Background

Modal pre-filled with the operator's current data. Three sections:
1. Form fields: Nome (full name), Tipo contratto, Certificazione ★
2. Read-only info row: Email (not editable — it's their Auth credential)
3. Action buttons: **Salva** | **Disattiva / Riattiva** (color depends on current `active`) | **Annulla**

The "Disattiva/Riattiva" button calls `updateOperator` with `{ active: !operator.active }` separately from the form save.

Pattern: mirrors `NuovoOperatoreModal.tsx` structure (same Tailwind classes, same modal backdrop + dialog pattern with ESC key, backdrop click, ARIA).

- [ ] **Step 1: Create `components/impostazioni/EditaOperatoreModal.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { updateOperator } from '@/lib/firebase/firestore'
import type { ContractType, Operator } from '@/lib/types'

interface EditaOperatoreModalProps {
  operator: Operator
  nucleoId: string
  onClose: () => void
  onSaved: () => void
}

export function EditaOperatoreModal({
  operator, nucleoId, onClose, onSaved,
}: EditaOperatoreModalProps) {
  const [name, setName] = useState(operator.name)
  const [contractType, setContractType] = useState<ContractType>(
    operator.contractType === 'standard' ? 'fulltime' : operator.contractType as ContractType
  )
  const [hasFSCertification, setHasFSCertification] = useState(
    operator.hasFSCertification ?? false
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [loading, onClose])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await updateOperator(nucleoId, operator.id, {
        name: name.trim(),
        contractType,
        hasFSCertification,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive() {
    setLoading(true)
    setError(null)
    try {
      await updateOperator(nucleoId, operator.id, { active: !operator.active })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div
        id="edita-operatore-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edita-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
      >
        <h2 id="edita-modal-title" className="text-base font-bold text-slate-900 mb-4">
          Modifica operatore
        </h2>

        <form onSubmit={handleSave} className="space-y-3">
          {/* Nome */}
          <div>
            <label htmlFor="edit-name" className="block text-xs font-medium text-slate-700 mb-1">
              Nome completo *
            </label>
            <input
              id="edit-name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Tipo contratto */}
          <div>
            <label htmlFor="edit-contract" className="block text-xs font-medium text-slate-700 mb-1">
              Tipo contratto *
            </label>
            <select
              id="edit-contract"
              value={contractType}
              onChange={e => setContractType(e.target.value as ContractType)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="fulltime">Full-time</option>
              <option value="parttime">Part-time</option>
            </select>
          </div>

          {/* Certificazione antincendio */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-fsCert"
              checked={hasFSCertification}
              onChange={e => setHasFSCertification(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-blue-600"
            />
            <label htmlFor="edit-fsCert" className="text-xs text-slate-700">
              Certificazione antincendio ★
            </label>
          </div>

          {/* Email — read-only */}
          <div className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-100">
            <span className="text-slate-500">Email (non modificabile): </span>
            <span className="font-mono text-slate-600">{operator.nucleoId ? `—` : '—'}</span>
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-between pt-2">
            {/* Disattiva / Riattiva */}
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={loading}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                operator.active
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              {operator.active ? 'Disattiva' : 'Riattiva'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "D:\Repositories\gestione di orarios\turni-chiari"
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: 46 tests pass

- [ ] **Step 4: Commit**

```bash
git add components/impostazioni/EditaOperatoreModal.tsx
git commit -m "feat(impostazioni): add EditaOperatoreModal for editing operator data"
```

---

## Task 3: Update Operatori Page

**Files:**
- Modify: `app/(app)/impostazioni/operatori/page.tsx`

### Background

Four changes to the operators page:
1. `subscribeOperators` → pass `includeInactive: true` so inactive operators appear
2. Each row: strikethrough + `text-slate-400` on name when `active === false`; badge changes from green "Attivo" to gray "Inattivo"
3. ✏️ icon button per row → opens `EditaOperatoreModal` with that operator
4. ← Matrice link at top of page (uses Next.js `Link`, points to `/matrice`)

- [ ] **Step 1: Read the current `app/(app)/impostazioni/operatori/page.tsx`**

Verify current structure before editing.

- [ ] **Step 2: Replace the full file content**

```typescript
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { subscribeOperators } from '@/lib/firebase/firestore'
import { NuovoOperatoreModal } from '@/components/impostazioni/NuovoOperatoreModal'
import { EditaOperatoreModal } from '@/components/impostazioni/EditaOperatoreModal'
import type { Operator } from '@/lib/types'

export default function OperatoriPage() {
  const { user } = useAuth()
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null)

  const nucleoId = user?.nucleoId

  useEffect(() => {
    if (!user || user.role === 'oss' || !nucleoId) return
    setLoading(true)
    // includeInactive = true: show all operators, including deactivated ones
    const unsub = subscribeOperators(nucleoId, ops => {
      setOperators(ops)
      setLoading(false)
    }, true)
    return unsub
  }, [nucleoId, user])

  if (!user || user.role === 'oss') {
    return <div className="p-6 text-sm text-slate-500">Accesso non autorizzato.</div>
  }

  if (!nucleoId) {
    return <div className="p-6 text-sm text-slate-500">Seleziona un nucleo dalla matrice per gestire gli operatori.</div>
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Caricamento...</div>
  }

  const activeCount = operators.filter(op => op.active).length

  return (
    <div className="flex-1 overflow-auto p-6 max-w-3xl">
      {/* Back link */}
      <Link
        href="/matrice"
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-4"
      >
        ← Matrice
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Operatori</h1>
          <p className="text-sm text-slate-500">{activeCount} operatori attivi</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          <span>＋</span>
          <span>Nuovo operatore</span>
        </button>
      </div>

      {/* Operators list */}
      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {operators.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Nessun operatore. Usa &quot;Nuovo operatore&quot; per aggiungere il primo.
          </p>
        ) : (
          operators.map(op => (
            <div key={op.id} className="flex items-center gap-3 px-4 py-3">
              {/* Name — strikethrough if inactive */}
              <span className={`flex-1 text-sm font-medium ${
                op.active ? 'text-slate-800' : 'line-through text-slate-400'
              }`}>
                {op.name}
                {op.hasFSCertification && (
                  <span className="ml-1 text-yellow-500 text-xs">★</span>
                )}
              </span>

              {/* Contract badge */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                op.contractType === 'parttime'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {op.contractType === 'parttime' ? 'PT' : 'FT'}
              </span>

              {/* Active/inactive badge */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                op.active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {op.active ? 'Attivo' : 'Inattivo'}
              </span>

              {/* Edit button */}
              <button
                onClick={() => setEditingOperator(op)}
                title="Modifica operatore"
                className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded"
              >
                ✏️
              </button>
            </div>
          ))
        )}
      </div>

      {/* New operator modal */}
      {showModal && user && nucleoId && (
        <NuovoOperatoreModal
          nucleoId={nucleoId}
          currentUser={user}
          onClose={() => setShowModal(false)}
          onCreated={() => setShowModal(false)}
        />
      )}

      {/* Edit operator modal */}
      {editingOperator && nucleoId && (
        <EditaOperatoreModal
          operator={editingOperator}
          nucleoId={nucleoId}
          onClose={() => setEditingOperator(null)}
          onSaved={() => setEditingOperator(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "D:\Repositories\gestione di orarios\turni-chiari"
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: 46 tests pass

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/impostazioni/operatori/page.tsx"
git commit -m "feat(operatori): show all operators, strikethrough inactive, add edit button and back link"
```

---

## Task 4: Add ← Matrice Link to Cicli Page

**Files:**
- Modify: `app/(app)/impostazioni/cicli/page.tsx`

### Background

One-line change: add a `← Matrice` link at the top of the page, before the `<h1>`, identical in style to the one added in Task 3.

- [ ] **Step 1: Read `app/(app)/impostazioni/cicli/page.tsx`**

Verify the current structure to find where to insert the link.

- [ ] **Step 2: Add `Link` import and back link**

Add `import Link from 'next/link'` to the imports (after the existing imports).

Then, inside the returned JSX, add the link as the first child of the container div, before the `<h1>`:

```typescript
import Link from 'next/link'
```

And at the start of the return div (before the `<h1>` on the existing line):

```tsx
<Link
  href="/matrice"
  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-4"
>
  ← Matrice
</Link>
```

The full updated return block:

```typescript
  return (
    <div className="flex-1 overflow-auto p-6 max-w-4xl">
      <Link
        href="/matrice"
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-4"
      >
        ← Matrice
      </Link>

      <h1 className="text-lg font-bold text-slate-900 mb-1">Configurazione cicli turni</h1>
      <p className="text-sm text-slate-500 mb-6">
        Imposta il ciclo di rotazione e la fase di partenza per ogni operatore.
        Questa configurazione viene usata dal pulsante <strong>&quot;Genera mese&quot;</strong> nella matrice.
      </p>

      {unconfiguredOps.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          ⚠ {unconfiguredOps.length} operatori non ancora configurati. Imposta la loro fase e salva prima di generare il mese.
        </div>
      )}

      <div className="flex items-center gap-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
        <div className="w-32">Operatore</div>
        <div className="w-6"></div>
        <div className="w-28">Fase (giorno 1)</div>
        <div className="w-16">Pos. 1</div>
        <div className="w-16">Pos. 2</div>
        <div className="w-16">Pos. 3</div>
        <div>Anteprima ciclo</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg px-4">
        {fulltimeOps.length === 0 && parttimeOps.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Nessun operatore trovato. Aggiungi operatori prima di configurare i cicli.
          </p>
        ) : (
          <>
            {fulltimeOps.map(op => (
              <CicloOperatoreRow
                key={op.id}
                operator={op}
                nucleoId={nucleoId}
                currentYearMonth={CURRENT_YEAR_MONTH}
              />
            ))}
            {parttimeOps.length > 0 && (
              <>
                <div className="py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-t border-slate-100 mt-1">
                  Part-time — schema settimanale fisso
                </div>
                {parttimeOps.map(op => (
                  <CicloOperatoreRow
                    key={op.id}
                    operator={op}
                    nucleoId={nucleoId}
                    currentYearMonth={CURRENT_YEAR_MONTH}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
```

- [ ] **Step 3: TypeScript check**

```bash
cd "D:\Repositories\gestione di orarios\turni-chiari"
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: 46 tests pass

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/impostazioni/cicli/page.tsx"
git commit -m "feat(cicli): add back link to matrice"
```

---

## Task 5: Firestore Rules Update + Deploy

**Files:**
- Modify: `firestore.rules`

### Background

Currently `users/{userId}` allows `update, delete: if isCoordinatrice()` only. The RAA needs to update the `name` field of OSS operators in their nucleo (called from `updateOperator` in Task 1).

The fix splits `update` into two cases:
- Coordinatrice: can update any field
- RAA: can update only the `name` field on OSS documents in their nucleo, using Firestore's `diffKeys().hasOnly()` to enforce that only `name` changes

The `delete` rule stays coordinatrice-only.

- [ ] **Step 1: Read `firestore.rules`**

Verify the current `match /users/{userId}` block.

- [ ] **Step 2: Update the `match /users/{userId}` block**

Replace:
```
allow update, delete: if isCoordinatrice();
```

With:
```
allow update: if isCoordinatrice() ||
  (isAuth() &&
   'nucleoId' in resource.data &&
   'role' in resource.data &&
   resource.data.role == 'oss' &&
   canWrite(resource.data.nucleoId) &&
   request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name']));
allow delete: if isCoordinatrice();
```

The full updated `match /users/{userId}` block becomes:

```
match /users/{userId} {
  allow read: if isAuth() && (request.auth.uid == userId || isCoordinatrice());
  // RAA can create OSS profiles in their own nucleo; only coordinatrice can update/delete
  allow create: if isAuth() &&
    'nucleoId' in request.resource.data &&
    'role' in request.resource.data &&
    request.resource.data.role == 'oss' &&
    canWrite(request.resource.data.nucleoId);
  allow update: if isCoordinatrice() ||
    (isAuth() &&
     'nucleoId' in resource.data &&
     'role' in resource.data &&
     resource.data.role == 'oss' &&
     canWrite(resource.data.nucleoId) &&
     request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name']));
  allow delete: if isCoordinatrice();
}
```

- [ ] **Step 3: Build check**

```bash
cd "D:\Repositories\gestione di orarios\turni-chiari"
npm run build 2>&1 | tail -5
```

Expected: build succeeds

- [ ] **Step 4: Deploy hosting + rules**

```bash
npx firebase deploy --only hosting,firestore:rules
```

Expected: `Deploy complete!` — `https://turnichiari-79193.web.app`

- [ ] **Step 5: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): allow RAA to update operator name in users collection"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `updateOperator(nucleoId, uid, data)` — Task 1
- ✅ `subscribeOperators` with `includeInactive` param — Task 1
- ✅ `EditaOperatoreModal` with name/contract/cert fields + disattiva/riattiva — Task 2
- ✅ List shows all operators (active + inactive) — Task 3
- ✅ Strikethrough + `text-slate-400` for inactive name — Task 3
- ✅ Badge: verde "Attivo" / grigio "Inattivo" — Task 3
- ✅ ✏️ button per row opening `EditaOperatoreModal` — Task 3
- ✅ ← Matrice link on operatori page — Task 3
- ✅ ← Matrice link on cicli page — Task 4
- ✅ Firestore rule: RAA can update `name` of OSS in their nucleo — Task 5
- ✅ Deploy — Task 5

**Placeholder scan:** No TBDs. All code is complete.

**Type consistency:**
- `updateOperator(nucleoId, uid, data)` — defined Task 1, called Task 2 ✅
- `subscribeOperators(nucleoId, callback, true)` — updated signature Task 1, called Task 3 ✅
- `EditaOperatoreModal` props: `{ operator, nucleoId, onClose, onSaved }` — defined Task 2, used Task 3 ✅
- `Operator.active` — existing field in `lib/types/index.ts` ✅
