# Product

## Register

product

## Users

RAA (responsabile di nucleo) e Coordinatrice di una struttura socio-sanitaria in Italia.
- **RAA**: gestisce la matrice turni del proprio nucleo (operatori OSS), inserisce eccezioni, genera e ritocca il piano mensile. Uso quotidiano e prolungato, da desktop, spesso durante il turno.
- **Coordinatrice**: amministra tutti i nuclei, registra le RAA e gli operatori.
- **OSS**: operatori (sola lettura del proprio turno) — non è il focus principale dell'interfaccia.
Contesto d'uso: lavoro reale, poco tempo, bisogno di leggere e modificare turni rapidamente e senza errori.

## Product Purpose

Pianificare e gestire i turni del personale socio-sanitario rispettando i vincoli di legge (D.Lgs 66/2003, CCNL Comparto Sanità): riposi, ore settimanali per contratto, notte→smonto→riposo, copertura giornaliera fissa. Include generazione automatica della matrice (auto-reparto per copertura), banca ore, autosostituzione e gestione eccezioni. Successo = una RAA produce un mese valido in pochi minuti e individua a colpo d'occhio cosa manca da coprire.

## Brand Personality

Clinico, sobrio, affidabile. Tono professionale e calmo, da strumento di lavoro serio. La voce è chiara e diretta (italiano), mai giocosa. L'interfaccia deve trasmettere ordine e fiducia, non personalità appariscente.

## Anti-references

- **Gestionali sanitari datati**: grigio plombo, tabelle densissime, controlli stile Windows 98.
- **App infantile/colorata**: eccesso di colori vivaci, emoji ovunque, aspetto da gioco.
- **"AI slop" / SaaS generico**: gradienti viola, card annidate, template senza identità, neri puri.
- **Sovraccarico**: densità visiva senza respiro; preferire aria, gerarchia e focus.

## Design Principles

- **Leggibilità prima di tutto**: turni lunghi, dati densi → testo nitido, contrasto sufficiente, niente grigi tenui "per eleganza".
- **Densità con respiro**: mostrare un mese intero a colpo d'occhio senza affollare; ritmo di spazio e separazioni chiare (i blocchi-settimana).
- **Il colore ha significato**: ogni colore codifica qualcosa (tipo turno, eccezione in rosso, posti scoperti in rosso). Niente colore decorativo che confonda la lettura.
- **Affidabilità visibile**: stati chiari (coperto/scoperto/eccezione/override), comportamenti prevedibili, nessuna sorpresa.
- **La modifica è il mestiere**: editare una cella, assegnare, coprire un buco deve essere immediato e a prova di errore.

## Accessibility & Inclusion

WCAG 2.1 AA. Contrasto testo ≥ 4.5:1 (≥3:1 per testo grande). Stati distinguibili non solo dal colore (codice testuale sempre presente: F, CO, M2, N1…). Rispettare `prefers-reduced-motion`. Target di click adeguati per uso prolungato.
