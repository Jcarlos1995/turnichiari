# Orario Fisso Part-Time (quincenal A/B) — Design Spec

> Approvato il 29/05/2026. Lingua codice/UI: italiano.

## Obiettivo
I part-time hanno un **orario contrattuale fisso bisettimanale** (settimana A / settimana B che si alternano). Quasi inamovibile (la RAA può modificare a mano una cella per necessità). Va applicato in **entrambi** i generatori ("Genera nuova matrice" e "Genera mese"). In "nuova matrice" il PT viene **piazzato per primo** e **conta per la copertura**; gli FT coprono il resto.

## Pattern (costante del nucleo, weekday Lun=0…Dom=6)
- **SEMANA A:** `['MP','MP','MP','P2','R','R','MP']`  (Lun-Mar-Mer MP 7–12, Gio P2 14:30–21, Ven/Sab R, Dom MP)
- **SEMANA B:** `['M1','P2','R','MP','MP','MP','R']`  (Lun M1 6:30–13:30, Mar P2, Mer R, Gio-Ven-Sab MP, Dom R)

## Fase per PT e per mese
- `startPhase` = patrón (A o B) della **1ª settimana Lun–Dom** del mese; le settimane successive **alternano** (`phaseForWeek(start, weekIndex) = weekIndex pari ? start : opposto`).
- I due PT del nucleo vanno **opposti** (op1=A ⇒ op2=B).
- Persistito in `nuclei/{nucleoId}/ptPhase/{yyyy-MM}` = `{ [opId]: 'A'|'B' }`.

## Risoluzione della fase al generare il mese M (regola dell'utente)
1. Se `ptPhase/{M}` ha già tutti i PT → riusa (re-generazione **stabile/deterministica**).
2. Altrimenti leggi `ptPhase/{M-1}`: se esiste → **continua** l'alternanza (`startPhase(M) = opposto(phaseForWeek(start(M-1), nWeeks(M-1)-1))`).
3. Altrimenti **random**: A a un PT, B all'altro (e si **persiste** subito → re-generazione stabile).

## Motore "Genera nuova matrice"
- Nuovo input `ptFixed: { opId: { day: code } }` (schedule PT con fase risolta + eccezioni del PT già sovrapposte).
- Pre-piazza `ptFixed` (assigned + weekHours) prima del loop.
- Riempimento posti di giorno: conta gli operatori **già** su quel turno (PT inclusi) e copre solo i posti **rimanenti** (`need - già`).
- Notte/posti: i PT (già assegnati) non vengono mai scelti automaticamente.

## "Genera mese"
- I PT non usano più `weeklyPattern` ma `ptMonthSchedule(year, month, startPhase)` con la fase risolta/persistita.

## Persistenza / Firestore
- `getPtPhase`, `setPtPhase`, `resolvePtPhases(nucleoId, year, month, ptOpIds)` (legge corrente→prec→random, persiste).
- Regola `match /ptPhase/{yyyy-MM}`: read isAuth, write canWrite.

## Manuale
La RAA può sovrascrivere a mano qualsiasi cella PT (non bloccata).

## Funzioni pure (testabili)
`opposite`, `phaseForWeek`, `continueStartPhase`, `ptMonthSchedule` in `lib/genera/ptSchedule.ts`.

## Fuori scope
Pattern PT configurabile da UI (per ora costante); >2 PT (assunzione: 2 per nucleo, ma il codice assegna fasi alternate per N qualsiasi).
