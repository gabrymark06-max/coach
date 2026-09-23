# Lifted — Design System

**Versione 2.0 · 2026-09-23 · Autore: `ui-ux-designer`**
Versione 1.0 · 2026-09-22 — resta valida ovunque la v2 non la contraddica.

Fonti vincolanti: `docs/spec.md` (brief originale) · **`docs/spec-v2.md` (revisione dell'utente,
prevale in caso di conflitto)** · `docs/qa-report.md` (due difetti chiudono qui) ·
`CLAUDE.md` (standard studio) · gli screenshot `docs/rif-hevy-*.png`.

---

## V2 — changelog: che cosa cambia e che cosa no (leggi questa tabella per prima)

La v2 **cambia il guscio, non il sistema**. Token, tipografia, contrasti, la riga della serie,
il timer, i PR, le misure, il backup: identici. Quello che cambia è *dove stanno le cose* da
1024px in su, più due schermate nuove e un difetto di grafico da chiudere.

| Area | v1 | **v2** | Dove |
|---|---|---|---|
| Palette e contrasti | tema scuro unico, misurato | **invariati** (decisione esplicita dell'utente) | §1.1–1.8 |
| Tipografia Archivo × Public Sans | — | **invariata** | §3 |
| Navigazione desktop | rail laterale 240px, stesse 5 tab | **sidebar 264px con ricerca, gruppi, blocco stato locale** — *sostituisce il rail* | §4.19 |
| Guscio ≥1024 | una colonna, max 1120px | **due colonne** (sidebar + centro) | §7.4 |
| Guscio ≥1280 | — | **tre colonne** (sidebar + centro a card + colonna destra) | §4.20, §7.5 |
| Tab mobile | Allenamento · Profilo · Esercizi · Misure · Statistiche | **Home · Allenamento · Trainer · Esercizi · Profilo** (Misure e Statistiche passano sotto Profilo) | §4.11 |
| Home | non esisteva, `/` → `/allenamento` | **`/home`: feed di allenamenti + avvio in cima** | §4.21, §6.7 |
| Trainer | non esisteva | **sezione nuova**: questionario, programma, giorno, registro delle decisioni | §4.23–§4.25, §6.8 |
| Libreria esercizi | lista a pagina piena, 81 voci | **due pannelli a ≥1280** (dettaglio al centro, elenco a destra), **~250-300 voci** | §4.26, §9.4 |
| Profilo | riepilogo + storico | **intestazione a numeri, statistiche a tab, calendario mensile, feed personale** | §4.22, §4.27 |
| Impostazioni | pagina singola + 2 sottopagine | **indice + pannello** a due colonne, una rotta per sezione | §4.28 |
| Grafici | nessuna regola di dominio → linee piatte (QA GRAVE 2) | **regola dei domini degli assi** | §4.10-bis |
| `<main>`/`<h1>` | solo dentro le tab (QA GRAVE 5) | **obbligatori su ogni rotta**, anche fuori dal guscio | §8.9 |
| Social | non c'era | **non c'è e non ci sarà**: niente follower, like, commenti, atleti suggeriti | tabella qui sotto |
| Video di esecuzione | — | **fuori dalla v2**: il campo esiste nello schema, nessuna schermata lo promette | §9.4 |

**Componenti v1 che la v2 non tocca** (non ridisegnarli, non "aggiornarli mentre ci sei):
`SetRow` §4.1 · `ExerciseCard` §4.2 · `SessionHeader` §4.3 · `RestTimerPill` §4.4 ·
`PRBadge` §4.5 · `RoutineCard` §4.7 · `MeasureForm` §4.9 · `Dialog`/`Sheet` §4.16 ·
`Toast` §4.17 · `NumberField` §4.18 · `PlateVisual` §6.4 · tutta la microcopy §5 ·
tutti i flussi di sessione §6.2–§6.6 · tutta la §11.

### V2 — che cosa si prende dal riferimento e che cosa si scarta

Gli screenshot sono di hevy.com, che è un prodotto **sociale**. Lifted no.
Ogni elemento sociale del riferimento ha una traduzione locale dichiarata, non un buco:

| Nel riferimento | In Lifted |
|---|---|
| `Cerca utenti` nella sidebar | **ricerca globale su esercizi e routine** (§4.19.3) |
| Blocco account in fondo alla sidebar | **blocco «stato locale»**: dove stanno i dati + età dell'ultimo backup (§4.19.4) |
| Avatar + username + Follower/Seguiti | **intestazione a numeri**: allenamenti, volume, serie, tempo (§4.22) |
| Like · commenti · condividi sotto la card | **niente**. La card finisce con l'elenco esercizi. |
| `Atleti suggeriti` nella colonna destra | **azioni rapide + stato del backup** (§4.20) |
| Miniature fotografiche dell'esercizio | **quadratino 40×40 con l'iniziale del gruppo muscolare** (§4.8, già in v1) |
| Emoji 🏅 sul conteggio record | **icona `Trophy` + numero + la parola** (§4.21) |
| `HEVY PRO · Sblocca` | **niente**: non c'è un piano a pagamento da vendere a sé stessi |

---

## 0. Premesse non negoziabili

**La direzione visiva è data dall'utente**: Hevy dark. Non inventiamo una terza estetica.
Il mio compito è tradurla in **numeri**: token, scale, stati, contrasti misurati.

**Tema unico: scuro.** La spec non chiede il tema chiaro, quindi non esiste. Niente
`prefers-color-scheme`, niente `.dark` class toggle, niente token duplicati. Il `<html>`
porta `class="dark"` fisso per compatibilità shadcn e `color-scheme: dark`.

**Contesto d'uso che vince su tutto**: telefono, in palestra, tra una serie e l'altra,
mani sudate, sguardo di 3 secondi a distanza di braccio. Da questo discendono:
- target minimo **48×48 px** (non 44) su tutto ciò che si tocca durante una sessione attiva;
- numerali **tabulari** ovunque compaia un peso o una ripetizione (niente jitter dei digit);
- la **riga della serie** ha la priorità su ogni altra decisione di layout;
- zero interazioni che dipendono da hover o da precisione.

**Elemento ricorrente del sistema ("la corsia")**: ogni riga/card che porta uno stato ha
un binario verticale di **3px** sul bordo sinistro interno. Colore + forma insieme:
piena blu = serie completata, piena ambra = PR, tratteggiata = riscaldamento,
assente = neutro. È l'unico ornamento del sistema e ricorre in sessione, storico, PR.
*(Se in futuro passa il `designer` con un'art direction propria, questo è l'unico
elemento che può sovrascrivere; i token no.)*

### Come ho risolto il vincolo di contrasto del blu

Numeri reali, calcolati con la formula WCAG 2.x (sRGB relative luminance):

| Coppia | Rapporto | Verdetto |
|---|---|---|
| `#007AFF` testo su `#0B0C0E` (background) | **4.87:1** | passa come testo, ma solo sul fondo puro |
| `#007AFF` testo su `#16181D` (card) | **4.42:1** | ❌ fallisce |
| `#007AFF` testo su `#1F222A` (elevato) | **3.96:1** | ❌ fallisce |
| `#FFFFFF` testo su riempimento `#007AFF` | **4.02:1** | ❌ fallisce come testo (ok come icona, ≥3) |
| `#FFFFFF` testo su riempimento `#1D70F5` | **4.48:1** | ❌ fallisce per 0.02 |

**Decisione — il blu si sdoppia per ruolo, non per gusto:**

1. **`#007AFF` (`--blue-brand`) è colore-firma, mai testo.** Vive come: riempimento del
   check di serie completata (con **icona** bianca, non testo → soglia 3:1, ok a 4.02),
   tratto dei grafici, binario della corsia, indicatore della tab attiva, riempimento
   della barra di progresso del timer. Regola meccanica: **mai testo sotto i 24px sopra
   `#007AFF`, e mai `#007AFF` come colore di un glifo testuale.**
2. **`--primary` (riempimento dei pulsanti) = `#1268EC`.** È `#1D70F5` della spec
   ricalibrato di pochi punti per canale: stessa famiglia, stesso blu elettrico percepito,
   ma `#FFFFFF` sopra arriva a **4.98:1**. `#1D70F5` puro si ferma a 4.48 — sotto soglia,
   quindi non lo uso come fondo di un'etichetta.
3. **`--accent-blue` (testo e icone blu su fondo scuro) = `#3E96FF`.** È la variante
   schiarita: **5.31:1** sulla superficie peggiore (`#1F222A`), 6.53:1 sul background.
   Tutti i link, le label blu, le icone blu informative usano questo.
4. **Gli stati hover/active del primario scuriscono, non schiariscono.** Su fondo nero
   l'istinto è schiarire, ma qualunque schiarimento di `--primary` fa scendere il bianco
   sotto 4.5. Quindi: hover `#0F5ED8` (bianco 5.81:1), active `#0B57C9` (bianco 6.52:1),
   più uno `scale(0.97)` su `transform` per il feedback tattile.

**Ambra/PR**: `#FFB020` su `#1F222A` = **8.70:1**. Nessun problema, passa ovunque come
testo. E `#0B0C0E` sopra `#FFB020` (chip pieno) = **10.70:1**. L'arancione non richiede
compromessi; il blu sì. Documentato perché il contrario sarebbe stato intuitivo.

---

## 1. Token

Tutti i valori sono token. **Un hex grezzo o un px magico dentro un componente è un bug**,
non una scorciatoia.

### 1.1 Colore — superfici

| Token | Hex | Ruolo | Contrasto vs `--background` |
|---|---|---|---|
| `--background` | `#0B0C0E` | fondo pagina, fondo bottom nav | — |
| `--card` | `#16181D` | card, righe elenco, header sticky | 1.10:1 (separato dal bordo, non dal contrasto) |
| `--card-elevated` | `#1F222A` | sheet, dialog, popover, pill timer, input segmentati | 1.23:1 |
| `--surface-hover` | `#262A34` | hover/press su righe ed elenchi | 1.36:1 |
| `--input` | `#0F1115` | fondo dei campi (incassato, più scuro della card) | 1.04:1 |
| `--overlay` | `rgba(0,0,0,0.72)` | scrim di dialog e sheet | composito ≈ `#030304` |

> **Le superfici non si distinguono per luminanza** (1.10:1 tra background e card): la
> gerarchia la fanno **bordo + spaziatura**, non l'ombra. Su `#0B0C0E` un'ombra non esiste.
> Conseguenza vincolante: **ogni card e ogni sheet hanno un bordo 1px visibile**.

### 1.2 Colore — testo

| Token | Hex | Su `--background` | Su `--card` | Su `--card-elevated` | Uso |
|---|---|---|---|---|---|
| `--text-primary` | `#F2F4F7` | **17.76:1** | **16.12:1** | **14.44:1** | pesi, reps, titoli, nomi esercizio |
| `--text-secondary` | `#A9B2C1` | **9.16:1** | **8.31:1** | **7.44:1** | label, unità, assi grafici, metadati |
| `--text-muted` | `#838FA4` | **5.99:1** | **5.44:1** | **4.87:1** | serie precedente (grigio), placeholder, timestamp |
| `--text-disabled` | `#5C6274` | 3.22:1 | 2.92:1 | 2.61:1 | **solo controlli disabilitati** (esenzione WCAG 1.4.3) |

`--text-muted` è il **pavimento**: `#838FA4` è il grigio più scuro che tiene 4.5:1 anche
sulla superficie elevata. La "serie precedente in grigio" di Hevy usa questo token — non
un grigio più spento, perché quel testo porta informazione (è il numero che l'utente deve
battere) e non può stare sotto soglia.

`--text-disabled` è sotto 4.5:1 di proposito: WCAG esenta i controlli inattivi. In cambio
**ogni controllo disabilitato porta anche `disabled` + `aria-disabled="true"` e un testo
di aiuto che spiega perché** (vedi §5 microcopy). Mai un disabilitato muto.

> ⚠️ `--text-muted` **non** va usato su `--surface-hover` (`#262A34`): il rapporto scende a
> 4.40:1. Su quella superficie il minimo è `--text-secondary` (6.72:1).

### 1.3 Colore — blu (azione, marchio, completamento)

| Token | Hex | Ruolo | Contrasto misurato |
|---|---|---|---|
| `--blue-brand` | `#007AFF` | **solo riempimento e tratto**, mai testo | vs bg 4.87:1 (non-testo ✓); icona bianca sopra 4.02:1 (≥3 ✓) |
| `--primary` | `#1268EC` | riempimento pulsante primario | `--primary-foreground` sopra **4.98:1**; vs bg 3.93:1 ✓ |
| `--primary-hover` | `#0F5ED8` | hover pulsante primario | bianco sopra **5.81:1**; vs bg 3.37:1 ✓ |
| `--primary-active` | `#0B57C9` | press pulsante primario | bianco sopra **6.52:1**; vs bg 3.00:1 ✓ |
| `--primary-foreground` | `#FFFFFF` | etichetta sul primario | vedi sopra |
| `--accent-blue` | `#3E96FF` | **testo e icone blu**, link, valori attivi | vs bg **6.53:1**, card **5.93:1**, elevato **5.31:1** |
| `--ring` | `#6FB4FF` | anello di focus | vs bg **8.99:1**, card **8.16:1**, elevato **7.31:1** |
| `--set-done-surface` | `#10243C` | tinta di riga serie completata | `--text-primary` sopra 14.23:1; `--text-muted` sopra 4.80:1 |

### 1.4 Colore — semantico

| Token | Hex | Su `--card` | Note |
|---|---|---|---|
| `--pr` | `#FFB020` | **9.71:1** (bg 10.70, elevato 8.70) | PR, tipo serie W, stelle |
| `--pr-surface` | `#2E2208` | — | fondo del chip PR; `--pr` sopra = **8.52:1** |
| `--pr-border` | `#6B4F12` | — | bordo del chip PR (decorativo, il testo porta il senso) |
| `--pr-on-fill` | `#0B0C0E` | — | testo scuro su `--pr` pieno = **10.70:1** |
| `--danger` | `#FF6259` | **6.04:1** (bg 6.66, elevato 5.41) | testo/icona di errore, tipo serie F |
| `--danger-fill` | `#D92D24` | 4.06:1 vs bg ✓ | fondo azione distruttiva; `#FFFFFF` sopra = **4.83:1** |
| `--danger-on-fill` | `#FFFFFF` | — | vedi sopra |
| `--success` | `#32D74B` | **9.27:1** (bg 10.21, elevato 8.30) | import riuscito, backup completato |
| `--warning` | `#FFB020` | 9.71:1 | alias di `--pr` |

### 1.5 Colore — tipi di serie (W / D / F)

**Regola dura: il tipo di serie non è mai solo un colore.** La cella dell'indice serie
mostra sempre **la lettera** (`W`, `D`, `F`) o **il numero** (serie normale). Il colore è
rinforzo, non veicolo.

| Tipo | Token | Hex | Glifo | Contrasto su `--card` |
|---|---|---|---|---|
| Normale | `--set-normal` | `#F2F4F7` | numero progressivo (`1`, `2`, `3`…) | 16.12:1 |
| Riscaldamento | `--set-warmup` | `#FFB020` | `W` | **9.71:1** |
| Drop set | `--set-drop` | `#C77DFF` | `D` | **6.60:1** | 
| Cedimento | `--set-failure` | `#FF6259` | `F` | **6.04:1** |

Il glifo è in `--font-display` 14px/700, centrato in un'area 48×48. Il drop set aggiunge
anche un rientro di `--space-4` sulla riga (indica la discesa di carico): forma + colore.

### 1.6 Colore — bordi

| Token | Hex | Ruolo | Contrasto |
|---|---|---|---|
| `--border` | `#2A2E39` | separatori, bordi card | 1.31:1 vs card — **decorativo**, ok perché la card non porta significato da sola |
| `--border-strong` | `#666D82` | bordo di **input, checkbox, switch, slider, sheet** | vs bg **3.80:1**, card **3.45:1**, elevato **3.09:1**, input **3.67:1** ✓ |
| `--border-focus` | `#6FB4FF` | = `--ring` | vedi §1.3 |

`--border-strong` esiste perché WCAG 1.4.11 chiede **3:1 per i confini dei controlli**, e
`#2A2E39` della spec non ci arriva (1.31:1). `#2A2E39` resta per i separatori decorativi;
tutto ciò che si tocca prende `--border-strong`. Questo è l'unico punto in cui aggiungo un
colore non presente nella spec, ed è per obbligo, non per estetica.

### 1.7 Colore — serie dati (Recharts)

Tutte misurate su `--card` (`#16181D`), che è il fondo di ogni grafico.

| Token | Hex | Contrasto su card | Assegnazione consigliata |
|---|---|---|---|
| `--chart-1` | `#3E96FF` | **5.93:1** | volume totale, 1RM stimato (serie primaria) |
| `--chart-2` | `#FFB020` | **9.71:1** | 1RM quando in coppia con il volume |
| `--chart-3` | `#32D74B` | **9.27:1** | peso corporeo |
| `--chart-4` | `#C77DFF` | **6.60:1** | % massa grassa |
| `--chart-5` | `#FF8A5B` | **7.65:1** | serie 5 (distribuzione muscolare) |
| `--chart-6` | `#5EE0D0` | **11.04:1** | serie 6 (distribuzione muscolare) |
| `--chart-grid` | `#2F3440` | 1.43:1 | griglia (decorativa: i valori stanno sugli assi) |
| `--chart-axis` | `#A9B2C1` | **8.31:1** | etichette degli assi — sono testo, soglia 4.5 rispettata |

**Mai serie distinta dal solo colore**: ogni serie ha un `dot` di forma diversa
(cerchio pieno, quadrato, rombo, triangolo) e la legenda riporta il nome per esteso.
Sei serie è il tetto: oltre, si cambia grafico.

### 1.8 Colore — dischi del calcolatore

Convenzione IPF, che chi si allena riconosce già. Ogni disco porta **il peso stampato sopra**.

| Peso | Token | Hex | Etichetta | Contrasto etichetta |
|---|---|---|---|---|
| 20 kg | `--plate-20` | `#1268EC` | `#FFFFFF` | **4.98:1** |
| 15 kg | `--plate-15` | `#FFB020` | `#0B0C0E` | **10.70:1** |
| 10 kg | `--plate-10` | `#32D74B` | `#0B0C0E` | **10.21:1** |
| 5 kg | `--plate-5` | `#F2F4F7` | `#0B0C0E` | **17.76:1** |
| 2.5 kg | `--plate-2_5` | `#D92D24` | `#FFFFFF` | **4.83:1** |
| 1.25 kg | `--plate-1_25` | `#A9B2C1` | `#0B0C0E` | **9.16:1** |
| bilanciere | `--plate-bar` | `#666D82` | — | 3.80:1 vs bg ✓ |

### 1.9 Spaziatura

Scala unica, base 4, densa (è un'app di dati, non una landing).

| Token | Valore | Uso tipico |
|---|---|---|
| `--space-1` | `2px` | scostamenti ottici, gap dentro un chip |
| `--space-2` | `4px` | gap icona↔testo dentro un badge |
| `--space-3` | `8px` | gap tra colonne della riga serie, gap tra chip |
| `--space-4` | `12px` | padding interno card compatta, gap tra righe serie |
| `--space-5` | `16px` | **gutter di pagina a 375**, padding card standard |
| `--space-6` | `20px` | padding card esercizio in sessione |
| `--space-7` | `24px` | gutter di pagina a 768, spazio tra sezioni correlate |
| `--space-8` | `32px` | spazio tra blocchi diversi (es. fine lista → CTA) |
| `--space-9` | `40px` | gutter a 1440, respiro sopra un titolo di pagina |
| `--space-10` | `48px` | vuoto sopra/sotto un empty state |
| `--space-11` | `64px` | padding verticale di un empty state a pagina piena |

**Densità deliberata** (dove stringe, dove respira):
- **Stringe** — tabella delle serie: righe da 52px, gap verticale `--space-1` (2px), padding
  orizzontale `--space-3`. Si vedono 6–7 serie senza scrollare. È il punto più denso dell'app.
- **Stringe** — libreria esercizi: righe 56px, separatore 1px, nessun padding tra righe.
- **Respira** — header di sessione: `--space-6` sopra/sotto, il volume totale è a 40px.
- **Respira** — riepilogo post-workout e gli empty state: `--space-10` / `--space-11`.
- **Respira** — schede misure e statistiche: card con `--space-6`, gap `--space-5`.

**v2 — la densità del guscio** (dove stringe e dove respira, da 1024 in su):
- **Stringe** — la **sidebar**: voci da 48px con gap verticale `--space-1` (2px), padding
  orizzontale `--space-4`, sotto-voci da 40px. Sei destinazioni devono stare sopra la piega
  insieme alla ricerca e al blocco di stato.
- **Stringe** — il **pannello elenco** della libreria: righe 48px (`--row-list-desk`),
  separatore 1px, **nessun gap**. 13 voci in un pannello alto 640px.
- **Stringe** — l'**indice delle impostazioni**: voci da 44px, gruppi separati da `--space-5`.
- **Stringe** — la **griglia del calendario**: gap `--cal-gap` (4px), celle 40px.
- **Respira** — la **colonna centrale a feed**: gap `--space-5` (16px) fra le card, padding
  interno `--space-6` (20px), `--space-9` (40px) sopra l'`h1` di pagina.
- **Respira** — la **card «Oggi»** del Trainer: padding `--space-6`, che la stacca dalle righe
  delle settimane sotto.
- La **colonna destra ha un padding interno minore del centro** (`--space-5` contro
  `--space-6`): è di supporto, e la densità lo dice prima del contenuto. Padding identico
  ovunque farebbe sembrare le due colonne intercambiabili, e non lo sono.

### 1.10 Raggi

Deliberatamente **non uniformi**: la forma classifica.

| Token | Valore | Applicato a |
|---|---|---|
| `--radius-xs` | `3px` | binario "corsia", barra di progresso, glifo tipo serie |
| `--radius-sm` | `6px` | input numerici, chip filtro, badge PR |
| `--radius-md` | `10px` | card esercizio, riga routine, card statistica |
| `--radius-btn` | `12px` | pulsanti (primario, secondario, distruttivo) |
| `--radius-lg` | `16px` | sheet, dialog, card quick start, card riepilogo |
| `--radius-full` | `9999px` | pill timer, avatar, toggle, indicatore tab |

Tailwind `--radius` di shadcn → mappato su `--radius-md` (`10px`).

### 1.11 Elevazione

Su `#0B0C0E` un'ombra nera non si vede. L'elevazione qui è **luce dall'alto + bordo**.

| Token | Valore | Uso |
|---|---|---|
| `--elev-0` | `none` | righe dentro una card |
| `--elev-1` | `inset 0 1px 0 rgba(255,255,255,0.04)` | card, riga elenco |
| `--elev-2` | `inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.6)` | pill timer, bottom sheet, barra "sessione in corso" |
| `--elev-3` | `inset 0 1px 0 rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.78)` | dialog modale |
| `--glow-timer` | `0 0 0 1px #007AFF, 0 6px 24px rgba(0,122,255,0.30)` | pill timer **in conto alla rovescia** |
| `--glow-pr` | `0 0 0 1px #6B4F12, 0 6px 24px rgba(255,176,32,0.22)` | card riepilogo con PR |

### 1.12 Z-index

| Token | Valore | Strato |
|---|---|---|
| `--z-base` | `0` | contenuto |
| `--z-sticky` | `10` | header sticky di sessione, header di lista |
| `--z-session-bar` | `15` | barra "sessione in corso" (sopra il contenuto, sotto la nav) |
| `--z-nav` | `20` | bottom navigation |
| `--z-timer` | `30` | pill del timer di recupero |
| `--z-overlay` | `40` | scrim di dialog/sheet |
| `--z-dialog` | `50` | dialog, bottom sheet, popover Radix |
| `--z-toast` | `60` | toast |

### 1.13 Movimento

Tutto tra **150ms e 300ms**, solo `transform` e `opacity`, e **ogni animazione spiega un
cambio di stato**. Nessuna animazione decorativa esiste in questo sistema.

| Token | Valore | Applicato a |
|---|---|---|
| `--dur-1` | `150ms` | press/hover, check di serie, chip filtro, uscita di qualsiasi overlay |
| `--dur-2` | `200ms` | comparsa pill timer, toast, cambio tab, apertura popover |
| `--dur-3` | `260ms` | ingresso bottom sheet / dialog, transizione verso `/sessione` |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | ingressi |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | uscite |
| `--ease-tap` | `cubic-bezier(0.34, 1.15, 0.64, 1)` | solo il check di completamento serie (`scale`) |

Uscita = `--dur-1` (150ms), cioè ~58% dell'ingresso più lento. Ogni animazione è
**interrompibile**: un tocco durante la transizione la cancella e applica lo stato finale.

### 1.14 Breakpoint — **aggiornata in v2**

| Token | Valore | Cosa cambia |
|---|---|---|
| base | `375px` | mobile-first, nessuna media query |
| `--bp-sm` | `480px` | phablet: la riga serie guadagna la colonna RPE anche se attiva |
| `--bp-md` | `768px` | tablet: griglie a 2 colonne, contenuto centrato max 680px. **La bottom nav resta.** |
| `--bp-lg` | `1024px` | **v2: la bottom nav diventa la `Sidebar` di 264px** (in v1 era il rail di 240px). Guscio a **due** colonne. |
| `--bp-3col` | **`1280px`** | **v2, nuovo**: compare la **colonna destra** di 320px. Guscio a **tre** colonne. |
| `--bp-xl` | `1440px` | sessione a 2 colonne; l'area contenuto smette di crescere (max 1120px) e si centra |

**Perché 1280 e non 1024 per la terza colonna.** A 1024 il conto è: 264 di sidebar + 24×2 di
gutter + 320 di colonna destra = 632px di cromo, e alla colonna centrale ne restano 392 —
meno di quanti ne ha a 768px senza sidebar. Una terza colonna che rimpicciolisce il contenuto
non è un guadagno, è un vezzo. A 1280 il centro misura 632px, a 1440 misura 760px: sopra
soglia in entrambi i casi.

### 1.15 Dimensioni dei controlli

| Token | Valore | Nota |
|---|---|---|
| `--tap-min` | `44px` | minimo assoluto (WCAG 2.5.8 / HIG) |
| `--tap-gym` | `48px` | **minimo dentro `/sessione`** — mani sudate, sguardo breve |
| `--row-set` | `52px` | altezza riga serie |
| `--row-list` | `56px` | altezza riga elenco (libreria, storico, misure) |
| `--nav-h` | `56px` | bottom nav, + `env(safe-area-inset-bottom)` |
| `--session-bar-h` | `48px` | barra "sessione in corso" |
| `--icon-sm` | `16px` | icone dentro chip e badge |
| `--icon-md` | `20px` | icone inline nei bottoni |
| `--icon-lg` | `24px` | icone di navigazione e di azione principale |
| `--stroke-icon` | `1.75` | `strokeWidth` uniforme su tutte le lucide-react |

### 1.16 Dimensioni del guscio — **nuova in v2**

Nessuno di questi numeri vive dentro un componente: sono token, come tutto il resto.

| Token | Valore | Ruolo |
|---|---|---|
| `--sidebar-w` | **`264px`** | larghezza della sidebar da `--bp-lg`. **Sostituisce il rail da 240px di v1** (`lg:pl-60` / `lg:w-60` in `app-shell.tsx` e `bottom-nav.tsx` vanno rimossi) |
| `--sidebar-item-h` | `48px` | altezza di una voce di navigazione (≥ `--tap-min`, anche a 1024 su tablet) |
| `--sidebar-search-h` | `44px` | campo di ricerca globale in cima alla sidebar |
| `--sidebar-pad-x` | `var(--space-4)` (12px) | imbottitura orizzontale della sidebar |
| `--sidebar-foot-h` | `64px` | blocco «stato locale» in fondo, e `SessionBar` quando è presente |
| `--rail-right-w` | **`320px`** | colonna destra da `--bp-3col` |
| `--shell-max` | `1120px` | larghezza massima di (centro + colonna destra), centrata |
| `--shell-gutter` | `var(--space-7)` (24px) | gutter dell'area contenuto fra 1024 e 1279 |
| `--shell-gutter-lg` | `var(--space-8)` (32px) | gutter e gap fra colonne da 1280 |
| `--content-max` | `760px` | larghezza massima della colonna centrale a **due** colonne |
| `--settings-index-w` | `260px` | indice delle impostazioni dentro la colonna centrale |
| `--pane-list-w` | `var(--rail-right-w)` | pannello elenco della libreria a due pannelli |
| `--row-list-desk` | `48px` | riga di elenco dentro un pannello laterale (mouse + tastiera; resta ≥ `--tap-min`) |
| `--cal-cell` | `40px` | diametro visivo della cella del calendario (area tattile 44×44) |
| `--cal-gap` | `var(--space-2)` (4px) | gap della griglia del calendario |

---

## 2. Token nel codice

### 2.1 `app/globals.css` — variabili CSS

```css
:root {
  color-scheme: dark;

  /* --- shadcn / Radix (tema scuro unico, valori esadecimali diretti) --- */
  --background:            #0B0C0E;
  --foreground:            #F2F4F7;
  --card:                  #16181D;
  --card-foreground:       #F2F4F7;
  --popover:               #1F222A;
  --popover-foreground:    #F2F4F7;
  --primary:               #1268EC;
  --primary-foreground:    #FFFFFF;
  --secondary:             #1F222A;
  --secondary-foreground:  #F2F4F7;
  --muted:                 #1F222A;
  --muted-foreground:      #A9B2C1;
  --accent:                #262A34;
  --accent-foreground:     #F2F4F7;
  --destructive:           #D92D24;
  --destructive-foreground:#FFFFFF;
  --border:                #2A2E39;
  --input:                 #0F1115;
  --ring:                  #6FB4FF;
  --radius:                0.625rem; /* 10px */

  --chart-1: #3E96FF;  --chart-2: #FFB020;  --chart-3: #32D74B;
  --chart-4: #C77DFF;  --chart-5: #FF8A5B;  --chart-6: #5EE0D0;

  /* --- token propri di Lifted --- */
  --surface-hover:  #262A34;
  --border-strong:  #666D82;
  --text-primary:   #F2F4F7;
  --text-secondary: #A9B2C1;
  --text-muted:     #838FA4;
  --text-disabled:  #5C6274;

  --blue-brand:     #007AFF;
  --primary-hover:  #0F5ED8;
  --primary-active: #0B57C9;
  --accent-blue:    #3E96FF;

  --set-done-surface: #10243C;
  --set-normal:  #F2F4F7;
  --set-warmup:  #FFB020;
  --set-drop:    #C77DFF;
  --set-failure: #FF6259;

  --pr:         #FFB020;
  --pr-surface: #2E2208;
  --pr-border:  #6B4F12;
  --pr-on-fill: #0B0C0E;
  --success:    #32D74B;
  --danger:     #FF6259;
  --warning:    #FFB020;

  --chart-grid: #2F3440;
  --chart-axis: #A9B2C1;

  --plate-20: #1268EC; --plate-15: #FFB020; --plate-10: #32D74B;
  --plate-5:  #F2F4F7; --plate-2_5: #D92D24; --plate-1_25: #A9B2C1;
  --plate-bar: #666D82;

  --space-1: 2px;  --space-2: 4px;  --space-3: 8px;  --space-4: 12px;
  --space-5: 16px; --space-6: 20px; --space-7: 24px; --space-8: 32px;
  --space-9: 40px; --space-10: 48px; --space-11: 64px;

  --radius-xs: 3px;  --radius-sm: 6px;  --radius-md: 10px;
  --radius-btn: 12px; --radius-lg: 16px; --radius-full: 9999px;

  --elev-1: inset 0 1px 0 rgb(255 255 255 / 0.04);
  --elev-2: inset 0 1px 0 rgb(255 255 255 / 0.05), 0 8px 24px rgb(0 0 0 / 0.60);
  --elev-3: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 16px 48px rgb(0 0 0 / 0.78);
  --glow-timer: 0 0 0 1px #007AFF, 0 6px 24px rgb(0 122 255 / 0.30);
  --glow-pr:    0 0 0 1px #6B4F12, 0 6px 24px rgb(255 176 32 / 0.22);

  --z-base: 0; --z-sticky: 10; --z-session-bar: 15; --z-nav: 20;
  --z-timer: 30; --z-overlay: 40; --z-dialog: 50; --z-toast: 60;

  --dur-1: 150ms; --dur-2: 200ms; --dur-3: 260ms;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in:  cubic-bezier(0.4, 0, 1, 1);
  --ease-tap: cubic-bezier(0.34, 1.15, 0.64, 1);

  --tap-min: 44px; --tap-gym: 48px;
  --row-set: 52px; --row-list: 56px;
  --nav-h: 56px;   --session-bar-h: 48px;
  --icon-sm: 16px; --icon-md: 20px; --icon-lg: 24px;

  /* --- v2: guscio a due/tre colonne (§1.16) --- */
  --sidebar-w: 264px;
  --sidebar-item-h: 48px;
  --sidebar-search-h: 44px;
  --sidebar-pad-x: var(--space-4);
  --sidebar-foot-h: 64px;
  --rail-right-w: 320px;
  --shell-max: 1120px;
  --shell-gutter: var(--space-7);
  --shell-gutter-lg: var(--space-8);
  --content-max: 760px;
  --settings-index-w: 260px;
  --pane-list-w: var(--rail-right-w);
  --row-list-desk: 48px;
  --cal-cell: 40px;
  --cal-gap: var(--space-2);
}
```

**v2 — da aggiungere a `@theme inline` (§2.2):** `--breakpoint-3col: 1280px`.
Nessun **colore** nuovo: la v2 non introduce un solo hex che non fosse già in v1.

> **Nota d'implementazione.** Lo stack è React 19 + Next App Router → Tailwind v4, dove
> shadcn accetta valori colore diretti. Se per qualunque ragione il progetto finisse su
> Tailwind v3 con la convenzione `hsl(var(--x))`, si convertono **gli stessi hex** in
> triplette HSL senza cambiarne il valore: i rapporti di contrasto di questo documento
> restano validi solo se i colori non cambiano.

### 2.2 `@theme inline` — Tailwind v4

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-brand: var(--blue-brand);
  --color-accent-blue: var(--accent-blue);
  --color-text-muted: var(--text-muted);
  --color-text-disabled: var(--text-disabled);
  --color-set-done: var(--set-done-surface);
  --color-set-warmup: var(--set-warmup);
  --color-set-drop: var(--set-drop);
  --color-set-failure: var(--set-failure);
  --color-pr: var(--pr);
  --color-pr-surface: var(--pr-surface);
  --color-success: var(--success);
  --color-danger: var(--danger);

  --color-chart-1: var(--chart-1); --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3); --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5); --color-chart-6: var(--chart-6);

  --font-display: var(--font-archivo), "Helvetica Neue", "Segoe UI", system-ui, sans-serif;
  --font-sans:    var(--font-public-sans), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono:    ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace;

  --text-xs: 12px;   --text-xs--line-height: 16px;
  --text-sm: 14px;   --text-sm--line-height: 20px;
  --text-base: 16px; --text-base--line-height: 24px;
  --text-lg: 18px;   --text-lg--line-height: 24px;
  --text-xl: 22px;   --text-xl--line-height: 28px;
  --text-2xl: 28px;  --text-2xl--line-height: 32px;
  --text-3xl: 40px;  --text-3xl--line-height: 40px;

  --spacing-1: 2px;  --spacing-2: 4px;  --spacing-3: 8px;  --spacing-4: 12px;
  --spacing-5: 16px; --spacing-6: 20px; --spacing-7: 24px; --spacing-8: 32px;
  --spacing-9: 40px; --spacing-10: 48px; --spacing-11: 64px;

  --radius-xs: 3px; --radius-sm: 6px; --radius-md: 10px;
  --radius-btn: 12px; --radius-lg: 16px;

  --shadow-elev-1: var(--elev-1);
  --shadow-elev-2: var(--elev-2);
  --shadow-elev-3: var(--elev-3);

  --breakpoint-sm: 480px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1440px;
}
```

---

## 3. Tipografia

### 3.1 L'accoppiamento

**Archivo (display + numerali) × Public Sans (testo di lavoro).** Entrambe variabili,
entrambe da `next/font/google`, entrambe con cifre tabulari reali.

**Perché Archivo per i numeri.** Il contenuto di questa app *sono* numeri: 80, 8, 7.5, 1240.
Archivo è una grottesca con x-height alta e aperture chiuse — un `8` non collassa in un `6`
a distanza di braccio, e il `1` ha la barra, quindi non si confonde con la `l`. Ha figure
tabulari native (`tnum`): quando il peso passa da `95` a `100` la colonna non salta. È la
proprietà che rende usabile una tabella di serie che si compila mentre si respira male.

**Perché Public Sans per il testo.** È disegnata per interfacce dense e leggi a corpo
piccolo (nasce nello USWDS). Aperture più aperte e tracciatura più larga di Archivo: legge
bene a 14px sui metadati, e non compete con il display perché ha proporzioni più ampie e
terminali più morbidi. Due grottesche, due temperamenti: quella che urla i numeri e quella
che sussurra le etichette.

**Perché non Inter.** Vietata dagli standard dello studio, e comunque non è la scelta
giusta qui: le sue cifre proporzionali di default e la x-height uniforme la rendono
eccellente per il testo e mediocre per una colonna di pesi letta di sfuggita.

```ts
// app/fonts.ts
import { Archivo, Public_Sans } from "next/font/google";

export const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});
```

Fallback dichiarati (vedi `@theme inline` §2.2):
- display → `"Helvetica Neue", "Segoe UI", system-ui, sans-serif`
- testo → `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- mono → `ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace` (solo anteprima export)

### 3.2 La scala

Ramp con contrasto vero tra gli step (12 → 14 → 16 → 18 → 22 → 28 → 40): i passi in alto
accelerano (×1.27, ×1.43) perché il display deve staccare, quelli in basso sono fitti
(×1.17, ×1.14) perché il testo secondario vive di piccole differenze.

| Ruolo | Font | Dim / interlinea | Peso | Tracking | Uso |
|---|---|---|---|---|---|
| `display` | Archivo | **40 / 40** | 700 | `-0.03em` | conto alla rovescia timer, volume totale in sessione, 1RM in evidenza |
| `h1` | Archivo | **28 / 32** | 700 | `-0.02em` | titolo di pagina |
| `h2` | Archivo | **22 / 28** | 700 | `-0.015em` | nome esercizio in sessione, titolo di sezione |
| `h3` | Archivo | **18 / 24** | 600 | `-0.01em` | titolo card, nome esercizio in libreria, nome routine |
| `body` | Public Sans | **16 / 24** | 400 | `0` | testo corrente, voci di elenco, note |
| `body-strong` | Public Sans | **16 / 24** | 600 | `0` | etichette di form, valore di misura |
| `sm` | Public Sans | **14 / 20** | 400 | `0` | **serie precedente**, metadati, timestamp, aiuto |
| `label` | Public Sans | **12 / 16** | 600 | `0.06em` MAIUSC. | intestazioni colonna della tabella serie, etichette tab, chip |
| `num-set` | Archivo | **20 / 24** | 600 `tnum` | `0` | **valori kg / reps nella riga serie** |
| `num-md` | Archivo | **16 / 20** | 600 `tnum` | `0` | valori nelle tabelle dello storico, tooltip grafici |

Nessun testo scende sotto i **12px**, e i 12px esistono solo in maiuscoletto spaziato con
peso 600 (mai testo corrente).

```css
.tnum { font-variant-numeric: tabular-nums lining-nums; }
```
Applicato di default a `input[inputmode="decimal"]`, alle celle numeriche della tabella
serie, al timer, ai tooltip Recharts e alle colonne dello storico.

**Dynamic Type / zoom**: tutto il layout regge il 200% di zoom testo senza scroll
orizzontale. La tabella delle serie, oltre il 160%, passa a **due righe per serie**
(riga 1: indice + kg + reps + check; riga 2: precedente + RPE) — è l'unico reflow
condizionato dal testo, e si attiva con una container query, non con `@media`.

---

## 4. Componenti

Ogni componente è specificato **per stati**, non per aspetto. Se manca lo stato vuoto o
quello di caricamento, il componente non è finito.

### 4.1 `SetRow` — la riga della serie (componente chiave)

È l'elemento più toccato dell'app. Tutto il resto cede spazio a questo.

**Anatomia a 375px** (gutter pagina `--space-5` ×2 = 32, padding card `--space-3` ×2 = 16 →
319px utili):

```
[ 48 ]  [   64   ]  [  56  ]  [  48  ]  [ 48 ]
 TIPO    PRECED.       KG       REPS      ✓
  ↑ gap --space-3 (8px) tra le colonne = 32px  →  totale 296px, slack 23px sul KG
```

Con **RPE attivo** (impostazione, spento di default): gap scende a 6px e le colonne
diventano `48 / 48 / 56 / 48 / 40 / 48` = 288 + 30 = 318px. Sopra `--bp-sm` (480px) le
colonne tornano ai gap standard.

| Colonna | Contenuto | Target |
|---|---|---|
| TIPO | numero serie, oppure `W`/`D`/`F` in `--set-*` | **48×48** → apre il menu tipo serie |
| PRECEDENTE | `80×8` in `sm` / `--text-muted` (5.44:1). Vuoto → `—` in `--text-disabled` | non interattivo; tocco = copia i valori nei campi |
| KG | `input inputmode="decimal"`, `num-set`, allineato a destra | **56×48** |
| REPS | `input inputmode="numeric"`, `num-set`, allineato a destra | **48×48** |
| RPE | `select` 1–10 a step 0.5, `num-md` | **40×48** |
| ✓ | pulsante check | **48×48** |

**Stati:**

| Stato | Specifica |
|---|---|
| **default** | fondo `--card`, corsia trasparente, bordo inferiore 1px `--border`. Input con fondo `--input`, bordo 1px `--border-strong` (3.67:1), raggio `--radius-sm`. Check: quadrato 28×28 (in area 48×48), bordo 2px `--border-strong`, interno trasparente. |
| **hover** (solo puntatore) | riga → `--surface-hover`. **Nessuna affordance esiste solo in hover**: ogni azione raggiungibile con hover è raggiungibile anche con tocco o menu. |
| **focus-visible** | `outline: 2px solid var(--ring); outline-offset: 2px` sull'elemento focalizzato (input o check), mai sulla riga. L'anello non è mai coperto dalla pill del timer né dalla nav (vedi §7). |
| **active / press** | `transform: scale(0.97)` su `--dur-1` `--ease-tap`; il colore di fondo non cambia posizione né bounds. |
| **compilata, non completata** | i valori sono scritti ma il check è vuoto. Corsia trasparente. Il valore è in `--text-primary`. |
| **completata** | fondo riga `--set-done-surface` (`#10243C`), **corsia 3px piena `--blue-brand`**, check riempito `--blue-brand` con glifo `Check` bianco 18px (4.02:1, soglia non-testo 3:1 ✓). Animazione: `scale 0.8→1` su `--dur-1` `--ease-tap` + `opacity 0→1`. `aria-checked="true"`, label "Serie 3 completata". |
| **disabled** | la riga è disabilitata solo se la sessione è terminata: input `readonly`, check senza azione, testo `--text-disabled`, `aria-disabled="true"`, `cursor: default`. |
| **loading** | **non esiste**: i dati vengono da IndexedDB locale, la scrittura è ottimistica e sincrona a schermo. Se la scrittura Dexie fallisce → stato errore (sotto). |
| **error** | valore non valido (es. `kg` negativo, reps > 999): bordo input `--danger` 2px, **icona `AlertCircle` 16px dentro il campo a sinistra**, messaggio sotto la riga in `sm` / `--danger` (6.04:1). Il check resta disabilitato finché il campo non è valido. Validazione **on blur**, mai su ogni tasto. |
| **empty** | l'esercizio senza serie mostra la riga fantasma "Nessuna serie" + pulsante `+ Aggiungi serie` a larghezza piena, 48px. |
| **PR** | corsia 3px `--pr` **a fianco** della corsia blu (due binari da 3px, gap 2px) + badge `PR` inline dopo il valore. Colore + forma + parola. |

**Eliminazione di una serie — due strade obbligatorie:**
1. **Swipe** verso sinistra: `translateX` fino a −88px, rivela un pannello `--danger-fill`
   con icona `Trash2` + testo "Elimina". Soglia 44px, rilascio oltre 60% = elimina.
   Solo `transform`, 150ms.
2. **Alternativa non gestuale (obbligatoria, WCAG 2.5.7)**: il tocco lungo sulla colonna
   TIPO, o un tap su di essa, apre un `DropdownMenu` Radix con `Normale / Riscaldamento (W)
   / Drop set (D) / Cedimento (F) / ——— / Elimina serie`. Raggiungibile da tastiera.

Dopo l'eliminazione: **toast con "Annulla"** per 6 secondi. Nessuna conferma modale —
eliminare una serie non è distruttivo abbastanza da meritare un dialog, e in palestra un
dialog costa tre secondi.

### 4.2 `ExerciseCard` — scheda esercizio in sessione

Card `--card`, `--radius-md`, `--elev-1`, padding `--space-6` in alto e `--space-3` ai lati.

- **Header**: nome esercizio in `h2` `--text-primary`; sotto, in `sm` `--text-secondary`,
  `"Panca piana · Bilanciere"`. A destra un pulsante icona `MoreVertical` 48×48 →
  `DropdownMenu`: `Sostituisci esercizio / Riordina / Note / Timer di questo esercizio /
  ——— / Rimuovi dalla sessione`.
- **Nota**: `textarea` autoespandibile, `sm`, placeholder "Nota per questo esercizio",
  collassata finché vuota (una riga da 32px).
- **Intestazioni colonna**: `label` (12/16, 600, 0.06em, MAIUSC.) in `--text-secondary`
  (8.31:1) — `SERIE · PRECEDENTE · KG · REPS · ✓`.
- **Corpo**: n× `SetRow`.
- **Footer**: `+ Aggiungi serie` (ghost, larghezza piena, 48px, testo `--accent-blue`).

| Stato | Specifica |
|---|---|
| default | come sopra |
| **tutte le serie completate** | il nome esercizio prende un'icona `CheckCircle2` 20px `--blue-brand` a sinistra e il conteggio "4/4" in `--accent-blue`. La card **non** si collassa da sola. |
| riordino attivo | maniglia `GripVertical` 48×48 a sinistra dell'header, card in `--card-elevated` + `--elev-2`, `transform: scale(1.02)`. Alternativa da tastiera obbligatoria: frecce ↑↓ con focus sulla maniglia, annunciate con `aria-live`. |
| loading | non applicabile (dati locali) |
| error | banner interno `--danger` 1px, testo "Impossibile salvare questo esercizio. Riprova." + `Riprova` |
| empty | non esiste: una card esercizio senza serie mostra sempre lo stato empty della `SetRow` |

### 4.3 `SessionHeader` — header di sessione

Sticky in alto, `--z-sticky`, fondo `--card` con `backdrop-filter: none` (niente vetro),
bordo inferiore 1px `--border`, altezza 72px + safe area.

```
[ ChevronDown 48 ]   Push A · Petto            [ TERMINA ]
                     32:14        ·  4 280 kg
```

- **Sinistra**: `ChevronDown` 48×48 → minimizza la sessione e torna alla tab precedente
  (la sessione **continua**, vedi §6.4). `aria-label="Riduci la sessione e torna indietro"`.
- **Centro**: nome routine in `sm` `--text-secondary`; sotto, **cronometro totale** in
  `display` 40/40 `tnum` `--text-primary`, e accanto il **volume** in `num-md` `tnum`
  `--text-secondary` con l'unità `kg` in `--text-muted`.
- **Destra**: pulsante `TERMINA` primario, 48px, `--radius-btn`.

| Stato | Specifica |
|---|---|
| default | cronometro in corsa, aggiornamento al secondo |
| cronometro in pausa | il numero passa a `--text-muted` + icona `Pause` 16px accanto, **e** la parola "in pausa" in `label` sotto. Mai solo colore. |
| volume che cambia | il numero **non** anima: cambia e basta. Un contatore animato a 3 secondi di sguardo è rumore. Solo un `aria-live="off"` (non si annuncia). |
| loading | non applicabile |
| error | se Dexie fallisce: banner sotto l'header, `--danger-fill` a 1px di bordo, testo "Sessione non salvata sul dispositivo. I dati sono ancora in memoria." + `Riprova`. Persistente, non un toast. |

### 4.4 `RestTimerPill` — pill del timer di recupero (fluttuante)

Il componente più visto a distanza di braccio dopo la riga serie.

Posizione: `fixed`, `bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + var(--space-4))`,
centrata, larghezza `calc(100% - var(--space-5) * 2)` con `max-width: 420px`, altezza 64px,
`--radius-full`, fondo `--card-elevated`, bordo 1px `--border-strong`, `--elev-2`,
`--z-timer`.

```
[ −15 ]   1:28   [ progresso ————————————○      ]   [ +15 ]   [ ✕ ]
  48      display 40px tnum                            48       48
```

- **Barra di progresso**: 4px sotto i numeri, `--radius-xs`, traccia `--border`,
  riempimento `--blue-brand`, transizione `transform: scaleX()` lineare — **non** `width`.
- `−15` / `+15`: pulsanti 48×48, `--radius-full`, fondo `--surface-hover`,
  `aria-label="Togli 15 secondi" / "Aggiungi 15 secondi"`.
- `✕`: 48×48, salta il recupero. `aria-label="Salta il recupero"`.

| Stato | Specifica |
|---|---|
| **assente** | il timer non è partito: la pill non esiste nel DOM |
| **in corso** | `--glow-timer`. Numeri in `--text-primary` (14.44:1). Ingresso: `translateY(16px)→0` + `opacity 0→1`, `--dur-2` `--ease-out` |
| **ultimi 10 secondi** | numeri passano a `--pr` (8.70:1), **la barra passa a `--pr`**, **e la label sotto cambia in "Quasi"**. Pulsazione `scale 1→1.03→1`, 900ms, infinita, solo `transform`. Colore + testo + movimento: non è mai solo il colore. |
| **scaduto** | avviso sonoro (Web Audio, file 300ms) + vibrazione `navigator.vibrate([120, 60, 120])` se disponibile. La pill diventa `--pr-surface` con bordo `--pr`, testo "Recupero terminato", e si auto-chiude dopo 3s. `aria-live="assertive"` |
| **in pausa** | tocco sui numeri = pausa/riprendi. Glow rimosso, icona `Pause` 20px accanto ai numeri, label "In pausa". |
| **audio bloccato** | se il browser blocca l'autoplay: badge `VolumeX` 16px + testo "Audio non attivo — tocca per attivarlo". Un tocco sblocca l'AudioContext. |
| **reduced motion** | nessuna pulsazione, nessuna transizione di ingresso. La barra di progresso resta (è dato, non decorazione) ma avanza a step di 1s. Gli ultimi 10s restano segnalati da colore + testo. |
| **error** | se il timer perde il tick (tab in background >2s): si ricalcola da `startedAt` sull'orologio di sistema, mai dal contatore. Nessuno stato d'errore visibile. |

### 4.5 `PRBadge` — badge record personale

Chip inline: altezza 24px, padding `0 var(--space-3)`, `--radius-sm`, fondo `--pr-surface`,
bordo 1px `--pr-border`, icona `Trophy` 16px `--pr`, testo `label` `--pr` (8.52:1).

Varianti per tipo di PR, **sempre con la parola**: `PR 1RM`, `PR VOLUME`, `PR REPS`.
Mai solo l'icona.

| Stato | Specifica |
|---|---|
| default | come sopra |
| **appena conquistato** (in sessione) | ingresso `scale 0.9→1` + `opacity`, `--dur-2` `--ease-tap`, una sola volta. Annuncio `aria-live="polite"`: *"Record personale: panca piana, 1RM stimato 112 chilogrammi."* |
| storico (in un riepilogo passato) | identico ma senza animazione né annuncio |
| pieno (nel riepilogo post-workout) | fondo `--pr`, testo `--pr-on-fill` (10.70:1), altezza 28px |
| reduced motion | nessuna animazione; l'annuncio `aria-live` resta |

### 4.6 `QuickStart` — avvio rapido

Card grande in cima alla tab Allenamento: `--radius-lg`, fondo `--card`, bordo 1px
`--border`, padding `--space-6`, `--elev-1`.

- Titolo `h3` "Inizia ad allenarti".
- Pulsante primario a larghezza piena, 56px: `Avvia sessione vuota` (icona `Play` 20px).
- Sotto, in `sm` `--text-secondary`: "Oppure scegli una routine".

| Stato | Specifica |
|---|---|
| default | come sopra |
| **sessione già attiva** | il pulsante diventa secondario e recita `Riprendi sessione · 32:14`; il primario non è più "avvia". Nessuna via per aprire due sessioni. |
| hover/focus/active | vedi `Button` §4.13 |
| loading | skeleton 96px `--card` con shimmer `opacity 0.5→1` 1.2s solo al primo mount (idratazione Dexie) |
| error | "Impossibile leggere i dati locali." + `Riprova` |
| empty | non applicabile (è sempre presente) |

> **v2 — una taglia in più.** `QuickStart` guadagna una prop `size`:
> `full` (questa, in cima a `/allenamento`) e **`compact`** (80px, senza titolo, primario
> `Avvia allenamento` + secondario **col nome dell'ultima routine usata** — `Riprendi Push A ›`
> — in riga), che vive in cima a `/home` (§6.7). È lo **stesso componente**, non due che si
> somigliano. Tutti gli stati qui sopra valgono per entrambe le taglie.

### 4.7 `RoutineCard` — card routine

Riga/card `--radius-md`, fondo `--card`, padding `--space-5`, bordo 1px `--border`,
altezza minima 88px.

```
Push A                                    [ ⋮ 48 ]
Panca · Military · Alzate · Push-down
6 esercizi · ultimo: 3 giorni fa          [ AVVIA ]
```

- Titolo `h3`; elenco esercizi in `sm` `--text-secondary`, troncato a una riga con `…`
  (testo intero disponibile nel dettaglio, mai solo in tooltip);
- meta in `sm` `--text-muted` (5.44:1);
- `AVVIA` pulsante primario compatto, 40px di altezza ma **area tattile 48**;
- `⋮` → `Modifica / Duplica / Sposta in split… / ——— / Elimina routine`.

| Stato | Specifica |
|---|---|
| default / hover / focus-visible / active | vedi tabella stati globale §4.14 |
| **disabled** | routine senza esercizi: `AVVIA` disabilitato + testo di aiuto "Aggiungi almeno un esercizio per avviarla" in `sm` `--text-muted`. Mai un pulsante muto. |
| loading | skeleton 88px |
| error | riga con bordo `--danger` + "Routine danneggiata. Aprila per correggerla." |
| empty (lista) | vedi `EmptyState` §4.15 |

### 4.8 `ExerciseListRow` + filtri — libreria

Riga 56px, fondo `--card`, separatore 1px `--border` (nessun gap tra righe: densità).

```
[ ▮ 40x40 ]  Panca piana con bilanciere        ▸
             Petto · Bilanciere
```
- Quadratino 40×40 `--radius-sm` con l'**iniziale del gruppo muscolare** in `label` —
  non un'emoji, non un'icona generica. `--card-elevated` di fondo.
- Nome in `h3`; sotto, muscolo · attrezzo in `sm` `--text-secondary`.
- Esercizio personalizzato: chip `PERSONALIZZATO` in `label` `--accent-blue`.

**Barra filtri** (sticky sotto la ricerca, `--z-sticky`, altezza 56px, scroll orizzontale):
chip `--radius-full`, 36px di altezza / **48px di area tattile**, fondo `--card-elevated`,
bordo 1px `--border-strong`, testo `sm` `--text-secondary`.
- **Selezionato**: fondo `--primary`, testo `--primary-foreground` (4.98:1), icona `Check`
  14px a sinistra, `aria-pressed="true"`. Colore + icona + stato ARIA.
- Contatore risultati sempre visibile in `sm` `--text-muted`: "37 esercizi".
- `Azzera filtri` come chip `ghost` in coda, visibile solo se almeno un filtro è attivo.

| Stato | Specifica |
|---|---|
| default / hover / focus / active | §4.14 |
| loading | 8 skeleton da 56px |
| **empty — nessun esercizio** | vedi §4.15 |
| **empty — nessun risultato per il filtro** | "Nessun esercizio per *Dorso + Cavi*." + `Azzera filtri` + `Crea esercizio personalizzato` |
| error | "Impossibile leggere la libreria." + `Riprova` |

Liste oltre 50 voci: **virtualizzate** (`@tanstack/react-virtual`). La libreria precaricata
supera abbondantemente questa soglia.

> **v2.** Questa specifica resta la libreria **sotto 1280px**. Da 1280 diventa il pannello
> destro della libreria a due pannelli (§4.26): righe 48px invece di 56, due `<select>`
> invece dei chip, raggruppamento per famiglia di movimento. Con ~300 voci (§9.4) la
> virtualizzazione smette di essere una raccomandazione ed è un requisito.

### 4.9 `MeasureForm` — form misure

Layout a coppie: label a sinistra in `body-strong`, campo a destra, riga 56px.

- Ogni campo: `input inputmode="decimal"`, `num-md` `tnum`, allineato a destra, unità
  fissa a destra in `sm` `--text-muted` (`kg`, `%`, `cm`).
- **Label sempre visibile** (mai placeholder al posto della label).
- Selettore data in cima: `Oggi` come default, tocco → `Popover` Radix con calendario.

| Stato | Specifica |
|---|---|
| default | bordo 1px `--border-strong` (3.67:1), fondo `--input` |
| focus-visible | `outline: 2px solid var(--ring)`, offset 2px, bordo interno `--accent-blue` |
| **error** | validazione **on blur**. Bordo 2px `--danger`, icona `AlertCircle` 16px dentro il campo, messaggio sotto in `sm` `--danger`, `aria-invalid="true"` + `aria-describedby` |
| **error multiplo al salvataggio** | riepilogo errori in cima al form, con link a ciascun campo; il focus va sul riepilogo |
| disabled | `--text-disabled`, `aria-disabled`, mai senza spiegazione |
| loading (salvataggio) | pulsante in stato loading (§4.13); i campi restano leggibili, **non** disabilitati |
| empty | campi vuoti mostrano l'ultimo valore registrato come placeholder `--text-muted`, es. "ultima: 78,4 kg" |

### 4.10 `Chart` — grafici Recharts

Contenitore: card `--card`, `--radius-md`, padding `--space-5`, altezza 240px a 375px,
280px da `--bp-md`.

- **Griglia**: `CartesianGrid` orizzontale, `stroke: var(--chart-grid)`, `strokeDasharray="2 4"`.
  Nessuna griglia verticale.
- **Assi**: `stroke: var(--border)`, `tick.fill: var(--chart-axis)` (8.31:1),
  `tick.fontSize: 12`, `fontFamily: var(--font-sans)`, `tnum`. L'asse Y porta sempre
  l'unità nel primo tick (`kg`, `%`, `cm`).
- **Linee**: `strokeWidth: 2`, `dot` visibile solo sull'ultimo punto e sull'hover/focus.
  Forme diverse per serie (cerchio / quadrato / rombo / triangolo).
- **Tooltip**: fondo `--card-elevated`, bordo 1px `--border-strong` (3.09:1), `--radius-sm`,
  `--elev-2`, padding `--space-4`. Data in `label` `--text-secondary`, valore in `num-md`
  `--text-primary`, nome serie in `sm` con il **pallino colorato + il nome scritto**.
- **Legenda**: sempre presente con più di una serie, `label`, chip cliccabile 48px di area
  per mostrare/nascondere la serie (`aria-pressed`).
- **Brush / intervallo**: chip `1M · 3M · 6M · 1A · Tutto` sopra il grafico.

| Stato | Specifica |
|---|---|
| default | come sopra |
| hover / focus | tooltip + linea guida verticale 1px `--border-strong`. **Il tooltip è raggiungibile da tastiera**: frecce ←→ muovono il punto attivo, `aria-live="polite"` annuncia "14 marzo, 4 280 chilogrammi". |
| **loading** | rettangolo skeleton 240px con la griglia già disegnata (nessun CLS) |
| **empty — 0 punti** | "Non c'è ancora niente da mostrare." + sottotesto "Registra almeno due misurazioni per vedere l'andamento." + CTA contestuale |
| **empty — 1 punto** | si mostra il punto singolo grande + la frase "Serve un secondo dato per tracciare una linea." — mai una linea inventata |
| error | "Impossibile calcolare questo grafico." + `Riprova` |
| reduced motion | `isAnimationActive={false}` su tutte le serie |

### 4.10-bis Dominio degli assi — **nuova in v2, chiude QA GRAVE 2**

Il difetto: `TrendChart` non dichiarava `domain`, Recharts applicava `[0, 'auto']`, e due
misurazioni di peso corporeo a 82,4 e 81,2 kg diventavano una riga orizzontale su un asse
0-100. La funzionalità esisteva e non serviva a niente. La regola che segue non è un
suggerimento: è il contratto del componente `Chart`.

#### La domanda che decide

**Lo zero è un valore possibile e significativo per questa grandezza?**

| Risposta | Famiglia | Dominio Y | Esempi in Lifted |
|---|---|---|---|
| **Sì** — zero vuol dire "niente" | grandezze **cumulative o di conteggio**: si sommano, e la loro altezza *è* l'informazione | **`[0, dataMax + pad]`**, sempre. Nessuna eccezione. | volume settimanale/mensile, serie totali, minuti di allenamento, numero di allenamenti, distribuzione per gruppo muscolare |
| **No** — zero è impossibile o assurdo | grandezze **di livello**: quello che conta è la *variazione*, non la distanza dall'origine | **`[dataMin − pad, dataMax + pad]`** | peso corporeo, % massa grassa, circonferenze, **1RM stimato**, carico massimo per esercizio |

Le **barre** (`VolumeBars`) partono **sempre** da zero, anche se misurassero una grandezza di
livello: l'area della barra è il canale percettivo, e una barra tagliata mente. Se una
grandezza di livello va mostrata nel tempo, si usa una **linea**, non una barra. È il motivo
per cui `VolumeBars` resta com'è e solo `TrendChart` cambia.

#### Il margine, con i numeri

```ts
escursione = dataMax − dataMin
pad        = Math.max(escursione * 0.08, unitaMinima)
tick       = primo valore di [0.5, 1, 2.5, 5, 10, 25, 50, 100] che produce 4–6 tick
yMin       = Math.floor((dataMin − pad) / tick) * tick
yMax       = Math.ceil ((dataMax + pad) / tick) * tick
```

| Metrica | `unitaMinima` |
|---|---|
| peso corporeo, 1RM stimato, carico | `0.5` kg |
| % massa grassa | `0.5` % |
| circonferenze | `0.5` cm |

**Caso degenere — escursione zero** (tutti i punti uguali, o un punto solo): `pad` diventerebbe
`unitaMinima` e l'asse si stringerebbe a 1 kg, trasformando il rumore in un terremoto.
Regola: se `escursione === 0`, il dominio è `[v − unitaMinima*4, v + unitaMinima*4]`, la
linea si disegna al centro esatto, e **sotto il grafico compare la frase** «Nessuna variazione
nel periodo.» in `sm` `--text-secondary`. Mai un grafico che suggerisce un movimento che non c'è.

#### La dichiarazione obbligatoria

Quando l'asse **non parte da zero**, il grafico porta nel piede, in `sm` `--text-muted`
(5.44:1 su `--card`), una riga che dichiara la scala:

> `Scala: 78,5 – 83,0 kg`

Non è un'avvertenza decorata, è il dato: dice al lettore quanto vale l'escursione che sta
guardando, e serve anche da riepilogo accessibile. Sui grafici che partono da zero questa
riga **non** compare (sarebbe rumore: lo zero è già visibile sull'asse).

| Stato | Specifica |
|---|---|
| dominio dal minimo | riga `Scala: min – max` nel piede + primo tick con l'unità |
| dominio da zero | nessuna riga; il tick `0` è sempre visibile e mai tagliato |
| escursione zero | dominio simmetrico, linea al centro, frase «Nessuna variazione nel periodo.» |
| 1 solo punto | §4.10, empty «Serve un secondo dato per tracciare una linea.» — la regola del dominio non si applica |
| serie multiple con unità diverse | **vietato su un asse solo**. Due assi Y, ciascuno con la sua regola, o due grafici. |

`aria`: la `<table>` alternativa che l'app già genera per ogni grafico resta la fonte di
verità accessibile e **non** cambia con il dominio — contiene i valori, non i pixel.

### 4.11 `BottomNav` — navigazione a 5 tab · **tab riassegnate in v2**

`fixed`, altezza `--nav-h` (56px) `+ env(safe-area-inset-bottom)`, fondo `--background`,
bordo superiore 1px `--border`, `--z-nav`. Ogni tab occupa 20% (75px a 375 → ≥48 ✓).
**Vive solo sotto `--bp-lg` (1024px).** Da 1024 in su non esiste: al suo posto c'è la
`Sidebar` (§4.19), che **sostituisce il rail laterale da 240px della v1** — quel rail si
cancella, non si affianca.

| # | Rotta | Etichetta | Icona lucide (inattiva → attiva) | v1 → v2 |
|---|---|---|---|---|
| 1 | **`/home`** | Home | `House` → riempita | **nuova** |
| 2 | `/allenamento` | Allenamento | `Dumbbell` → riempita | resta (era la 1ª) |
| 3 | **`/trainer`** | Trainer | `ClipboardList` → riempita | **nuova** |
| 4 | `/esercizi` | Esercizi | `ListChecks` → riempita | resta |
| 5 | `/profilo` | Profilo | `User` → riempita | resta |

**Misure e Statistiche escono dalla barra.** Non spariscono: diventano due dei tre pannelli
di `/profilo` (`Riepilogo · Statistiche · Misure`, §4.22), restano rotte reali
(`/misure`, `/misure/[metrica]`, `/statistiche`), restano deep-linkabili, e nella sidebar
restano come voci annidate sotto Profilo.

*Il costo, dichiarato:* su telefono Misure passa da 1 tocco a 2. *Il motivo:* il tetto di
**cinque** voci in una bottom nav non è negoziabile (a sei, la colonna a 375px scende a 62px
e l'etichetta non ci sta più), e le due schermate nuove si aprono molte più volte a settimana
di quante se ne apra la tab Misure. Statistiche e Misure sono schermate da *consultare*, e il
posto delle schermate da consultare è il profilo: è anche dove il riferimento le mette.

Icona 24px sopra, etichetta `label` (12px, 600, 0.06em) sotto, gap `--space-1`.

| Stato | Specifica |
|---|---|
| **inattiva** | icona outline `--text-secondary` (9.16:1), etichetta `--text-secondary` |
| **attiva** | icona **riempita** + `--accent-blue` (6.53:1), etichetta peso 700 `--accent-blue`, **binario 2px `--blue-brand` sul bordo superiore della tab**, `aria-current="page"`. Quattro segnali: riempimento, colore, peso, binario. |
| hover | fondo `--surface-hover` sull'intera colonna |
| focus-visible | `outline: 2px solid var(--ring); outline-offset: -2px` (l'anello resta dentro la nav, non esce dallo schermo) |
| active | `scale(0.94)` sull'icona, `--dur-1` |
| disabled | non esiste: una tab è sempre raggiungibile |
| **con sessione attiva** | sopra la nav compare `SessionBar` (§4.12); la nav non cambia |

`role="navigation"` + `aria-label="Navigazione principale"`. Il `<main>` ha
`padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + var(--space-5))` —
il contenuto **non** finisce mai sotto la nav.

### 4.12 `SessionBar` — barra "sessione in corso"

Il ponte che rende la sessione minimizzabile senza perderla.

`fixed`, direttamente sopra la nav, altezza `--session-bar-h` (48px), larghezza piena,
fondo `--card-elevated`, bordo superiore 1px `--border-strong`, `--elev-2`,
`--z-session-bar`. **Corsia 3px `--blue-brand`** sul bordo sinistro.

```
▮ ● Sessione in corso · 32:14 · Panca piana        [ Riprendi ▸ ]
```
- Punto `●` 8px `--blue-brand` con pulsazione 2s (solo `opacity`, soppressa da reduced motion);
- testo `sm` `--text-primary`, cronometro `tnum`;
- tutta la barra è un unico `button` 48px, `aria-label="Riprendi la sessione in corso,
  32 minuti e 14 secondi"`.

| Stato | Specifica |
|---|---|
| **assente** | nessuna sessione attiva → non è nel DOM |
| default | come sopra |
| **timer di recupero attivo** | il testo diventa `Recupero · 0:28`, il punto passa a `--pr`. **La pill del timer resta visibile anche fuori dalla sessione**, sopra la barra. |
| hover / active | `--surface-hover` / `scale(0.99)` |
| focus-visible | anello standard, offset 2px verso l'interno |
| error | se la sessione in Dexie è irrecuperabile: testo "Sessione interrotta · recupera i dati" e il tocco porta a un dialog di recupero |
| reduced motion | punto fisso, nessuna pulsazione |

Il `<main>` aggiunge `--session-bar-h` al proprio `padding-bottom` quando la barra è presente.

> **v2.** Tutto questo vale **sotto 1024px**. Da `--bp-lg` la `SessionBar` si sposta
> **dentro la sidebar**, sopra il blocco stato locale: larghezza piena della colonna,
> altezza `--sidebar-foot-h` (64px), due righe, `--radius-md` (§4.19.5). Non resta anche
> fissa in fondo alla finestra: senza una bottom nav su cui appoggiarsi, coprirebbe il
> contenuto senza guadagnarci niente. Il `<main>` a ≥1024 non ha più il `padding-bottom`.

### 4.13 `Button`

Tre varianti + due dimensioni. `--radius-btn` (12px) su tutte.

| Variante | Fondo | Testo | Bordo | Contrasto testo |
|---|---|---|---|---|
| `primary` | `--primary` `#1268EC` | `#FFFFFF` | — | **4.98:1** |
| `secondary` | `--secondary` `#1F222A` | `--text-primary` | 1px `--border-strong` | **14.44:1** |
| `ghost` | trasparente | `--accent-blue` | — | **6.53:1** su card |
| `destructive` | `--danger-fill` `#D92D24` | `#FFFFFF` | — | **4.83:1** |

Dimensioni: `md` = 48px (default), `lg` = 56px (solo CTA a larghezza piena: Avvia, Termina).
Padding orizzontale `--space-6`. Icona inline 20px, gap `--space-3`.

| Stato | primary | secondary / ghost | destructive |
|---|---|---|---|
| hover | `--primary-hover` (bianco 5.81:1) | fondo `--surface-hover` | `#C2251D` |
| focus-visible | `outline 2px --ring`, `outline-offset 2px` | idem | idem |
| active | `--primary-active` (6.52:1) + `scale(0.97)` `--dur-1` | `scale(0.97)` | `scale(0.97)` |
| **disabled** | fondo `--secondary`, testo `--text-disabled`, `aria-disabled="true"`, `cursor: not-allowed`. **Sempre accompagnato da un testo di aiuto che spiega perché**. | idem | idem |
| **loading** | testo sostituito da `Loader2` 20px in rotazione 800ms lineare **+ la parola** ("Importo…"). Larghezza bloccata al valore precedente (niente CLS). `aria-busy="true"`, `aria-live="polite"`. | idem | idem |
| reduced motion | nessuno `scale`, nessuna rotazione: lo spinner diventa tre punti in dissolvenza a 1s | idem | idem |

### 4.14 Stati globali (si applicano a ogni elemento interattivo)

| Stato | Regola unica del sistema |
|---|---|
| **hover** | solo su `@media (hover: hover)`. **Nessuna informazione o azione esiste solo in hover.** |
| **focus-visible** | `outline: 2px solid var(--ring)` + `outline-offset: 2px`. Mai `outline: none`. L'anello non è mai coperto da nav, barra sessione o pill timer: il contenitore scrollabile ha `scroll-padding-bottom: 180px`. |
| **active** | `transform: scale(0.97)`, `--dur-1`, `--ease-tap`. Mai cambio di dimensione del box. |
| **disabled** | `--text-disabled` + `aria-disabled="true"` + testo di aiuto. Mai un controllo che sembra premibile e non fa niente. |
| **loading** | mai uno spinner senza parole. Sotto 1s: nessun indicatore. Sopra 1s: skeleton (liste) o bottone in loading (azioni). |
| **error** | messaggio **accanto all'elemento** che ha fallito, con icona + testo, mai solo rosso, mai solo in cima alla pagina. Sempre con un'azione di uscita (`Riprova`, `Annulla`). |
| **empty** | ogni lista, ogni grafico, ogni tab ha il suo (§4.15). |

### 4.15 `EmptyState`

Struttura fissa: icona lucide 40px `--text-muted` (mai emoji) → titolo `h3`
`--text-primary` → una riga `body` `--text-secondary` → **una** CTA primaria
(+ eventualmente una secondaria `ghost`). Padding verticale `--space-11`, testo centrato,
larghezza massima 320px.

| Dove | Icona | Titolo | Riga | CTA |
|---|---|---|---|---|
| Allenamento — nessuna routine | `LayoutList` | "Nessuna routine" | "Crea la tua prima routine, o avvia subito una sessione vuota." | `Crea routine` + ghost `Sessione vuota` |
| Profilo — nessuna sessione | `History` | "Nessun allenamento registrato" | "Il tuo storico comparirà qui dopo la prima sessione." | `Inizia ad allenarti` |
| Esercizi — libreria vuota | `Dumbbell` | "Libreria vuota" | "Ricarica gli esercizi di base o creane uno tuo." | `Ricarica libreria` + ghost `Crea esercizio` |
| Esercizi — filtri senza risultati | `SearchX` | "Nessun risultato" | "Nessun esercizio per *Dorso + Cavi*." | `Azzera filtri` |
| Misure — nessuna misura | `Ruler` | "Nessuna misurazione" | "Registra peso e circonferenze per vedere l'andamento nel tempo." | `Aggiungi misurazione` |
| Statistiche — dati insufficienti | `TrendingUp` | "Servono più dati" | "Completa almeno due sessioni per vedere le statistiche." | `Inizia ad allenarti` |
| Esercizio — nessuno storico | `LineChart` | "Mai allenato" | "Quando userai questo esercizio, qui vedrai il tuo 1RM stimato." | — |
| Backup — nessun export | `Download` | "Nessun backup" | "I dati sono solo su questo dispositivo. Esportali ora." | `Esporta tutto` |
| **v2** — Home, feed vuoto | `History` | "Nessun allenamento registrato" | "Il tuo primo allenamento comparirà qui. Poi ci resta." | `Avvia allenamento` + ghost `Scegli una routine` |
| **v2** — Trainer, nessun programma | `ClipboardList` | "Nessun programma" | "Rispondi a sei domande e ti preparo un programma di più settimane che si aggiorna da solo." | `Inizia il questionario` + ghost `Come funziona` |
| **v2** — Trainer, registro vuoto | `ListChecks` | "Ancora nessuna decisione" | "Il registro si riempie dopo il tuo primo allenamento del programma: ogni cambio di carico finisce qui, con il motivo." | `Vai al programma` |
| **v2** — Trainer, filtro senza risultati | `SearchX` | "Nessuna riduzione" | "Nessuna riduzione di carico finora." | `Azzera filtri` |
| **v2** — Libreria, nessuna selezione | `Dumbbell` | "Scegli un esercizio" | "Seleziona una voce dall'elenco per vedere storico, 1RM stimato e record." | — |
| **v2** — Calendario, mese vuoto | — (la griglia resta) | — | "Nessun allenamento a settembre." | link `Vai a agosto (8 allenamenti)` |
| **v2** — Ricerca globale, nessun risultato | `SearchX` | — | "Nessun risultato per «panka»." | `Crea l'esercizio «panka»` |

### 4.16 `Dialog` e `Sheet` (Radix)

**Regola di piattaforma**: sotto `--bp-md` **tutto è bottom sheet**; da `--bp-md` in su,
dialog centrato. Non esistono modali centrati su telefono.

**Bottom sheet**: fondo `--card-elevated`, `--radius-lg` solo in alto, bordo superiore 1px
`--border-strong` (4.00:1 contro lo scrim — **obbligatorio**, senza bordo il bordo del
foglio sparisce), `--elev-2`, maniglia 36×4 `--border-strong` `--radius-full` centrata,
padding `--space-6`, `padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom))`.
Altezza massima `85dvh`, contenuto scrollabile.

**Dialog** (≥768): larghezza 480px, centrato, `--radius-lg`, `--elev-3`.

**Scrim**: `--overlay` `rgba(0,0,0,0.72)`.

| Stato | Specifica |
|---|---|
| ingresso | sheet `translateY(100%)→0` `--dur-3` `--ease-out`; dialog `opacity 0→1` + `scale(0.98)→1` `--dur-3`; scrim `opacity 0→1` `--dur-2` |
| uscita | `--dur-1` (150ms), `--ease-in` |
| focus | trappola del focus Radix; al mount il focus va **sul primo elemento interattivo**, non sulla X; `Esc` chiude; alla chiusura il focus torna al trigger |
| loading | contenuto skeleton dentro il foglio, il foglio non si apre vuoto |
| error | messaggio in linea sopra le azioni, il foglio non si chiude da solo |
| empty | il foglio non si apre mai vuoto: se non c'è nulla da mostrare, si mostra l'empty state dentro |
| reduced motion | scrim in dissolvenza, foglio senza `translateY` (comparsa in `opacity` a 150ms) |
| swipe-to-dismiss | disponibile, **più** una `X` 48×48 in alto a destra e `Esc` |

### 4.17 `Toast`

`Sonner` (o `@radix-ui/react-toast`). In basso, sopra tutto (`--z-toast`), sopra la pill
del timer se presente. Larghezza `calc(100% - 32px)`, max 420px, `--radius-md`,
fondo `--card-elevated`, bordo 1px `--border-strong`, `--elev-2`, padding `--space-4`.

Struttura: **icona 20px + testo `body` + azione opzionale**. L'icona e la parola portano
il senso; il colore è un binario 3px a sinistra.

| Tipo | Corsia | Icona | Durata |
|---|---|---|---|
| neutro | `--border-strong` | `Info` | 4s |
| successo | `--success` | `CheckCircle2` | 4s |
| errore | `--danger` | `AlertTriangle` | **non si chiude da solo** |
| annullabile | `--accent-blue` | `Undo2` | 6s, con pulsante `Annulla` 48px |

`aria-live="polite"` (assertive solo per gli errori). Massimo **2 toast** contemporanei.
Ingresso `translateY(12px)→0` + `opacity`, `--dur-2`; uscita `--dur-1`. Reduced motion:
solo `opacity`.

### 4.18 `NumberField` — campo numerico ottimizzato per il pollice

Il componente da cui dipende la velocità di tutta l'app.

```tsx
<input
  type="text"                    // non "number": niente spinner, niente scroll accidentale
  inputMode="decimal"            // reps: "numeric"
  pattern="[0-9]*[.,]?[0-9]*"
  enterKeyHint="next"
  name="set-3-weight"            // name significativo, serve all'autofill e ai test
  autoComplete="off"             // campo non-auth: evita i suggerimenti del password manager
  spellCheck={false}
  defaultValue={...}             // NON controllato: vedi §11.6
  className="tnum text-right touch-manipulation"
/>
```

Decisioni vincolanti:
- **`type="text"` + `inputMode`**, mai `type="number"`: gli spinner nativi sono target da
  16px e la rotellina cambia il valore per sbaglio.
- **Selezione totale al focus** (`onFocus: e.target.select()`): si sovrascrive, non si
  corregge carattere per carattere.
- **La virgola vale il punto**: `,` e `.` normalizzati a `.` in scrittura.
- **`enterKeyHint="next"`** e `Invio` porta al campo successivo della **stessa riga**, poi
  al check. L'ordine di focus segue la lettura (vedi §7.2).
- **Incrementi**: pressione lunga sul campo apre uno `Popover` con `−2.5 / −1.25 / +1.25 /
  +2.5` (kg) o `−1 / +1` (reps), pulsanti 48×48. Alternativa da tastiera: `↑`/`↓`
  incrementano di uno step, `Shift+↑/↓` di quattro step.
- **Step dal token, non dal componente**: `--step-kg: 2.5`, `--step-kg-fine: 1.25`,
  `--step-reps: 1` (configurabili in Impostazioni).
- **Unità fissa** a destra fuori dal campo, `sm` `--text-muted` — non dentro il valore.

| Stato | Specifica |
|---|---|
| default | fondo `--input`, bordo 1px `--border-strong`, testo `--text-primary` allineato a destra |
| **placeholder** | mostra il valore della serie precedente in `--text-muted` (5.79:1 su `--input`). È un suggerimento leggibile, non un fantasma illeggibile. |
| focus-visible | anello `--ring` + bordo `--accent-blue`, contenuto selezionato |
| active | nessun cambio di bounds |
| disabled | `--text-disabled`, `readonly` quando la sessione è chiusa |
| loading | non applicabile |
| **error** | validazione on blur: bordo 2px `--danger`, icona `AlertCircle` 16px a sinistra dentro il campo, messaggio sotto |
| empty | il campo vuoto **non** blocca il check: una serie può essere completata a corpo libero (kg vuoto = 0) |

---

## 4-bis. Componenti nuovi della v2

Tutto quello che segue non esisteva in v1. Vale la stessa regola: **specificato per stati,
non per aspetto**; se manca lo stato vuoto, quello di caricamento o quello d'errore, il
componente non è finito.

### 4.19 `Sidebar` — la navigazione da `--bp-lg` in su

Sostituisce il rail di 240px. È **fissa**, non collassabile, non a scomparsa: un guscio che
si può nascondere costa un pulsante, uno stato da ricordare e una decisione a ogni apertura,
e su un'app con sei destinazioni non compra niente.

```
┌── 264px ─────────────────┐
│  Lifted                  │  wordmark, h2, link a /home
│  ┌────────────────────┐  │
│  │ ⌕ Cerca esercizi…  │  │  44px, ricerca globale (§4.19.3)
│  └────────────────────┘  │
│  ▮ ⌂  Home              │  48px, voce attiva: corsia 3px + fondo + icona piena
│    ⬚  Allenamento       │
│    ▤  Trainer           │
│    ≡  Esercizi          │
│    ○  Profilo           │
│       · Riepilogo       │  sotto-voci: solo se Profilo è la sezione attiva
│       · Statistiche     │
│       · Misure          │
│                          │
│  ·····················   │  separatore 1px --border
│    ⚙  Impostazioni      │
│  ┌────────────────────┐  │
│  │ ● Sessione · 32:14 │  │  SessionBar, solo se c'è una sessione attiva
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │▮ Dati su questo    │  │  blocco stato locale, 64px (§4.19.4)
│  │  dispositivo       │  │
│  │  Backup: 3 giorni fa│  │
│  └────────────────────┘  │
└──────────────────────────┘
```

Contenitore: `<nav aria-label="Navigazione principale">`, `position: fixed`, `inset-block: 0`,
`left: 0`, `width: var(--sidebar-w)`, fondo `--card`, bordo destro 1px `--border`,
`padding: var(--space-6) var(--sidebar-pad-x)`, `z-index: var(--z-nav)`,
`overflow-y: auto`, `scrollbar-gutter: stable`, `display: flex; flex-direction: column`.
Il blocco inferiore (separatore → Impostazioni → SessionBar → stato locale) è spinto in basso
da un `margin-top: auto`, **non** da una posizione assoluta: se la finestra è bassa, la lista
scorre e il piede scende con lei invece di coprirla.

#### 4.19.1 Voce di navigazione — stati

Altezza `--sidebar-item-h` (48px), `--radius-md`, padding `0 var(--space-4)`, icona 20px,
etichetta `body` (16/24), gap `--space-4`, gap verticale fra voci `--space-1` (2px).

| Stato | Specifica | Contrasto misurato |
|---|---|---|
| **default** | icona e testo `--text-secondary`, peso 400, fondo trasparente | 8.31:1 su `--card` |
| **hover** (`@media (hover:hover)`) | fondo `--surface-hover`, testo `--text-primary` | **13.02:1** su `#262A34` |
| **focus-visible** | `outline: 2px solid var(--ring); outline-offset: -2px` — l'anello resta **dentro** i bounds, così non viene tagliato dal bordo della sidebar | `--ring` su `#262A34` = **6.59:1** (≥3 ✓) |
| **active / press** | `transform: scale(0.99)`, `--dur-1`, `--ease-tap` | — |
| **attiva** | **cinque** segnali insieme: (1) **corsia 3px `--blue-brand`** sul bordo sinistro interno, `--radius-xs` — *è l'elemento firma del sistema, lo stesso di §0*; (2) fondo `--surface-hover`; (3) icona **riempita** `--accent-blue`; (4) etichetta `--accent-blue` peso 600; (5) `aria-current="page"` | `--accent-blue` su `#262A34` = **4.79:1** ✓ |
| **disabled** | non esiste: una destinazione è sempre raggiungibile | — |
| **loading** | non esiste: la sidebar è statica, non dipende da Dexie | — |
| **error** | non esiste | — |
| **con badge** | solo due voci possono portarne uno: Trainer (`Oggi` quando c'è un allenamento previsto e non ancora fatto) e Impostazioni (punto `--warning` se il backup manca da >14 giorni). Il badge è **testo o punto + `aria-label` esteso**, mai un numero senza nome: `aria-label="Trainer, allenamento previsto oggi"` |

#### 4.19.2 Sotto-voci

Solo sotto **Profilo**, e solo quando Profilo è la sezione attiva (`progressive-disclosure`).
Altezza 40px, rientro `--space-8` (32px) a sinistra, nessuna icona, etichetta `sm`
`--text-secondary`, attiva → `--accent-blue` peso 600 + `aria-current="page"`.
Marcate come `<ul>` annidato dentro il `<li>` del padre, così lo screen reader legge la
gerarchia invece di sette voci piatte. **Il target scende a 40px**: è l'unica eccezione ai 44
in tutto il sistema, ammessa perché (a) esiste solo da 1024px in su, dove l'input è un mouse,
(b) WCAG 2.5.8 chiede 24px sul web, (c) ogni sotto-voce è raggiungibile anche dal pannello a
tab di `/profilo`, che è a 48px. Se questa eccezione dà fastidio in revisione, si alza a 44 e
si perde un rientro: nessun altro effetto.

#### 4.19.3 `GlobalSearch` — ricerca in cima alla sidebar

Il riferimento ha «Cerca utenti». Qui non ci sono utenti: il campo cerca **esercizi e routine**.

Input 44px, fondo `--input`, bordo 1px `--border-strong` (3.67:1), `--radius-sm`, icona
`Search` 16px `--text-muted` a sinistra, placeholder `Cerca esercizi o routine…` (§11.8: le
istruzioni finiscono con `…`). `role="combobox"`, `aria-expanded`, `aria-controls`,
`aria-activedescendant`; il popover è `--card-elevated`, bordo `--border-strong`,
`--radius-md`, `--elev-2`, larghezza = sidebar + `--space-8`, max 8 risultati.

| Stato | Specifica |
|---|---|
| default | placeholder, nessun popover |
| focus | anello `--ring` + bordo `--accent-blue`; il popover si apre con «Recenti» (ultime 5 aperture) |
| digitazione | filtro locale con **debounce 120ms**; risultati raggruppati con intestazione `label`: `ESERCIZI` / `ROUTINE`. `↑`/`↓` scorrono, `Invio` apre, `Esc` chiude e restituisce il focus al campo |
| **loading** | non esiste: 300 voci in memoria si filtrano in meno di 16ms. Coerente con §4.14 («sotto 1s nessun indicatore») |
| **empty — nessun risultato** | `Nessun risultato per «panka».` + azione `Crea l'esercizio «panka»` |
| **empty — campo vuoto al focus** | «Recenti»; se non ce ne sono, «Scrivi il nome di un esercizio o di una routine.» |
| error | `Impossibile leggere la libreria.` + `Riprova` |
| annuncio | `aria-live="polite"` con debounce 500ms: «7 risultati.» Mai un annuncio per tasto. |

**Sotto 1024px la ricerca globale non esiste.** Non si aggiunge una lente alla bottom nav:
la ricerca della libreria è già in cima a `/esercizi` e duplicarla creerebbe due campi che
cercano cose diverse con la stessa icona.

#### 4.19.4 `LocalStateBlock` — il piede della sidebar

Al posto del blocco account del riferimento. 64px (`--sidebar-foot-h`), fondo
`--card-elevated`, `--radius-md`, bordo 1px `--border`, padding `--space-4`,
**corsia 3px** a sinistra (l'elemento firma).

```
▮ Dati su questo dispositivo                 [ ⤓ 44 ]
  Ultimo backup: 3 giorni fa
```
- riga 1: `sm` `--text-primary` (14.44:1);
- riga 2: `sm` `--text-muted` (4.87:1 su elevato) quando il backup è recente;
- pulsante icona `Download` 44×44, `aria-label="Esporta un backup adesso"`.

| Stato | Corsia | Riga 2 | Canali |
|---|---|---|---|
| backup ≤ 7 giorni | `--success` | «Ultimo backup: 3 giorni fa» `--text-muted` | colore + testo |
| backup 8–14 giorni | `--warning` | «Ultimo backup: 11 giorni fa» `--pr` (8.70:1 su elevato) | colore + testo |
| backup > 14 giorni **o mai** | `--warning` | icona `AlertTriangle` 16px `--pr` + «**Nessun backup.** I dati sono solo qui.» | colore + **icona** + testo |
| esportazione in corso | `--accent-blue` | pulsante in stato loading (§4.13) + «Esporto…» | — |
| error | `--danger` | «Esportazione non riuscita.» + `Riprova` | colore + testo |

È la traduzione onesta del blocco «chi sei» del riferimento: qui non conta chi sei, conta
**dove stanno i tuoi dati** — che in un'app local-first è l'unica informazione di stato che
valga un posto fisso sullo schermo.

#### 4.19.5 `SessionBar` nella sidebar

Quando c'è una sessione attiva, la `SessionBar` di §4.12 vive **dentro la sidebar**, sopra il
blocco stato locale: larghezza piena della colonna, altezza `--sidebar-foot-h` (64px),
`--radius-md`, due righe (`Sessione in corso` / `32:14 · Panca piana`). Fuori dalla sidebar
non compare: a ≥1024 non c'è una bottom nav sopra cui appoggiarla, e una barra fissa in fondo
alla finestra coprirebbe il contenuto senza motivo. Sotto 1024 resta esattamente come in v1.

---

### 4.20 `RightRail` — la colonna destra (da `--bp-3col`)

`<aside aria-label="Riepilogo e azioni rapide">`, larghezza `--rail-right-w` (320px),
`position: sticky; top: var(--space-8)`, altezza massima `calc(100dvh - var(--space-8) * 2)`,
`overflow-y: auto`, `overscroll-behavior: contain`. Card impilate con gap `--space-5`,
padding interno `--space-5` — **16px contro i 20px della colonna centrale**: è una colonna di
supporto, e la densità lo dice prima del contenuto.

**È sempre l'ultima nel DOM**, dopo `<main>`. Nessuna informazione critica vive solo qui:
sotto 1280 ogni card della colonna destra ricompare dentro la colonna centrale, in coda, o
in una rotta propria. Una colonna che sparisce portandosi via un dato è un bug di responsive,
non una scelta di layout.

| Rotta | Che cosa ci va, in ordine | Dove finisce sotto 1280 |
|---|---|---|
| `/home` | **Il tuo mese** (allenamenti, volume, serie + `Vedi il profilo`) · **Azioni rapide** · **Stato del backup** | in coda al feed |
| `/allenamento` | **Azioni rapide**: `Nuova routine`, `Nuovo split` · **Ultime usate** (3 routine) | in coda alla lista routine |
| `/trainer` | **Riepilogo del programma** (settimana, aderenza %, prossimi 3 allenamenti) · **Azioni**: `Sostituisci un esercizio`, `Cambia giorni a settimana`, `Come funziona la progressione` | dentro la dashboard, sotto la card di oggi |
| `/esercizi` | **il pannello elenco + filtri** (§4.26) — qui la colonna destra *è* il contenuto, non un supporto | diventa la pagina; il dettaglio diventa una rotta |
| `/profilo` | **Calendario mensile** (§4.27) · **Totali di sempre** | il calendario va in colonna centrale, dopo le statistiche |
| `/statistiche` | **Intervallo attivo** + legenda persistente · **PR recenti** (5) | chip d'intervallo sopra ogni grafico, come in v1 |
| `/misure` | `Aggiungi misurazione` · **Variazioni a 30 giorni** | in coda all'elenco metriche |
| `/impostazioni` | **niente**: l'indice vive dentro la colonna centrale (§4.28) | — |
| `/sessione`, `/sessione/riepilogo/[id]` | **niente**: la sessione tiene il layout a due colonne di §7.3 e prende tutta l'area contenuto. La sidebar resta (è la via d'uscita che non scarta), la colonna destra non si monta | — |

**Card «Azioni rapide»** — righe 48px, icona 20px in un quadrato 32×32 `--card-elevated`
`--radius-sm`, etichetta `body`, `ChevronRight` 16px `--text-muted` a destra, separatore 1px
fra le righe. È la forma del riferimento (`Nuova routine ›`), ridisegnata con i token di v1.

| Stato | Specifica |
|---|---|
| default / hover / focus-visible / active | §4.14 (hover = `--surface-hover` sulla sola riga) |
| **loading** | skeleton di 3 righe da 48px, solo al primo mount |
| **empty** | una card di riepilogo senza dati non si mostra vuota: si mostra con lo zero e la frase («0 allenamenti questo mese. Il primo conta doppio.»), oppure non si monta affatto. Mai una card con un trattino e basta. |
| **error** | la singola card mostra «Non riesco a leggere questo dato.» + `Riprova`; **le altre card della colonna restano vive** (l'errore non abbatte l'aside) |

---

### 4.21 `WorkoutFeedCard` — la card della home a feed

È la card del riferimento, spogliata di tutto ciò che è sociale.

```
┌──────────────────────────────────────────────┐
│  Schiena+Dorso                        [ ⋮ ]  │  h3 + menu 44×44
│  ieri, 18:04                                 │  sm --text-muted
│ ──────────────────────────────────────────── │  separatore 1px --border
│  DURATA     VOLUME       RECORD              │  label 12/600/0.06em --text-secondary
│  1:42       3 685 kg     🏆 9                │  num-md 16/600 tnum; Trophy --pr
│ ──────────────────────────────────────────── │
│  ▮ [▮] 3 × Panca inclinata (Smith)           │  corsia 3px + quadratino 40×40
│  ▮ [▮] 3 × Lat pulldown (Macchina)           │
│  ▮ [▮] 3 × Chest press (Macchina)            │
│  Visualizza altri 4 esercizi                 │  <button aria-expanded>
└──────────────────────────────────────────────┘
```

Card `--card`, `--radius-lg`, bordo 1px `--border`, `--elev-1`, padding `--space-6` (20px),
gap fra card `--space-5` (16px).

**Le tre differenze dal riferimento, e perché:**
1. **Niente intestazione avatar + username.** Al loro posto il nome dell'allenamento in `h3`
   e la data in `sm` `--text-muted`. In un'app a un solo utente, ripetere il proprio nome su
   ogni card è rumore, e l'avatar è un cerchio colorato che non dice niente.
2. **Niente piede sociale.** La card finisce con l'elenco esercizi. Nessun like, nessun
   campo commento, nessuna icona di condivisione.
3. **Niente miniature fotografiche.** §11.6 vieta le immagini raster nel prodotto; al posto
   della thumbnail, il **quadratino 40×40 con l'iniziale del gruppo muscolare** già definito
   in §4.8. La coerenza vale più della somiglianza.

**Il blocco metriche.** Tre celle in riga, `display: grid; grid-template-columns: repeat(3, 1fr)`,
etichetta sopra in `label` `--text-secondary` (8.31:1), valore sotto in `num-md` `tnum`
`--text-primary`. Il record: icona `Trophy` 16px `--pr` + numero in `--pr` (9.71:1) + la
parola «record» nell'etichetta sopra — **mai l'emoji della medaglia del riferimento**
(`no-emoji-icons`). Se i record sono 0, la terza cella **non** mostra «0»: mostra
`— ` in `--text-disabled` con `aria-label="Nessun record in questo allenamento"`.
A 375px, se il volume supera le 5 cifre, le tre celle passano a `1fr 1fr` + riga sotto.

**L'elenco esercizi.** Righe 40px, `3 × Nome (Attrezzo)`, nome in `body` `--text-primary`
troncato a una riga con `min-w-0` (§11.9), conteggio serie in `num-md` `tnum`.
**Corsia 3px** a sinistra di ogni riga: piena `--blue-brand` se tutte le serie sono state
completate, piena `--pr` se la riga contiene un PR, assente altrimenti. L'elemento firma del
sistema ricorre anche qui.

| Stato | Specifica |
|---|---|
| **default** | 3 esercizi visibili |
| **hover** | `--surface-hover` sul solo titolo e sulle righe cliccabili, mai sull'intera card (una card intera che si illumina non dice *dove* cliccare) |
| **focus-visible** | anello standard sul titolo, sul menu e sul pulsante di espansione, mai sulla card |
| **active** | `scale(0.99)` sulla riga premuta |
| **espansa** | `aria-expanded="true"`, il pulsante diventa `Mostra meno`. **L'espansione non si anima**: le righe nuove entrano in `opacity 0→1` `--dur-1`, l'altezza cambia subito. Animare l'altezza violerebbe la regola «solo `transform` e `opacity`», e un'animazione di layout su una lista lunga è jank garantito. |
| **con sessione in corso** | la **prima** card del feed è sostituita dalla card «Sessione in corso» (corsia `--blue-brand`, punto pulsante, cronometro `tnum`, primario `Riprendi`). Non si somma alla `SessionBar`: a ≥1024 la barra è nella sidebar e questa card è il richiamo nel contenuto; sotto 1024 la card **non** compare, perché la `SessionBar` è già fissa sopra la nav. Una sola chiamata all'azione per schermo. |
| **loading** | 3 skeleton da 260px con il blocco metriche già disegnato (nessun CLS); solo al primo mount |
| **empty** | il feed vuoto non mostra card: mostra l'`EmptyState` «Nessun allenamento registrato» (§4.15) |
| **error** | la singola card danneggiata mostra «Questo allenamento è illeggibile.» + `Apri comunque` / `Elimina`; le altre card restano |
| **reduced motion** | nessuna dissolvenza all'espansione, nessun `scale`; il punto della sessione in corso è fisso |

**Paginazione.** 10 card, poi un pulsante reale `Carica altri 10` a larghezza piena, 48px.
**Niente scroll infinito**: rompe il ritorno alla posizione quando si apre una sessione e si
torna indietro, che è esattamente il gesto più frequente su questa schermata. Oltre le 200
card in memoria, la lista si virtualizza (§11.6).

**Menu ⋮** (44×44, `aria-label="Azioni per Schiena+Dorso del 22 settembre"`):
`Apri il dettaglio` · `Ripeti come sessione` · `Salva come routine` · ——— · `Elimina allenamento`.

---

### 4.22 `ProfileHeader` + `StatsTabs` — l'intestazione del profilo

**L'intestazione non ha un avatar.** Il riferimento mette avatar, username, Follower, Seguiti;
di quei quattro, tre non esistono qui e il quarto è un cerchio con una lettera. Al loro posto,
quello che l'utente possiede davvero: **i numeri**.

```
Profilo                                        h1
┌───────────┬───────────┬───────────┬──────────┐
│ ALLENAM.  │ VOLUME    │ SERIE     │ TEMPO    │  label --text-secondary
│ 214       │ 1 890 t   │ 3 200     │ 214 h    │  h2 Archivo 22/28 700 tnum
└───────────┴───────────┴───────────┴──────────┘
```
Card `--card`, `--radius-lg`, padding `--space-6`, quattro celle in griglia.
A 375px → **griglia 2×2**, gap `--space-5`. A ≥1280 → una riga di 4.

**Questi numeri si calcolano su tutte le sessioni completate, non sulla lista troncata.**
È la chiusura di QA GRAVE 3: la lista sotto può fermarsi a 200 voci, i totali no. Due schermate
della stessa app non possono dare due numeri diversi sullo stesso dato.
Il tempo totale si formatta con la scala che rolla (`214 h`, `8 g 8 h`), mai `12000 min`
(QA MINORE 3).

**`StatsTabs`** — sotto l'intestazione, tre pannelli che sono **tre rotte reali**:

| Tab | Rotta | Contenuto |
|---|---|---|
| Riepilogo | `/profilo` | calendario (sotto 1280) + feed personale |
| Statistiche | `/statistiche` | la schermata v1, invariata |
| Misure | `/misure` | la schermata v1, invariata |

`role="tablist"` **non si usa** qui: sono link di navigazione, non pannelli locali. Si usa un
`<nav aria-label="Sezioni del profilo">` con `<a>` reali e `aria-current="page"`, così Cmd+click
funziona e il tasto Indietro fa quello che deve (§11.5). Segmented control: altezza 48px,
fondo `--card-elevated`, `--radius-full`, indicatore attivo `--primary` con etichetta
`--primary-foreground` (4.98:1), inattive `--text-secondary`.

**Dentro `/profilo` → Statistiche** resta invece il gruppo a tab **locale** del riferimento
(`Durata` / `Ripetizioni` / `Volume`) sopra il grafico: quello sì è un `role="tablist"` con
`aria-controls`, perché cambia il contenuto di un pannello senza cambiare pagina. Lo stato
della tab va in query string (`?metrica=durata`), non in `useState` (§11.5).

| Stato | Specifica |
|---|---|
| default / hover / focus / active | §4.14 |
| loading | skeleton: 4 celle da 56px nell'intestazione, un rettangolo 280px per il grafico |
| **empty — zero allenamenti** | l'intestazione mostra i quattro zeri **con** la frase «Nessun allenamento registrato.» e la CTA `Inizia ad allenarti`. Mai quattro zeri muti. |
| error | «Non riesco a calcolare i totali.» + `Riprova`; il feed sotto resta visibile |

---

### 4.23 `TrainerQuestionnaire` — il questionario iniziale

Rotta a schermo intero `/trainer/questionario` (fuori dal guscio, come `/sessione`: qui si
risponde, non si naviga). **Sei passi, una domanda per schermata** — `progressive-disclosure`:
cinque domande in una pagina sola sembrano un modulo fiscale e si abbandonano.

| # | Domanda | Controllo | Vincoli |
|---|---|---|---|
| 1 | Qual è il tuo obiettivo? | radio card (4) | Forza · Ipertrofia · Ricomposizione · Mantenimento. **Una scelta, obbligatoria.** |
| 2 | Quali muscoli vuoi privilegiare? | checkbox card (7) | **massimo 2**, contatore visibile «1 di 2». Zero è ammesso («Nessuna preferenza») |
| 3 | Che attrezzatura hai? | checkbox (14 attrezzi) + 4 preset | Preset: `Palestra completa` · `Home gym con bilanciere` · `Solo manubri` · `Corpo libero`. **Almeno uno**, obbligatorio |
| 4 | Da quanto ti alleni? | radio card (3) | Principiante <1 anno · Intermedio 1-3 · Avanzato 3+. Ogni card **dice cosa cambia** («Principiante: progressione a ogni sessione, meno esercizi, più tecnica»), non solo l'etichetta |
| 5 | Quanti giorni a settimana? Quanto dura una seduta? | stepper 2–6 + segmented 45/60/75/90 min | il numero di giorni determina lo split; lo si mostra subito: «4 giorni → Upper/Lower ×2» |
| 6 | **Ecco cosa ho capito** | riepilogo | tutte le risposte, ognuna con `Modifica` in linea che torna al passo. Primario `Genera il programma` |

**Radio card**: 72px di altezza minima, fondo `--card`, bordo 1px `--border-strong` (3.45:1),
`--radius-md`, titolo `body-strong`, descrizione `sm` `--text-secondary`. Selezionata: bordo
2px `--accent-blue` + fondo `--set-done-surface` + **icona `Check` 20px `--accent-blue` a
destra** + `aria-checked`. Tre canali, mai il solo bordo colorato.
Il `<label>` avvolge il controllo: nessuna zona morta (§11.8).

**Barra di avanzamento**: sticky in alto, `Passo 3 di 6` in `label` `--text-secondary` +
barra 4px, traccia `--border`, riempimento `--primary`, `transform: scaleX()` `--dur-2`.
`role="progressbar"` con `aria-valuemin/max/now` e `aria-valuetext="Passo 3 di 6"`.

**Transizione fra passi**: `translateX(±12px)` + `opacity`, `--dur-2` `--ease-out`, direzione
coerente col verso (avanti = entra da destra). Reduced motion → solo `opacity` 150ms.

| Stato | Specifica |
|---|---|
| default | il passo corrente; `Indietro` sempre presente (ghost, a sinistra), `Avanti` primario a destra, 48px |
| **bozza salvata** | ogni risposta si scrive in Dexie **al momento della risposta**, non alla fine (`form-autosave`). Chiudere l'app e riaprirla riprende dal passo raggiunto |
| **ripresa** | entrando in `/trainer` con una bozza aperta: card «Questionario in sospeso — passo 3 di 6» + `Riprendi` + ghost `Ricomincia` |
| **error — nessuna scelta** | il primario **resta abilitato** (§11.8): si preme, compare il messaggio sotto la domanda, con icona `AlertCircle` 16px + «Scegli un obiettivo per continuare.», `aria-invalid` + `aria-describedby`, e il focus va lì |
| **error — nessun attrezzo** | «Senza attrezzi posso generare solo esercizi a corpo libero.» + azione `Va bene, corpo libero` che seleziona il preset e prosegue. L'errore offre sempre una via d'uscita (§5.3) |
| **loading — generazione** | la generazione è locale e dura meno di 300ms → **nessun indicatore** (§4.14). Se supera 1s (programma a 6 giorni × 12 settimane), skeleton della dashboard, non uno spinner |
| **error — generazione** | «Non riesco a generare un programma con queste risposte.» + il motivo esatto («4 giorni a settimana con il solo corpo libero non bastano a coprire tutti i gruppi») + `Cambia le risposte` |
| empty | non applicabile: un questionario non è mai vuoto |
| reduced motion | nessuna traslazione fra i passi; la barra avanza senza transizione |

---

### 4.24 `TrainerDashboard` — il programma attivo

`/trainer` è un dispatcher: mostra l'empty, la bozza in sospeso, il programma attivo, quello
in pausa o quello finito. Non è mai una pagina che «non sa cosa dire».

**Colonna centrale, in ordine:**

1. **Intestazione del programma** — `h1` col nome generato (`Ipertrofia · 4 giorni · 8 settimane`),
   sotto `Settimana 3 di 8` in `label` + barra 4px `--primary` (`scaleX`), menu ⋮ a destra
   (44×44): `Sostituisci un esercizio` · `Cambia giorni a settimana` · `Come funziona la
   progressione` · `Metti in pausa` · ——— · `Termina il programma`.

2. **Card «Oggi»** — la card più importante della schermata, `--radius-lg`, `--elev-1`,
   bordo 1px `--border`, padding `--space-6`, **corsia 3px `--blue-brand`** a sinistra.
   ```
   ▮ OGGI · Giovedì 24 settembre
     Giorno B · Spinta                           h2
     5 esercizi · ~60 min · 18 serie             sm --text-secondary
     ──────────────────────────────────────────
     Panca piana (Bilanciere)      3 × 6-8   82,5 kg
       ↗ +2,5 kg — 3 serie su 3 a RPE 7        ← la riga del perché (§4.25)
     Lento avanti (Manubri)        3 × 8-10   24 kg
       → Stesso carico — settimana scorsa 2 su 3
     … altri 3 esercizi
     ──────────────────────────────────────────
     [       Avvia l'allenamento       ]  56px, primario
   ```

3. **Le settimane** — lista di `<details>`/accordion, una riga per settimana, 56px:
   `Settimana 3 · in corso · 2 di 4 fatti`, con la corsia a sinistra
   (`--success` completata · `--blue-brand` in corso · `--warning` saltata · assente futura)
   **più** l'etichetta testuale dello stato. Espansa: i giorni, righe 48px con il proprio stato
   e un link al dettaglio `/trainer/giorno/[id]`. Solo la settimana corrente è espansa di
   default; la prima apertura dopo la generazione espande la settimana 1.

**Colonna destra** (≥1280): riepilogo del programma (aderenza `%`, serie fatte/previste,
prossimi 3 allenamenti con data) + azioni rapide. Sotto 1280 scende in coda alla dashboard.

#### Stati del Trainer — la tabella che il frontend implementa letteralmente

| Stato | Che cosa si vede |
|---|---|
| **nessun programma** | `EmptyState` (§4.15): icona `ClipboardList` 40px · «Nessun programma» · «Rispondi a sei domande e ti preparo un programma di più settimane che si aggiorna da solo, in base a come vanno i tuoi allenamenti.» · primario `Inizia il questionario` + ghost `Come funziona la progressione` |
| **bozza di questionario in sospeso** | card «Questionario in sospeso — passo 3 di 6» sopra l'empty · `Riprendi` + ghost `Ricomincia` |
| **attivo, oggi c'è allenamento** | la card «Oggi» descritta sopra |
| **attivo, oggi è riposo** | card «Oggi è riposo» con icona `Moon` 24px `--text-secondary`, «Il prossimo allenamento è **giovedì**: Giorno B · Spinta» + ghost `Allenati lo stesso` (che anticipa il prossimo giorno e lo registra come anticipo, non come extra) |
| **attivo, allenamento di oggi già fatto** | card «Fatto oggi ✓» con durata, volume, PR, e link al riepilogo. Il primario sparisce: non si propone di rifare quello che è appena stato fatto |
| **settimana saltata** | banner `role="status"` in cima alla colonna centrale, fondo `--pr-surface`, bordo 1px `--pr-border`, icona `CalendarX` 20px `--pr`, testo «Hai saltato la **settimana 3**: 0 allenamenti su 4.» e **tre azioni esplicite, nessuna preselezionata**: `Ripeti la settimana 3` (stessi carichi, nessun aumento) · `Vai alla settimana 4` (prosegue come previsto) · ghost `Rigenera da qui`. **Il programma resta fermo finché l'utente non sceglie**, e la frase lo dice: «Non tocco niente finché non decidi.» |
| **due settimane saltate di fila** | allo stesso banner si aggiunge una quarta azione: `Riduci a 3 giorni a settimana` + la riga «Quattro giorni non stanno entrando nella tua settimana. Posso adattare il programma invece di insistere.» Adattare, non colpevolizzare |
| **in pausa** | banner neutro (corsia `--border-strong`, icona `Pause`) «Programma in pausa dal 12 settembre» + `Riprendi`. Il programma non progredisce e non conta le settimane saltate |
| **finito** | schermata di chiusura: `h1` «Programma completato» + i numeri veri del ciclo (allenamenti fatti su previsti, volume totale, PR conquistati, progressione dei 3 esercizi principali con il delta in kg) + primario `Genera il ciclo successivo` (che riapre il questionario **precompilato** con le risposte di prima) + ghost `Torna alle routine`. Il programma finito resta consultabile in sola lettura |
| **loading** | skeleton: card «Oggi» da 220px + 4 righe settimana da 56px. Solo al primo mount |
| **error** | «Non riesco a leggere il programma.» + `Riprova` + ghost `Esporta un backup` (se il dato è corrotto, prima si salva il resto) |

**Avvio dell'allenamento dal Trainer**: identico al percorso A di §6.2 — un tocco su `Avvia`
crea la sessione con esercizi, serie, intervallo di ripetizioni e **carico consigliato già nei
campi** (come valore, non come placeholder: il Trainer *propone*, quindi scrive). La sessione
porta `trainerDayId`, così alla chiusura il giorno si marca da sé e la progressione può girare.

---

### 4.25 `ProgressionReason` — il perché di ogni cambiamento

**È il punto della funzione.** Un programma che cambia i carichi senza spiegarsi è un oracolo,
e un oracolo lo si smette di seguire alla prima proposta che sembra sbagliata.

#### La riga del perché

Sotto il carico consigliato di **ogni** esercizio, sempre, mai in un tooltip (un'affordance
solo-hover è vietata, §4.14):

| Direzione | Icona 16px | Colore | Testo di esempio |
|---|---|---|---|
| aumento | `TrendingUp` | `--success` (9.27:1) | «+2,5 kg — 3 serie su 3 a RPE 7» |
| mantenimento | `Minus` | `--text-muted` (5.44:1) | «Stesso carico — settimana scorsa 2 serie su 3» |
| riduzione | `TrendingDown` | `--warning` (9.71:1) | «−5% — due sedute sotto le ripetizioni obiettivo» |
| scarico programmato | `RotateCcw` | `--accent-blue` (5.93:1) | «Scarico — settimana 4 di scarico prevista» |
| primo incontro | `Sparkle` | `--text-secondary` (8.31:1) | «Prima volta — parti leggero e tara il carico» |
| deciso da te | `UserCog` | `--accent-blue` | «Carico scelto da te il 18 settembre» |

Testo in `sm`, icona + colore + **frase**: tre canali, e la frase da sola basta (§8.2).
Tutta la riga è un `<button>` (`aria-label="Perché 82,5 kg su Panca piana"`) che apre il
foglio «Perché questo carico».

#### Il foglio «Perché questo carico»

Bottom sheet sotto 768, dialog 480px sopra (§4.16). Quattro blocchi, in quest'ordine:

1. **La regola, con il suo nome** — `h3`: «Doppia progressione». Una riga di spiegazione:
   «Quando completi tutte le serie in cima all'intervallo di ripetizioni, salgo di carico.»
2. **I dati che l'hanno attivata**, con i numeri veri e la data — una tabellina:
   `17 set · 3 serie su 3 · 8, 8, 8 ripetizioni · RPE 7, 7, 8`.
   Ogni sessione citata è un link al suo riepilogo: si può andare a verificare.
3. **Il conto** — `da 80 kg → 82,5 kg` (`+2,5 kg`, incremento minimo per il bilanciere),
   in `num-md` `tnum`.
4. **Che cosa serve per il prossimo passo** — **obbligatorio, su ogni esercizio**:
   «Completa 3 × 8 a RPE ≤ 8 e la prossima volta salgo a 85 kg.»
   È la frase che trasforma il registro in uno strumento: l'utente deve sapere *cosa fare*,
   non solo *cosa è successo*.

In fondo al foglio: ghost `Non sono d'accordo` → apre l'override manuale (un `NumberField`
§4.18 con il carico e una riga di motivo facoltativa). **L'override finisce nel registro come
ogni altra decisione**, con `rule: "manual"`, e da lì in poi la progressione riparte da quel
valore. Il Trainer non «si offende» e non riscrive la scelta alla sessione successiva.

#### Il registro delle decisioni — `/trainer/progressione`

Cronologia inversa di **tutte** le decisioni, raggruppate per settimana, righe 72px:

```
▮  22 set · Panca piana (Bilanciere)
   80 → 82,5 kg   ↗  Doppia progressione: 3 serie su 3 a RPE 7
```
Corsia a sinistra col colore della direzione + icona + testo (tre canali, di nuovo).
Filtri in cima: `Tutte` · `Aumenti` · `Riduzioni` · `Scarichi` · `Tue scelte`, come chip
(§4.8), con lo stato in query string.

| Stato | Specifica |
|---|---|
| default | fino a 50 voci, poi `Carica altre 50` |
| hover / focus / active | §4.14; il tocco apre lo stesso foglio «Perché questo carico» |
| **loading** | 6 skeleton da 72px |
| **empty — nessuna decisione** | «Ancora nessuna decisione» · «Il registro si riempie dopo il tuo primo allenamento del programma: ogni cambio di carico finisce qui, con il motivo.» · CTA `Vai al programma` |
| **empty — filtro senza risultati** | «Nessuna riduzione di carico finora.» + `Azzera filtri`. Detto così, è una buona notizia |
| **error** | «Non riesco a leggere il registro.» + `Riprova` |

#### Le regole di progressione — nominate, non implicite

Servono al frontend per generare la frase giusta, e all'utente per fidarsi. Sono **dati**, non
`if` sparsi: vivono in una tabella versionata (`ruleSetVersion`, §9.5).

| `rule` | Nome mostrato | Quando scatta | Effetto |
|---|---|---|---|
| `double-progression` | Doppia progressione | tutte le serie al tetto dell'intervallo **e** RPE medio ≤ `rpeTarget` | +1 incremento di carico; le ripetizioni tornano al fondo dell'intervallo |
| `reps-first` | Prima le ripetizioni | serie completate ma sotto il tetto | +1 ripetizione sulla prima serie non al tetto, carico invariato |
| `rpe-cap` | Freno da RPE | una serie a RPE ≥ 9,5 | l'aumento previsto si **dimezza** (e lo si dice) |
| `hold-on-miss` | Mantenimento | una seduta sotto il fondo dell'intervallo | carico invariato, nessun aumento |
| `deload-on-miss` | Riduzione | **due** sedute consecutive sotto il fondo | −10% di carico, arrotondato all'incremento |
| `planned-deload` | Scarico programmato | settimana di scarico (ogni 4ª, configurabile) | volume −40%, carico −10% |
| `skip-hold` | Settimana saltata | nessun allenamento registrato nella settimana | nessuna progressione; la settimana si ripete se l'utente lo sceglie |
| `first-time` | Prima volta | nessuno storico per quell'esercizio | nessun carico proposto: il campo resta vuoto con il suggerimento «parti leggero» |
| `manual` | Tua scelta | override dell'utente | il carico indicato diventa la nuova base |

**Incrementi minimi** — token, non costanti nel codice (finiscono in `Settings`, §9.5):
`bilanciere superiore 2,5 kg` · `bilanciere inferiore 5 kg` · `manubri 2 kg per manubrio` ·
`macchina e cavi 1 tacca (default 5 kg)` · `corpo libero +1 ripetizione, poi zavorra +2,5 kg`.
Nessun arrotondamento silenzioso: se l'incremento non è caricabile con i dischi posseduti, il
foglio lo dice e propone il valore raggiungibile — la stessa regola del calcolatore di dischi
(§6.4), che su questo punto il QA ha trovato corretta.

---

### 4.26 `ExerciseTwoPane` — la libreria a due pannelli (≥1280)

Sotto 1280 la libreria resta **esattamente quella di v1** (§4.8): lista a pagina piena,
dettaglio come rotta `/esercizi/[id]`. Da 1280 i due diventano visibili insieme.

**Disposizione**: come il riferimento — **dettaglio al centro, elenco + filtri nella colonna
destra** (`--pane-list-w`, 320px). È una scelta del riferimento, non mia, e la rispetto perché
la colonna destra del guscio è già il posto dei controlli in ogni altra schermata: metterci
anche l'elenco rende il guscio prevedibile invece di eccezionale.

#### Il pannello elenco (colonna destra)

```
Libreria                    + Personalizzato
┌────────────────────────────────────────┐
│ Tutti gli attrezzi                  ⌄ │  select 44px
│ Tutti i muscoli                     ⌄ │  select 44px
│ ⌕ Cerca esercizi…                     │  input 44px
└────────────────────────────────────────┘
287 esercizi                               sm --text-muted, aria-live polite
─── PETTO ──────────────────────  sticky   label 12/600/0.06em
 [P] Panca piana (Bilanciere)              48px (--row-list-desk)
     Petto · Bilanciere
 [P] Panca piana (Manubri)
 …
```

- **Due `<select>` nativi** per attrezzo e muscolo (non i chip di v1): a 320px di larghezza,
  quattordici chip d'attrezzo occuperebbero quattro righe di scroll orizzontale. I chip
  restano sotto 1280, dove la barra è larga quanto lo schermo. §11.2: il `<select>` nativo va
  forzato con `background-color: var(--input); color: var(--text-primary)`.
- **Contatore risultati** sempre visibile, `aria-live="polite"` con debounce 500ms.
- **Raggruppamento**, con intestazioni sticky:
  - nessun filtro muscolo attivo → per **gruppo muscolare** (Petto, Dorso, Spalle, …);
  - filtro muscolo attivo → per **famiglia di movimento** (Panca piana, Lat pulldown, …),
    che è un campo dello schema (`family`, §9.4), non una deduzione dal nome.
  L'intestazione sticky vive **fuori** dal viewport virtualizzato: non è una riga della lista
  e non entra nel calcolo delle posizioni.
- **Densità**: righe `--row-list-desk` (48px), separatore 1px `--border`, **nessun gap**.
  Le 48px (contro le 56 del telefono) sono deliberate: qui si punta col mouse e si scorre con
  la rotella, e 48 fa stare 13 voci in un pannello alto 640px invece di 11. Resta ≥ `--tap-min`.
- **Scroll**: `overflow-y: auto`, `overscroll-behavior: contain`, `scrollbar-gutter: stable`
  (senza, la comparsa della barra fa saltare la larghezza delle righe a ogni filtro).

#### Prestazioni percepite su 250-300 voci

| Problema | Regola |
|---|---|
| montaggio di 300 righe | **virtualizzazione obbligatoria** (`@tanstack/react-virtual`); `estimateSize` **costante** = `--row-list-desk`, nessuna misura a runtime |
| filtro che «lagga» | filtro locale in <16ms su 300 voci → **nessuno skeleton al cambio filtro** (§4.14: sotto 1s nessun indicatore). Lo skeleton esiste solo al primo mount |
| campo di ricerca che scatta | input **non controllato** con eco immediato sul campo; il filtro parte con `debounce 120ms`. Il campo non aspetta mai il filtro |
| annuncio a raffica | il contatore si annuncia con debounce 500ms, mai per tasto |
| salto dello scroll al ritorno | la posizione dell'elenco si conserva quando cambia solo il dettaglio: il pannello **non si rimonta** |
| lista lunga senza virtualizzazione (fallback) | `content-visibility: auto` + `contain-intrinsic-size: var(--row-list-desk)` |
| navigazione da tastiera nella lista virtuale | il contenitore espone `aria-rowcount`; le righe fuori dal viewport **non** sono nel tab order, e la selezione corrente è sempre montata |

#### Il pannello dettaglio (centro)

Il contenuto di `/esercizi/[id]` di v1, invariato: nome, muscolo, attrezzo, storico, 1RM
stimato **con la regola dei domini di §4.10-bis**, PR, note, azioni.

#### Ordine di lettura e tastiera — il punto delicato

L'elenco è a destra ma **si usa prima** del dettaglio. §7.3 impone che l'ordine del DOM
coincida con quello visivo, quindi il DOM è `main` (dettaglio) poi `aside` (elenco), e la
navigazione da tastiera sarebbe costretta ad attraversare tutto il dettaglio per arrivare ai
filtri. Si risolve con due link reali, non con un `tabindex` acrobatico:

- **in cima alla colonna centrale**, primo elemento focalizzabile: `<a href="#elenco-esercizi">`
  **«Vai all'elenco esercizi»**, visibile solo in focus, stesso stile dello skip link (§8.4);
- **in fondo al pannello dettaglio**: `<a href="#elenco-esercizi">` **«Torna all'elenco»**,
  sempre visibile, in `ghost`.

Alla selezione di un esercizio: il focus va sull'`<h1>` del dettaglio (`tabIndex={-1}`) e
`#sr-system` annuncia «Panca piana con bilanciere, dettaglio aperto». La voce selezionata
nell'elenco porta `aria-current="true"`, fondo `--surface-hover` e **corsia 3px
`--blue-brand`** (non solo il fondo: su `--card` la differenza di fondo è 1.36:1).

| Stato | Specifica |
|---|---|
| default | elenco pieno, dettaglio dell'ultimo esercizio aperto (da query string) |
| **empty — nessuna selezione** | il centro mostra: icona `Dumbbell` 40px · «Scegli un esercizio» · «Seleziona una voce dall'elenco per vedere storico, 1RM stimato e record.» — è lo stato del riferimento, e va implementato, non lasciato bianco |
| **empty — filtri senza risultati** | nel pannello elenco: «Nessun esercizio per *Dorso + Cavi*.» + `Azzera filtri` + `Crea esercizio personalizzato` |
| **empty — libreria vuota** | §4.15 |
| loading | elenco: 8 skeleton da 48px · centro: skeleton del dettaglio |
| error | i due pannelli falliscono **indipendentemente**: un dettaglio illeggibile non svuota l'elenco |
| transizione di selezione | **crossfade** del solo pannello centrale, `opacity` `--dur-1`. Nessuna traslazione: il contenitore non si sposta. Reduced motion → cambio immediato |

---

### 4.27 `MonthCalendar` — il calendario mensile del profilo

Componente nuovo. Mostra i giorni in cui c'è stato un allenamento.

```
        ‹        settembre 2026        ›          h3 + due bottoni 44×44
   L    M    M    G    V    S    D                label --text-secondary
  31    1    2    3    4    5    6                fuori mese: --text-disabled
   7   (8)   9   10   11  (12)  13                (n) = giorno allenato
  14   15  (16) (17)  18  (19)  20
  21    22   23   24   25   26   27                21 = oggi (numerale sottolineato)
  28   29   30    1    2    3    4
```

Griglia `role="grid"`, 7 colonne, `gap: var(--cal-gap)` (4px). Cella: area **44×44**
(`--tap-min`) con cerchio visivo `--cal-cell` (40px). A 375px la larghezza disponibile è
343px → `(343 − 6×4) / 7 = 45,5px`: i 44 ci stanno senza scroll orizzontale.
Numerale in `num-md` `tnum` (le cifre non devono ballare fra una settimana e l'altra).

#### Gli stati della cella — e il «mai solo colore»

Due canali **ortogonali**, così non si contendono mai lo stesso segnale:
**il riempimento dice «allenato», la sottolineatura dice «oggi».**

| Stato | Resa | Contrasto | Secondo canale |
|---|---|---|---|
| **giorno allenato** | cerchio pieno `--primary` `#1268EC`, numerale `#FFFFFF` peso 700 | **4.98:1** | **barra 3px `--blue-brand` sotto il cerchio**, larga quanto il cerchio, `--radius-xs` — la corsia del sistema, girata di 90° |
| **giorno allenato, 2+ sessioni** | come sopra | — | la barra sotto diventa **due segmenti** da 3px con gap 3px + `aria-label` «2 allenamenti» |
| **giorno non allenato (passato)** | nessun riempimento, numerale `--text-primary` peso 400 | 16.12:1 su `--card` | — |
| **oggi** | numerale **sottolineato** (`text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 2px`) `--accent-blue` peso 700 | 5.93:1 | `sr-only` «oggi» dentro l'etichetta della cella |
| **oggi + allenato** | cerchio pieno **e** numerale sottolineato in bianco | 4.98:1 | barra sotto + «oggi» in etichetta |
| **giorno futuro** | numerale `--text-muted`, non interattivo (non è un `<button>`) | 5.44:1 | — |
| **fuori dal mese** | numerale `--text-disabled`, `aria-hidden="true"`, non focalizzabile — serve solo a chiudere la griglia | 2.92:1 (esente: non porta informazione) | — |
| **hover** su giorno allenato | cerchio `--primary-hover`, cursore a puntatore | bianco 5.81:1 | — |
| **focus-visible** | `outline: 2px solid var(--ring); outline-offset: 2px` sulla cella | 6.59:1 su `--card` | — |
| **active** | `scale(0.94)` sul cerchio, `--dur-1` | — | — |
| **loading** | griglia di 42 quadrati skeleton 40×40 con l'intestazione dei giorni già disegnata (nessun CLS) | — | — |
| **empty — mese senza allenamenti** | la griglia resta (serve comunque a orientarsi) + sotto, in `sm` `--text-secondary`: «Nessun allenamento a settembre.» + link `Vai a agosto (8 allenamenti)`, cioè **al mese più recente che ne ha** | — | — |
| **empty — nessun allenamento mai** | il calendario **non si monta**: al suo posto l'`EmptyState` «Nessun allenamento registrato» (§4.15) | — | — |
| **error** | «Non riesco a leggere il calendario.» + `Riprova`; il resto del profilo resta | — | — |

**Prova del grigio**: togliendo tutti i colori, un giorno allenato resta riconoscibile dal
riempimento scuro, dalla barra sotto e dal peso 700; oggi resta riconoscibile dalla
sottolineatura. Nessuno dei due dipende dalla tinta.

#### Tastiera e semantica (pattern griglia APG)

- `role="grid"` con `aria-labelledby` sul titolo del mese; `<th scope="col">` per i giorni
  della settimana, con il nome **completo** in `sr-only` («lunedì») accanto alla lettera.
- **Roving tabindex**: una sola cella nel tab order (oggi se è nel mese in vista, altrimenti
  il primo giorno allenato, altrimenti il giorno 1). Le altre `tabindex="-1"`.
- `←` `→` giorno · `↑` `↓` settimana · `Home` / `End` inizio/fine settimana ·
  `PagSu` / `PagGiù` mese precedente/successivo. Uscire dal mese con le frecce lo cambia.
- Etichetta di cella completa: `"12 settembre 2026, 1 allenamento: Schiena+Dorso"` oppure
  `"13 settembre 2026, nessun allenamento"`.
- `Invio` su un giorno allenato → `/profilo/sessione/[id]`; con 2+ sessioni → popover con
  l'elenco (righe 48px), non una scelta arbitraria.
- Pulsanti di mese 44×44, `aria-label="Mese precedente, agosto 2026"`. Al cambio, `#sr-system`
  annuncia «settembre 2026, 8 allenamenti» — **una volta sola**, non a ogni cella attraversata.
- Il mese in vista sta nella **query string** (`/profilo?mese=2026-09`), non in `useState`
  (§11.5): il tasto Indietro torna al mese precedente e il link è condivisibile.

**Movimento**: cambio mese `translateX(±8px)` + `opacity`, `--dur-2` `--ease-out`, direzione
coerente col verso. Reduced motion → solo `opacity` 150ms, nessuna traslazione.

---

### 4.28 `SettingsTwoPane` — impostazioni a indice + pannello

Oggi è una pagina sola con due figlie. In v2 diventa **indice a sinistra, pannello a destra**,
tutto **dentro la colonna centrale** (la colonna destra del guscio resta vuota su questa rotta:
un indice è già una colonna di supporto, due sarebbero una di troppo).

Griglia `grid-template-columns: var(--settings-index-w) minmax(0, 1fr)`, gap `--space-8`,
separatore verticale 1px `--border` fra le due.

#### L'indice

Gruppi con intestazione `label` `--text-secondary`, voci da 44px, icona 20px, etichetta `body`.

| Gruppo | Voci | Rotta |
|---|---|---|
| **Allenamento** | Timer di recupero · RPE · Unità e arrotondamenti · Bilanciere e dischi · Riscaldamento | `/impostazioni/allenamento` |
| **App** | Tema · Lingua · Suono e vibrazione | `/impostazioni/app` |
| **Dati** | Backup ed esportazione · Importa · Cancella tutti i dati | `/impostazioni/dati` |
| **Info** | Versione, licenze, dove stanno i tuoi dati | `/impostazioni/info` |

**Tema e Lingua ci sono anche se non hanno alternative.** La voce Tema dice «Scuro — è l'unico
tema di Lifted», la voce Lingua dice «Italiano — l'unica lingua di Lifted». Una voce assente
fa cercare; una voce che spiega chiude la domanda. Nessun interruttore finto.

| Stato voce | Specifica |
|---|---|
| default | icona e testo `--text-secondary` |
| hover | fondo `--surface-hover`, testo `--text-primary` (13.02:1) |
| focus-visible | anello `--ring`, offset 2px |
| **attiva** | fondo `--surface-hover` + **corsia 2px `--blue-brand`** a sinistra + testo `--accent-blue` (4.79:1) peso 600 + `aria-current="page"` |
| badge | solo su **Dati**: punto `--warning` + `aria-label` «Dati, nessun backup da 18 giorni» |

#### Il pannello

`h1` della sezione **dentro `<main>`** (chiude QA MINORE 6: oggi l'intestazione sta fuori dal
landmark), righe di impostazione da 56px con label a sinistra e controllo a destra, gruppi
separati da `--space-7`, testo di aiuto in `sm` `--text-muted` **sotto** il controllo — non
come placeholder.

**Le impostazioni si salvano al cambio, non con un `Salva`.** Il controllo che si muove *è* la
conferma; un toast a ogni interruttore è rumore. `#sr-system` annuncia in `polite`
«Timer di recupero: 90 secondi». Il pulsante `Salva` esiste **solo** dove il form ha più campi
interdipendenti (inventario dischi, percentuali di riscaldamento) e lì vale §11.8: resta
abilitato, si valida alla pressione, il focus va sul riepilogo errori.

| Stato | Specifica |
|---|---|
| default | la sezione scelta |
| **nessuna sezione (solo `/impostazioni`)** | a ≥1024 si **reindirizza** alla prima sezione (`/impostazioni/allenamento`): un pannello vuoto accanto a un indice pieno è una schermata che non dice niente. A <1024 `/impostazioni` **è** l'indice, e il pannello è la rotta figlia (lo stesso master-detail che `/misure` usa già) |
| loading | skeleton di 6 righe da 56px nel pannello; l'indice è statico e non ne ha bisogno |
| error | banner in cima al pannello «Non riesco a leggere le impostazioni. Sto usando i valori di fabbrica.» + `Riprova` — e i controlli restano **usabili**, non bloccati |
| empty | non applicabile: una sezione di impostazioni ha sempre contenuto |
| azione distruttiva | `Cancella tutti i dati` resta con il dialog di §5.2, in fondo alla sezione Dati, in `destructive`, separata dalle altre da `--space-8` e da un separatore |

---

## 5. Microcopy di sistema (italiano)

### 5.1 L'avviso che i dati sono solo qui

Compare in **tre punti**, mai di più:
1. **Al primo avvio**, sheet non ignorabile con un solo bottone:
   > **I tuoi dati restano su questo telefono**
   > Lifted non usa server. Tutto — routine, allenamenti, misure — vive solo nel browser di
   > questo dispositivo. Se cancelli i dati del sito o cambi telefono, senza un backup
   > perdi tutto.
   > `Ho capito`  ·  ghost `Come faccio un backup?`
2. **In Impostazioni → Backup**, banner permanente `--warning` con icona `HardDrive`:
   > Ultimo backup: **mai**. I dati sono solo su questo dispositivo.
3. **Dopo la 5ª sessione registrata senza mai aver esportato**, un toast annullabile:
   > Hai 5 allenamenti salvati e nessun backup. `Esporta ora`

### 5.2 Conferme distruttive

Il dialog di conferma si usa **solo** quando l'azione non è annullabile con un toast.

| Azione | Titolo | Corpo | Pulsanti |
|---|---|---|---|
| Elimina serie | — | — | nessun dialog: toast `Serie eliminata` + `Annulla` (6s) |
| Rimuovi esercizio da sessione | — | — | toast `Esercizio rimosso` + `Annulla` (6s) |
| Elimina routine | "Eliminare «Push A»?" | "La routine sparisce. Gli allenamenti già registrati restano." | `Annulla` · `Elimina` (destructive) |
| Elimina sessione dallo storico | "Eliminare questo allenamento?" | "Volume, serie e PR calcolati da questa sessione verranno ricalcolati." | `Annulla` · `Elimina` |
| Scarta sessione attiva | "Scartare l'allenamento?" | "Hai completato 7 serie. Non si può recuperare." | `Continua ad allenarti` · `Scarta` |
| Elimina esercizio personalizzato | "Eliminare «Rematore Kroc»?" | "Lo storico che lo contiene resta, ma non potrai più aggiungerlo." | `Annulla` · `Elimina` |
| Importa backup | "Sostituire tutti i dati?" | "L'importazione cancella quello che c'è ora e mette al suo posto il contenuto del file. Esporta prima, se non l'hai fatto." | `Annulla` · ghost `Esporta prima` · `Sostituisci` |
| Cancella tutti i dati | "Cancellare tutto?" | "Routine, allenamenti, misure ed esercizi personalizzati. Non c'è modo di tornare indietro." | `Annulla` · `Cancella tutto` |

Il pulsante distruttivo **dice cosa fa** (`Elimina`, `Scarta`, `Sostituisci`), mai `OK`.
Il pulsante sicuro è a sinistra ed è quello che riceve il focus all'apertura.

### 5.3 Errori

| Situazione | Messaggio |
|---|---|
| Dexie non disponibile (navigazione privata / quota) | "Non riesco a salvare su questo dispositivo. Il browser potrebbe essere in navigazione privata o senza spazio." + `Riprova` |
| Spazio esaurito durante il salvataggio | "Spazio esaurito. Esporta un backup e libera spazio." + `Esporta` |
| File di import non valido | "Questo file non è un backup di Lifted." |
| File di import di una versione futura | "Questo backup viene da una versione più recente di Lifted. Aggiorna l'app prima di importarlo." |
| Import parzialmente riuscito | "Importati 412 allenamenti su 415. 3 voci erano danneggiate e sono state saltate." + `Vedi dettagli` |
| Peso fuori scala | "Inserisci un peso tra 0 e 1000 kg." |
| Reps fuori scala | "Inserisci un numero di ripetizioni tra 1 e 999." |
| RPE fuori scala | "L'RPE va da 1 a 10." |
| Data futura in una misura | "Non puoi registrare una misura nel futuro." |
| Nome routine vuoto | "Dai un nome alla routine." |
| Nome esercizio già esistente | "Esiste già un esercizio con questo nome." |
| Sessione senza serie completate al "Termina" | "Non hai completato nessuna serie. Vuoi comunque salvare questo allenamento?" + `Scarta` · `Salva` |

### 5.4 Conferme positive

- `Allenamento salvato · 48 min · 4 280 kg`
- `Backup esportato` + `Apri cartella` (dove il browser lo consente)
- `Importati 412 allenamenti e 96 misurazioni`
- `Routine «Push A» creata`
- `Nuovo record: Panca piana, 1RM stimato 112 kg` (toast `--pr`, 6s)

### 5.5 Etichette e unità

- Peso sempre in **kg** (la spec non chiede lb; l'impostazione esiste ma il default è kg).
- Separatore decimale **virgola** in visualizzazione (`82,5 kg`), punto accettato in input.
- Migliaia con spazio fine: `4 280 kg`. Mai il punto (si confonde col decimale).
- Durata: `48 min` in sintesi, `0:48:12` nel cronometro, `1:28` nel timer di recupero.
- Date relative fino a 7 giorni (`3 giorni fa`), poi assolute (`14 mar`).

---

## 6. Flussi e navigazione

### 6.1 Mappa delle rotte — **aggiornata in v2**

```
/                                   → redirect a /home          ← era /allenamento

TAB 1 ─ /home                       ★ NUOVA — avvio in cima + card di oggi + feed

TAB 2 ─ /allenamento                quick start + elenco routine per split
        /allenamento/routine/nuova          editor routine (creazione)
        /allenamento/routine/[id]           dettaglio routine (sola lettura + Avvia)
        /allenamento/routine/[id]/modifica  editor routine (modifica)

TAB 3 ─ /trainer                    ★ NUOVA — dashboard, o empty, o programma finito
        /trainer/questionario               ★ 6 passi, a schermo intero (fuori dal guscio)
        /trainer/giorno/[id]                ★ dettaglio del giorno + Avvia
        /trainer/progressione               ★ registro delle decisioni

TAB 4 ─ /esercizi                   libreria: 2 pannelli a ≥1280, lista sotto
        /esercizi/nuovo                     crea esercizio personalizzato
        /esercizi/[id]                      dettaglio (pannello centrale a ≥1280)
        /esercizi/[id]/modifica             modifica esercizio personalizzato

TAB 5 ─ /profilo                    intestazione a numeri + statistiche + calendario + feed
        /profilo/sessione/[id]              dettaglio sessione passata (+ PR ottenuti)
        /statistiche                        ⇢ pannello «Statistiche» del profilo (rotta invariata)
        /misure                             ⇢ pannello «Misure» del profilo (rotta invariata)
        /misure/[metrica]                   grafico + elenco voci + aggiungi

FUORI DALLE TAB E FUORI DAL GUSCIO
        /sessione                   sessione attiva, a schermo intero
        /sessione/riepilogo/[id]    riepilogo post-workout con i PR
        /impostazioni               ≥1024 → redirect a /impostazioni/allenamento
                                    <1024 → l'indice
        /impostazioni/allenamento   ★ timer, RPE, unità, bilanciere e dischi, riscaldamento
        /impostazioni/app           ★ tema, lingua, suono e vibrazione
        /impostazioni/dati          ★ export JSON/CSV, import, cancella tutto  (era /backup)
        /impostazioni/info          versione, dove stanno i dati, licenze
```

**Rotte che spariscono**: nessuna. `/impostazioni/backup` si rinomina in `/impostazioni/dati`
e mantiene un redirect permanente — i link nella microcopy di §5.1 puntano lì.

**Stato di vista nella query string** (§11.5), voci nuove:
`/profilo?mese=2026-09` · `/esercizi?q=…&attrezzo=…&muscolo=…&sel=<id>` ·
`/profilo?metrica=durata` · `/trainer/progressione?filtro=aumenti`

**Strumenti come parametro di ricerca** (deep-link + il tasto Indietro li chiude):
- `?tool=warmup&target=100&exerciseId=…` → sheet calcolatore riscaldamento
- `?tool=plates&target=100` → sheet calcolatore dischi
- `?picker=exercise` → sheet selezione esercizio

**Comportamento del tasto Indietro** (vincolante):
- ogni tab mantiene il proprio stack e la propria posizione di scroll;
- Indietro da uno sheet lo chiude, non cambia pagina;
- Indietro da `/sessione` **minimizza** la sessione (non la scarta) e riporta alla tab da
  cui si è partiti;
- `/sessione` è esclusa dalla history come pagina "riavviabile": ricaricando l'app con una
  sessione attiva si entra su `/allenamento` con la `SessionBar` visibile, non direttamente
  in sessione (evita di finire in sessione per sbaglio all'apertura).

### 6.2 Flusso: sessione attiva — **il flusso che conta**

**Percorso A — avvio da routine: 2 tocchi dall'apertura al primo campo.**

| # | Schermo | Azione | Note |
|---|---|---|---|
| 1 | `/allenamento` | tocco su `AVVIA` nella `RoutineCard` | la routine è già in vista, nessuna navigazione intermedia |
| 2 | `/sessione` | — | gli esercizi sono già caricati con le serie del template, i campi kg/reps portano **come placeholder l'ultima sessione** di quell'esercizio |
| 3 | `/sessione` | tocco sul campo KG della serie 1 | il campo è già selezionato per intero |

**Percorso B — sessione vuota: 4 tocchi al primo campo.**

| # | Schermo | Azione |
|---|---|---|
| 1 | `/allenamento` | `Avvia sessione vuota` |
| 2 | `/sessione` (vuota) | `+ Aggiungi esercizio` → sheet `?picker=exercise` |
| 3 | sheet | ricerca / filtro → tocco sull'esercizio (selezione multipla consentita) |
| 4 | sheet | `Aggiungi 3 esercizi` |
| 5 | `/sessione` | tocco sul campo KG |

**Il ciclo della serie — 3 tocchi per serie, mai di più:**

| # | Azione | Cosa succede |
|---|---|---|
| 1 | tocco KG → digita | campo selezionato, tastierino decimale |
| 2 | `Invio` (o tocco REPS) → digita | passa a REPS senza chiudere il tastierino |
| 3 | tocco `✓` | riga completata: corsia blu, fondo `--set-done-surface`, check pieno, `scale` 150ms. **Il timer di recupero parte da solo**, la pill appare in 200ms. Il volume nell'header si aggiorna. Se il valore batte un record, il `PRBadge` compare sulla riga + toast + annuncio. |

Il tastierino **non si chiude** tra un campo e l'altro della stessa riga. Dopo il check, il
focus va al campo KG della **serie successiva** se esiste, altrimenti al pulsante
`+ Aggiungi serie`.

**Sostituisci / riordina**
- Sostituisci: `⋮` sulla card esercizio → `Sostituisci esercizio` → sheet picker → le serie
  già completate restano registrate sotto il vecchio esercizio, le serie non completate
  migrano al nuovo. **Lo si dice**: "3 serie completate restano su Panca piana."
- Riordina: `⋮` → `Riordina` → maniglie su tutte le card + frecce ↑↓ da tastiera.

**Termina — 2 tocchi:**

| # | Azione | Schermo |
|---|---|---|
| 1 | `TERMINA` nell'header | dialog "Terminare l'allenamento? · 18 serie completate su 20. Le serie vuote non verranno salvate." → `Continua` · `Termina` |
| 2 | `Termina` | `/sessione/riepilogo/[id]` |

**Riepilogo**: durata, volume totale, serie completate, **i PR in evidenza** (card con
`--glow-pr`), il confronto con l'ultima volta che si è fatta quella routine, elenco degli
esercizi con le serie. In fondo: `Fatto` (torna a `/allenamento`) e ghost `Condividi
immagine` — *fuori scope v1, non implementare*.

**Punti d'attrito identificati e risolti:**

| Attrito | Dove | Risoluzione nel sistema |
|---|---|---|
| "Quanto avevo fatto la volta scorsa?" | ogni serie | la colonna PRECEDENTE è sempre visibile **e** il suo valore è il placeholder dei campi: un tocco su di essa copia i valori |
| Due tocchi per cambiare tipo serie | riga serie | il tipo si cambia dalla colonna indice (48×48, già sotto il pollice), non da un menu della card |
| Il timer parte e l'utente non sa quanto manca mentre naviga | tab diverse | la pill è `fixed` e sopravvive al cambio tab e alla minimizzazione della sessione |
| Il tastierino copre il campo successivo | riga bassa | `scroll-padding-bottom: 180px` sul contenitore + `scrollIntoView({block:'center'})` al focus |
| "Ho perso l'allenamento?" dopo aver chiuso l'app | rientro | vedi §6.4 |
| Mani sudate → tocco impreciso | ovunque in sessione | `--tap-gym` 48px + gap minimo 8px tra target adiacenti |

### 6.3 Flusso: calcolatore di riscaldamento — 3 tocchi

| # | Schermo | Azione |
|---|---|---|
| 1 | `/sessione`, card esercizio | `⋮` → `Calcola riscaldamento` (oppure `?tool=warmup`) |
| 2 | sheet | il campo **peso target** è precompilato con la prima serie allenante di quell'esercizio; si può correggere con il `NumberField` |
| 3 | sheet | `Aggiungi 4 serie di riscaldamento` |

Il foglio mostra **la tabella prima di confermare**, non dopo:

| Serie | % | Peso | Reps | Recupero |
|---|---|---|---|---|
| W1 | bilanciere | 20 kg | 10 | 30 s |
| W2 | 50% | 50 kg | 8 | 45 s |
| W3 | 70% | 70 kg | 5 | 60 s |
| W4 | 87,5% | 87,5 kg | 2 | 90 s |

- Il peso è **arrotondato al disco più piccolo disponibile** (default 1,25 kg per lato →
  step 2,5 kg); il valore teorico esatto si mostra in `sm` `--text-muted` accanto.
- Riga `Bilanciere: 20 kg` modificabile in cima; per gli esercizi con manubri o macchine la
  riga "bilanciere vuoto" sparisce e le percentuali partono dal 50%.
- Le serie generate entrano come tipo `W` (`--set-warmup`, glifo `W`) sopra le serie
  allenanti, già ordinate.
- **Empty**: senza peso target inserito il foglio mostra "Inserisci il peso della tua prima
  serie allenante" e il pulsante è disabilitato **con testo di aiuto**.
- **Error**: peso < peso del bilanciere → "Il target è più leggero del bilanciere. Non
  serve riscaldarsi con meno di 20 kg."

### 6.4 Flusso: calcolatore dischi — 2 tocchi, e la resa grafica

| # | Schermo | Azione |
|---|---|---|
| 1 | `/sessione` (tocco lungo sul campo KG → `Dischi`) oppure `/impostazioni` | apre `?tool=plates&target=<kg>` |
| 2 | sheet | il target è precompilato dal campo; si legge il risultato |

**Resa grafica del bilanciere** — SVG, non immagini, altezza 120px, larghezza piena:

```
        ┌─┐┌┐┌┐ ┌──────────────────────────┐
════════│ ││││││ ...                        ← barra --plate-bar (#666D82), 8px
        └─┘└┘└┘ └──────────────────────────┘
         20 20 10 2,5        ← etichetta stampata su ogni disco
```
- Solo **mezzo bilanciere** (un lato), perché è quello che si carica; sopra il disegno la
  riga `Per lato · 47,5 kg  ·  Totale 115 kg`.
- Ogni disco è un rettangolo arrotondato (`--radius-xs`) con **altezza proporzionale al
  peso** (20 kg = 100px, 15 = 88, 10 = 76, 5 = 60, 2,5 = 46, 1,25 = 36) e larghezza fissa
  14px, gap 3px. Forma + colore + etichetta: tre canali.
- **Ogni disco porta il peso scritto sopra**, ruotato di 90°, nel colore di etichetta della
  tabella §1.8 (tutti ≥4,8:1).
- Sotto, la **legenda testuale** che è la vera fonte accessibile:
  `2 × 20 kg · 1 × 5 kg · 1 × 2,5 kg` — e l'SVG ha
  `role="img"` con `aria-label="Per lato: due dischi da 20 chili, uno da 5, uno da 2 e mezzo."`
- **Tocco su un disco** = lo rimuove e ricalcola il totale (modalità "ho solo questi").

| Stato | Specifica |
|---|---|
| default | combinazione ottima (meno dischi possibile) |
| **resto non raggiungibile** | "Con i dischi disponibili il più vicino è **117,5 kg** (+2,5)." + il delta in `--warning` con icona `AlertTriangle`. Si mostra anche l'opzione per difetto. |
| **target < bilanciere** | empty: "Il target è sotto il peso del bilanciere." + campo per cambiare il bilanciere |
| **nessun disco** | disegno del solo bilanciere + "Servono solo i 20 kg del bilanciere." |
| inventario personalizzato | in `/impostazioni`: quanti dischi per taglio si possiedono; il calcolatore lo rispetta |
| reduced motion | il ricalcolo non anima i dischi: compaiono in posizione |

### 6.5 Flusso: export / import

**Export — 2 tocchi:**

| # | Azione | Risultato |
|---|---|---|
| 1 | `/impostazioni/backup` → `Esporta tutto` | sheet con scelta formato: `JSON (backup completo)` / `CSV (allenamenti)` / `CSV (misure)` |
| 2 | scelta → `Esporta` | download `lifted-backup-2026-09-22.json`. Toast `Backup esportato`. Si registra `lastExportAt` e il banner "ultimo backup: mai" diventa "oggi". |

Sul JSON si dichiara in `sm` `--text-secondary`: "Il file JSON contiene tutto e può essere
reimportato. I CSV servono per Excel: non si reimportano."

**Import — 4 tocchi, con una conferma che non si può saltare:**

| # | Azione | Schermo |
|---|---|---|
| 1 | `/impostazioni/backup` → `Importa da backup` | selettore file di sistema |
| 2 | scelta file | il file viene **letto e validato senza scrivere niente**; loading con `Loader2` + "Leggo il backup…" |
| 3 | anteprima | "Questo backup contiene **412 allenamenti**, **96 misurazioni**, **23 routine**, del **14 set 2026**." A fianco, cosa c'è ora: "Sul dispositivo: 418 allenamenti." |
| 4 | `Sostituisci` | dialog distruttivo (§5.2) → import in transazione Dexie → toast `--success` |

- Se l'import fallisce a metà: **rollback completo** della transazione, toast di errore
  persistente, dati precedenti intatti. Lo si dice: "Niente è stato modificato."
- Import parziale volontario ("unisci invece di sostituire") è **fuori scope v1**.

### 6.6 Sessione attiva e cambio contesto — la regola che tiene tutto

| Evento | Comportamento |
|---|---|
| L'utente tocca una tab | `/sessione` si **minimizza**: transizione `translateY(0 → 100%)` 260ms `--ease-in`, e compare la `SessionBar` sopra la nav. Lo stato non si perde: niente unmount dei campi. |
| L'utente tocca `SessionBar` | `/sessione` si riapre dal basso, 260ms, **con lo scroll dove era rimasto**. |
| L'app va in background | il cronometro e il timer di recupero **non usano il tick**: si ricalcolano da `startedAt` / `restStartedAt` confrontati con `Date.now()` al rientro. Un timer scaduto in background mostra la pill in stato "scaduto". |
| L'utente chiude l'app / ricarica | la sessione è già in IndexedDB (ogni check scrive subito). Al riavvio si entra su `/allenamento` con la `SessionBar` visibile e il cronometro corretto. **Mai** direttamente in sessione. |
| Passano più di 6 ore | al rientro, dialog: "Hai un allenamento aperto da 7 ore. Vuoi terminarlo o scartarlo?" → `Riprendi` · `Termina adesso` · `Scarta`. |
| `beforeunload` | nessun blocco: i dati sono già scritti. Un prompt del browser qui è solo rumore. |

### 6.7 La home diventa il feed — la decisione, e perché

**Domanda posta:** la home diventa il feed con l'avvio in cima, oppure restano due schermate?

**Decisione: tutte e due.** `/home` è il feed **con l'avvio in cima**, e `/allenamento`
sopravvive come schermata delle routine. Non è un compromesso, sono due lavori diversi:

| | `/home` (feed) | `/allenamento` (routine) |
|---|---|---|
| Domanda a cui risponde | «cosa ho fatto» | «cosa faccio adesso» |
| Quando si apre | più volte a settimana, anche fuori dalla palestra | una volta per sessione, in palestra, di fretta |
| Cresce nel tempo? | **sì**, una card a sessione | no, resta di 3-10 voci |
| Modo d'uso | si scorre | si colpisce |

**Perché non fonderle.** Fondere significa mettere l'elenco routine sotto una lista che si
allunga ogni settimana. Dopo due mesi il pulsante `AVVIA` della routine è a tre scroll, e il
percorso critico di §6.2 (2 tocchi dall'apertura al primo campo) diventa «scorri, cerca, tocca».
Il percorso critico di quest'app è l'unica cosa che non si tocca.

**Perché non lasciare solo `/allenamento`.** Perché lo storico oggi è sepolto in fondo al
profilo, e il riferimento ha ragione su questo: vedere l'ultimo allenamento all'apertura è ciò
che fa tornare.

**Cosa c'è in `/home`, in ordine:**

| # | Blocco | Nota |
|---|---|---|
| 1 | `<h1>Home` | a ≥1024 con `--space-9` di respiro sopra |
| 2 | `QuickStart size="compact"` (§4.6) | 80px: primario `Avvia allenamento` + secondario `Scegli una routine`, in riga. Con una sessione attiva diventa `Riprendi · 32:14` |
| 3 | `TrainerTodayCard` | **solo se** esiste un programma attivo. Versione compatta della card «Oggi» (§4.24): nome del giorno, 3 esercizi, `Avvia`. Senza programma **non compare**: l'invito al Trainer sta in `/trainer`, non come pubblicità in cima alla home |
| 4 | `<h2>Allenamenti recenti` + le `WorkoutFeedCard` | §4.21 |

`QuickStart` è **lo stesso componente** di `/allenamento` in due taglie (`compact` / `full`),
non due componenti che si somigliano. La duplicazione dell'azione primaria su due schermate è
voluta: è l'azione primaria dell'app intera.

**Il conto dei passi, prima e dopo:**

| Percorso | v1 | **v2** |
|---|---|---|
| apertura → primo campo, da routine | 2 tocchi (`/allenamento` → `AVVIA`) | **2 tocchi** (`/home` → `Scegli una routine` → `AVVIA`)… **3**. Da `/allenamento`, **2**, invariato |
| apertura → primo campo, sessione vuota | 4 tocchi | **2 tocchi** (`/home` → `Avvia allenamento` → `+ Aggiungi esercizio`) — **migliora** |
| apertura → allenamento di oggi del Trainer | — | **2 tocchi** (`/home` → `Avvia` sulla card di oggi) |
| apertura → ultimo allenamento fatto | 3 tocchi (Profilo → scorri → tocca) | **1 tocco**: è la prima card della home |

**Punto d'attrito residuo, dichiarato:** chi parte sempre dalla stessa routine paga un tocco
in più se apre la home invece della tab Allenamento. Si chiude senza aggiungere schermate:
la card `QuickStart` compatta mostra, come azione secondaria, **il nome dell'ultima routine
usata** invece del generico «Scegli una routine» (`Riprendi Push A ›`). Torna a 2 tocchi per
il caso frequente, resta 3 per gli altri.

### 6.8 Flusso: dal questionario al primo allenamento del Trainer

**Primo accesso → primo valore: 8 passi, di cui 6 sono risposte.**

| # | Schermo | Azione | Attrito |
|---|---|---|---|
| 1 | `/trainer` (empty) | `Inizia il questionario` | — |
| 2-7 | `/trainer/questionario` | sei domande, una per schermata | **il passo 3 (attrezzatura) è quello che fa fermare**: quattordici caselle sono troppe da leggere in piedi. Risolto con i **quattro preset** in cima, che coprono il 90% dei casi con un tocco: le caselle restano sotto, per chi vuole correggere |
| 8 | `/trainer` (dashboard) | il programma è generato e la card «Oggi» è già in cima | — |
| 9 | `/sessione` | `Avvia l'allenamento` — esercizi, serie, intervallo di reps **e carichi consigliati già nei campi** | — |

Da qui in poi il ciclo della serie è quello di §6.2, invariato: 3 tocchi per serie.

**Il ritorno — quello che rende progressivo il programma:**

| # | Evento | Cosa succede |
|---|---|---|
| 1 | `TERMINA` sulla sessione | la sessione porta `trainerDayId`: il giorno si marca `completata` |
| 2 | subito dopo il salvataggio | la progressione gira sui **soli esercizi di quel giorno** e scrive una `ProgressionDecision` per ciascuno (§9.5) |
| 3 | `/sessione/riepilogo/[id]` | in coda al riepilogo, la card **«Cosa cambia la prossima volta»**: 3-5 righe del perché (§4.25), con il delta. È il momento in cui l'utente ha più attenzione e meno domande |
| 4 | apertura successiva | la card «Oggi» mostra i carichi nuovi, ciascuno con la sua riga del perché |

**Punti d'attrito identificati e risolti:**

| Attrito | Dove | Risoluzione |
|---|---|---|
| «Perché mi propone questo carico?» | ogni esercizio | la riga del perché è **sempre visibile**, non in un tooltip; il foglio dà i numeri e le sessioni citate sono link verificabili |
| «Non sono d'accordo, e adesso?» | carico proposto | `Non sono d'accordo` → override manuale; l'override **entra nel registro** e diventa la nuova base, non viene riscritto alla sessione dopo |
| «Ho saltato una settimana, ho rotto tutto?» | rientro | il banner della settimana saltata offre tre strade e **non ne sceglie nessuna**; la frase «Non tocco niente finché non decidi» toglie l'ansia |
| «Sto seguendo il programma o le mie routine?» | due sistemi in parallelo | il Trainer **non sostituisce** le routine: convivono. L'unica cosa che le lega è che un giorno del Trainer si può salvare come routine, non il contrario |
| Quattordici caselle di attrezzatura | passo 3 | quattro preset in cima |
| «Che cosa mi serve per salire?» | ogni esercizio | frase del prossimo passo, obbligatoria su ogni riga del perché |

---

## 7. Layout responsive

### 7.1 375px (telefono — il caso principale)

| Schermata | Layout |
|---|---|
| **Globale** | gutter `--space-5` (16px). Bottom nav 56px + safe area. `<main>` con `padding-bottom` che somma nav + eventuale `SessionBar`. Nessuno scroll orizzontale, mai. |
| **Allenamento** | `QuickStart` a larghezza piena → split come sezioni con intestazione `label` sticky → `RoutineCard` impilate, gap `--space-4` |
| **Sessione** | header sticky 72px, card esercizio a larghezza piena impilate, tabella serie a 5 colonne (§4.1), pill timer fluttuante sopra la nav |
| **Esercizi** | ricerca 48px sticky, barra filtri a scorrimento orizzontale sotto, righe 56px a piena larghezza, virtualizzate |
| **Misure** | card metrica in colonna singola, ognuna con sparkline 48px a destra |
| **Statistiche** | grafici impilati, 240px ciascuno, chip d'intervallo sopra ogni grafico |
| **Sheet** | sempre bottom sheet, `85dvh` max |

### 7.2 768px (tablet)

| Cosa | Comportamento |
|---|---|
| Contenitore | `max-width: 680px`, centrato, gutter `--space-7` (24px) |
| Bottom nav | **resta** (è un dispositivo touch); le etichette passano accanto alle icone in orizzontale, altezza 56px invariata |
| Riga serie | la colonna **RPE è visibile di default** e si aggiunge la colonna **NOTA** (icona 48×48 che apre un popover) |
| Allenamento | `RoutineCard` in griglia **2 colonne**, gap `--space-5` |
| Esercizi | lista a **2 colonne**; i filtri smettono di scorrere e vanno a capo su due righe |
| Statistiche | grafici in griglia **2 colonne**, altezza 280px |
| Misure | card metriche in griglia **2 colonne** |
| Sheet | ancora bottom sheet fino a 767px; **da 768px diventa dialog centrato 480px** |
| Sessione | invariata nella struttura, contenuto centrato a 680px |
| Pill timer | `max-width: 420px`, centrata |

**Cosa si nasconde**: niente. A 768 non si toglie contenuto, si distribuisce.

### 7.3 1440px (desktop — "si guarda con calma")

| Cosa | Comportamento |
|---|---|
| Navigazione | la bottom nav **diventa un rail laterale a sinistra**, 240px, fisso, con le stesse 5 voci in verticale (icona 24 + etichetta `body`), `--card` di fondo, bordo destro `--border`. La `SessionBar` si sposta **in fondo al rail**, larghezza 240px, altezza 64px. Il cambio avviene a `--bp-lg` (1024px). |
| Contenitore | `max-width: 1120px`, gutter `--space-9` (40px) |
| **Sessione** | **due colonne**: sinistra 360px = elenco esercizi della sessione (navigabile, con stato completato); destra = la tabella serie dell'esercizio selezionato, a piena larghezza con colonne più generose (KG 88px, REPS 72px). L'header di sessione diventa una barra piena larghezza in alto. La pill del timer si ancora **in basso a destra**, 360px, non più centrata. |
| Esercizi | **3 colonne**; i filtri diventano una colonna laterale sinistra di 200px con checkbox invece che chip |
| Statistiche | griglia **3 colonne** per le card sintetiche, **2 colonne** per i grafici (altezza 320px) |
| Misure | elenco metriche a sinistra 280px + grafico della metrica selezionata a destra (master-detail, niente navigazione) |
| Storico | tabella vera: data · routine · durata · volume · serie · PR |
| Ordine DOM | **non cambia mai**. Tutti i riordini sono `order` in flex/grid su contenitori il cui ordine visivo coincide con quello di lettura. |

**Cosa non cambia mai, a nessuna larghezza**: le dimensioni minime dei target (48px in
sessione), la scala tipografica, i contrasti, l'ordine di focus.

> **v2 — la §7.3 qui sopra resta valida per `/sessione` e `/sessione/riepilogo/[id]`**, che
> stanno fuori dal guscio e mantengono le due colonne. Per tutte le altre rotte il layout a
> ≥1024 è quello che segue: il **rail da 240px non esiste più**.

### 7.4 v2 — 1024-1279px: due colonne (sidebar + centro)

| Cosa | Comportamento |
|---|---|
| **Navigazione** | la bottom nav **sparisce**; compare la `Sidebar` di `--sidebar-w` (264px), fissa a sinistra, con ricerca globale, sei voci, sotto-voci di Profilo, Impostazioni e blocco stato locale (§4.19) |
| **Guscio** | `<body>` prende `padding-left: var(--sidebar-w)`. Il `<main>` perde il `padding-bottom` della nav e della `SessionBar` (che ora vive nella sidebar) |
| **Colonna centrale** | `max-width: var(--content-max)` (760px), centrata, gutter `--shell-gutter` (24px) |
| **Colonna destra** | **non esiste**. Ogni sua card scende in coda alla colonna centrale, nell'ordine di §4.20 |
| **Home** | feed a colonna singola, card a 760px |
| **Esercizi** | **una** pagina: lista a 2 colonne di righe (come 768), dettaglio come rotta |
| **Impostazioni** | indice + pannello già a due colonne dentro i 760px (260 + 32 + 468) |
| **Profilo** | calendario in colonna centrale, dopo le statistiche, larghezza piena |
| **Trainer** | dashboard a colonna singola; il riepilogo del programma va in coda |
| **Sessione** | invariata (§7.3), ma **dentro** il guscio: la sidebar resta visibile (è la via d'uscita che non scarta la sessione), la colonna destra non compare mai |

### 7.5 v2 — ≥1280px: tre colonne

```
│◄── 264 ──►│◄────── centro ──────►│◄── 320 ──►│
│  Sidebar  │   main (card)        │   aside   │
│  fixed    │                      │   sticky  │
```

```css
/* area contenuto: tutto ciò che non è la sidebar */
.shell {
  padding-left: var(--sidebar-w);
}
.shell__content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--rail-right-w);
  gap: var(--shell-gutter-lg);
  max-width: var(--shell-max);        /* 1120px */
  margin-inline: auto;
  padding-inline: var(--shell-gutter-lg);
}
```

| Larghezza | Sidebar | Centro | Destra |
|---|---|---|---|
| 1280 | 264 | **632px** | 320 |
| 1440 | 264 | **760px** | 320 |
| >1440 | 264, resta a filo a sinistra | 768px (l'area si centra nello spazio rimasto) | 320 |

| Cosa | Comportamento a ≥1280 |
|---|---|
| **Colonna destra** | compare, `<aside aria-label="Riepilogo e azioni rapide">`, `position: sticky; top: var(--space-8)`, scroll proprio con `overscroll-behavior: contain` |
| **Esercizi** | **due pannelli** (§4.26): dettaglio al centro, elenco + filtri nella colonna destra; i chip filtro diventano due `<select>` |
| **Profilo** | il calendario si sposta **nella colonna destra**; statistiche e feed restano al centro |
| **Home** | «Il tuo mese» + azioni rapide + stato backup passano a destra |
| **Trainer** | riepilogo del programma e azioni passano a destra; la card «Oggi» resta al centro |
| **Statistiche** | griglia 2 colonne per i grafici dentro il centro (632-760px), altezza 280px — **non** 3 colonne: a 760px tre grafici sono illeggibili |
| **Misure** | master-detail dentro il centro (elenco 240px + grafico), colonna destra con `Aggiungi misurazione` e le variazioni a 30 giorni |
| **Impostazioni** | indice 260 + pannello dentro il centro; **colonna destra vuota** e quindi non montata |
| **Ordine DOM** | `skip link` → `nav` (sidebar) → `main` → `aside`. **Non cambia a nessuna larghezza.** L'unica eccezione motivata è la libreria a due pannelli, e si risolve con due link reali (§4.26), non con `tabindex` |

### 7.6 Che cosa succede **fra 768 e 1024** — e perché non succede niente

Fra `--bp-md` e `--bp-lg` il layout resta **quello di v1 §7.2**: bottom nav, contenuto centrato
a 680px, griglie a 2 colonne, sheet che diventano dialog a 768. Nessuna sidebar, nessuna
colonna destra.

**Il conto che decide**: a 1023px, una sidebar da 264px lascia al contenuto 759px meno i
gutter, cioè ~711px — ma a 1023px senza sidebar il contenuto ne ha già 680 di massimo e tutta
la larghezza per i margini. Si guadagnerebbero 30px di contenuto in cambio di 264px di cromo
permanente. Peggio: 768-1023 è la fascia dell'**iPad in verticale e in orizzontale**, dove
l'input è il dito e la bottom nav è raggiungibile col pollice mentre una sidebar a sinistra
non lo è. La soglia sta a 1024 perché è lì che il dispositivo smette di essere quasi sempre
touch.

**Le tre schermate che cambiano forma a 1024, non prima**: la libreria (resta a lista piena),
le impostazioni (restano master-detail a due rotte), il profilo (il calendario resta in colonna).

### 7.7 Riepilogo — le tre larghezze richieste

| | **375** | **768** | **1440** |
|---|---|---|---|
| Navigazione | bottom nav 5 tab, 56px + safe area | bottom nav, etichette accanto alle icone | **Sidebar 264px** fissa con ricerca e blocco stato locale |
| Colonne | 1 | 1 (max 680px) | **3**: 264 / 760 / 320 |
| Gutter | `--space-5` (16px) | `--space-7` (24px) | `--shell-gutter-lg` (32px) |
| Home | card feed a piena larghezza, metriche 3 celle | idem, max 680 | feed al centro, «Il tuo mese» + azioni a destra |
| Esercizi | lista piena, chip filtro a scorrimento | lista a 2 colonne, chip su 2 righe | **due pannelli**: dettaglio al centro, elenco 320 a destra con 2 `<select>` |
| Trainer | card «Oggi» piena, settimane in accordion | idem, max 680 | card «Oggi» al centro, riepilogo programma a destra |
| Calendario | griglia piena, cella 45,5px | griglia in card da 680, cella 44 + gap maggiore | nella colonna destra, cella 40 (area 44) |
| Profilo | intestazione **2×2**, tab a segmenti | intestazione 4 celle in riga | intestazione 4 celle, calendario a destra |
| Impostazioni | `/impostazioni` = indice, sezione = rotta figlia | idem | indice 260 + pannello, nella colonna centrale |
| Sessione | §7.1 | §7.2 | §7.3 invariata: **la sidebar resta** (è l'unica via per uscire senza scartare), la **colonna destra no** — la sessione prende tutta l'area contenuto |
| Cosa si nasconde | niente | niente | niente: ciò che sta a destra sotto 1280 vive in coda al centro |

---

## 8. Contratto di accessibilità

Elenco verificabile voce per voce. È quello che il `qa-engineer` spunterà.

### 8.1 Contrasto

- [ ] Ogni coppia testo/fondo del §1.2 misurata ≥ **4.5:1**; nessuna eccezione oltre
      `--text-disabled` sui controlli inattivi (esenzione WCAG 1.4.3), che è sempre
      accompagnato da testo di aiuto.
- [ ] `#007AFF` non compare mai come colore di un glifo testuale né come fondo di testo
      sotto i 24px. Verificabile con una grep: `text-brand` non deve esistere nel codice.
- [ ] Bordi di tutti i controlli (input, checkbox, switch, chip, sheet) ≥ **3:1** contro la
      superficie adiacente → `--border-strong`, mai `--border`.
- [ ] Anello di focus `--ring` ≥ **3:1** contro ogni superficie su cui appare (misurato:
      8.99 / 8.16 / 7.31).
- [ ] Serie dei grafici ≥ **3:1** su `--card` (misurate: 5.93 → 11.04).
- [ ] Etichette degli assi ≥ **4.5:1** (`--chart-axis` = 8.31:1).

**v2 — coppie nuove, tutte misurate su `--surface-hover` `#262A34`**, che in v1 compariva solo
come stato di pressione e in v2 è il **fondo permanente della voce di sidebar attiva** e della
voce di impostazioni attiva. Sono rapporti nuovi e vanno verificati come gli altri:

| Coppia | Rapporto | Uso | Verdetto |
|---|---|---|---|
| `--text-primary` `#F2F4F7` su `#262A34` | **13.02:1** | testo di voce in hover | ✓ |
| `--accent-blue` `#3E96FF` su `#262A34` | **4.79:1** | etichetta e icona della voce **attiva** | ✓ (margine 0.29) |
| `--text-secondary` `#A9B2C1` su `#262A34` | **6.72:1** | metadati su riga in hover | ✓ |
| `--ring` `#6FB4FF` su `#262A34` | **6.59:1** | anello di focus dentro la sidebar | ✓ (soglia 3) |
| `#FFFFFF` su `--primary` `#1268EC` | **4.98:1** | numerale del giorno allenato nel calendario | ✓ |
| `#FFFFFF` su `--primary-hover` `#0F5ED8` | **5.81:1** | giorno del calendario in hover | ✓ |
| `--pr` `#FFB020` su `--pr-surface` `#2E2208` | **8.52:1** | banner «settimana saltata» | ✓ |
| `--success` `#32D74B` su `--card` | **9.27:1** | riga del perché, direzione «aumento» | ✓ |
| `--text-muted` `#838FA4` su `#262A34` | **4.40:1** | — | ❌ **vietato**, come in v1: su `--surface-hover` il minimo resta `--text-secondary`. Vale anche per la sidebar |

- [ ] Nessun colore nuovo entra nel sistema con la v2: la grep dei token deve dare lo stesso
      insieme di hex di v1.

### 8.2 Nessun significato affidato al solo colore

- [ ] **Tipo di serie**: la lettera `W` / `D` / `F` (o il numero) è sempre presente nella
      colonna indice. Togliendo tutti i colori il tipo resta leggibile.
- [ ] **Serie completata**: check **riempito con il glifo `Check`** + `aria-checked="true"`,
      non solo il fondo blu.
- [ ] **PR**: icona `Trophy` + la parola `PR 1RM` / `PR VOLUME` / `PR REPS`.
- [ ] **Timer negli ultimi 10s**: colore + label "Quasi" + pulsazione.
- [ ] **Tab attiva**: colore + icona riempita + peso 700 + binario + `aria-current="page"`.
- [ ] **Toast**: icona + testo, il colore è solo la corsia laterale.
- [ ] **Serie dei grafici**: forma del `dot` diversa + legenda testuale.
- [ ] **Dischi**: peso stampato su ogni disco + altezza proporzionale + legenda testuale.
- [ ] **Errori**: icona `AlertCircle` + messaggio, mai solo il bordo rosso.

**v2 — voci nuove:**

- [ ] **Voce di sidebar attiva**: corsia 3px + fondo + icona riempita + peso 600 + colore +
      `aria-current="page"`. Togliendo il colore, la corsia e il riempimento dell'icona
      bastano a dire quale voce è attiva.
- [ ] **Giorno allenato nel calendario**: riempimento **+ barra 3px sotto la cella** + peso
      700 + etichetta parlata («1 allenamento»). **Oggi**: sottolineatura del numerale, non un
      colore. I due segnali sono ortogonali e si sommano senza confondersi.
- [ ] **Stato della settimana nel Trainer**: corsia colorata **+ la parola**
      («in corso», «completata», «saltata»), mai il solo binario.
- [ ] **Direzione della progressione**: icona (`TrendingUp`/`Minus`/`TrendingDown`/`RotateCcw`)
      + colore + **la frase**. La frase da sola è sufficiente a capire cosa è successo.
- [ ] **Card «record» del feed**: icona `Trophy` + numero + la parola «record». **Nessuna
      emoji**: la 🏅 del riferimento non entra nel prodotto.
- [ ] **Blocco stato locale**: corsia + testo; sopra i 14 giorni si aggiunge l'icona
      `AlertTriangle`, così l'allarme non è affidato alla sola tinta.
- [ ] **Esercizio selezionato nella libreria a due pannelli**: fondo **+ corsia 3px** +
      `aria-current="true"` (il solo fondo fa 1.36:1 contro `--card`: invisibile).
- [ ] **Radio card del questionario selezionata**: bordo 2px + fondo + **icona `Check`** +
      `aria-checked`.

### 8.3 Nomi accessibili

| Componente | `aria-label` / nome accessibile |
|---|---|
| Check della serie | `"Completa serie 3 di Panca piana, 80 chili per 8 ripetizioni"` → a check fatto `aria-checked="true"` |
| Campo KG | `<label>` visivamente nascosta: `"Peso in chili, serie 3, Panca piana"` |
| Campo REPS | `"Ripetizioni, serie 3, Panca piana"` |
| Campo RPE | `"RPE da 1 a 10, serie 3, Panca piana"` |
| Colonna indice serie | `"Serie 3, tipo: riscaldamento. Cambia tipo o elimina"` (`aria-haspopup="menu"`) |
| Colonna precedente | `"Serie precedente: 80 chili per 8. Tocca per copiare"` |
| Swipe elimina | l'area rivelata è un `button` con `"Elimina serie 3"` |
| Pill timer, `−15` / `+15` | `"Togli 15 secondi al recupero"` / `"Aggiungi 15 secondi al recupero"` |
| Pill timer, numeri | `role="timer"`, `"Recupero, 1 minuto e 28 secondi rimanenti"` |
| Pill timer, `✕` | `"Salta il recupero"` |
| `SessionBar` | `"Riprendi l'allenamento in corso, 32 minuti e 14 secondi"` |
| Chevron dell'header sessione | `"Riduci la sessione e torna indietro"` |
| Tab della bottom nav | il testo visibile basta; `aria-current="page"` sull'attiva |
| Chip filtro | `"Filtra per Petto"` + `aria-pressed` |
| Disco nell'SVG | l'SVG è un solo `role="img"` con `aria-label` completa; i singoli dischi rimovibili sono `button` con `"Rimuovi un disco da 20 chili"` |
| Icone decorative accanto a testo visibile | `aria-hidden="true"` — sempre |
| Pulsante icona senza testo | **non esiste** senza `aria-label`. Nessuna eccezione. |
| **v2** — wordmark della sidebar | `"Lifted, vai alla home"` |
| **v2** — ricerca globale | `"Cerca esercizi o routine"` + `role="combobox"` |
| **v2** — esporta dal blocco stato locale | `"Esporta un backup adesso"` |
| **v2** — voce di sidebar attiva | il testo visibile basta; `aria-current="page"` |
| **v2** — badge sulla voce Trainer | `"Trainer, allenamento previsto oggi"` |
| **v2** — «Visualizza altri 4 esercizi» | il testo visibile basta; `aria-expanded` sul pulsante |
| **v2** — menu ⋮ di una card del feed | `"Azioni per Schiena+Dorso del 22 settembre"` |
| **v2** — cella del calendario | `"12 settembre 2026, 1 allenamento: Schiena+Dorso"` · `"13 settembre 2026, nessun allenamento"` |
| **v2** — mese precedente / successivo | `"Mese precedente, agosto 2026"` / `"Mese successivo, ottobre 2026"` |
| **v2** — riga del perché | `"Perché 82,5 kg su Panca piana"` |
| **v2** — barra del questionario | `role="progressbar"` + `aria-valuetext="Passo 3 di 6"` |
| **v2** — «Vai all'elenco esercizi» / «Torna all'elenco» | il testo visibile basta; sono `<a href="#elenco-esercizi">` reali |

### 8.4 Ordine di focus in sessione

Deterministico, e coincide con la lettura visiva:

```
1  Chevron riduci
2  TERMINA
3  [per ogni esercizio, in ordine]
3a   nome esercizio (heading h2, focusable per lo skip)
3b   menu ⋮ dell'esercizio
3c   nota dell'esercizio (se aperta)
3d   [per ogni serie, in ordine]
3d-1   indice/tipo serie (apre il menu)
3d-2   campo KG
3d-3   campo REPS
3d-4   campo RPE (solo se attivo)
3d-5   check di completamento
3e   + Aggiungi serie
4  + Aggiungi esercizio
5  pill del timer (se presente): −15 → numeri (pausa) → +15 → ✕
6  bottom nav (5 tab)
```

- La **pill del timer entra nella sequenza dopo il contenuto**, non lo interrompe:
  è `position: fixed` ma il suo nodo DOM sta dopo `<main>`.
- `Invio` dentro KG → REPS. `Invio` dentro REPS → check. `Invio` sul check → KG della serie
  successiva. È l'unico shortcut del sistema ed è quello che vale.
- **Focus non oscurato** (WCAG 2.4.11): `scroll-padding-bottom: 180px` sul contenitore
  scrollabile di `/sessione` copre nav + `SessionBar` + pill.
- **Skip link** all'inizio del documento: `Vai al contenuto` — visibile solo in focus,
  fondo `--card-elevated`, bordo `--ring`.

### 8.5 Annunci `aria-live`

| Evento | Regione | Cortesia | Testo |
|---|---|---|---|
| Serie completata | `#sr-session` | `polite` | "Serie 3 completata. Volume totale 4 280 chili." |
| Timer avviato | `#sr-timer` | `polite` | "Recupero avviato, 90 secondi." |
| Timer, 10 secondi | `#sr-timer` | `polite` | "10 secondi." |
| Timer scaduto | `#sr-timer` | **`assertive`** | "Recupero terminato." |
| Timer ±15s | `#sr-timer` | `polite` | "Recupero, 1 minuto e 45 secondi." |
| **PR conquistato** | `#sr-pr` | `polite` | "Record personale: Panca piana, 1RM stimato 112 chilogrammi." |
| Esercizio riordinato | `#sr-session` | `polite` | "Panca piana spostata in posizione 2 di 5." |
| Serie eliminata | `#sr-session` | `polite` | "Serie 3 eliminata. Premi Annulla per ripristinare." |
| Import concluso | `#sr-system` | `polite` | "Importati 412 allenamenti e 96 misurazioni." |
| Errore di salvataggio | `#sr-system` | **`assertive`** | "Allenamento non salvato sul dispositivo." |
| Filtri applicati | `#sr-system` | `polite` | "37 esercizi trovati." |
| **v2** — risultati della ricerca globale | `#sr-system` | `polite` | "7 risultati." — debounce 500ms, **mai per tasto** |
| **v2** — dettaglio esercizio aperto (due pannelli) | `#sr-system` | `polite` | "Panca piana con bilanciere, dettaglio aperto." |
| **v2** — cambio mese del calendario | `#sr-system` | `polite` | "settembre 2026, 8 allenamenti." — **una volta sola**, non a ogni cella attraversata con le frecce |
| **v2** — passo del questionario | `#sr-system` | `polite` | "Passo 4 di 6: da quanto ti alleni?" |
| **v2** — programma generato | `#sr-system` | `polite` | "Programma creato: ipertrofia, 4 giorni, 8 settimane." |
| **v2** — decisioni di progressione dopo il `TERMINA` | `#sr-session` | `polite` | "Aggiornati 5 carichi per la prossima volta." — **un solo annuncio**, non uno per esercizio |
| **v2** — errore di lettura del programma | `#sr-system` | **`assertive`** | "Non riesco a leggere il programma." |

**Il conto alla rovescia NON si annuncia secondo per secondo.** `role="timer"` con
`aria-live="off"`: si annunciano solo avvio, 10 secondi e fine. Un annuncio al secondo
rende lo screen reader inutilizzabile.

Quattro regioni distinte e persistenti nel DOM (`sr-only`, sempre montate, mai create al
volo): `#sr-session`, `#sr-timer`, `#sr-pr`, `#sr-system`.

### 8.6 `prefers-reduced-motion` — mappa completa

| Animazione | Normale | `reduce` |
|---|---|---|
| Check di completamento serie | `scale 0.8→1` 150ms | nessuna scala; il riempimento appare istantaneo |
| Ingresso pill timer | `translateY(16)→0` + `opacity` 200ms | `opacity` 150ms |
| Pulsazione ultimi 10s | `scale 1→1.03` 900ms ∞ | **nessuna**; restano colore + label "Quasi" |
| Punto pulsante `SessionBar` | `opacity` 2s ∞ | punto fisso |
| Barra di progresso timer | `scaleX` continuo | avanza a scatti di 1s |
| Ingresso bottom sheet | `translateY(100%)→0` 260ms | `opacity` 150ms, nessuna traslazione |
| Ingresso dialog | `scale(0.98)→1` + `opacity` 260ms | `opacity` 150ms |
| Toast | `translateY(12)→0` + `opacity` 200ms | `opacity` 150ms |
| Press su qualsiasi controllo | `scale(0.97)` 150ms | fondo `--surface-hover`, nessuna scala |
| Minimizza/riapri sessione | `translateY` 260ms | cambio immediato |
| Swipe elimina | `translateX` segue il dito | **il gesto resta** (è diretto, non un'animazione automatica); l'azione a rilascio è immediata |
| Grafici Recharts | animazione di ingresso | `isAnimationActive={false}` |
| Skeleton shimmer | `opacity 0.5→1` 1.2s ∞ | blocco statico `--card-elevated` |
| Spinner dei bottoni | rotazione 800ms | tre punti in dissolvenza 1s |
| **v2** — cambio mese del calendario | `translateX(±8px)` + `opacity` 200ms | solo `opacity` 150ms |
| **v2** — passo del questionario | `translateX(±12px)` + `opacity` 200ms | solo `opacity` 150ms |
| **v2** — barra del questionario | `scaleX` 200ms | nessuna transizione: salta al valore |
| **v2** — cambio dettaglio nella libreria | crossfade `opacity` 150ms | cambio immediato |
| **v2** — espansione della card feed | **nessuna animazione di altezza**, mai; righe nuove in `opacity` 150ms | nessuna dissolvenza |
| **v2** — voce di sidebar, hover | `background-color` 150ms (proprietà elencata, mai `all`) | invariata: è un colore, non un movimento |

> Il fondo di una voce in hover è l'unica transizione del sistema che non sia `transform` o
> `opacity`. È ammessa perché `background-color` non provoca layout né paint del sottoalbero,
> ed è elencata esplicitamente nella `transition` (mai `transition: all`, §11.6).

Implementazione: un `@media (prefers-reduced-motion: reduce)` globale che azzera
`--dur-1/2/3` **non basta** (le animazioni infinite vanno rimosse, non accorciate). Serve
sia il reset globale sia i casi elencati gestiti nei componenti.

### 8.7 Dimensioni e gesti

- [ ] Target ≥ **44×44px** ovunque; ≥ **48×48px** dentro `/sessione` e sulla bottom nav.
- [ ] Spazio ≥ **8px** tra target adiacenti (le colonne della riga serie rispettano il gap
      `--space-3`, ridotto a 6px solo con RPE attivo a 375 — compensato dal fatto che le
      colonne sono comunque ≥40px e i tipi di errore sono correggibili senza costo).
- [ ] **Ogni gesto ha un'alternativa a tocco singolo o tastiera** (WCAG 2.5.7): swipe→menu,
      drag di riordino→frecce, swipe-to-dismiss→`X` ed `Esc`, tocco lungo→menu.
- [ ] Nessuna azione dipende dalla pressione, dalla velocità o dal percorso del dito.
- [ ] Zoom non bloccato: `viewport` **senza** `maximum-scale` né `user-scalable=no`.
- [ ] Nessuno scroll orizzontale a 320px di larghezza (la barra filtri è l'unica area con
      scroll orizzontale **intenzionale**, ed è annunciata come tale).
- [ ] Safe area rispettata su iOS: nav, pill timer, `SessionBar` e sheet usano
      `env(safe-area-inset-bottom)`.

### 8.8 Form

- [ ] Ogni campo ha una `<label>` associata (visibile o `sr-only` con testo completo).
      Mai un placeholder al posto della label.
- [ ] Validazione **on blur**, non su ogni tasto.
- [ ] Errore **accanto al campo**, con `aria-invalid="true"` e `aria-describedby`.
- [ ] Submit con più errori: riepilogo in cima con link ai campi, focus sul riepilogo.
- [ ] `inputMode` corretto su ogni campo numerico (`decimal` per i kg, `numeric` per le reps).
- [ ] Nessuna autenticazione in questa app → WCAG 3.3.8 non applicabile, e va detto.

### 8.9 Struttura e semantica — **rafforzata in v2 (chiude QA GRAVE 5 e MINORE 6)**

- [ ] **Ogni rotta dell'app monta esattamente un `<main id="contenuto" tabIndex={-1}>` e
      esattamente un `<h1>`, dentro quel `<main>`.** Senza eccezioni, e in particolare **fuori
      dal guscio delle tab**, che è dove il difetto è nato.

| Rotta fuori dal guscio | `<main>` oggi | `<h1>` da adottare |
|---|---|---|
| `/sessione` | **manca** | il nome della routine — `Push A`, o `Sessione libera`. Oggi è un `<h2>`: si promuove, e i nomi degli esercizi restano `<h2>` (§4.2), quindi la gerarchia non salta |
| `/sessione/riepilogo/[id]` | **manca** | `Riepilogo · Push A` |
| `/impostazioni/*` | c'è, ma il titolo sta **fuori** | il titolo della sezione **dentro** `<main>` (QA MINORE 6: regola axe `region`) |
| `/trainer/questionario` | nuova | `Il tuo programma` (il testo della domanda è `<h2>`) |

- [ ] **Lo skip link «Vai al contenuto» ha un bersaglio su ogni rotta.** Verifica automatica,
      una riga per rotta: `document.querySelector('#contenuto')?.tagName === 'MAIN'`, e dopo
      `Invio` l'elemento attivo è quel `main`. Oggi fallisce su `/sessione` e sul riepilogo.
- [ ] Gerarchia senza salti su **tutte** le rotte, comprese `/misure`, `/statistiche` e
      `/misure/[metrica]` (QA MINORE 6: `heading-order`, `h3` senza `h2`).
- [ ] `<main>`, `<nav aria-label="Navigazione principale">`, `<header>` semantici.
- [ ] **Un solo `<nav aria-label="Navigazione principale">` nel documento**: sotto 1024 è la
      bottom nav, sopra è la sidebar. Non devono coesistere, nemmeno nascosta una delle due
      con `display:none` in un ramo di React che resta montato.
- [ ] La colonna destra è `<aside aria-label="Riepilogo e azioni rapide">`: è un landmark, così
      chi usa uno screen reader ci salta invece di tabularci dentro.
- [ ] La tabella delle serie è una `<table>` reale con `<th scope="col">`, non un grid di `<div>`.
- [ ] `lang="it"` sull'`<html>`.
- [ ] Titolo di pagina univoco e descrittivo su ogni rotta (`Sessione · Push A — Lifted`),
      comprese le rotte nuove (`Trainer · Settimana 3 — Lifted`).
- [ ] Liste > 50 voci virtualizzate **senza rompere la navigazione da tastiera** (il
      contenitore espone `aria-rowcount`). Con ~300 esercizi, la libreria ci rientra
      abbondantemente.

### 8.10 v2 — il contratto dei componenti nuovi

Elenco a sé perché è quello che il `qa-engineer` non ha mai verificato prima.

**Sidebar (§4.19)**
- [ ] `<nav aria-label="Navigazione principale">`, voce attiva con `aria-current="page"`.
- [ ] Voce 48px di altezza e larghezza piena della colonna (≥ `--tap-min`); sotto-voci 40px,
      eccezione dichiarata e giustificata in §4.19.2.
- [ ] Anello di focus con `outline-offset: -2px`: non esce dalla sidebar e non viene tagliato.
- [ ] La sidebar **non è un focus trap**; l'ordine è skip link → sidebar → `main` → `aside`.
- [ ] Il piede della sidebar non copre mai la lista: `margin-top: auto`, non `position: absolute`.
- [ ] `GlobalSearch`: `role="combobox"` + `aria-expanded` + `aria-controls` +
      `aria-activedescendant`; `Esc` chiude e restituisce il focus al campo; l'annuncio dei
      risultati è `polite` con debounce 500ms, **mai per tasto**.
- [ ] Il pulsante icona del blocco stato locale ha `aria-label="Esporta un backup adesso"`.

**Colonna destra (§4.20)**
- [ ] Nessuna informazione esiste **solo** nella colonna destra: sotto 1280 ogni card ha una
      collocazione dichiarata. Verifica: a 1279px nessun dato è scomparso rispetto a 1280px.
- [ ] `position: sticky` non copre mai un elemento che ha il focus (`focus-not-obscured`):
      l'aside ha uno scroll proprio e non si sovrappone al `main`.

**Calendario (§4.27)**
- [ ] `role="grid"`, `aria-labelledby` sul mese, `<th scope="col">` con il giorno per esteso
      in `sr-only`.
- [ ] Roving tabindex: **una sola** cella nel tab order.
- [ ] `←→↑↓`, `Home`/`End`, `PagSu`/`PagGiù` implementati; uscire dal mese con le frecce lo cambia.
- [ ] Etichetta di cella completa e parlata: `"12 settembre 2026, 1 allenamento: Schiena+Dorso"`.
- [ ] Il cambio mese si annuncia **una volta** in `#sr-system`, non a ogni cella attraversata.
- [ ] Area di cella ≥ 44×44 anche a 375px (misurata, non stimata: 45,5px).
- [ ] Giorni fuori dal mese `aria-hidden` e non focalizzabili.
- [ ] Reduced motion: nessuna traslazione al cambio mese.

**Libreria a due pannelli (§4.26)**
- [ ] Il link «Vai all'elenco esercizi» è il **primo** elemento focalizzabile della colonna
      centrale, e «Torna all'elenco» chiude il pannello dettaglio.
- [ ] Alla selezione il focus va sull'`<h1>` del dettaglio (`tabIndex={-1}`) e `#sr-system`
      annuncia l'apertura.
- [ ] La voce selezionata porta `aria-current="true"` **e** la corsia (il solo fondo fa 1.36:1).
- [ ] Le righe fuori dal viewport virtuale non sono nel tab order; `aria-rowcount` esposto.
- [ ] I due `<select>` nativi sono forzati con `background-color: var(--input); color:
      var(--text-primary)` (§11.2: su Windows in tema scuro rendono bianco su bianco).
- [ ] Il contatore dei risultati è `aria-live="polite"` con debounce, e i filtri stanno nella
      query string.

**Trainer (§4.23-§4.25)**
- [ ] Il questionario è un `<form>` con un `<fieldset>`+`<legend>` per domanda; radio e
      checkbox **nativi**, `<label>` che avvolge il controllo.
- [ ] `role="progressbar"` con `aria-valuenow`/`min`/`max` e `aria-valuetext="Passo 3 di 6"`.
- [ ] Il primario resta **abilitato** con la domanda senza risposta (§11.8): si preme, l'errore
      compare sotto la domanda con `aria-invalid` + `aria-describedby`, e il focus va lì.
- [ ] Il banner «settimana saltata» è `role="status"` (polite e persistente), **non**
      `role="alert"`: non è un'emergenza e non deve interrompere.
- [ ] La riga del perché è **testo visibile**, non un `title` né un tooltip: nessuna
      affordance solo-hover (§4.14).
- [ ] Il foglio «Perché questo carico» si apre da un `<button>` con nome accessibile
      («Perché 82,5 kg su Panca piana») e si chiude con `Esc`.
- [ ] Le sessioni citate nelle prove sono link reali, verificabili.
- [ ] Ogni riga del perché contiene la frase del **prossimo passo**: senza, il registro
      racconta il passato e non serve al futuro.
- [ ] Reduced motion: nessuna traslazione fra i passi del questionario, la barra di
      avanzamento cambia senza transizione.

**Feed (§4.21)**
- [ ] «Visualizza altri N esercizi» è un `<button>` con `aria-expanded`, non un link.
- [ ] L'espansione **non anima l'altezza**: solo `opacity` sulle righe nuove.
- [ ] `Carica altri 10` è un pulsante reale: niente scroll infinito.
- [ ] Il menu ⋮ ha un nome accessibile che include l'allenamento e la data.

**Grafici (§4.10-bis)**
- [ ] `TrendChart` ha un `domain` esplicito su **tutti e tre** i punti d'uso
      (`/misure/[metrica]`, `/esercizi/[id]`, `/statistiche`).
- [ ] `VolumeBars` **non** cambia: resta ancorato a zero.
- [ ] Quando l'asse non parte da zero, la riga `Scala: min – max` è presente.
- [ ] Escursione zero → dominio simmetrico + frase «Nessuna variazione nel periodo.».
- [ ] La `<table>` alternativa resta e contiene i valori, non il dominio.

---

## 9. Modello dati suggerito

Quello che **la UI legge**. Gli indici, le versioni dello schema e le migrazioni Dexie li
decide il `frontend-engineer`: qui ci sono le entità e i campi, non lo schema.

```ts
type ID = string;           // crypto.randomUUID()
type ISODate = string;      // "2026-09-22T18:04:12.000Z"
type SetType = "normal" | "warmup" | "drop" | "failure";
type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight" | "other";
type MuscleGroup = "chest" | "back" | "shoulders" | "legs" | "arms" | "core";
type PRKind = "e1rm" | "volume" | "reps";
```

### 9.1 Entità

| Entità | Campi |
|---|---|
| **Exercise** | `id`, `name`, `muscleGroup: MuscleGroup`, `secondaryMuscles?: MuscleGroup[]`, `equipment: Equipment`, `isCustom: boolean`, `notes?`, `defaultRestSec?`, `isBodyweight: boolean`, `createdAt`, `archivedAt?` |
| **Routine** | `id`, `name`, `split?: string`, `order: number`, `exercises: RoutineExercise[]`, `createdAt`, `updatedAt`, `lastPerformedAt?` |
| **RoutineExercise** | `exerciseId`, `order`, `notes?`, `restSec?`, `sets: RoutineSetTemplate[]` |
| **RoutineSetTemplate** | `type: SetType`, `targetWeightKg?`, `targetReps?`, `targetRpe?` |
| **Session** | `id`, `routineId?`, `routineName?`, `startedAt: ISODate`, `endedAt?: ISODate`, `status: "active" \| "completed" \| "discarded"`, `pausedMs: number`, `notes?`, `exercises: SessionExercise[]`, `totalVolumeKg`, `totalSets`, `durationSec` |
| **SessionExercise** | `id`, `exerciseId`, `exerciseName` (denormalizzato: lo storico non deve rompersi se l'esercizio viene rinominato), `order`, `notes?`, `restSec`, `sets: SetEntry[]` |
| **SetEntry** | `id`, `index: number`, `type: SetType`, `weightKg: number \| null`, `reps: number \| null`, `rpe?: number`, `completed: boolean`, `completedAt?: ISODate`, `prevWeightKg?`, `prevReps?`, `prIds?: ID[]` |
| **PersonalRecord** | `id`, `exerciseId`, `kind: PRKind`, `value: number`, `weightKg?`, `reps?`, `sessionId`, `setId`, `achievedAt: ISODate`, `previousValue?` |
| **MeasurementEntry** | `id`, `metric: MetricKey`, `value: number`, `unit: "kg" \| "%" \| "cm"`, `date: ISODate`, `note?` |
| **Settings** | `id: "singleton"`, `unit: "kg"`, `defaultRestSec: 90`, `restAutoStart: true`, `soundEnabled: true`, `vibrationEnabled: true`, `showRpe: false`, `e1rmFormula: "epley" \| "brzycki"`, `barWeightKg: 20`, `plateInventory: Record<PlateKg, number>`, `stepKg: 2.5`, `stepKgFine: 1.25`, `warmupPercents: number[]`, `lastExportAt?`, `onboardingSeenAt?`, `schemaVersion: number` |

```ts
type MetricKey =
  | "bodyweight" | "bodyfat"
  | "arm" | "chest" | "waist" | "hips" | "thigh" | "calf";
type PlateKg = 20 | 15 | 10 | 5 | 2.5 | 1.25;
```

### 9.2 Cosa legge ogni schermata

| Schermata | Legge |
|---|---|
| `/allenamento` | `Settings` (sessione attiva?) · `Session[status=active]` (id, startedAt, nome esercizio corrente) · `Routine[]` (id, name, split, order, exercises.length, lastPerformedAt, i primi 4 `exerciseName`) |
| `/allenamento/routine/[id]` | `Routine` completa + `Exercise.name/muscleGroup/equipment` per ogni riga |
| editor routine | `Routine` completa · `Exercise[]` (per il picker: id, name, muscleGroup, equipment, isCustom) |
| `/sessione` | `Session[status=active]` completa · per ogni `SessionExercise`: l'ultima `SetEntry` completata dello stesso `exerciseId` in una sessione precedente (→ `prevWeightKg`, `prevReps`) · `PersonalRecord[exerciseId]` correnti (per confrontare live) · `Settings` (restSec, showRpe, stepKg, e1rmFormula, sound) |
| pill timer | `Session.restStartedAt` + `restSec` — **ricalcolato da `Date.now()`, mai da un contatore** |
| `/sessione/riepilogo/[id]` | `Session` completa · `PersonalRecord[sessionId]` · la `Session` precedente con lo stesso `routineId` (per il confronto) |
| `/profilo` | `Session[status=completed]` ordinate per `startedAt` desc (id, routineName, startedAt, durationSec, totalVolumeKg, totalSets, conteggio PR) · aggregati settimanali |
| `/profilo/sessione/[id]` | `Session` completa + `PersonalRecord[sessionId]` |
| `/esercizi` | `Exercise[]` (tutti i campi tranne `notes`) · conteggio per filtro |
| `/esercizi/[id]` | `Exercise` · tutte le `SetEntry` completate di quell'esercizio con data (→ serie 1RM stimato e volume) · `PersonalRecord[exerciseId]` |
| `/misure` | ultimo `MeasurementEntry` per ciascuna `MetricKey` + il precedente (per il delta) + gli ultimi 12 punti (sparkline) |
| `/misure/[metrica]` | tutte le `MeasurementEntry` di quella metrica, ordinate per `date` |
| `/statistiche` | `Session[status=completed]` aggregate per settimana/mese (volume, serie, durata) · `SetEntry` aggregate per `MuscleGroup` via `Exercise.muscleGroup` · serie 1RM stimato per gli esercizi principali · `PersonalRecord[]` recenti |
| `/impostazioni` | `Settings` |
| `/impostazioni/backup` | `Settings.lastExportAt` · conteggi di tutte le tabelle (per l'anteprima) |
| calcolatore riscaldamento | `Settings` (barWeightKg, warmupPercents, plateInventory, stepKg) + il peso target dal campo |
| calcolatore dischi | `Settings` (barWeightKg, plateInventory) + target |

### 9.3 Note sul modello che riguardano la UI

- **`exerciseName` denormalizzato in `SessionExercise`**: senza, rinominare un esercizio
  riscrive lo storico. La UI dello storico mostra il nome al momento della sessione.
- **`prevWeightKg` / `prevReps` scritti su `SetEntry` alla creazione**, non calcolati al
  volo a ogni render: la colonna PRECEDENTE è nel percorso critico della sessione e non può
  dipendere da una query.
- **`PersonalRecord` è una tabella, non un calcolo**: il riepilogo e il badge devono sapere
  *quando* un record è stato battuto e *quale* era il precedente. Ricalcolarlo da zero a
  ogni check è sprecato e rende impossibile la frase "112 kg, +4 rispetto al record".
- **`Session.status = "active"` è unico per costruzione**: la UI non ammette due sessioni
  aperte, e questo va imposto nel data layer, non solo nel bottone.
- **Scrittura ottimistica**: ogni tocco sul check scrive subito. Se la scrittura fallisce,
  lo stato visivo resta e compare il banner d'errore persistente (§4.3) — non si fa
  rollback visivo di una serie che l'utente ha fatto davvero.

### 9.4 v2 — la libreria allargata (~250-300 voci)

Fonte: `docs/esercizi-hevy.md`. **Ogni combinazione movimento × attrezzo è un esercizio
distinto**, come nel riferimento: `Panca piana (Bilanciere)`, `Panca piana (Manubri)`,
`Panca piana (Smith)`, `Panca piana (Macchina)` sono quattro voci, non una con un'opzione.

**Convenzione di nome, vincolante**: `Nome del movimento (Attrezzo)`. Con una qualifica di
presa o di angolo, la qualifica sta **prima** della parentesi:
`Lat pulldown presa inversa (Cavi)`. Maiuscola solo sulla prima parola (§11.10).

**Campi nuovi su `Exercise`:**

```ts
type Equipment =                    // da 6 a 15 — ampliata, non sostituita
  | "barbell" | "ez-bar" | "dumbbell" | "cable" | "machine" | "smith"
  | "bodyweight" | "weighted" | "assisted-machine" | "kettlebell"
  | "band" | "trap-bar" | "medicine-ball" | "plate" | "other";

type MuscleGroup =                  // da 6 a 8: i gruppi della spec-v2
  | "chest" | "back" | "shoulders" | "arms" | "legs" | "core"
  | "traps" | "fullbody";

interface Exercise {
  // … tutti i campi di §9.1, invariati …
  family: string;          // "panca-piana" — raggruppa le varianti; è il raggruppamento
                           //   della libreria quando c'è un filtro muscolo attivo (§4.26)
  variant?: string;        // "presa inversa" | "presa neutra" | "30 gradi"
  mechanics: "compound" | "isolation";
  unilateral: boolean;     // un braccio/una gamba: il volume si conta per lato
  loadMode: "external" | "bodyweight" | "weighted-bodyweight" | "assisted";
  stepKgOverride?: number; // incremento minimo dell'attrezzo (macchina a tacche da 5)
  popularity: number;      // ordine di default nella libreria: prima quelli che si usano
  videoUrl?: string | null;// PREVISTO DALLO SCHEMA, MAI MOSTRATO IN V2 (spec-v2 §4).
                           //   Nessuna schermata deve promettere un video che non c'è.
}
```

**Vincoli di migrazione — nessun dato dell'utente si tocca:**

| Regola | Perché |
|---|---|
| `nameKey` deve includere **l'attrezzo** | senza, `Panca piana (Bilanciere)` e `(Manubri)` collidono sull'indice unico `&nameKey` e il seed ne perde una |
| Il seed riconosce le voci esistenti per **`family` + `equipment`**, non per nome | gli 81 esercizi di v1 hanno nomi italiani estesi («Panca piana con bilanciere»): si **aggiornano** con i campi nuovi, non si duplicano |
| Gli esercizi con `isCustom: true` **non si toccano mai** | spec-v2 §3. Nemmeno per aggiungere `family`: resta vuoto e la libreria li raggruppa sotto «Personalizzati» |
| Lo storico non si riscrive | `SessionExercise.exerciseName` è già denormalizzato (§9.3): rinominare o riclassificare un esercizio non tocca le sessioni passate |
| Il seed è **idempotente** e versionato in `AppMeta` | una libreria che si ri-semina due volte è una libreria doppia |

**Conseguenza sulla UI**: con ~300 voci, la virtualizzazione della libreria smette di essere
una raccomandazione e diventa un requisito (§4.26, §11.6). E il contatore dei risultati smette
di essere un dettaglio: con 287 voci, «quante ne ho filtrate» è l'unico modo per sapere se il
filtro ha fatto qualcosa.

### 9.5 v2 — il modello del Trainer

Quattro entità nuove. La quarta — `ProgressionDecision` — è quella che rende il Trainer
trasparente: **senza una tabella delle decisioni, il «perché» andrebbe ricalcolato a ogni
render e cambierebbe quando cambiano i dati**. È lo stesso motivo per cui `PersonalRecord` è
una tabella e non un calcolo (§9.3): la storia deve restare quella che è stata.

```ts
type TrainerGoal  = "strength" | "hypertrophy" | "recomp" | "maintenance";
type TrainerLevel = "beginner" | "intermediate" | "advanced";
type ProgressionRule =
  | "double-progression" | "reps-first" | "rpe-cap" | "hold-on-miss"
  | "deload-on-miss" | "planned-deload" | "skip-hold" | "first-time" | "manual";

interface TrainerProfile {          // le risposte al questionario — singleton
  id: "singleton";
  goal: TrainerGoal;
  priorityMuscles: MuscleGroup[];   // massimo 2, può essere vuoto
  equipment: Equipment[];           // almeno uno
  level: TrainerLevel;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  sessionMinutes: 45 | 60 | 75 | 90;
  answeredAt?: ISODate;
  draftStep?: 1|2|3|4|5|6;          // questionario a metà: si riprende da qui
}

interface TrainerProgram {
  id: ID;
  name: string;                     // "Ipertrofia · 4 giorni · 8 settimane"
  profileSnapshot: TrainerProfile;  // le risposte AL MOMENTO della generazione:
                                    //   cambiare le risposte non riscrive il passato
  goal: TrainerGoal;
  weeksTotal: number;
  currentWeek: number;
  status: "active" | "paused" | "completed" | "abandoned";
  createdAt: ISODate; startedAt: ISODate;
  pausedAt?: ISODate; completedAt?: ISODate;
  ruleSetVersion: number;           // quale set di regole (§4.25) ha generato il programma
  weeks: TrainerWeek[];
}

interface TrainerWeek {
  index: number;                              // 1-based
  kind: "accumulo" | "intensificazione" | "scarico";
  status: "futura" | "in-corso" | "completata" | "saltata" | "ripetuta";
  days: TrainerDay[];
}

interface TrainerDay {
  id: ID;
  weekIndex: number; dayIndex: number;
  name: string;                               // "Giorno B · Spinta"
  targetMuscles: MuscleGroup[];
  estimatedMinutes: number;
  status: "prevista" | "completata" | "saltata";
  plannedFor?: ISODate;                       // la data suggerita, non un obbligo
  sessionId?: ID;                             // la sessione che l'ha chiuso
  exercises: TrainerExercise[];
}

interface TrainerExercise {
  exerciseId: ID; exerciseName: string;       // denormalizzato, come ovunque
  order: number;
  sets: number; repsMin: number; repsMax: number;
  rpeTarget: number; restSec: number;
  suggestedWeightKg: number | null;           // null = "prima volta", campo vuoto
  decisionId?: ID;                            // ⇢ ProgressionDecision: il perché di questo carico
}

interface ProgressionDecision {               // TABELLA PROPRIA, indicizzata per programId+decidedAt
  id: ID; programId: ID;
  weekIndex: number; dayId: ID;
  exerciseId: ID; exerciseName: string;
  decidedAt: ISODate;
  rule: ProgressionRule;
  direction: "up" | "hold" | "down" | "deload" | "manual";
  fromWeightKg: number | null; toWeightKg: number | null;
  fromReps: [number, number] | null; toReps: [number, number] | null;
  evidence: {                                 // i numeri che hanno attivato la regola
    sessionIds: ID[];                         // link verificabili nel foglio (§4.25)
    setsCompleted: number; setsPlanned: number;
    repsAchieved: number[];
    rpeObserved: (number | null)[];
  };
  humanReason: string;                        // "3 serie su 3 a RPE 7" — la frase mostrata
  nextStepHint: string;                       // "Completa 3×8 a RPE ≤ 8 e salgo a 85 kg"
  overriddenBy?: ID;                          // se l'utente ha detto "non sono d'accordo"
}
```

**Collegamento con la sessione**: `Session` guadagna **un solo campo**,
`trainerDayId?: ID`. È quello che permette al giorno di marcarsi da sé al `TERMINA` e alla
progressione di girare sugli esercizi giusti. Nient'altro della sessione cambia.

**Impostazioni nuove** (in `Settings`, non costanti nel codice):
`trainerIncrementUpperKg: 2.5` · `trainerIncrementLowerKg: 5` · `trainerIncrementDumbbellKg: 2` ·
`trainerIncrementMachineKg: 5` · `trainerDeloadEveryWeeks: 4` · `trainerRpeCap: 9.5`.

**Backup — conseguenza da non dimenticare.** Le quattro tabelle nuove entrano nell'export JSON
e il formato sale a **`formatVersion: 2`**. Oggi l'importatore **rifiuta** un file con
`formatVersion: 2` come «versione più recente» (verificato dal QA): va insegnato ad accettarlo
e a migrare un file **v1 → v2** (che semplicemente non ha le tabelle del Trainer → si importa
con il Trainer vuoto, senza errori). Un backup fatto ieri deve restare importabile domani:
è l'unica rete di sicurezza di quest'app.

### 9.6 v2 — cosa legge ogni schermata nuova

| Schermata | Legge |
|---|---|
| `/home` | `Session[status=active]` · le ultime 10 `Session[status=completed]` (id, nome, data, durata, volume, conteggio PR, i primi 3 `SessionExercise.exerciseName` + conteggio serie) · `TrainerProgram[status=active]` → il giorno di oggi · `Settings.lastExportAt` |
| `Sidebar` | `Session[status=active]` (per la `SessionBar`) · `Settings.lastExportAt` (per il blocco stato locale) · `TrainerProgram` (per il badge «Oggi») |
| `GlobalSearch` | `Exercise[]` (id, name, muscleGroup, equipment) · `Routine[]` (id, name) — tutto in memoria, nessuna query per tasto |
| `/trainer` | `TrainerProgram[status in (active,paused)]` completa · le `Session` collegate ai giorni (per gli stati) · le ultime `ProgressionDecision` del giorno di oggi |
| `/trainer/giorno/[id]` | il `TrainerDay` + le `ProgressionDecision` referenziate dai suoi esercizi |
| `/trainer/progressione` | `ProgressionDecision[programId]` ordinate per `decidedAt` desc, paginate a 50 |
| `/trainer/questionario` | `TrainerProfile` (bozza) · `Exercise[]` (per sapere cosa è generabile con gli attrezzi scelti) |
| `/profilo` — intestazione | **aggregazione su tutte** le `Session[status=completed]`: conteggio, volume, serie, durata. **Non** sulla lista troncata (QA GRAVE 3) |
| `/profilo` — calendario | le `Session[status=completed]` del mese in vista (`startedAt` fra il 1° e l'ultimo giorno), raggruppate per giorno locale — **indice su `startedAt`**, non una scansione |
| `/esercizi` (due pannelli) | `Exercise[]` completa in memoria (~300 voci, trascurabile) · il dettaglio come in v1 |

---

## 10. Consegne al `frontend-engineer`

Ordine di implementazione consigliato — ogni punto è completo abbastanza da non richiedere
invenzioni.

1. **Fondamenta (prima di qualunque componente)**
   - `app/globals.css` con il blocco `:root` di §2.1 e il `@theme inline` di §2.2, **copiati
     alla lettera**. Nessun colore fuori da qui.
   - `app/fonts.ts` di §3.1; `<html lang="it" class="dark">` con `color-scheme: dark`.
   - Utility `.tnum` e la classe `.focus-ring` che applica lo standard di §4.14.
   - `viewport` **senza** `maximum-scale`.
   - Lint rule (o semplice grep in CI): **nessun `#` esadecimale dentro `components/`**.

2. **Primitivi shadcn da installare e ritemare**: `button`, `input`, `dialog`, `sheet`,
   `dropdown-menu`, `popover`, `select`, `checkbox`, `switch`, `tabs`, `toast`/`sonner`,
   `skeleton`, `separator`, `badge`, `scroll-area`. Ogni variante rimappata sui token;
   **il `ring` di default di shadcn va sostituito con `--ring` a 2px e offset 2px**.

3. **Componenti propri, in quest'ordine di priorità**
   `NumberField` (§4.18) → `SetRow` (§4.1) → `ExerciseCard` (§4.2) → `SessionHeader` (§4.3)
   → `RestTimerPill` (§4.4) → `SessionBar` (§4.12) → `BottomNav` (§4.11) → `PRBadge` (§4.5)
   → `EmptyState` (§4.15) → `RoutineCard` (§4.7) → `ExerciseListRow` + filtri (§4.8)
   → `Chart` wrapper Recharts (§4.10) → `MeasureForm` (§4.9) → `PlateVisual` (§6.4).

4. **Regole che non sono negoziabili in fase di build**
   - `#007AFF` non compare mai come colore di testo. Usa `--accent-blue` (`#3E96FF`).
   - Il pulsante primario ha fondo `#1268EC`, non `#1D70F5`: la differenza è di contrasto,
     non di gusto (4.98:1 vs 4.48:1).
   - Ogni `fetch`/lettura Dexie ha i tre stati: `loading` (skeleton), `empty` (§4.15),
     `error` (con azione di uscita). Non se ne salta nessuno.
   - Ogni gesto ha un'alternativa a tocco singolo (§8.7).
   - Ogni animazione esiste nella mappa `prefers-reduced-motion` di §8.6.
   - Le quattro regioni `aria-live` di §8.5 sono montate nel layout root, sempre.
   - **`SetRow` con input non controllati** (§11.6): controllati per keystroke su 40 campi
     è il modo più rapido per rendere la sessione inutilizzabile.
   - Nessun formato di data o numero scritto a mano: `Intl`, locale `it-IT` (§11.4),
     con l'unica eccezione documentata del volume totale.
   - Filtri e intervalli dei grafici **nella query string**, non in `useState` (§11.5).
   - `transition: all` vietato; `touch-action: manipulation`,
     `-webkit-tap-highlight-color: transparent` e `overscroll-behavior: contain`
     impostati come in §11.1.

5. **Il timer si calcola dall'orologio, non dal tick.** `Date.now() - restStartedAt`.
   Un `setInterval` serve solo a ridisegnare, mai a contare.

6. **Fuori scope v1** — non implementare, anche se sembra naturale: condivisione immagine
   del riepilogo, import "unisci", temi multipli, unità in libbre come default, notifiche
   push, qualunque telemetria.

7. **Prima di dichiarare "fatto"**: build + typecheck puliti, il flusso della sessione
   percorso davvero su un telefono reale (375px, tastiera aperta, con `prefers-reduced-motion`
   attivo almeno una volta), e i target misurati — non stimati a occhio.

---

## 10-bis. Consegne v2 al `frontend-engineer`

L'app esiste già e funziona. Questo è un **innesto**, non una riscrittura: l'ordine sotto è
pensato perché a ogni passo l'app resti avviabile.

### Passo 0 — i due difetti del QA che chiudono qui (mezz'ora, fatelo prima di tutto)

1. **QA GRAVE 2** — `domain` su `TrendChart` (`src/components/charts/recharts-impl.tsx:236-243`)
   secondo §4.10-bis. `VolumeBars` (riga ~319) **non si tocca**. I tre punti d'uso sono
   `misure/[metrica]/metrica-view.tsx:161`, `esercizi/[id]/dettaglio-view.tsx:173`,
   `statistiche/statistiche-view.tsx:322`. Aggiungere la riga `Scala: min – max` nel piede e
   il caso «escursione zero».
2. **QA GRAVE 5** — `<main id="contenuto" tabIndex={-1}>` + `<h1>` in
   `src/app/sessione/sessione-view.tsx` e `riepilogo-view.tsx`; il titolo di
   `/impostazioni*` **dentro** il `<main>` di `src/app/impostazioni/layout.tsx:26`. Vedi la
   tabella in §8.9.

Sono due difetti che il design system aveva lasciato senza regola: adesso la regola c'è, e
la verifica è una riga di e2e per rotta.

### Passo 1 — token e guscio

- Aggiungere a `app/globals.css` il blocco `--sidebar-*` / `--rail-right-w` / … di §2.1 e
  `--breakpoint-3col: 1280px` a `@theme inline`. **Nessun colore nuovo.**
- **Cancellare il rail da 240px**: `lg:pl-60` in `src/components/layout/app-shell.tsx:17` e
  tutto il ramo `lg:*` di `src/components/layout/bottom-nav.tsx:38-89`. Non si adatta: si
  sostituisce con un componente nuovo.
- Nuovo `AppShell` a due/tre colonne: `padding-left: var(--sidebar-w)` da 1024,
  `.shell__content` in griglia da 1280 (§7.5). DOM: skip link → `<nav>` → `<main>` → `<aside>`.
- `<BottomNav>` con le cinque tab nuove (§4.11) e `<Sidebar>` (§4.19) — **mai montate
  insieme**, nemmeno nascoste (§8.9).

### Passo 2 — le rotte nuove, vuote ma corrette

`/home`, `/trainer`, `/trainer/questionario`, `/trainer/giorno/[id]`,
`/trainer/progressione`, `/impostazioni/{allenamento,app,dati,info}` (con redirect da
`/impostazioni/backup`). Ognuna con `<main id="contenuto">`, un `<h1>`, titolo di pagina, e
lo stato **empty** già implementato: una rotta nuova che mostra una pagina bianca è un
regresso rispetto a nessuna rotta.

### Passo 3 — componenti, in quest'ordine

`Sidebar` + `LocalStateBlock` (§4.19) → `RightRail` (§4.20) → `WorkoutFeedCard` (§4.21) →
`/home` (§6.7) → `MonthCalendar` (§4.27) → `ProfileHeader`/`StatsTabs` (§4.22) →
`SettingsTwoPane` (§4.28) → `ExerciseTwoPane` (§4.26) → `GlobalSearch` (§4.19.3) →
`TrainerQuestionnaire` (§4.23) → `TrainerDashboard` (§4.24) → `ProgressionReason` (§4.25).

Il Trainer è ultimo di proposito: è l'unico pezzo che ha bisogno di logica nuova, e fino ad
allora tutto il resto è già verificabile.

### Passo 4 — dati

- `Exercise` allargato (§9.4): `Equipment` da 6 a 15 valori, `MuscleGroup` da 6 a 8,
  `family`, `variant`, `mechanics`, `unilateral`, `loadMode`, `stepKgOverride`, `popularity`,
  `videoUrl` (**mai mostrato**). **`nameKey` deve includere l'attrezzo**, o il seed perde voci.
- Nuovo seed da `docs/esercizi-hevy.md`, ~250-300 voci, **idempotente**, che riconosce le
  esistenti per `family`+`equipment` e **non tocca mai `isCustom: true`**.
- Quattro tabelle nuove (§9.5) + `Session.trainerDayId` + le sei impostazioni di incremento.
- **`formatVersion: 2` nel backup**, con import che accetta sia 1 sia 2 e migra 1→2 senza
  errori. Oggi un file v2 viene rifiutato: è una regressione che va tolta **nello stesso
  commit** in cui il formato cambia.
- Indice su `Session.startedAt` per il calendario (non si scansiona per disegnare un mese).

### Passo 5 — regole che non si negoziano in fase di build (in aggiunta a §10.4)

- **Un solo `<main>` e un solo `<h1>` per rotta**, sempre, anche fuori dal guscio.
- **Un solo `<nav aria-label="Navigazione principale">`** nel documento.
- La colonna destra **non** è mai l'unico posto in cui vive un dato: se sparisce a 1279px, è
  un bug (§4.20, §8.10).
- La libreria è **virtualizzata** con `estimateSize` costante; il filtro non mostra skeleton.
- **Nessuna emoji come icona**, in nessun punto: il 🏅 del riferimento diventa `Trophy` + la parola.
- **Nessun video, nessuna miniatura fotografica.** Il campo `videoUrl` esiste nello schema e
  non ha una sola riga di UI che lo legga.
- **Nessuna funzione sociale**: nessun like, commento, follower, condivisione, «atleti
  suggeriti». Se compare in un mockup, è una svista del riferimento, non un requisito.
- La riga del perché del Trainer è **testo visibile**, non un tooltip.
- `ProgressionDecision` si **scrive**, non si ricalcola a ogni render.
- Il carico consigliato del Trainer entra nei campi come **valore**, non come placeholder:
  il Trainer propone, e una proposta che l'utente deve ridigitare non è una proposta.

### Passo 6 — fuori scope v2, anche se sembra naturale

Video di esecuzione · qualunque funzione sociale · temi multipli · sincronizzazione ·
condivisione dell'immagine del riepilogo · import «unisci» · un Trainer che genera in base a
qualcosa che non siano i dati locali dell'utente · notifiche push · telemetria.

### Passo 7 — prima di dire «fatto»

Oltre a §10.7: il **questionario percorso davvero** dall'inizio alla fine su 375px, un
allenamento del Trainer registrato e la card «Cosa cambia la prossima volta» letta; il
calendario navigato **con la sola tastiera**; la libreria con 300 voci scorsa a 1440 e a 375;
e `axe` ripassato sulle rotte nuove **e** su `/sessione`, che finalmente deve dare zero.

---

## 11. Conformità Web Interface Guidelines

Verificato contro le Web Interface Guidelines (vercel-labs, `command.md`). Le voci qui sotto
sono quelle che le linee guida coprono e che il resto del documento non aveva ancora fissato
con un valore. Sono **vincolanti quanto i token**.

### 11.1 Tocco e gesti (regole globali di CSS)

```css
/* layout root */
* { -webkit-tap-highlight-color: transparent; }   /* il feedback lo dà --surface-hover, non il flash del browser */
button, a, [role="button"], input, label { touch-action: manipulation; } /* niente ritardo da doppio tap */
[data-sheet], [data-dialog], [data-scroll-area] { overscroll-behavior: contain; }
```
- Durante il drag di riordino: `user-select: none` sul contenitore e `inert` sulle card non
  trascinate.
- **`autoFocus` è vietato su telefono.** All'ingresso in `/sessione` nessun campo prende il
  focus automaticamente: aprirebbe il tastierino coprendo metà schermo prima che l'utente
  abbia deciso da dove partire. Su `--bp-lg`+ il campo KG della prima serie non completata
  riceve il focus al mount di `/sessione`, e solo lì.

### 11.2 Tema e chrome del browser

```html
<html lang="it" class="dark" style="color-scheme: dark">
<meta name="theme-color" content="#0B0C0E">
```
- Il `theme-color` **coincide con `--background`**, così la status bar iOS e la barra
  Android non stonano; stesso valore in `manifest.json` (`background_color` e `theme_color`).
- Il `<select>` dell'RPE è nativo: va forzato con `background-color: var(--input); color:
  var(--text-primary)` — altrimenti su Windows in tema scuro rende bianco su bianco.

### 11.3 Testo: dettagli tipografici

- **Puntini di sospensione**: sempre `…` (un carattere), mai `...`. Vale per gli stati di
  caricamento (`Importo…`, `Leggo il backup…`) e per il troncamento.
- **Virgolette**: caporali italiani `«…»` per i nomi citati nei dialog (`Eliminare «Push A»?`),
  mai `"`.
- **Spazi non separabili**: `80&nbsp;kg`, `1:28&nbsp;min`, `8&nbsp;serie`. Il separatore
  delle migliaia è lo **spazio stretto non separabile** `&#8239;` → `4 280 kg`. Un numero non
  si deve mai spezzare dall'unità a fine riga.
- **`text-wrap: balance`** su `h1`, `h2`, `h3` e sui titoli degli `EmptyState`;
  **`text-wrap: pretty`** sui paragrafi di `body` (evita la riga orfana di una parola).
- **`translate="no"`** su: il nome `Lifted`, i glifi `W` / `D` / `F`, la sigla `RPE`, `1RM`,
  `PR`, e i nomi di esercizio personalizzati — la traduzione automatica li rovinerebbe.
- **`scroll-margin-top: calc(72px + var(--space-5))`** su ogni heading che è bersaglio di un
  ancora, così l'header sticky di sessione non lo copre.

### 11.4 Localizzazione dei formati

**Niente formati scritti a mano.** Tutti i numeri e le date passano da `Intl`, locale `it-IT`:

```ts
const kg   = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });          // 82,5
const vol  = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });          // 4.280 → vedi nota
const day  = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });  // 14 set
const full = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeStyle: "short" });
const rel  = new Intl.RelativeTimeFormat("it-IT", { numeric: "auto" });             // 3 giorni fa
```
> **Nota sul volume**: `it-IT` usa il punto come separatore delle migliaia (`4.280`), che in
> un'app di pesi si confonde col decimale. Per il **solo volume totale** si usa
> `useGrouping: false` e si inserisce a mano lo spazio stretto: `4 280`. È l'unica eccezione
> a `Intl`, ed è documentata qui perché altrimenti sembra una svista.

### 11.5 Stato nell'URL

Tutto ciò che è stato di vista sta nella query string, non in `useState`:
- `/esercizi?q=panca&muscolo=petto&attrezzo=bilanciere`
- `/statistiche?intervallo=3m&metrica=volume`
- `/misure/bodyweight?intervallo=1a`
- `?tool=warmup|plates`, `?picker=exercise` (§6.1)

Conseguenza: i filtri sono condivisibili, il tasto Indietro li annulla uno alla volta, e
ricaricare non azzera la vista. Consigliato `nuqs`; la decisione della libreria è
dell'ingegnere, il requisito no.

Tutti i link di navigazione sono `<Link>`/`<a>` reali (Cmd+click e tasto centrale devono
funzionare a 1440). Nessun `<div onClick>` in tutta l'app.

### 11.6 Prestazioni

- **`SetRow` usa input non controllati** (`defaultValue` + `onBlur`), non controllati per
  keystroke. In sessione ci possono essere 40 campi montati: un re-render dell'albero a ogni
  tasto è il modo più veloce per rendere l'app inutilizzabile con i guanti.
  Lo stato canonico è Dexie; il campo si sincronizza su `blur` e sul check.
- **Nessuna lettura di layout in render** (`getBoundingClientRect`, `offsetHeight`,
  `scrollTop`). Lo `scrollIntoView` al focus va in un `useEffect`/callback ref.
- **Virtualizzazione obbligatoria** sopra le 50 voci: libreria esercizi, storico sessioni,
  elenco voci di una misura. Alternativa accettabile per le liste medie: `content-visibility: auto`
  con `contain-intrinsic-size` pari all'altezza di riga (`--row-list`), che evita anche il CLS.
- **`transition: all` è vietato.** Sempre l'elenco esplicito: `transition: transform var(--dur-1) var(--ease-tap), opacity var(--dur-1) var(--ease-out);`
- **`transform-origin` dichiarato** su ogni elemento che scala: `center` per il check e i
  bottoni, `bottom center` per lo sheet.
- **SVG del bilanciere**: le trasformazioni vanno sul `<g>` wrapper con
  `transform-box: fill-box; transform-origin: center`.
- I font sono gestiti da `next/font` (self-hosted, `display: swap`, preload automatico):
  **nessun `<link>` a Google Fonts**, nessun `preconnect` a domini esterni. L'app è offline-first.
- **Nessuna immagine raster** nel prodotto: le uniche immagini sono le icone PWA del
  manifest e sono SVG/PNG dichiarate lì. Ogni `<img>` che dovesse comparire porta `width` e
  `height` espliciti.

### 11.7 Sicurezza di idratazione

- I campi con `value` hanno sempre `onChange`; dove sono non controllati si usa `defaultValue`.
- **Le date non si formattano durante il render del server**: cronometro, "3 giorni fa" e
  ogni valore derivato da `Date.now()` si calcolano dopo il mount. In SSR si renderizza il
  placeholder della stessa larghezza (`--:--`), così non c'è né mismatch né CLS.
  In pratica tutta l'app è client-side (dati in IndexedDB): il rischio è limitato al layout
  statico, ma la regola resta.

### 11.8 Form — voci che mancavano

- **Il pulsante di submit resta abilitato finché la richiesta non parte.** Un `Salva`
  disabilitato perché il form "non è ancora valido" nasconde all'utente il perché: si
  preme, si validano tutti i campi, si mostra il riepilogo errori e il focus va lì.
  (L'unica eccezione già dichiarata è `AVVIA` su una routine vuota, §4.7, che ha il testo
  di aiuto accanto.)
- **`onPaste` non viene mai bloccato.** Nessun campo di questa app ha ragione di farlo.
- **Checkbox e radio condividono un unico bersaglio con la propria label** (`<label>` che
  avvolge il controllo): nessuna zona morta tra il quadratino e il testo.
- **Placeholder**: mostrano un esempio, e se sono un'istruzione finiscono con `…`
  (`Cerca un esercizio…`, `Nota per questo esercizio…`).
- **`beforeunload`**: non si usa in sessione (i dati sono già scritti, §6.6). Si usa **solo**
  nell'**editor routine** con modifiche non salvate, perché lì la scrittura avviene al
  `Salva` e non a ogni tasto.

### 11.9 Gestione del contenuto lungo

- Ogni figlio flex che contiene testo troncabile porta **`min-w-0`** — senza, `truncate` non
  ha effetto e la riga sfonda in orizzontale.
- Nomi di esercizio e di routine: `truncate` a una riga nelle liste, **testo intero nel
  dettaglio** (mai solo in un `title` o in un tooltip: sarebbe un'affordance solo-hover).
- Note di esercizio e di sessione: `line-clamp-3` con `Mostra tutto`.
- Il sistema deve reggere tre lunghezze reali: `Curl`, `Panca piana con bilanciere`,
  `Rematore con bilanciere presa inversa a busto flesso 45 gradi`. La terza va testata.

### 11.10 Copy — convenzione italiana

Le linee guida prescrivono il *Title Case* di Chicago: **non si applica all'italiano**, dove
produce un risultato sbagliato. La convenzione di Lifted è:
- **Maiuscola solo sulla prima parola** in titoli e pulsanti (`Crea routine`, non `Crea Routine`).
- **Etichette specifiche**, mai generiche: `Esporta backup`, non `Continua`; `Termina
  l'allenamento`, non `OK`.
- **Voce attiva, seconda persona**: "Esporta i tuoi dati", non "I dati possono essere esportati".
- **Numeri in cifre**: `8 serie`, non `otto serie`.
- **Ogni errore dice cosa fare**, non solo cosa è andato storto (§5.3 rispetta già la regola:
  "Spazio esaurito. **Esporta un backup e libera spazio.**").
- Le maiuscole integrali restano solo dove sono un token tipografico: `TERMINA`, `AVVIA`, e
  le intestazioni di colonna in `label` — sono maiuscoletto spaziato, non enfasi.

---

### Nota metodologica sui contrasti

Tutti i rapporti in questo documento sono calcolati con la formula WCAG 2.x
(`(L1 + 0.05) / (L2 + 0.05)`, luminanza relativa sRGB con linearizzazione a 2.4), arrotondati
a due decimali per difetto. Chi li riverifica deve ottenere gli stessi numeri; se non li
ottiene, il colore nel codice è cambiato e il documento va riallineato prima del merge.
