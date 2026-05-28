# Generazione Automatica Matrice — Design Spec

> Documento approvato il 28/05/2026. Lingua del codice e UI: italiano.

---

## Obiettivo

Eliminare il lavoro manuale della RAA nel calcolo mensile dei turni. Invece di 10 giorni di Excel, la RAA clicca **"Genera mese"** e il mese appare completo in pochi secondi. Poi aggiusta solo le eccezioni (ferie, permessi, b.o.).

---

## Contesto reale (Nucleo B)

- **13 operatori full-time** con contratto standard + Linda (contratto vecchio, trattata come standard)
- **2 operatori part-time**: Carlos, Daniela — schema settimanale fisso, nessuna rotazione
- **1 operatore speciale**: Majlinda (congedo lungo in giugno — trattata come full-time quando presente)
- La RAA inizia il calcolo circa il 15 del mese corrente e pubblica intorno al 25

---

## Ciclo di rotazione

### Scoperta chiave: ciclo di 6 giorni (non 7)

Analizzando i dati reali di maggio e giugno 2026, il turno N1 si ripete ogni **6 giorni** per ogni operatore full-time. Il periodo del ciclo è confermato per: Sonila, Zeinab, Wassim, Lumturi, Karina.

### Struttura del ciclo (6 posizioni)

```
Posizione 0: R   — riposo obbligatorio (sempre dopo N2)
Posizione 1: ?   — turno lavoro (M o P, specifico per operatore)
Posizione 2: ?   — turno lavoro (M o P, specifico per operatore)
Posizione 3: ?   — turno lavoro (M o P, specifico per operatore)
Posizione 4: N1  — 21:00–00:00 (fisso per tutti)
Posizione 5: N2  — 00:00–06:30 (fisso per tutti)
```

Le posizioni 1–3 variano per operatore. Esempi reali:
- Sonila: `[R, M1, P1, P2, N1, N2]` — 1 mattina, 2 pomeriggi
- Zeinab: `[R, M1, M2, P1, N1, N2]` — 2 mattine, 1 pomeriggio
- Lumturi: `[R, P2, M1, M2, N1, N2]` — 1 pomeriggio, 2 mattine (ordine diverso)

### Turni N1 e N2 — split della notte

Il turno notturno non è un singolo codice `N` ma **due codici consecutivi**:
- `N1` (21:00–00:00): assegnato al giorno D
- `N2` (00:00–06:30): assegnato al giorno D+1

N1→N2 è un'unica prestazione lavorativa che attraversa la mezzanotte. La regola delle 11h di riposo **non si applica** tra N1 e N2. Dopo N2 viene sempre R (posizione 0 del ciclo successivo).

### Formula di generazione

```
turno_giorno_D = operatore.ciclo[(operatore.fase + D - 1) % 6]
```

dove `D` è il giorno del mese (1-based) e `fase` è la posizione nel ciclo il giorno 1 del mese.

### Transizione tra mesi (automatica)

```
faseMeseSuccessivo = (faseMeseCorrente + giorniNelMese) % 6
```

Esempi:
- Giugno (30 giorni) → Luglio: `(fase + 30) % 6` = `(fase + 0) % 6` = stessa fase
- Maggio (31 giorni) → Giugno: `(fase + 31) % 6` = `(fase + 1) % 6`
- Luglio (31 giorni) → Agosto: `(fase + 31) % 6` = `(fase + 1) % 6`

> Nota: giugno ha 30 giorni → 30 % 6 = 0 → la fase di luglio è identica a quella di giugno.

### Fasi confermate per giugno 2026

| Operatore   | Turno 01/06 | Fase |
|-------------|-------------|------|
| Sonila      | R           | 0    |
| Zeinab      | M1          | 1    |
| Rebecca     | P1          | 2    |
| Lumturi     | P2          | 3    |
| Karina      | P2          | 3    |
| Victoryia   | M1          | 1    |
| Betty       | N1          | 4    |
| Wassim      | R           | 0    |
| Malagoli.V  | R           | 0    |

### Schema part-time (Carlos, Daniela)

Schema fisso settimanale — nessuna rotazione. Array di 7 codici indicizzati per giorno della settimana (0=Lunedì … 6=Domenica):

```
Carlos:  [M_PT, M_PT, M_PT, M_PT, M_PT, R, R]   // 7:00-12:00, sabato/domenica riposo
Daniela: [M1,   PM,   R,    M_PT, M_PT, M_PT, R]  // schema approssimativo da verificare
```

> I pattern esatti vanno confermati con la RAA al momento della configurazione.

---

## Modifiche al modello dati

### Nuovi codici turno

Aggiungere a `SYSTEM_SHIFTS` in `lib/types/index.ts`:

| Codice | Orario       | Descrizione         |
|--------|--------------|---------------------|
| `N1`   | 21:00–00:00  | Prima metà notte    |
| `N2`   | 00:00–06:30  | Seconda metà notte  |

Il codice `N` (21:00–06:30) rimane per retrocompatibilità ma non viene più generato automaticamente.

### Operator (Firestore: `nuclei/{nucleoId}/operators/{uid}`)

```typescript
interface Operator {
  // campi esistenti
  id: string
  name: string
  nucleoId: string
  active: boolean
  contractType: 'fulltime' | 'parttime'   // NUOVO

  // solo full-time
  cycle?: string[]        // array di 6 codici es. ['R','M1','P1','P2','N1','N2']
  cyclePhase?: number     // 0–5, fase nel ciclo il giorno 1 del mese corrente
  cycleMonth?: string     // 'YYYY-MM' — a quale mese si riferisce cyclePhase

  // solo part-time
  weeklyPattern?: string[] // array di 7 codici, indice 0=Lunedì

  // opzionale
  hasFSCertification?: boolean  // stella ★ = certificato antincendio
}
```

### MatriceDayEntry (esistente, piccola aggiunta)

```typescript
interface MatriceDayEntry {
  code: string
  note?: string
  updatedAt: number
  updatedBy?: string
  isManualOverride?: boolean   // NUOVO — true se la RAA ha modificato un turno generato
  originalCode?: string        // NUOVO — valore originale prima della modifica manuale
}
```

---

## Componenti UI

### 1. Pulsante "Genera mese"

Posizione: barra sopra la matrice, a destra del navigatore mese. Visibile solo a RAA e Coordinatrice.

```
‹  giugno 2026  ›  [Oggi]          [⚡ Genera mese]
```

Comportamento:
- Apre `GeneraMeseModal`
- Disabilitato se il mese è già stato generato (con tooltip "Già generato — usa le celle per modificare")

### 2. GeneraMeseModal

Modal di conferma con:
- Riepilogo: "Verranno generati X giorni per Y operatori"
- Avviso: "Le celle già compilate non verranno toccate"
- Pulsanti: **Genera** | **Annulla**

Dopo conferma:
- Calcola tutti i turni via `generateMatrice()`
- Scrive in Firestore solo le celle vuote (merge)
- Salva la fase del mese successivo su ogni operatore (`cyclePhase` + `cycleMonth`)
- Chiude il modal → la matrice si aggiorna in real-time via `subscribeMatrice`

### 3. Schermata "Configurazione cicli" (Impostazioni)

Percorso: Impostazioni → Cicli turni  
Accessibile a: RAA e Coordinatrice

Per ogni operatore full-time — riga con:
- Nome operatore
- 3 selettori dropdown per posizioni 1, 2, 3 del ciclo (opzioni: M1, M2, MP, P1, P2)
- Selettore fase corrente (0–5, con label del turno corrispondente es. "0 = R, 1 = M1, …")
- Badge visivo del ciclo: 6 quadratini colorati in sequenza

Per ogni operatore part-time — riga con:
- 7 selettori (uno per giorno settimana Lun–Dom)

Pulsante **Salva configurazione** → scrive in Firestore.

### 4. Indicatore cella modificata manualmente

Quando `isManualOverride === true`:
- Punto arancione (●) nell'angolo superiore destro della cella
- Tooltip al hover: `"Originale: M1"` (mostra `originalCode`)

```
┌──────────┐   ┌──────────●┐
│   M1     │   │   P2      │  ← modificata dalla RAA
└──────────┘   └───────────┘
```

---

## Logica di generazione (file: `lib/cycle/cycleEngine.ts`)

```typescript
// Genera tutti i turni del mese per un operatore full-time
function generateOperatorMonth(
  operator: Operator,
  year: number,
  month: number  // 1-12
): Record<number, string>   // { dayNumber: shiftCode }

// Calcola la fase per il mese successivo
function nextMonthPhase(currentPhase: number, daysInMonth: number): number

// Verifica se N1→N2 sono consecutivi validi (non viola le 11h)
function isValidN1N2Sequence(day: number, nextDayCode: string): boolean
```

---

## Regole di validazione aggiornate

Il motore legale (`lib/validation/legal.ts`) va aggiornato:

- **N1 → N2**: sempre valido (stessa prestazione lavorativa che attraversa la mezzanotte) — nessun controllo 11h
- **N2 → R**: sempre valido — R è il riposo obbligatorio dopo la notte
- **N2 → qualsiasi turno di lavoro**: bloccare se non c'è R in mezzo

---

## File da creare/modificare

| File | Azione | Responsabilità |
|------|--------|----------------|
| `lib/types/index.ts` | Modifica | Aggiungere N1, N2, aggiornare `Operator`, `MatriceDayEntry` |
| `lib/cycle/cycleEngine.ts` | Crea | Funzioni pure: generazione mese, calcolo fase, validazione N1→N2 |
| `lib/validation/legal.ts` | Modifica | Aggiungere regola N1→N2 valido, N2→lavoro bloccato |
| `lib/firebase/firestore.ts` | Modifica | Aggiungere `bulkUpdateMatrice`, `updateOperatorCycle` |
| `components/matrice/MatriceCell.tsx` | Modifica | Mostrare punto arancione + tooltip se `isManualOverride` |
| `components/matrice/CellDropdown.tsx` | Modifica | Impostare `isManualOverride=true` + `originalCode` alla selezione |
| `components/matrice/GeneraMeseModal.tsx` | Crea | Modal conferma + logica di generazione |
| `app/(app)/matrice/page.tsx` | Modifica | Aggiungere pulsante "Genera mese" |
| `app/(app)/impostazioni/cicli/page.tsx` | Crea | Schermata configurazione cicli operatori |
| `components/impostazioni/CicloOperatoreRow.tsx` | Crea | Riga configurazione per singolo operatore |
| `scripts/seed-production.ts` | Modifica | Aggiungere `cycle`, `cyclePhase`, `contractType` agli operatori |

---

## Fuori scope (Fase 3)

- Gestione AUTOSOSTITUZIONE cross-nucleo
- Generazione automatica proposta con AI (suggerimenti copertura)
- Notifiche push alla pubblicazione del mese

---

*Spec approvato — pronto per il piano di implementazione*
