# Editar Operatore — Design Spec

> Documento approvato il 28/05/2026. Lingua del codice e UI: italiano.

---

## Obiettivo

Permettere alla RAA (e alla Coordinatrice) di modificare i dati di un operatore esistente direttamente dalla pagina `/impostazioni/operatori`, e di disattivarlo/riattivarlo senza eliminarlo. Aggiungere inoltre link di ritorno alla matrice dalle pagine impostazioni.

---

## Campi modificabili

| Campo | Tipo | Note |
|-------|------|------|
| Nome completo | testo | Aggiorna `users/{uid}.name` e `operators/{uid}.name`. Email/username Auth invariato. |
| Tipo contratto | dropdown (`fulltime` / `parttime`) | |
| Certificazione antincendio ★ | checkbox | |
| Stato attivo | toggle | Disattiva (active: false) o riattiva (active: true). Bottone separato nel modal. |

L'email non è modificabile da questa interfaccia — è la credenziale di login dell'operatore.

---

## Comportamento lista operatori

- La query `subscribeOperators` attuale filtra `active == true`. Va rimossa per mostrare tutti.
- Operatori **attivi**: visualizzazione normale (nome, badge FT/PT, badge verde "Attivo").
- Operatori **inattivi**: nome con ~~tachado~~ + badge grigio "Inattivo". Non vengono considerati per la generazione automatica dei turni.
- Ogni riga ha un bottone/icona ✏️ che apre il modal di modifica.

---

## Componenti UI

### EditaOperatoreModal

Modal pre-compilato con i dati correnti dell'operatore.

**Props:**
```typescript
interface EditaOperatoreModalProps {
  operator: Operator
  nucleoId: string
  onClose: () => void
  onSaved: () => void
}
```

**Campi nel form:**
- Nome (testo, obbligatorio)
- Tipo contratto (dropdown fulltime/parttime)
- Certificazione antincendio ★ (checkbox)

**Bottoni:**
- **Salva** — aggiorna i campi sopra via `updateOperator`
- **Disattiva / Riattiva** — toglia lo stato `active`, rosso se attivo / verde se inattivo
- **Annulla**

Il modal NON mostra il campo email (sola lettura, non editabile).

### Pagina `/impostazioni/operatori`

Modifiche:
1. `subscribeOperators` senza filtro `active == true` — mostra tutti
2. Ogni riga mostra il nome con stile condizionale: `line-through text-slate-400` se `active === false`
3. Badge stato: verde "Attivo" o grigio "Inattivo"
4. Bottone ✏️ per aprire `EditaOperatoreModal`
5. Link **← Matrice** in alto a sinistra, sotto l'header

### Navigazione di ritorno

Aggiungere un link **← Matrice** (punta a `/matrice`) nelle pagine:
- `app/(app)/impostazioni/operatori/page.tsx`
- `app/(app)/impostazioni/cicli/page.tsx`

---

## Architettura tecnica

### Funzione Firestore `updateOperator`

```typescript
// in lib/firebase/firestore.ts
export async function updateOperator(
  nucleoId: string,
  uid: string,
  data: {
    name?: string
    contractType?: ContractType
    hasFSCertification?: boolean
    active?: boolean
  }
): Promise<void>
```

Internamente usa `writeBatch` per aggiornare in modo atomico:
- `users/{uid}` — solo il campo `name` se presente
- `nuclei/{nucleoId}/operators/{uid}` — tutti i campi presenti

### `subscribeOperators` senza filtro attivo

La versione attuale filtra `where('active', '==', true)`. Serve una seconda versione o modificare quella esistente rimuovendo il filtro.

**Scelta:** aggiungere il parametro opzionale `includeInactive: boolean = false` per non rompere i consumatori esistenti (la matrice usa `getOperators` separato, non `subscribeOperators`).

```typescript
export function subscribeOperators(
  nucleoId: string,
  callback: (operators: Operator[]) => void,
  includeInactive = false
): Unsubscribe
```

Quando `includeInactive = true`, omette il filtro `where('active', '==', true)`.

---

## Modifiche Firestore Security Rules

Nessuna modifica necessaria. La regola esistente per `nuclei/{nucleoId}/operators/{operatorId}` permette già `write` a chi ha `canWrite(nucleoId)` (RAA del nucleo e Coordinatrice).

La regola `users/{userId}` permette già `update` alla Coordinatrice. Per la RAA, l'aggiornamento del campo `name` in `users/{uid}` richiede un piccolo aggiustamento: aggiungere `allow update` limitato al campo `name` per utenti OSS del proprio nucleo.

```
allow update: if isCoordinatrice() ||
  (isAuth() &&
   canWrite(resource.data.nucleoId) &&
   resource.data.role == 'oss' &&
   request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name']));
```

---

## File da creare/modificare

| File | Azione | Responsabilità |
|------|--------|----------------|
| `lib/firebase/firestore.ts` | Modifica | Aggiungere `updateOperator`; aggiungere param `includeInactive` a `subscribeOperators` |
| `components/impostazioni/EditaOperatoreModal.tsx` | **Crea** | Modal pre-compilato con form + bottone disattiva/riattiva |
| `app/(app)/impostazioni/operatori/page.tsx` | Modifica | Lista senza filtro attivo, stile tachado, bottone ✏️, link ← Matrice |
| `app/(app)/impostazioni/cicli/page.tsx` | Modifica | Aggiungere link ← Matrice |
| `firestore.rules` | Modifica | Permettere alla RAA di aggiornare solo il campo `name` degli OSS del proprio nucleo |

---

## Fuori scope

- Modificare email/username (richiede re-creazione account Auth)
- Eliminazione permanente di un operatore
- Storico delle modifiche
- Reattivazione dalla matrice (solo dalla pagina operatori)
