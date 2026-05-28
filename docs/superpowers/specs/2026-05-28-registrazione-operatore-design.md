# Registrazione Operatore — Design Spec

> Documento approvato il 28/05/2026. Lingua del codice e UI: italiano.

---

## Obiettivo

Permettere alla RAA (e alla Coordinatrice) di registrare un nuovo operatore direttamente dall'interfaccia web, generando automaticamente un account Firebase Auth con username deterministico e password iniziale uguale all'username.

---

## Contesto

- Il sistema ha 3 ruoli: `coordinatrice`, `raa`, `oss`
- Gli operatori OSS esistenti sono stati creati via seed script
- Ogni operatore ha due documenti Firestore: `users/{uid}` (profilo auth) e `nuclei/{nucleoId}/operators/{uid}` (dati matrice)
- La RAA gestisce un solo nucleo; la Coordinatrice gestisce tutti i nuclei

---

## Regola di generazione username

```
username = cognome_normalizzato[0:5] + nome_normalizzato[0:3]
```

Normalizzazione: lowercase, accenti rimossi (è→e, à→a, ecc.), solo caratteri `[a-z]`.

Esempi:
- "Mario Rossi" → `rossimar`
- "Sonila Mucka" → `muckason`
- "Ana Rè" → `reana`
- "Ed Li" → `lied`

**Email:** `{username}@turnichiari.it`
**Password iniziale:** `{username}`

**Collisione:** se l'email esiste già in Firebase Auth, si tenta `{username}2`, `{username}3` … fino a `{username}9`. Dopo 9 tentativi falliti si mostra errore e si chiede di modificare nome/cognome.

---

## Componenti UI

### Pagina lista operatori

**Route:** `/impostazioni/operatori`
**Accesso:** RAA e Coordinatrice (OSS → "Accesso non autorizzato")

Mostra la lista di tutti gli operatori del nucleo con:
- Nome
- Badge contratto (FT / PT)
- ★ se `hasFSCertification`
- Badge stato (Attivo / Inattivo)
- Pulsante **"+ Nuovo operatore"** in alto a destra → apre `NuovoOperatoreModal`

### NuovoOperatoreModal

Modal con form:

| Campo | Tipo | Obbligatorio |
|-------|------|-------------|
| Cognome | testo | ✓ |
| Nome | testo | ✓ |
| Tipo contratto | dropdown (`fulltime` / `parttime`) | ✓ |
| Nucleo | dropdown (lista nuclei) | Solo Coordinatrice |
| Certificazione antincendio ★ | checkbox | — |

Preview di sola lettura sotto il form:
```
Username:         rossimar
Email:            rossimar@turnichiari.it
Password iniziale: rossimar
```

Il preview si aggiorna in tempo reale mentre la RAA digita nome/cognome.

Pulsanti: **Registra** | **Annulla**

Comportamento **Registra**:
1. Genera username
2. Crea account Firebase Auth (via app secondaria)
3. Scrive `users/{uid}` e `nuclei/{nucleoId}/operators/{uid}` in Firestore
4. Chiude il modal → la lista si aggiorna in real-time

### Navigazione Topbar

Aggiungere link **"Operatori"** accanto a "Impostazioni" nella Topbar, visibile solo a RAA e Coordinatrice. Punta a `/impostazioni/operatori`.

---

## Architettura tecnica

### Creazione account senza disconnettere la RAA

Firebase `createUserWithEmailAndPassword` logga automaticamente il nuovo utente, disconnettendo la RAA. Soluzione: **secondary Firebase app**.

```typescript
// lib/firebase/createUserSecondary.ts
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { firebaseConfig } from './config'

export async function createAuthUserSecondary(email: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, 'secondary-' + Date.now())
  try {
    const secondaryAuth = getAuth(secondaryApp)
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    return cred.user.uid
  } finally {
    await deleteApp(secondaryApp)
  }
}
```

### Funzione pura per il username

```typescript
// lib/utils/username.ts
export function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

export function generateUsername(nome: string, cognome: string): string {
  return normalizeStr(cognome).slice(0, 5) + normalizeStr(nome).slice(0, 3)
}
```

### Funzione Firestore `createOperator`

```typescript
// in lib/firebase/firestore.ts
export async function createOperator(
  nucleoId: string,
  data: {
    nome: string
    cognome: string
    contractType: ContractType
    hasFSCertification: boolean
  }
): Promise<{ uid: string; username: string }>
```

Internamente:
1. Genera username base
2. Prova `createAuthUserSecondary` con incremento numerico se collide (max 9)
3. Scrive `users/{uid}` con `{ email, name: cognome + ' ' + nome, role: 'oss', nucleoId }`
4. Scrive `nuclei/{nucleoId}/operators/{uid}` con i campi operatore
5. Ritorna `{ uid, username }`

### Hook `subscribeOperators`

```typescript
// in lib/firebase/firestore.ts
export function subscribeOperators(
  nucleoId: string,
  callback: (operators: Operator[]) => void
): () => void
```

Già esiste `getOperators` (one-shot). Aggiungere la versione realtime con `onSnapshot`.

---

## Modifiche Firestore Security Rules

La regola attuale per `users` permette la scrittura solo alla Coordinatrice:

```
allow write: if isCoordinatrice();
```

Aggiornare per permettere anche alla RAA di **creare** (non modificare) profili OSS nel proprio nucleo:

```
// users/{userId}
allow create: if isAuth() &&
  canWrite(request.resource.data.nucleoId) &&
  request.resource.data.role == 'oss';
allow update, delete: if isCoordinatrice();
allow read: if isAuth() && (request.auth.uid == userId || isCoordinatrice());
```

---

## File da creare/modificare

| File | Azione | Responsabilità |
|------|--------|----------------|
| `lib/utils/username.ts` | **Crea** | `generateUsername`, `normalizeStr` — funzioni pure |
| `lib/utils/__tests__/username.test.ts` | **Crea** | Test TDD per username generation |
| `lib/firebase/createUserSecondary.ts` | **Crea** | `createAuthUserSecondary` — app Firebase secondaria |
| `lib/firebase/firestore.ts` | Modifica | Aggiungere `createOperator`, `subscribeOperators` |
| `components/impostazioni/NuovoOperatoreModal.tsx` | **Crea** | Modal con form + preview username |
| `app/(app)/impostazioni/operatori/page.tsx` | **Crea** | Pagina lista operatori |
| `components/layout/Topbar.tsx` | Modifica | Aggiungere link "Operatori" |
| `firestore.rules` | Modifica | Permettere alla RAA di creare profili OSS |

---

## Fuori scope

- Modifica/disattivazione di un operatore esistente (Fase successiva)
- Reset della password da UI (Fase successiva)
- Notifica email al nuovo operatore (Fase successiva)
- Cambio password al primo accesso — l'OSS può farlo manualmente da Firebase, oppure aggiungere in futuro

---

*Spec approvato — pronto per il piano di implementazione*
