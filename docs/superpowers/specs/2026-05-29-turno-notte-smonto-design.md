# Turno Notte (N1 + N2 in coppia) — Design Spec

> Documento approvato il 29/05/2026. Lingua del codice e UI: italiano.

---

## Obiettivo

Quando la RAA (o la Coordinatrice) assegna **manualmente** il turno notte a un operatore, il sistema deve collocare automaticamente **entrambe le metà** del turno:

- **N1** (21:00–00:00) nel giorno scelto `D`
- **N2** (00:00–06:30, lo *smonto*) nel giorno successivo `D+1`

Un turno notte è un'unica giornata lavorativa che attraversa la mezzanotte; nella matrice (una colonna per giorno di calendario) appare come due celle in due giorni consecutivi.

Oggi questo accoppiamento avviene solo tramite "Genera mese" (il ciclo `['R','M1','M2','P1','N1','N2']` mette N1 e N2 consecutivi). L'assegnazione manuale di una singola cella NON propaga lo smonto: questa spec colma quel divario.

---

## Decisioni approvate

| Tema | Decisione |
|------|-----------|
| Selezione | Una sola voce **"Notte"** nel dropdown. N1 e N2 NON sono più selezionabili singolarmente a mano. |
| Coppia | N1 e N2 vanno sempre insieme: cambiare o rimuovere il N1 elimina il N2 del giorno successivo. |
| Cella N2 | **Sola lettura**: si modifica agendo sul N1 del giorno precedente. |
| Sovrascrittura | Il N2 sovrascrive **sempre** ciò che c'era nel giorno successivo (per legge non esiste altro turno possibile dopo la notte). |
| Fine mese | Se N1 cade nell'ultimo giorno del mese, N2 va nel **giorno 1 del mese successivo** (dicembre → gennaio anno dopo). Obbligatorio supportarlo. |

---

## Architettura (Approccio A: modulo logico + helper Firestore)

### Sorgente di verità della coppia

```typescript
// lib/shifts/nightShift.ts
export const NIGHT = { start: 'N1', smonto: 'N2' } as const
```

Dropdown, validazione legale e helper Firestore usano questa costante invece di stringhe 'N1'/'N2' sparse. (Nota: `lib/validation/legal.ts` riga 50 contiene già un controllo hardcoded `prevShift.code === 'N1' && nextShift.code === 'N2'`; verrà aggiornato per usare `NIGHT`.)

Il catalogo turni del nucleo continua a contenere N1 e N2 come `ShiftType` separati (colori, orari, durate). Cambia solo **come si selezionano**, non come si renderizzano.

### Funzione pura — calcolo dello smonto

```typescript
// lib/shifts/nightShift.ts
export function nextSmontoTarget(
  year: number,
  month: number,   // 1-based
  day: number
): { year: number; month: number; day: number }
```

Regole:
- Se `day < giorniNelMese(year, month)` → `{ year, month, day: day + 1 }`
- Se `day === giorniNelMese(year, month)` (ultimo giorno):
  - se `month < 12` → `{ year, month: month + 1, day: 1 }`
  - se `month === 12` → `{ year: year + 1, month: 1, day: 1 }`

Pura, nessun accesso a Firestore. Riusa `getDaysInMonth` da `lib/cycle/cycleEngine.ts`.

### Helper Firestore (scrittura atomica, cross-month)

```typescript
// lib/firebase/firestore.ts

// Colloca N1 in (year, month, day) e N2 nel giorno successivo (anche su mese diverso).
// Sovrascrive sempre. writeBatch → atomico anche su due documenti matrice/{yyyy-MM}.
// isOverride: true se la cella N1 conteneva già un turno (calcolato dal dropdown,
// stessa logica di oggi). Applicato a entrambe le celle come isManualOverride.
export async function setNightShift(
  nucleoId: string,
  year: number,
  month: number,
  day: number,
  operatorId: string,
  updatedBy: string,
  isOverride: boolean
): Promise<void>

// Rimuove il N2 (smonto) accoppiato al N1 in (year, month, day).
// Usa deleteField() sulla cella del giorno successivo (anche su mese diverso).
export async function clearNightSmonto(
  nucleoId: string,
  year: number,
  month: number,
  day: number,
  operatorId: string
): Promise<void>
```

**`setNightShift`** costruisce un `writeBatch`:
- `matrice/{year-month}` → `{ [operatorId]: { [day]: { code: 'N1', updatedAt, updatedBy, isManualOverride: isOverride } } }` (merge)
- `matrice/{targetYear-targetMonth}` → `{ [operatorId]: { [targetDay]: { code: 'N2', updatedAt, updatedBy, isManualOverride: isOverride } } }` (merge)

Lo `yearMonth` si formatta come `${year}-${String(month).padStart(2,'0')}` (stessa convenzione di `MatriceGrid`).

**`clearNightSmonto`** costruisce un `writeBatch` che applica `deleteField()` alla chiave `[targetDay]` del giorno successivo nel documento di mese corretto. Si appoggia all'invariante della coppia: un N1 implica **sempre** un N2 il giorno dopo (garantito sia da questa feature sia da "Genera mese"), quindi il `deleteField()` è sicuro senza una lettura aggiuntiva. La funzione viene chiamata dal routing solo quando il codice precedente della cella era `NIGHT.start`.

### Routing — `MatriceGrid.handleCellSelect`

Firma estesa per sapere quale codice c'era prima nella cella (`previousCode`):

```typescript
handleCellSelect(operatorId, day, entry, previousCode?)
```

Logica:
1. **Nuovo codice === "Notte"** (azione sintetica dal dropdown) → `setNightShift(...)`.
2. **`previousCode === NIGHT.start`** (la cella era un N1) **e** nuovo codice ≠ N1 → prima `clearNightSmonto(...)`, poi `updateMatriceCell(...)` col nuovo valore.
3. Altrimenti → `updateMatriceCell(...)` come oggi.

Tutte le scritture restano dentro un `try/catch` con `console.error` (come dopo il fix recente).

### UI

**`CellDropdown`:**
- Filtra fuori dalla lista i turni con codice `NIGHT.start` e `NIGHT.smonto`.
- Aggiunge una voce sintetica unica **"Notte"** (mostra l'orario complessivo 21:00–06:30, colore di N1). Selezionandola chiama `onSelectNight(isOverride)` invece di `onSelect(entry)`, dove `isOverride` è calcolato come oggi (`currentCode !== undefined && currentCode !== '—'`).
- La voce "Notte" è bloccata (disabilitata) se collocare N1 genera una violazione legale rispetto al giorno precedente — stessa logica `violations` già esistente, valutata sul codice `NIGHT.start`.

**`MatriceCell`:**
- Se `entry?.code === NIGHT.smonto` → cella **sola lettura**: niente apertura dropdown al click, `cursor-default`, `title="Smonto notte — modifica il turno N1 del giorno precedente"`, e un piccolo indicatore visivo (icona 🌙) per chiarire che è la coda della notte. Resta visibile col colore di N2.
- Le altre celle restano invariate.

**Propagazione `previousCode`:** `MatriceRow` passa già `entry` a ogni cella; passerà anche il codice corrente al callback di selezione affinché `MatriceGrid` distingua il caso 2.

### Validazione legale

- Il dropdown blocca "Notte" se `getViolationsForCell(prevShift, N1shift, weekShifts)` ritorna violazioni (riuso del meccanismo attuale).
- La coppia N1→N2 è già esente dal riposo di 11h (`legal.ts`), aggiornata per usare `NIGHT`.
- Il giorno successivo allo smonto (D+2) non viene toccato: lo assegna la RAA.

### Comportamento cross-month visualizzato

Aprendo un mese il cui **giorno 1 è un N2** (il cui N1 sta nel mese precedente), il N2 si vede normalmente in sola lettura. Per rimuoverlo si va al mese precedente e si modifica il N1 dell'ultimo giorno. Coerente con la regola "N2 si edita dal N1".

---

## File da creare/modificare

| File | Azione | Responsabilità |
|------|--------|----------------|
| `lib/shifts/nightShift.ts` | **Crea** | Costante `NIGHT` + funzione pura `nextSmontoTarget` |
| `lib/shifts/__tests__/nightShift.test.ts` | **Crea** | Test casi limite date (metà mese, 30/31, feb 28/29, 31 dic) |
| `lib/firebase/firestore.ts` | Modifica | `setNightShift`, `clearNightSmonto` (writeBatch cross-month) |
| `lib/firebase/__tests__/nightShift.firestore.test.ts` | **Crea** | Test con Firestore mockato: verifica celle scritte/cancellate corrette |
| `lib/validation/legal.ts` | Modifica | Usare `NIGHT` invece di stringhe hardcoded 'N1'/'N2' |
| `components/matrice/CellDropdown.tsx` | Modifica | Nasconde N1/N2, aggiunge voce "Notte", callback `onSelectNight` |
| `components/matrice/MatriceCell.tsx` | Modifica | Cella N2 in sola lettura + indicatore 🌙 |
| `components/matrice/MatriceRow.tsx` | Modifica | Propaga `previousCode` al callback di selezione |
| `components/matrice/MatriceGrid.tsx` | Modifica | Routing in `handleCellSelect`: night / clear-pair / normale |

---

## Fuori scope

- Validazione legale cross-month generale (il giorno 1 che "vede" l'ultimo turno del mese precedente) — resta watch item.
- Modifica del motore di cicli / "Genera mese" (colloca già N1/N2 correttamente).
- Banca ore (feature separata, in attesa della busta paga).
- Cloud Function per la propagazione lato server (Approccio B scartato per ora).

---

## Criteri di accettazione

1. Selezionando "Notte" su un giorno `D` a metà mese → la cella `D` mostra N1 e la cella `D+1` mostra N2.
2. Selezionando "Notte" sull'ultimo giorno del mese → N2 appare nel giorno 1 del mese successivo (verificabile cambiando mese).
3. La cella N2 non apre il dropdown al click e mostra il tooltip dello smonto.
4. Cambiando un N1 in un altro turno → il N2 accoppiato del giorno successivo sparisce.
5. N1 e N2 non compaiono più come voci singole nel dropdown.
6. "Notte" è disabilitata se viola il riposo di 11h rispetto al giorno precedente.
7. "Genera mese" continua a funzionare identico a prima.
