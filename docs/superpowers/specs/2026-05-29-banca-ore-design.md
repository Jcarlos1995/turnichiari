# Banca Ore — Design Spec

> Documento approvato il 29/05/2026. Lingua del codice e UI: italiano.
> Basato sull'analisi di due buste paga reali (FT Agosto 2025, PT Aprile 2026) dell'azienda (Comparto Sanità, Modena).

---

## Obiettivo

Mostrare e gestire il **saldo di ORE (+/−)** di banca ore per ogni operatore: ore lavorate in più (festivo/domenica + straordinario) accumulate come credito, ore recuperate come debito, con **riporto da un mese all'altro**. È un saldo di **sole ore** (nessun calcolo di denaro/maggiorazioni — quello è la busta paga, fuori scope). L'app è un pianificatore, non un gestionale paghe.

Modello **ibrido**: l'app calcola il saldo automaticamente dalla matrice + calendario festivi + ore contrattuali, e la RAA può **aggiustarlo manualmente** (perché il lavorato reale a volte differisce dal pianificato).

**FT e PT hanno meccanismi distinti** (confermato dalle buste paga): il FT usa la **banca ore**; il PT usa **riposo compensativo + lavoro supplementare**.

---

## Nuovi codici turno (turni di sistema, 0 ore di lavoro)

- **`BO` — Recupero Banca Ore** (solo FT): giorno in cui il FT recupera ore dalla banca → **sottrae** dal saldo.
- **`RC` — Riposo Compensativo** (solo PT): → **sottrae** dal saldo PT.

Selezionabili nel dropdown della cella (sezione "Assenze"), come ferie/permessi. Si aggiungono al catalogo `SYSTEM_SHIFTS` in `lib/types/index.ts` con `operatorsPerDay: 0`, `isSystem: true`.

---

## Calendario festivi — `isFestivo(date): boolean`

Ritorna `true` se la data è **domenica** OPPURE un **festivo nazionale italiano**:
1 gennaio, 6 gennaio, **Lunedì dell'Angelo** (Pasquetta, calcolato dall'algoritmo di Pasqua/Computus), 25 aprile, 1 maggio, 2 giugno, 15 agosto, 1 novembre, 8 dicembre, 25 dicembre, 26 dicembre.

Il **sabato NON è festivo** (le buste paga mostrano maggiorazione "FEST/DOM", domenica+festivo, non sabato). Patrono locale fuori scope.

Vive in `lib/festivi/festivi.ts` (funzione pura + funzione Computus per la Pasqua).

---

## Ore per turno lavorato (dal catalogo Nucleo B)

M1 = 7h · M2 = 7h · MP = 5h · P1 = 7h · P2 = 6.5h · Notte (N1+N2) = 9.5h. I codici di sistema (R, F, ML, PE, 104, CO, INF, LU, AS, **BO**, **RC**) = 0h lavorate.

---

## Calcolo FULL-TIME (banca ore)

Su settimane **Lun–Dom**, proporzionate nelle settimane parziali ai bordi del mese (meta × giorni-nel-mese / 7).

**Accredito (+):**
- Ore lavorate in **domenica/festivo** (1:1).
- **Straordinario** = `max(0, ore_lavorate_NON_festive_della_settimana − 40)`. (Le ore festive sono già accreditate sopra, quindi vengono **escluse** dal calcolo straordinario per non contarle due volte.)

**Addebito (−):**
- Ore delle celle **`BO`** (recupero). Ogni cella BO sottrae una "giornata standard" FT = 8h (= 40/5) dal saldo. *(Valore tunable.)*

**Eccezioni** (ferie/104/ML/CO/PE): contano come **giornata adempiuta** → non generano straordinario né saldo negativo nella loro settimana.

**Saldo finale mese = carryIn + accredito − addebito + manualAdjust.**

---

## Calcolo PART-TIME (riposo compensativo)

Stesso schema, meta settimanale **28h**:

**Accredito (+):** ore lavorate in domenica/festivo (1:1) + **lavoro supplementare** = `max(0, ore_NON_festive_settimana − 28)`.
**Addebito (−):** ore delle celle **`RC`** (giornata standard PT = 28/5 = 5.6h per cella). *(Tunable.)*
Stesso riporto + aggiustamento manuale.

---

## Persistenza (ibrido + riporto)

Documento per **operatore/mese**: `nuclei/{nucleoId}/bancaOre/{yyyy-MM}` con mappa `{ [operatorId]: { carryIn, accrualFestivo, accrualStraord, usage, manualAdjust, closing } }` (oppure un doc per operatore/mese — dettaglio nel piano).

- La parte **calcolata** (`accrualFestivo`, `accrualStraord`, `usage`) si ricomputa dalla matrice del mese.
- `manualAdjust` lo imposta la RAA.
- `closing = carryIn + accrualFestivo + accrualStraord − usage + manualAdjust`.
- Il `closing` di un mese diventa il `carryIn` del mese successivo (riporto a catena).

---

## Motore = funzione pura testabile

```
computeBancaOre(operator, matriceMese, year, month, carryIn)
  → { accrualFestivo, accrualStraord, usage, delta, closing, breakdown }
```

Non accede a Firestore. Riusa `isFestivo`, le ore-per-turno e `getDaysInMonth`. Distingue FT (40h, BO) da PT (28h, RC) in base a `operator.contractType`.

---

## UI

Vista **"Banca ore"** (nuova pagina o sezione in impostazioni): tabella per operatore con colonne **Saldo iniziale · Maturato (festivo + straordinario) · Usato (BO/RC) · Rettifica manuale · Saldo finale**, con colore verde (+) / rosso (−). Link ← Matrice in alto (come le altre pagine impostazioni). I codici `BO`/`RC` diventano selezionabili nella matrice.

---

## Fuori scope

- Maggiorazioni in denaro (15%/20%/25%, +36% PT) — è la busta paga.
- Validazione esatta al centesimo del CCNL (si affina contro un mese reale; l'aggiustamento manuale copre le differenze).
- Patrono locale tra i festivi.
- Generazione automatica delle celle BO/RC (le mette la RAA manualmente).

---

## Nota di validazione

La regola straordinario-vs-festivo (sezioni 4–5) è il modello più ragionevole dedotto dalle buste paga reali, ma la ripartizione esatta tra "maturate per festivo" e "per straordinario" può variare per CCNL. Per questo il modello è **ibrido**: se un mese reale non torna, la RAA aggiusta a mano e, se serve, si rifinisce la formula validandola contro una busta paga con la matrice di quel mese.

---

## Testing

Funzione pura → test unitari:
- ora festiva/domenicale lavorata accredita 1:1;
- straordinario settimanale `max(0, ore_non_festive − 40)` (FT) / `− 28` (PT);
- cella BO sottrae 8h (FT), cella RC sottrae 5.6h (PT);
- eccezione (ferie/104) non genera straordinario né saldo negativo;
- riporto: closing di un mese = carryIn del successivo;
- `isFestivo`: domeniche + festivi nazionali (incl. Pasquetta calcolata), sabato escluso.

---

## File da creare/modificare (panoramica, dettaglio nel piano)

| File | Azione |
|------|--------|
| `lib/festivi/festivi.ts` (+ test) | Crea — `isFestivo` + Computus Pasqua |
| `lib/bancaore/bancaOre.ts` (+ test) | Crea — `computeBancaOre` (puro) |
| `lib/types/index.ts` | Modifica — codici sistema `BO`, `RC`; tipo saldo banca ore |
| `lib/firebase/firestore.ts` | Modifica — read/write `bancaOre/{yyyy-MM}` + helper riporto/manualAdjust |
| `components/matrice/CellDropdown.tsx` | Modifica — BO/RC selezionabili (BO per FT, RC per PT) |
| `app/(app)/impostazioni/banca-ore/page.tsx` | Crea — vista tabella saldi |
| Topbar / navigazione | Modifica — link alla vista Banca ore |
