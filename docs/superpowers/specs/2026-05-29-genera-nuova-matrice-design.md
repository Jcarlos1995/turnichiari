# Genera Nuova Matrice (auto-reparto por cobertura) — Design Spec

> Documento approvato il 29/05/2026. Lingua del codice e UI: italiano.
> **Stato:** disegno approvato; implementazione in attesa (l'utente ha dato priorità a "Banca ore", in attesa delle buste paga). Questo spec preserva il disegno per quando si riprende.

---

## Obiettivo

Aggiungere un secondo modo di generazione della matrice: oltre all'attuale "Genera mese" (basato sui cicli per-operatore), un **"Genera nuova matrice"** che costruisce il mese **da zero**, ignorando i mesi precedenti, ripartendo automaticamente i turni tra gli operatori disponibili in base alla **copertura richiesta**, alle **ore settimanali per contratto** e alle **regole legali**.

---

## UI — bottone e flusso

Il bottone attuale **⚡ Genera mese** diventa un **bottone con dropdown** a due voci:

- **Genera mese** → apre l'attuale `GeneraMeseModal`, invariato (cicli + fase, rispetta le celle esistenti, fa avanzare la fase del mese successivo).
- **Genera nuova matrice** → apre il nuovo modal. Genera il **mese attualmente visualizzato** (se vedi maggio genera maggio), **da zero**, ignorando i mesi precedenti e **sovrascrivendo l'intero mese corrente** (con conferma esplicita, perché cancella ciò che c'è).

## Modal "Genera nuova matrice"

- **Step 1 — Eccezioni:** elenco di tutti gli operatori; per ciascuno si possono aggiungere righe di eccezione → tipo (Ferie / 104 / Malattia / Congedo / Permesso) + intervallo di date (da–a dentro il mese; 104 ammette giorni singoli).
- **Step 2 — Genera:** esegue il motore, scrive la matrice e mostra un **report** (posti scoperti per giorno/turno, operatori sopra/sotto le ore, chi non ha potuto fare la notte obbligatoria).

---

## Motore (euristica greedy giorno-per-giorno) — Approccio A

Funzione **pura** e testabile, indicativamente:

```
generateNuovaMatrice(operators, year, month, exceptions, coverage, shiftCatalog)
  → { matrice: GeneratedMonth, report: GenerationReport }
```

### Ore per turno (dai tempi del catalogo Nucleo B)

| Turno | Orario | Ore |
|-------|--------|-----|
| M1 | 06:30–13:30 | 7 |
| M2 | 07:00–14:00 | 7 |
| MP | 07:00–12:00 | 5 |
| P1 | 14:00–21:00 | 7 |
| P2 | 14:30–21:00 | 6.5 |
| Notte (N1 21:00–00:00 + N2 00:00–06:30) | | 9.5 (accreditate alla settimana del giorno di inizio) |

### Domanda giornaliera (copertura fissa, 7 giorni su 7)

1 inizio notte (N1) + posti di giorno: **M1×2, M2×1, MP×1, P1×1, P2×2** (= 7 posti giorno). Il N2 (smonto) di ogni giorno è occupato automaticamente da chi ha fatto N1 il giorno prima; quell'operatore ha **R forzato** il giorno dopo lo smonto (blocco N1→N2→R).

### Per ogni giorno (in ordine)

1. **Celle forzate prima:** N2 a chi ha fatto N1 ieri; R a chi ha fatto lo smonto ieri; **eccezioni** dal modal (F/104/ML/CO/PE) nelle loro date.
2. **Assegnare l'inizio notte (N1):** solo FT disponibili e legali; preferisce il FT che non ha ancora fatto la **notte obbligatoria** della settimana; spareggio per chi è più lontano dalla meta ore, poi per meno notti accumulate (equità).
3. **Riempire i posti di giorno** (prima i più scarsi, P2/M1 che chiedono 2): candidati idonei e disponibili (**PT solo giorno; MP preferito per PT**), legali; preferisce chi è più sotto la meta ore; spareggio per equità. Posto non copribile legalmente → **vuoto + segnalato**.
4. Operatori non assegnati (e senza eccezione/R forzato) → **R**. Si garantiscono i riposi minimi (FT ≥1/sett, PT ≥2/sett, + notte→riposo).

### Regole dure (legale SEMPRE prima)

11h tra turni, ≥1 riposo/7 giorni, max 48h/settimana, notte→smonto→riposo. Se coprire un posto violerebbe la legge → il posto NON si copre e si segnala. (Riusa `lib/validation/legal.ts`.)

### Ore settimanali (Lun–Dom)

Meta FT 40h / PT 28h, **proporzionate** nelle settimane parziali ai bordi del mese (× giorni-nel-mese / 7). Un **giorno di eccezione accredita una giornata standard** (FT 8h, PT 5.6h = meta/5) che **riduce** la meta di quella settimana. *(Formula di accredito tunable; da rifinire con le buste paga.)*

### Vincoli strutturali per contratto

- **Full-time:** 40h/sett + **1 notte obbligatoria/sett** + **1 riposo obbligatorio/sett** (di norma dopo lo smonto).
- **Part-time:** 28h/sett + **2 riposi/sett**; turni part-time (MP) + alcuni turni di giorno FT per arrivare alla meta. **Mai notte in automatico** (ma la notte manuale per un PT NON è bloccata, per emergenza estrema).

### Idoneità

- **N1 (inizio notte):** solo FT.
- **Posti di giorno (M1/M2/MP/P1/P2):** FT o PT (PT solo giorno). MP preferito per PT.

---

## Visualizzazione dei posti scoperti (richiesta esplicita)

Una cella/posto che il motore lascia **scoperto** (da coprire poi manualmente con autosostituzione) si rende nella matrice con uno **stile dedicato: bordo rosso + segnale di avviso**, chiaramente distinto dal riposo (`—`/R), così la RAA vede a colpo d'occhio quali turni mancano da coprire. Il report finale elenca anche questi posti (giorno + turno).

---

## Dati / persistenza

- Riusa la struttura matrice `{ operatorId: { day: { code, updatedAt, updatedBy, isManualOverride } } }`.
- "Nuova matrice" **cancella il mese corrente e scrive il mese completo** generato. Le eccezioni restano scritte col loro codice (F/104/ML/CO/PE).
- I posti scoperti vanno rappresentati in modo da distinguersi dal riposo (es. un marcatore/flag nella cella, p.es. `code` vuoto + `uncovered: true`, oppure un set di celle scoperte nel report usato dalla griglia per il bordo rosso). Dettaglio implementativo da definire nel piano.
- **Non tocca** `cycle`/`cyclePhase` degli operatori (quelli sono solo di "Genera mese").

---

## Fuori scope (per ora)

- **Autosostituzione** (coprire assenze reali / posti scoperti) — Fase 3.
- **Banca ore** — feature separata (in attesa delle buste paga FT + PT per la formula esatta).
- Continuità col mese precedente (la nuova matrice ignora la storia di proposito).
- Festivi nazionali distinti dal weekend (oggi la copertura è uguale tutti i giorni).

---

## Testing

Il motore è una **funzione pura** → test unitari:
- copertura soddisfatta in un caso semplice con organico sufficiente;
- blocco notte→smonto→riposo applicato correttamente;
- un'eccezione (ferie/104/…) blocca i giorni indicati e accredita le ore;
- un PT non riceve mai una notte in automatico;
- riposo legale (11h, 1/7gg) sempre rispettato;
- posto segnalato come **scoperto** quando l'organico disponibile è insufficiente (e compare nel report).

---

## Decisioni di default modificabili

- Formula di accredito ore delle eccezioni (giornata = meta/5).
- Ordine di riempimento dei posti (scarsi prima).
- Criteri di spareggio (equità per ore / numero di notti).

---

## Alternative di motore scartate (registrate per il futuro)

- **B — Solver CSP/ILP reale:** qualità migliore, ma dipendenza pesante + probabile Cloud Function/WASM, più lento. Possibile upgrade futuro se l'euristica non basta.
- **C — Template ciclici scaglionati + riparazione:** copertura garantita per costruzione, ma rigido e difficile con ore per contratto + copertura disomogenea.
