# fitcoach — Sistema di design (fase 6b)

Data: 2026-09-16 · Autore: ui-ux-designer · Input: `direzione-visiva.md` (approvata, con la decisione sul nome), `brief.md` (§5, §7, §11, emendamenti), `business-model.md` (§5, §6, §10), `competitors.md` (§4, §5), `CLAUDE.md`.

Questo documento trasforma la direzione in **numeri**. Non decide il carattere: lo prende da `direzione-visiva.md` e lo rende implementabile senza inventare nulla. Ogni valore è un token CSS; un hex o un px scritto dentro un componente è un bug.

**Il sistema in una riga:** *carta, inchiostro, evidenziatore — due famiglie con due ruoli (l'app parla in Archivo, il coach in Newsreader), due raggi (zero e pieno), nessuna ombra, e una nota in apice su ogni numero che il motore ha deciso.*

---

## 0. Decisioni prese qui (e perché)

Punti in cui la direzione lasciava un margine o entrava in conflitto con una soglia. Le ho chiuse così:

| # | Decisione | Perché |
|---|---|---|
| D1 | **L'apice della nota ha target 44 px in altezza e ≥ 32 px in larghezza**, non 44×44. | Due apici nella stessa riga (`3 × 8¹ · 90″²`) distano ~36 px: due hit-box da 44 si sovrapporrebbero e il tap diventerebbe ambiguo. WCAG 2.5.8 (AA) chiede 24×24 e ammette l'eccezione per i target in linea nel testo; il nostro 44×32 la supera. **Ogni nota è comunque raggiungibile da un target 44×44 pieno**: la riga "Note 1–2" in seduta e l'apparato in fondo a ogni schermata. È l'unica eccezione alla regola 44×44 del sistema ed è dichiarata. |
| D2 | **Il RIR si chiede nel foglio del timer, non nella riga del set.** | La riga resta esattamente il ritmo Hevy (precedente · peso · rip · check) e a 375 px non ci sta un quinto campo tappabile. Il timer si apre comunque al check: la domanda "quante ne avevi ancora?" sta lì, pre-selezionata sul RIR target del piano, un tap. Convenzione "RIR per set" rispettata senza rallentare la riga. |
| D3 | **Le serie cambiate dalla readiness portano un'etichetta di testo** ("oggi: 2 serie invece di 3") oltre all'evidenziatore. | L'evidenziatore su bianco è 1,3:1: non può identificare da solo (direzione §5). Vale in ogni uso del giallo: ha sempre un bordo inchiostro, un numero, o una parola accanto. |
| D4 | **Due scale tipografiche selezionate per schermata, non per viewport.** `data-scale="palestra"` su seduta, readiness e timer; `scrivania` ovunque altro, a qualunque larghezza. | La distanza di lettura dipende da cosa stai facendo, non dallo schermo: la seduta a 1440 px la guardi comunque da lontano col telefono appoggiato. |
| D5 | **Il nome esercizio in seduta è a 28 px (1,65× il corpo), sotto la forbice 1,8–2,2× della direzione.** | A 32 px "Rematore con manubrio" non entra in 343 px senza andare a capo due volte. L'H1 delle altre schermate resta nella forbice (30 px su corpo 16). |
| D6 | **Navigazione a parole, senza icone**, sia nelle tab mobile sia nel rail desktop. | Coerente con "sotto il neon le azioni sono parole" e toglie la decisione di un set di icone. Il sistema usa quattro glifi SVG in tutto (check, chiudi, chevron, link esterno), tutti con nome accessibile. |
| D7 | **Tema scuro: non esiste.** `color-scheme: light` dichiarato; `prefers-color-scheme: dark` ignorato deliberatamente. | Direzione §3. Chi lo chiede riceve il chiaro senza inversioni automatiche del browser (`color-scheme` evita form control scuri su fondo chiaro). |
| D8 | **Nota 1 del logotipo** riscritta per `fitcoach¹`. | Il gioco ancóra/àncora decade con la decisione dell'utente. Testo in §10. |
| D9 | **Verifica email non bloccante.** Si entra in onboarding subito dopo la registrazione; la verifica è un avviso in Account finché non è fatta. | Il tempo al primo valore (piano pronto in 2 minuti) è la metrica della landing. Un link da cliccare prima del form la raddoppia. |
| D10 | **Font via `next/font/local`** con i TTF variabili nel repo. | Self-hosting obbligatorio (direzione §4). `next/font/local` genera da solo le metriche di fallback (`size-adjust`, `ascent-override`) che azzerano il CLS: non le invento a mano. |

---

## 1. Token

Tutti i token vivono in `:root` (file `frontend/src/styles/tokens.css`). Nomi per **ruolo**, mai per valore. Il frontend importa questo file e non scrive mai un colore o una misura altrove.

### 1.1 Colore

| Token | Valore | Ruolo |
|---|---|---|
| `--paper` | `#F4F4F1` | Fondo della pagina. |
| `--surface` | `#FFFFFF` | Superfici che contengono dati: riga del set, cella settimana, scheda studio, foglio della nota, composer. |
| `--ink` | `#17181A` | Testo, numeri, pulsante primario, check fatto, anello di focus, bordi degli input. |
| `--text-muted` | `#5C5F63` | Testo secondario: "precedente", etichette, contatore quota, metadati della nota. |
| `--rule` | `#D9DAD5` | Filetti di tabella e separatori. **Mai** come bordo di un controllo (vedi contrasti). |
| `--highlight` | `#FFDD57` | **Solo sfondo, mai testo, mai da solo.** Apice della nota, cella "oggi", serie cambiate, scelta selezionata. |
| `--danger` | `#B3261E` | Solo blocco di sicurezza (filetto) e azioni distruttive (recesso, cancella account). Mai per seduta saltata, quota, mantenimento. |
| `--scrim` | `rgb(23 24 26 / 0.48)` | Velo dietro il foglio della nota su mobile e dietro il dialogo di conferma. Non è un'ombra: serve a chiudere il contesto modale. |
| `--on-ink` | `#FFFFFF` | Testo su `--ink` (pulsante primario, pillola Pro, toast). |
| `--on-danger` | `#FFFFFF` | Testo su `--danger` (pulsante distruttivo). |

**Contrasti verificati** (formula WCAG 2.x sui valori finali; luminanze: carta 0,903 · bianco 1,000 · inchiostro 0,0091 · grafite 0,1136 · riga 0,697 · evidenziatore 0,737 · attenzione 0,1106):

| Coppia (testo/fondo) | Rapporto | Uso | Esito |
|---|---|---|---|
| `--ink` / `--surface` | **17,8:1** | Testo e numeri su bianco | AAA |
| `--ink` / `--paper` | **16,1:1** | Testo su carta | AAA |
| `--text-muted` / `--surface` | **6,4:1** | Secondario su bianco | AA (AAA per testo ≥ 18,7 px) |
| `--text-muted` / `--paper` | **5,8:1** | Secondario su carta | AA |
| `--ink` / `--highlight` | **13,3:1** | Numero dell'apice, testo nella cella oggi e nella scelta selezionata | AAA |
| `--text-muted` / `--highlight` | 4,8:1 | **Non usato**: sull'evidenziatore va solo `--ink` | — |
| `--on-ink` / `--ink` | **17,8:1** | Pulsante primario, pillola Pro, toast | AAA |
| `--danger` / `--surface` | **6,5:1** | Testo "Recedi dal contratto qui", filetto del blocco sicurezza | AA (3:1 non-testo superato) |
| `--danger` / `--paper` | **5,9:1** | Idem su carta | AA |
| `--on-danger` / `--danger` | **6,5:1** | Pulsante distruttivo | AA |
| `--ink` / `--rule` | 12,6:1 | Testo su skeleton/disabilitato | AAA |
| `--text-muted` / `--rule` | 4,6:1 | Testo di un pulsante disabilitato (fondo riga) | AA (non richiesto per disabilitati, rispettato comunque) |
| `--highlight` / `--surface` | **1,3:1** | Evidenziatore su bianco | **Fallisce 3:1 → mai indicatore unico** |
| `--highlight` / `--paper` | 1,2:1 | Evidenziatore su carta | Idem |
| `--rule` / `--surface` | 1,4:1 | Filetto su bianco | Fallisce 3:1 non-testo → **solo separatore decorativo, mai bordo di controllo** |
| `--surface` / `--paper` | 1,1:1 | Bianco su carta | Le superfici si distinguono per filetto e posizione, non per contrasto. È voluto. |
| `--ink` 2 px (focus) / `--paper` | 16,1:1 | Anello di focus | Supera 3:1 |

**Regole d'uso derivate**
- Bordi di input, pulsante secondario, pillola di scelta non selezionata: `--ink` (1 px) o `--text-muted` (1 px, 6,4:1). Mai `--rule`.
- Ogni uso di `--highlight` ha almeno uno tra: bordo `--ink` di 1–2 px, un numero in `--ink`, una parola in `--ink`. Lo stato che comunica esiste anche in scala di grigi.
- Nessun gradiente, nessuna trasparenza salvo `--scrim`, nessuna ombra.

### 1.2 Tipografia

**Famiglie e fallback**

```css
--font-ui: "Archivo", "Arial Narrow", Arial, system-ui, sans-serif;
--font-voice: "Newsreader", Georgia, "Times New Roman", serif;
```

- Archivo variabile, assi `wght` 100–900 e `wdth` 62–125. Caricare **un solo file** con entrambi gli assi (`Archivo[wdth,wght].ttf` + corsivo se serve: in v1 non serve, il corsivo è solo Newsreader).
- Newsreader variabile, assi `wght` 200–800 e `opsz` 6–72, **due file**: romano e corsivo (`Newsreader[opsz,wght].ttf`, `Newsreader-Italic[opsz,wght].ttf`).
- Setup: `next/font/local` con `display: 'swap'`, `adjustFontFallback` attivo (default) per Archivo → Arial e Newsreader → Georgia; `preload: true` solo per Archivo (è il primo testo visibile); Newsreader `preload: false`. Nessuna richiesta a `fonts.googleapis.com`: i file stanno in `frontend/public/fonts/` o accanto al modulo.
- Subset: `latin` + `latin-ext` (accenti italiani, «virgolette basse», ′ ″). **Verifica del frontend-engineer:** che Archivo renda U+2032 (′) e U+2033 (″) senza fallback. Se manca il glifo, si scrive `2 min` e `90 s` in tutta l'app (non un font di fallback per due glifi).
- Numeri: `font-variant-numeric: tabular-nums` su ogni token `--fs-numero*` e sulle celle di tabella. Decimali con la virgola (`62,5 kg`), mai col punto.

**Le due scale.** Selezionate con `[data-scale="palestra"]` sul contenitore delle schermate seduta, readiness e sul timer; `scrivania` è il default di `:root`.

| Gradino | Token | Scrivania (default) | Palestra | Famiglia · peso · larghezza/ottica | Interlinea | Tracking |
|---|---|---|---|---|---|---|
| Numero | `--fs-numero` | 56 px | 60 px | Archivo · 900 · `wdth 125` · tnum | 1,0 | 0 |
| Numero, taglia riga | `--fs-numero-riga` | 24 px | 28 px | Archivo · 800 · `wdth 110` · tnum | 1,0 | 0 |
| Titolo | `--fs-titolo` | 30 px | 28 px | Archivo · 700 · `wdth 100` | 1,15 | −0,01em |
| Voce | `--fs-voce` | 18 px | 19 px | Newsreader · 400 · `opsz` auto | 1,55 | 0 |
| Corpo | `--fs-corpo` | 16 px | 17 px | Archivo · 500 · `wdth 100` | 1,5 | 0 |
| Nota | `--fs-nota` | 14 px | 15 px | Newsreader · 400 · `opsz 10` (forzata) | 1,45 | 0 |
| Etichetta | `--fs-etichetta` | 12 px | 13 px | Archivo · 600 · maiuscolo | 1,2 | +0,08em |
| Display (solo landing H1 e titolo prezzi) | `--fs-display` | 40 px @375 · 52 px @768 · 64 px @1440 | — | Archivo · 700 · `wdth 100` | 1,05 | −0,02em |

Perché la Nota su palestra è 15 e non 14: è il "pavimento più alto in seduta" chiesto dalla direzione; a 40 cm con gli occhiali appannati 14 px in serif è al limite.

```css
:root {
  --fs-numero: 56px; --fs-numero-riga: 24px; --fs-titolo: 30px; --fs-voce: 18px;
  --fs-corpo: 16px; --fs-nota: 14px; --fs-etichetta: 12px;
  --fs-display: clamp(40px, 2.5rem + 3vw, 64px);
  --lh-numero: 1; --lh-titolo: 1.15; --lh-voce: 1.55; --lh-corpo: 1.5; --lh-nota: 1.45; --lh-etichetta: 1.2;
  --ls-titolo: -0.01em; --ls-etichetta: 0.08em; --ls-display: -0.02em;
  --wdth-numero: 125; --wdth-numero-riga: 110; --wdth-ui: 100;
  --opsz-nota: 10;
}
[data-scale="palestra"] {
  --fs-numero: 60px; --fs-numero-riga: 28px; --fs-titolo: 28px; --fs-voce: 19px;
  --fs-corpo: 17px; --fs-nota: 15px; --fs-etichetta: 13px;
}
```

**Classi di testo** (una per gradino, il frontend non compone mai font a mano):

| Classe | Regole |
|---|---|
| `.t-numero` | `font: 900 var(--fs-numero)/var(--lh-numero) var(--font-ui); font-variation-settings: "wdth" var(--wdth-numero); font-variant-numeric: tabular-nums;` |
| `.t-numero-riga` | come sopra con `--fs-numero-riga`, peso 800, `wdth` 110 |
| `.t-titolo` | `font: 700 var(--fs-titolo)/var(--lh-titolo) var(--font-ui); letter-spacing: var(--ls-titolo);` `text-wrap: balance` |
| `.t-voce` | `font: 400 var(--fs-voce)/var(--lh-voce) var(--font-voice); font-optical-sizing: auto;` `text-wrap: pretty` |
| `.t-voce em` | Newsreader corsivo 400 — il "cosa non dice" |
| `.t-voce .num` | numeri citati dal coach: `font-family: var(--font-ui); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 0.95em` — "un fatto, non un'opinione" |
| `.t-corpo` | `font: 500 var(--fs-corpo)/var(--lh-corpo) var(--font-ui)` |
| `.t-corpo-strong` | idem, peso 600 |
| `.t-nota` | `font: 400 var(--fs-nota)/var(--lh-nota) var(--font-voice); font-variation-settings: "opsz" var(--opsz-nota);` |
| `.t-etichetta` | `font: 600 var(--fs-etichetta)/var(--lh-etichetta) var(--font-ui); text-transform: uppercase; letter-spacing: var(--ls-etichetta);` |
| `.t-display` | `font: 700 var(--fs-display)/1.05 var(--font-ui); letter-spacing: var(--ls-display); text-wrap: balance` |

Misura di lettura: `--measure-voice: 62ch` (paragrafi del coach, stati vuoti, note), `--measure-ui: 72ch`.

### 1.3 Spazio

Scala a base 4. Nessun valore fuori scala.

| Token | px | Dove tipicamente |
|---|---|---|
| `--space-1` | 4 | Gap tra apice e numero; tra pillole RIR |
| `--space-2` | 8 | Gap minimo tra target; padding interno pillole; separatore " · " |
| `--space-3` | 12 | Gap tra i campi della riga del set; padding verticale della riga |
| `--space-4` | 16 | Margine di pagina a 375; padding delle celle |
| `--space-5` | 20 | Padding del composer |
| `--space-6` | 24 | Tra un esercizio e il successivo; padding foglio nota |
| `--space-8` | 32 | Margine di pagina a 768; tra messaggi del coach |
| `--space-10` | 40 | Sopra il titolo di uno stato vuoto (mobile) |
| `--space-12` | 48 | Tra sezioni di landing (mobile); padding pannello note desktop |
| `--space-16` | 64 | Sopra il titolo di uno stato vuoto (desktop); altezza barra tab |
| `--space-20` | 80 | Tra sezioni di landing (desktop) |
| `--space-24` | 96 | Sopra l'apertura landing (desktop) |

Misure fisse derivate:

| Token | Valore | Ruolo |
|---|---|---|
| `--target` | 44 px | Minimo di ogni target interattivo (altezza e larghezza) |
| `--target-gym` | 56 px | Altezza dei target in seduta (check, campi, pulsanti del timer) |
| `--gap-target` | `--space-2` | Distanza minima tra due target adiacenti |
| `--nav-h` | 64 px | Barra tab mobile (+ `env(safe-area-inset-bottom)`) |
| `--rail-w` | 200 px | Rail di navigazione desktop |
| `--chat-w` | 400 px | Colonna chat desktop |
| `--panel-w` | 400 px | Pannello note / dettaglio desktop |
| `--timer-h` | 160 px | Foglio del timer (+ safe-area) |
| `--container-lg` | 1120 px | Contenitore landing e pagine pubbliche |
| `--container-app` | 1360 px | Contenitore app a 1440 (rail + tabella + chat) |

### 1.4 Raggi, bordi, ombre

```css
--radius-0: 0;        /* tutto: righe, celle, pannelli, pulsanti, input, fogli */
--radius-full: 999px; /* solo: apice della nota, pillola Pro, pillole di scelta e RIR */
--border-1: 1px;      /* filetti, bordi di input e pulsante secondario */
--border-2: 2px;      /* selezionato, focus, bordo superiore dei fogli */
--border-3: 3px;      /* barra della voce di navigazione corrente, filetto del coach */
--shadow: none;       /* esiste solo per dire che non esiste */
```

Nessun terzo raggio. Un `border-radius: 8px` in un componente è un bug di sistema.

### 1.5 Movimento

```css
--dur-1: 150ms;  /* timbro del set fatto; uscita di fogli e pannelli */
--dur-2: 200ms;  /* entrata di fogli (nota, timer) e pannello desktop */
--dur-3: 300ms;  /* passata dell'evidenziatore sulle serie cambiate */
--stagger: 40ms; /* sfalsamento tra righe della passata, max 5 righe */
--ease-out: cubic-bezier(0.2, 0, 0, 1);   /* entrate */
--ease-in:  cubic-bezier(0.4, 0, 1, 1);   /* uscite, sempre più corte delle entrate */
```

Solo `transform` e `opacity`. Nessun `height`, `width`, `top` animato. Con `prefers-reduced-motion: reduce` tutte le durate diventano `0ms` (mappa in §7). Nessun'altra animazione esiste: niente shimmer sugli skeleton, niente contatori che salgono, niente scroll-reveal in landing.

### 1.6 Z-index

| Token | Valore | Cosa |
|---|---|---|
| `--z-base` | 0 | Contenuto |
| `--z-sticky` | 10 | Intestazione esercizio fissa in seduta; intestazione tabella desktop |
| `--z-timer` | 20 | Foglio del timer (non modale) |
| `--z-nav` | 30 | Barra tab mobile, rail desktop |
| `--z-scrim` | 40 | Velo |
| `--z-sheet` | 41 | Foglio della nota (mobile), pannello note (desktop), foglio Sostituisci |
| `--z-toast` | 50 | Annunci |
| `--z-dialog` | 60 | Dialogo di conferma distruttiva |

### 1.7 Breakpoint e griglia

| Token | Valore | Cosa cambia |
|---|---|---|
| base | 375 px | Una colonna, tab in basso, margine `--space-4` |
| `--bp-md` | 768 px | Margine `--space-8`; readiness e stati vuoti con scelte affiancate; tabella settimana visibile |
| `--bp-lg` | 1024 px | Layout desktop: rail sinistro, tab in basso sparisce, colonna chat a lato della settimana |
| `--bp-xl` | 1440 px | Contenitore a `--container-app`, il pannello note ha spazio proprio senza coprire la chat |

Media query mobile-first (`min-width`). Niente larghezze fisse in px sui contenitori sotto 1024: `max-width` + `width: 100%`.

---

## 2. Componenti

Per ogni componente: anatomia, misure, tutti gli stati, nome accessibile. "Stato" significa: default, hover, focus-visible, active, disabled, loading, error, empty — dove uno non si applica lo dico.

**Regole trasversali**
- `:hover` non aggiunge mai informazione: solo rinforzo (sottolineatura o inversione). Tutto ciò che si vede in hover si vede anche senza.
- `:focus-visible`: `outline: var(--border-2) solid var(--ink); outline-offset: 2px;` ovunque. Su superfici `--ink` (pulsante primario, toast): `outline-color: var(--on-ink); outline-offset: -4px`. Mai `outline: none` senza sostituto.
- `:active`: `transform: scale(0.98)` a `--dur-1` sui pulsanti; con reduced-motion nessuna trasformazione.
- Disabilitato: `--rule` di fondo, `--text-muted` di testo, `cursor: not-allowed`, `aria-disabled="true"` (non `disabled` quando il pulsante deve restare leggibile allo screen reader e spiegare perché — es. "Costruisci il blocco 2" in free resta attivo e porta al paywall; non esiste un pulsante disabilitato "per marketing").
- Loading: il pulsante mantiene larghezza, il testo diventa il verbo al presente ("Salvo…", "Carico…"), `aria-busy="true"`, nessuno spinner.
- Errore: testo in `--ink` (non rosso) sotto il controllo, preceduto dalla parola "Errore:" per lo screen reader (`role="alert"` solo sul riepilogo del form, non su ogni campo); bordo del controllo passa a `--border-2` `--ink`. Il rosso non è per gli errori di form.

### 2.1 La Nota (elemento firma)

Quattro parti: **Apice**, **Foglio**, **Scheda studio**, **Apparato**.

#### 2.1.1 Apice

- Elemento: `<button type="button" class="nota-apice" aria-label="Nota 1: recupero di due minuti tra le serie" aria-expanded="false" aria-controls="nota-1" data-nota="1">1</button>`. Il nome accessibile è **"Nota N: " + titolo breve della regola** (fornito dal backend, campo `note.title_it`).
- Visivo: numero in Archivo 700 tnum, `font-size: 0.62em` del testo che lo ospita (min 11 px), colore `--ink`, fondo `--highlight`, bordo `var(--border-1) solid var(--ink)`, `border-radius: var(--radius-full)`, padding `0 var(--space-1)`, `min-width: 18px; height: 18px; line-height: 16px`. Posizione: `position: relative; top: -0.55em; margin-left: 2px`. Non è `<sup>`: è un componente.
- Target: `::before { content: ""; position: absolute; inset: -13px -7px; min-width: 32px; min-height: 44px }` → hit-box 44 × ≥32 (decisione D1). Due apici nella stessa riga sono separati da ` · ` con `--space-2` per lato: centri a ≥ 36 px.
- Stati:
  - default: come sopra.
  - hover: il bordo passa a `--border-2` (il fondo giallo non cambia: non è informazione).
  - focus-visible: anello `--ink` 2 px offset 2 px, attorno al glifo (non alla hit-box invisibile).
  - active: `scale(0.96)`.
  - **aperto** (`aria-expanded="true"`): fondo `--ink`, numero `--on-ink`, bordo `--ink`. Inversione: si vede in scala di grigi.
  - disabled: non esiste. Se la nota non c'è, l'apice non c'è (direzione §6, regola 3).
  - loading: non esiste — il contenuto della nota arriva insieme al numero (§9).

#### 2.1.2 Foglio

Contenitore che ospita la Scheda studio. Due presentazioni:

| | Mobile (< 1024) | Desktop (≥ 1024) |
|---|---|---|
| Posizione | Sale dal basso, ancorato al fondo sopra la barra tab | Pannello a destra, `--panel-w`, altezza piena della colonna contenuto |
| Semantica | `role="dialog" aria-modal="true" aria-labelledby` (titolo della scheda). Focus intrappolato, `--scrim` dietro, chiude con Esc, tap sul velo, pulsante "Chiudi". | `<aside role="complementary" aria-labelledby>`, **non modale**: la tabella resta usabile. Focus va al titolo del pannello all'apertura; Esc e "Chiudi" lo riportano all'apice. |
| Superficie | `--surface`, `border-top: var(--border-2) solid var(--ink)`, `padding: var(--space-6)`, `max-height: 80dvh`, scroll interno | `--surface`, `border-left: var(--border-2) solid var(--ink)`, `padding: var(--space-12) var(--space-8)` |
| Entrata | `translateY(100%) → 0` + `opacity 0 → 1`, `--dur-2 --ease-out` | `translateX(100%) → 0` + opacity, `--dur-2` |
| Uscita | Stessa via, `--dur-1 --ease-in` | Idem |
| Chiudi | Pulsante terziario "Chiudi" in alto a destra, 44×44, con glifo × e testo | Idem |
| Focus al ritorno | All'apice che l'ha aperta | All'apice |

Su desktop il pannello **copre la colonna chat** sotto 1440 e ha spazio proprio da 1440 (§4). Non sposta mai la tabella.

#### 2.1.3 Scheda studio (contenuto del Foglio)

Struttura fissa, dall'alto:

1. Etichetta `NOTA 1` (`.t-etichetta`, `--text-muted`) + titolo breve della regola (`.t-corpo-strong`).
2. **Cosa dice** — `.t-voce`, `--ink`. Una o due frasi in italiano (`note.summary_it`).
3. **Cosa non dice** — `.t-voce` in corsivo, preceduto dalle parole "Non dice" in tondo (`note.not_says_it`).
4. Grado dell'evidenza: etichetta `EVIDENZA A` / `B` / `C` con la spiegazione in `.t-nota` ("A: più meta-analisi concordi", ecc. — testo dal backend, `note.grade_label_it`).
5. Citazioni (0…n): ognuna in `.t-nota`: *Autori (anno). Titolo. Rivista.* + link "DOI" (glifo link esterno, `target="_blank" rel="noopener"`, testo accessibile "DOI, si apre in una nuova scheda") + pillola `OPEN ACCESS` in etichetta se `open_access`.
6. Se `note.is_own_note`: al posto dei punti 4–5 la riga in `.t-voce`: **"Nota nostra, non uno studio."** e sotto, in `.t-nota`, il motivo (`note.rationale_it`).
7. Sotto un filetto `--rule`: "Regola `volume.hypertrophy.beginner.weekly_sets`, versione 3, aggiornata il 12/09/2026" in `.t-nota` `--text-muted`. È l'audit trail reso visibile; per chi non lo capisce è rumore innocuo in fondo.

Stati del contenuto: **loading** non esiste (arriva col piano); **error** solo se la nota è referenziata ma il backend non la restituisce: la Scheda mostra "Questa nota non è disponibile adesso. Riprova tra poco." e l'apice resta cliccabile. **empty** non esiste: nessuna nota vuota (regola 3).

#### 2.1.4 Apparato

Lista numerata in coda a ogni schermata che ha ≥ 1 nota (seduta, settimana, chat per messaggio, riepilogo, progressi, prezzi, landing).

- `<section aria-labelledby="apparato-h"><h2 id="apparato-h" class="t-etichetta">Note</h2><ol class="apparato">…</ol></section>`.
- Ogni voce: `<li id="nota-1">` con lo stesso apice (non interattivo qui: `<span class="nota-apice" aria-hidden="true">1</span>`) e la scheda studio **in forma compatta**: cosa dice, "Non dice" in corsivo, autori-anno-rivista, DOI. Un pulsante terziario "Apri" 44×44 apre il Foglio con la scheda completa.
- Tipografia: `.t-nota`, misura `--measure-voice`, `padding-top: var(--space-6)`, `border-top: var(--border-1) solid var(--rule)`.
- Nella chat l'apparato è **per messaggio**: in coda al paragrafo del coach, sotto un filetto `--rule` di larghezza `--space-16`.
- In seduta l'apparato di esercizio è la riga chiusa "Note 1–2" (§2.2.5).

### 2.2 Seduta: intestazione esercizio, riga del set, azioni, riga note

Scala `palestra`. Un esercizio = un blocco `<section aria-labelledby>` su `--surface` con `border-top: var(--border-1) solid var(--ink)` e `border-bottom: var(--border-1) solid var(--rule)`; tra un blocco e il successivo `--space-6` di carta.

#### 2.2.1 Intestazione esercizio

- Riga 1: nome esercizio `.t-titolo` (28 px) come `<h2>`; a destra un pulsante terziario "Come si fa" (44×44 min, testo + chevron) che apre la GIF in un Foglio (stesso componente della nota, `aria-label="Come si fa: Squat con bilanciere"`).
- Riga 2: la prescrizione in `.t-numero-riga` (28 px): `3 × 8¹ · 90″²` con apici veri; a destra il RIR target in `.t-corpo` `--text-muted`: "2–3 in canna".
- Riga 3 (solo se sostituito o cambiato): `.t-etichetta` `--text-muted`: "Sostituito: era Squat con bilanciere" oppure "Oggi: 2 serie invece di 3" con fondo `--highlight` e bordo inchiostro se cambiato dalla readiness (D3).
- **Sticky**: quando il blocco scorre sotto l'intestazione di pagina, compare una barra compatta `position: sticky; top: 0; z-index: var(--z-sticky)` alta 48 px su `--surface` con bordo inferiore `--ink` 1 px: nome in `.t-corpo-strong` + "serie 2 di 3" in `--text-muted`. Non è l'`<h2>` (che resta nel flusso): è `aria-hidden="true"`.

#### 2.2.2 Riga del set

Griglia a 4 colonne, altezza `--target-gym` (56 px) + `padding: var(--space-3) 0`, `border-bottom: var(--border-1) solid var(--rule)` (l'ultima senza).

| Colonna | Larghezza a 375 | Contenuto | Elemento |
|---|---|---|---|
| Precedente | 64 px | `60 × 8` in `.t-corpo` `--text-muted`, tnum; sotto in `.t-etichetta` `--text-muted` "RIR 2" | `<span>` con `aria-label="Precedente: 60 chili per 8 ripetizioni, RIR 2"` |
| Peso | 84 px | `<input type="text" inputmode="decimal" pattern="[0-9]*[,.]?[0-9]*">` valore precompilato dal piano, `.t-numero-riga`, `text-align: center`, bordo `--border-1 --ink`, fondo `--surface`, altezza 56 | `<label class="visually-hidden">Serie 2, peso in chili</label>` |
| Rip | 76 px | `<input type="text" inputmode="numeric">` precompilato, idem | `<label class="visually-hidden">Serie 2, ripetizioni</label>` |
| Check | 56 px | Pulsante 56×56, bordo `--border-2 --ink`, fondo `--surface`, glifo check `--ink` 24 px **vuoto** (solo contorno) | `<button aria-label="Serie 2 fatta" aria-pressed="false">` |

Gap tra colonne `--space-3`. Totale 64+84+76+56+36 = 316 px in 343 disponibili; il resto è margine destro. A 768 le colonne restano uguali (non si dilatano: la riga è un oggetto, non un layout fluido); a ≥ 1024 la seduta occupa una colonna di 480 px max.

Il numero di serie ("1", "2", "3") non ha colonna: è nel nome accessibile e, visivamente, nell'ordine. Se si vuole, una colonna da 20 px `.t-etichetta` all'inizio a 768+.

**Stati della riga** (`data-state` sul `<tr>`/`<div role="row">`):

| Stato | Visivo | Accessibile |
|---|---|---|
| `todo` (da fare) | Come sopra. | — |
| `active` (in corso: la precedente è fatta, questa no) | `border-left: var(--border-3) solid var(--ink)` + `padding-left: var(--space-3)`; nient'altro. Non è un'informazione critica: chi non la vede fa la riga successiva comunque. | `aria-current="step"` |
| `done` (fatta) | Check pieno: fondo `--ink`, glifo `--on-ink`. Input diventano `readonly` con testo `--ink` (non muted: i numeri fatti restano un fatto), bordo `--rule`. Il RIR loggato compare nella colonna Precedente al posto del precedente: "RIR 2" `.t-etichetta`. Timbro: `scale(0.96 → 1)` `--dur-1` sull'intera riga. | `aria-pressed="true"`; annuncio `polite`: "Serie 2 fatta. Riposo: 90 secondi." |
| `skipped` (saltata) | Al posto del check la parola **"Saltata"** `.t-etichetta` `--text-muted`; input `readonly` `--text-muted`. Nessun rosso. | `aria-label="Serie 3 saltata, ripristina"` (il tap ripristina) |
| `changed` (modificata dalla readiness) | Fondo riga `--highlight` **+** etichetta "oggi" in `.t-etichetta` `--ink` accanto al precedente. Passata da sinistra (§7). | `aria-describedby` → la riga del coach della readiness |
| `syncing` | Nessun cambio nella riga; lo stato di rete sta nell'intestazione di pagina (§2.2.6). | — |
| `error` | Se il salvataggio locale (IndexedDB) fallisce — raro: bordo riga `--border-2 --ink` e sotto la riga: "Errore: non sono riuscito a salvare questa serie sul telefono. Riprova." con pulsante terziario "Riprova". | `role="alert"` |
| `disabled` | Non esiste: la seduta non ha righe bloccate. | — |
| `loading` | Skeleton (§2.13) per l'intero blocco esercizio, mai per la singola riga. | — |
| `hover` | Su input e check: bordo `--border-2`. | — |
| `focus-visible` | Anello standard. Su input: bordo `--border-2 --ink` + anello. | — |

Tap sul check di una riga con input vuoti: non è possibile perché i campi sono sempre precompilati (convenzione #4); se l'utente li svuota, il check è comunque attivo e salva `null` → il backend tratta la serie come "fatta senza dati" e il coach può chiederlo. Nessun blocco in seduta.

**"Aggiungi serie"** e **"Togli l'ultima"**: due pulsanti terziari 44 px sotto l'ultima riga, `.t-corpo`, in linea.

#### 2.2.3 Azioni dell'esercizio

Riga sotto le serie, tre pulsanti terziari a parole, 44 px di altezza, gap `--space-4`: **Sostituisci** · **Salta esercizio** · **Note 1–2** (quest'ultimo è la riga note, §2.2.5).

- **Sostituisci** (due tocchi): il primo apre un Foglio (mobile dal basso, desktop pannello) `aria-label="Sostituisci Squat con bilanciere"` con **al massimo 5 alternative** dal backend (`exercise.substitutes[]`: stesso gruppo, stessa attrezzatura disponibile), ognuna una riga 56 px con nome `.t-corpo-strong` e sotto `.t-nota` il perché ("stesso movimento, con manubri"); il secondo tocco sull'alternativa sostituisce e chiude. Le serie restano; il "precedente" passa a quello del nuovo esercizio (o "—" se non c'è). L'intestazione mostra "Sostituito: era …" e un pulsante terziario "Annulla" per 30 secondi (senza countdown visibile: sparisce e basta; con reduced-motion idem).
- **Salta esercizio**: nessuna conferma; tutte le righe passano a `skipped`; il pulsante diventa "Ripristina".

#### 2.2.4 Timer di riposo

Foglio non modale, `position: fixed; bottom: calc(var(--nav-h) + env(safe-area-inset-bottom)); z-index: var(--z-timer)`, altezza `--timer-h` 160 px, `--surface`, `border-top: var(--border-2) solid var(--ink)`, padding `--space-4`. Su desktop: stessa cosa, ancorato al fondo della colonna seduta (480 px), non a tutta la finestra.

Anatomia (due righe):
1. Sinistra: etichetta `RIPOSO` + countdown `.t-numero` a 48 px (override locale `--fs-numero: 48px` solo qui — è l'unico override di scala consentito, ed è documentato) `1:30`. Destra: due pulsanti secondari 56×72 "+30″" e "Salta" (gap `--space-2`).
2. `Quante ne avevi ancora in canna (RIR)?` `.t-corpo` la prima volta; dalla seconda seduta in poi solo `RIR`. Cinque pillole di scelta (§2.8) `0 · 1 · 2 · 3 · 4+`, 44×44 min, quella corrispondente al RIR target **pre-selezionata**; un tap cambia e salva; nessun pulsante conferma.

Comportamento:
- Parte al check; se un timer è già attivo, riparte dal valore della nuova serie.
- Al termine: il countdown mostra `0:00` per 2 s, poi il foglio scende. Vibrazione `navigator.vibrate(200)` se disponibile; nessun suono in v1.
- Il tempo è calcolato su `performance.now()`/timestamp di partenza, non su `setInterval` cumulativo: al ritorno da background (iOS PWA) il valore è giusto.
- Entrata `translateY(100%) → 0` `--dur-2`; uscita `--dur-1`.

Accessibile:
- `<section role="timer" aria-labelledby="timer-h">` con `aria-live="off"` sul numero (mai annunciare ogni secondo).
- Una regione `aria-live="polite"` separata (`#annunci`, unica per la pagina) riceve: all'avvio "Riposo: 90 secondi"; a 10 s dalla fine "Dieci secondi"; alla fine "Riposo finito". Tre annunci, non di più.
- Il focus **non** viene spostato sul timer all'apertura (l'utente è nella lista). Il timer sta nel DOM subito dopo l'intestazione di pagina, prima della lista, così è a due Tab dall'inizio.
- Stati: `running`, `paused` (non esiste in v1: si salta o si aggiunge), `finished`. `disabled` no. `error` no.

#### 2.2.5 Riga "Note 1–2"

Pulsante terziario 44 px `aria-expanded` che espande **in loco** (sotto le azioni dell'esercizio) l'apparato di quell'esercizio: le schede compatte delle note 1–2 in `.t-nota`. Chiuso di default; lo stato aperto/chiuso è per esercizio e non persiste. Nessuna animazione: appare (è un `display` toggle, non un movimento).

#### 2.2.6 Intestazione della pagina seduta e stato di rete

Barra in alto, 56 px, `--paper`, `border-bottom: var(--border-1) solid var(--rule)`:
- Sinistra: "Full Body A" `.t-corpo-strong` + sotto `.t-etichetta` `--text-muted` "Settimana 2 · seduta 2 di 3".
- Destra: pulsante terziario **"Chiudi seduta"** (44 px).
- Sotto il titolo, sempre presente, una riga `.t-etichetta` `--text-muted` con lo **stato di salvataggio**, a parole: `Salvato` / `Salvo…` / `Senza rete · salvo sul telefono` / `Rete tornata · sincronizzo…` / `Errore di sincronizzazione · riprovo`. `aria-live="polite"`, annunciato solo quando cambia tra "senza rete" e "rete tornata" (gli altri passaggi sono `aria-live="off"` per non parlare a ogni set).

**Chiudi seduta**: nessun dialogo se tutte le serie hanno uno stato; se ci sono serie `todo`, un dialogo (§2.12) non distruttivo: "Ci sono 4 serie non fatte. Le segno come saltate e chiudo?" [Chiudi comunque] [Torna alla seduta]. Poi la schermata di chiusura: una riga del coach in `.t-voce` con nota (dal backend, `session.close_line`) e due pulsanti pari: "Vai a Oggi" · "Parla col coach".

### 2.3 Readiness

Schermata intera (rotta propria), scala `palestra`. Titolo `.t-titolo` "Come stai oggi?" Sotto, in `.t-voce`: "Tre domande, dieci secondi. Il piano di oggi si adatta."

Tre gruppi `<fieldset>` con `<legend class="t-corpo-strong">`, ognuno una riga alta con **tre pillole di scelta larghe** (§2.8, variante `wide`): larghezza `calc((100% - 2 * var(--space-2)) / 3)`, altezza 56 px, testo `.t-corpo`.

| Domanda | Scelte (valori inviati) |
|---|---|
| Sonno | `Meno di 6 ore` (`lt6`) · `6–8 ore` (`6to8`) · `Più di 8` (`gt8`) |
| Voglia | `Poca` (`low`) · `Così così` (`mid`) · `Tanta` (`high`) |
| Dolori | `No` (`none`) · `Sì, lieve` (`mild`) · `Sì, forte` (`severe`) |

Sotto, pulsante primario a tutta larghezza **"Vai alla seduta"** (56 px), attivo solo quando le tre risposte ci sono (prima: `aria-disabled` con testo "Rispondi alle tre domande" nel nome accessibile). Sotto, terziario: **"Salta, oggi vado così"**.

Con `severe` → la risposta del backend è il **blocco di sicurezza** (§2.6.5) al posto della riga del coach, e "Vai alla seduta" diventa "Metti in pausa il piano" (secondario) + "Vai comunque alla seduta" (terziario). Nessun paywall, nessun rosso oltre il filetto.

**Dopo l'invio**, sulla stessa schermata, sotto le tre righe: la riga del coach in `.t-voce` (dal backend: `readiness.coach_line` con nota) e l'elenco delle modifiche a parole in `.t-corpo`: "Tolgo lo stacco¹ · Panca: 2 serie invece di 3 · Durata: 25 minuti". Poi "Vai alla seduta". Nella seduta, le righe cambiate hanno stato `changed` con la **passata** (§7.3) e l'esercizio tolto compare in coda come blocco compresso: "Stacco da terra — tolto oggi" + pulsante terziario **"Rimettilo"** (un tap, come promesso dalla direzione).

Stati: `loading` dopo l'invio: il pulsante dice "Adatto la seduta…" `aria-busy`; `error`: "Errore: non sono riuscito ad adattare la seduta. Puoi andare con il piano di oggi così com'è." + [Riprova] [Vai alla seduta]. `empty` non esiste. In **mantenimento** la readiness funziona uguale (corta/riposo sono deterministici).

### 2.4 Chat: messaggio del coach, messaggio dell'utente, composer, badge AI, blocco sicurezza

Scala `scrivania`. La chat è una **pagina**, misura `--measure-voice`, `padding: var(--space-6) var(--space-4)` (mobile) / `var(--space-8)` (desktop).

#### 2.4.1 Badge AI (sempre visibile)

In testa alla colonna chat, `position: sticky; top: 0`, `--paper`, `border-bottom: var(--border-1) solid var(--rule)`, `padding: var(--space-2) 0`. Testo `.t-nota` `--text-muted`: "Parli con un coach AI, non con una persona. Le regole dietro ai numeri le hanno scritte delle persone¹." L'apice apre la nota 1 di sistema (§10). Non si chiude, non si nasconde, non scorre via. `role="note"`.

#### 2.4.2 Messaggio del coach

`<article aria-label="Coach, 21:42">`. Nessuna bolla: paragrafi `.t-voce` con `border-left: var(--border-3) solid var(--ink); padding-left: var(--space-4)`. Sopra, `.t-etichetta` `--text-muted`: `COACH · 21:42`. Tra messaggi `--space-8`.

Contenuto strutturato (dal backend, `message.blocks[]`):
- `paragraph` con apici (le note del messaggio, numerate per messaggio da 1).
- `options` — le tre scelte del "giorno no": pulsanti **secondari** a tutta larghezza, impilati, gap `--space-2`, ognuno con titolo `.t-corpo-strong` e sotto `.t-nota` la descrizione ("25 minuti, 4 esercizi, stessi carichi"). Se una scelta è Pro (mantenimento), la pillola Pro sta **dentro** il pulsante, a destra. Dopo la scelta, i tre pulsanti diventano testo `--text-muted` con la scelta fatta in `--ink` e prefisso "Hai scelto: ".
- `plan_change` — proposta di modifica validata dal motore: tabella compatta (esercizio · da · a) con apici + due pulsanti pari "Applica" · "Lascia com'è". Dopo: "Applicata" / "Non applicata" in etichetta.
- `numbers` — i numeri citati dal coach nel testo usano `.num` (Archivo 600 tnum).
- `apparato` in coda al messaggio (§2.1.4).
- `safety` → §2.4.5.

Stati: `streaming`: il testo arriva progressivamente; sopra l'etichetta `COACH · sta scrivendo` `aria-busy="true"`, nessun puntino animato; a fine stream l'etichetta prende l'ora. `error` (la risposta è fallita): al posto del paragrafo, in `.t-corpo` `--ink`: "Il coach non ha risposto. Il tuo messaggio è salvato: [Riprova]." — il messaggio utente non va perso e non si riconta nella quota (vedi §9). `empty` (nessun messaggio nel thread): non succede — il primo messaggio è sempre il commento al piano; se manca per errore, lo stato vuoto §2.10 "Il coach non ha ancora commentato" con [Chiedi il commento].

#### 2.4.3 Messaggio dell'utente

`<article aria-label="Tu, 21:40">`. `.t-corpo`, `--ink`, allineato a destra, `max-width: 80%`, `margin-left: auto`, nessun filetto, nessun fondo. Sopra: `.t-etichetta` `TU · 21:40` allineata a destra. Stato `sending`: etichetta "invio…"; `failed`: "non inviato · [Riprova]" (in `--ink`, non rosso).

#### 2.4.4 Composer con quota

`position: sticky; bottom: var(--nav-h)` (mobile) / `bottom: 0` (desktop), `--surface`, `border-top: var(--border-1) solid var(--ink)`, padding `--space-5 var(--space-4)`.

- `<label class="visually-hidden" for="composer">Scrivi al coach</label><textarea id="composer" rows="1" placeholder="Scrivi al coach">` che cresce fino a 5 righe, `.t-corpo`, bordo `--border-1 --ink`, `min-height: 44px`. Invio con Enter su desktop (Shift+Enter a capo), pulsante su mobile.
- A destra il pulsante primario **"Invia"** (parola, 44×64).
- Sotto, sempre presente, la **riga della quota** `.t-nota` `--text-muted` `aria-live="polite"`:

| Quota | Testo |
|---|---|
| Pro | `Messaggi illimitati · uso ragionevole 300 al mese` (nessun contatore quotidiano visibile finché non manca 5 al limite giornaliero: "Ti restano 5 messaggi oggi") |
| Free, 0–11 usati | `12 messaggi rimasti questo mese` (numero = limit − used) |
| Free, 12–14 usati | `Ti restano 3 messaggi questo mese. Si azzerano il 1° ottobre.` |
| Free, 15/15 | Il composer **è sostituito** dalla card Pro (§2.5, superficie 2) |

L'annuncio live scatta solo al cambio di fascia (entrando in 12–14 e a 15), non a ogni messaggio.

- Stati: `disabled` mentre un messaggio è in invio (`aria-disabled`, testo "Invio…"); `error` di rete: sotto la quota, "Senza rete. Il messaggio parte appena torna." e il messaggio resta nel campo; `loading` iniziale: skeleton del thread, composer attivo.

#### 2.4.5 Blocco di sicurezza

È un messaggio del coach (`kind: safety`) con **filetto `--danger`** (unico rosso della chat) al posto del filetto inchiostro, testo `.t-voce` `--ink`, testo fisso dal backend. Sotto, due pulsanti secondari pari: "Metti in pausa il piano" · "Togli l'esercizio che fa male" (apre l'elenco esercizi come pillole di scelta) e un terziario "Ho capito". Nessun modale, nessun paywall, nessuna quota consumata. `role="region" aria-label="Avviso di sicurezza"`.

### 2.5 Card Pro / paywall

Un solo componente, `<section aria-labelledby>` su `--surface`, `border: var(--border-2) solid var(--ink)`, padding `--space-6`, con tre contenuti:

| Superficie | Dove | Contenuto | Pulsanti (pari peso: entrambi **secondari**) |
|---|---|---|---|
| 1 · Fine blocco | Schermata §2.10 | Tre numeri + paragrafo | "Costruisci il blocco 2 [Pro]" · "Continua in mantenimento — gratis" |
| 2 · Quota 15/15 | Al posto del composer | `.t-titolo` "15 su 15 messaggi usati." + `.t-voce` "Il coach continua a scriverti lui — commento al piano, giorno no, fine blocco. Per rispondergli prima del 1° ottobre serve Pro." | "Passa a Pro — 9,99 €/mese" · testo `.t-nota` "oppure aspetta il 1° ottobre." (non un pulsante) |
| 3 · Modifica in mantenimento | Dentro un messaggio del coach (`options` con una scelta Pro) | La risposta del coach in `.t-voce` | "Corta" · "Riposo" · "Rinegozia la settimana [Pro]" — tre secondari |

- La pillola Pro (§2.8) sta dentro l'etichetta del pulsante, dopo il testo, `margin-left: var(--space-2)`.
- Tap su una scelta Pro → `/prezzi?da=end_of_block|chat_quota|maintenance_request` (evento `paywall_shown` lo emette il backend quando serve la card; `checkout_started` al tap su "Passa a Pro" nella pagina prezzi).
- Stati: `loading` (verso il checkout): il pulsante dice "Apro il pagamento…"; `error`: "Errore: il pagamento non si è aperto. Riprova, oppure scrivimi a …" (email supporto dal backend `support_email`). `disabled` non esiste. `hover`/`focus` da pulsante secondario.
- **Mai** dentro `/oggi/seduta`, `/onboarding/*`, o dopo un blocco sicurezza. Il frontend lo garantisce per rotta, non per condizione.

### 2.6 Badge Pro e badge "AI" (non interattivi)

- **Pillola Pro**: `<span class="pill-pro">Pro</span>`, `.t-etichetta` 12 px (non scala: è fissa), `--on-ink` su `--ink`, padding `2px var(--space-2)`, `border-radius: var(--radius-full)`, `line-height: 16px`, `height: 20px`. Non interattiva → nessun target minimo. Dove: nei pulsanti Pro, nella tabella prezzi, in Account ("Piano: Pro"), nel rail desktop accanto a "Settimana" quando è editabile. Mai oro, corona, lucchetto.
- **Badge AI**: è la riga di §2.4.1; non esiste come pillola.

### 2.7 Pulsanti

Quattro varianti, angoli vivi, `.t-corpo` peso 600, altezza 44 (scrivania) / 56 (palestra: `--target-gym`), `padding: 0 var(--space-5)`, `min-width: 44px`. La parola è l'etichetta; nessun pulsante solo-icona tranne "Chiudi" (che ha testo + glifo).

| Variante | Default | Hover | Focus-visible | Active | Disabled | Loading |
|---|---|---|---|---|---|---|
| **Primario** | `--ink` fondo, `--on-ink` testo | Testo sottolineato (`text-decoration: underline; text-underline-offset: 3px`) | Anello `--on-ink` interno (offset −4 px) + anello esterno `--ink` offset 2 px sulla carta | `scale(0.98)` | `--rule` fondo, `--text-muted` testo | Testo "Verbo…", `aria-busy` |
| **Secondario** | `--surface` fondo, `--ink` testo, `border: var(--border-1) solid var(--ink)` | Bordo `--border-2` (senza spostare il layout: `box-shadow: inset 0 0 0 1px var(--ink)`) | Anello standard | `scale(0.98)` | Bordo e testo `--text-muted` | Idem |
| **Terziario** | Solo testo `--ink`, `text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px` | Spessore 2 px | Anello standard | — | `--text-muted` | Idem |
| **Distruttivo** | `--danger` fondo, `--on-danger` testo | Sottolineato | Anello `--on-danger` interno | `scale(0.98)` | Come primario disabilitato | Idem |

- Il terziario è **sempre sottolineato**: l'affordance non dipende dal colore né dall'hover.
- Due pulsanti "pari" = due secondari, stessa larghezza (`flex: 1`), gap `--space-2`; a 375 impilati (`flex-direction: column`) se la somma delle etichette supera 40 caratteri, altrimenti affiancati.
- Il pulsante distruttivo compare **solo** in Account (Recedi, Cancella account) e sempre dopo un dialogo (§2.12).
- Link che sembrano pulsanti: `<a>` con la stessa classe; link nel testo: sottolineati, `--ink`.

### 2.8 Pillole di scelta e pillole RIR

Gruppo `role="radiogroup"` o `<fieldset>` con `<input type="radio">` nascosti visivamente e `<label>` visibili (form nativo: funziona con tastiera e screen reader senza JS).

| Stato | Visivo |
|---|---|
| Non selezionata | `--surface`, `--ink` testo `.t-corpo`, `border: var(--border-1) solid var(--text-muted)`, `border-radius: var(--radius-full)`, altezza 44 (56 in `wide`), padding `0 var(--space-4)` |
| Hover | Bordo `--ink` |
| Focus-visible | Anello standard attorno alla pillola |
| **Selezionata** | Fondo `--highlight`, bordo `var(--border-2) solid var(--ink)`, testo `--ink` peso 600. Tre segnali oltre al colore: spessore del bordo, peso del testo, e per lo screen reader `checked`. |
| Disabled | Non usata in v1 |
| Variante `wide` | Larghezza a terzi della riga (readiness), altezza 56 |
| Variante `rir` | Larghezza 44, altezza 44, testo `.t-numero-riga` a 20 px (override locale documentato) |

### 2.9 Input del form onboarding

Cinque schermate + gate sicurezza (§3). Un campo per riga, `max-width: 480px`.

- **Etichetta visibile** sopra il campo, `.t-corpo-strong`; testo d'aiuto sotto l'etichetta in `.t-nota` `--text-muted`; mai placeholder come etichetta (il placeholder è vuoto o un esempio: "es. 45").
- **Testo/numero**: `input` 48 px di altezza (56 su palestra), `padding 0 var(--space-4)`, `--surface`, `border: var(--border-1) solid var(--ink)`, `.t-corpo` (≥ 16 px: iOS non zooma). Focus: bordo `--border-2` + anello. Errore: bordo `--border-2` + riga sotto in `.t-corpo` "Errore: …" collegata con `aria-describedby`; `aria-invalid="true"`. Disabled: `--rule` fondo. Readonly: senza bordo, testo `--ink`.
- **Scelta singola** (obiettivo, livello, luogo): pillole di scelta impilate a tutta larghezza (variante `wide` a 768+ affiancate se ≤ 3).
- **Scelta multipla** (attrezzatura, giorni): `input type="checkbox"` con casella visibile 24×24 (bordo `--ink` 2 px, angoli vivi; selezionata: fondo `--ink`, glifo check `--on-ink`) e etichetta cliccabile, riga 44 px.
- **Giorni a settimana**: pillole `2 · 3 · 4 · 5`, non uno slider.
- **Minuti per seduta**: pillole `30 · 45 · 60 · 75+`.
- **Vincoli** (infortuni/dolori): `textarea` libera **dietro** la casella di consenso art. 9 (§3.1): finché la casella non è spuntata, la textarea non compare (non "disabilitata": non c'è).
- **Progresso**: in alto `.t-etichetta` `--text-muted` "Passo 2 di 6" + una riga di 6 segmenti (alti 3 px, `--rule`; fatti `--ink`) `aria-hidden` — il testo è l'informazione.
- **Pulsanti**: primario "Avanti" a destra, terziario "Indietro" a sinistra; sull'ultimo "Crea la mia scheda". Il pulsante "Avanti" è sempre attivo: se manca qualcosa, mostra l'errore sul campo e porta il focus lì.
- **Riepilogo errori**: `role="alert"` in cima al form con "Manca una risposta: Obiettivo" come link al campo — solo se ci sono ≥ 2 errori.

### 2.10 Stati vuoti (cinque schermate)

Struttura fissa, `padding-top: var(--space-10)` (mobile) / `--space-16` (desktop), `max-width: var(--measure-voice)`, centrata a sinistra (non centrata orizzontalmente: è una pagina, non un cartello):

1. `.t-etichetta` `--text-muted` con la data ("MARTEDÌ 16 SETTEMBRE").
2. `<h1 class="t-titolo">` — il fatto.
3. `.t-voce` — la voce del coach, con apici, dal backend (`empty_state.coach_text`).
4. Da uno a tre pulsanti **secondari pari** (`empty_state.options[]`), impilati a 375, affiancati da 768.
5. Apparato in fondo (§2.1.4).

| Stato (`empty_state.kind`) | Titolo | Scelte |
|---|---|---|
| `rest_day` | "Oggi: recupero." | "Vedi la prossima seduta" · "Parla col coach" |
| `session_skipped` | (non è una schermata: `/oggi` reindirizza a `/chat` aperta sul messaggio del coach con le tre `options`) | Corta, domani · Sposta · Riposo |
| `week_skipped` | "Questa settimana: 0 su 3." | "Sì, corta" · "No, intera" · "Parliamone" |
| `return_after_break` | "Bentornato. Sono passate tre settimane." | "Corta" · "Intera" · "Parliamone" |
| `maintenance` | "Blocco 1 chiuso. La settimana ora si ripete." | "Vedi il riepilogo del blocco" · "Vai alla seduta di oggi" |

Testi del coach: quelli della direzione §7, forniti dal backend (sono testo, non hard-coded nel frontend, perché portano le note con `rule_id`). Nessun rosso, nessuna icona, nessun contatore a zero in evidenza (lo "0 su 3" è nel titolo perché è il fatto, ma non è grande né colorato).

Stati tecnici della schermata: `loading` → skeleton di titolo (una barra 60% × 28 px) e tre righe di voce; `error` → titolo "Non riesco a caricare oggi." + voce "Riprova tra poco. La seduta, se c'era, è salvata sul telefono." + [Riprova].

### 2.11 Riepilogo di fine blocco

Rotta `/blocco/1/riepilogo`. Scala `scrivania`, misura `--measure-voice`.

1. `.t-etichetta` `BLOCCO 1 · 4 SETTIMANE`.
2. `<h1 class="t-titolo">` "Blocco 1, chiuso."
3. **Tre numeri**: griglia 1 colonna (375) / 3 colonne (768+), ognuno: `.t-numero` (`11 su 12`, `60 → 75`, `8 → 10`) sopra `.t-etichetta` `--text-muted` ("SEDUTE", "STACCO, KG", "PANCA, RIP A 50 KG"). Dal backend `summary.highlights[]` (esattamente tre; se ne ha meno, il frontend mostra quelle che ci sono, mai un segnaposto). Numeri con `aria-label` completo ("11 sedute su 12").
4. `.t-voce` — il paragrafo del coach con tre apici (`summary.coach_paragraph`).
5. Card Pro superficie 1 (§2.5): due secondari pari.
6. Apparato.

Stati: `loading` skeleton; `error`: "Il riepilogo non è pronto. Riprova tra un minuto." + [Riprova]; se l'utente è già Pro: il pulsante Pro diventa primario "Costruisci il blocco 2" e il secondo sparisce (il secondo esiste solo in free).

### 2.12 Dialogo di conferma (solo distruttivo o perdita di dati)

`<dialog>` nativo, `--surface`, `border: var(--border-2) solid var(--ink)`, `max-width: 480px`, padding `--space-6`, `--scrim` dietro, `z-index: var(--z-dialog)`. Titolo `.t-titolo` (a 24 px: override locale documentato), testo `.t-corpo`, due pulsanti: secondario "Annulla" (focus iniziale) + distruttivo (o primario, se non distruttivo) con la parola dell'azione ("Conferma recesso", "Cancella l'account", "Chiudi comunque"). Esc = Annulla. Il focus torna al pulsante che l'ha aperto. Mai per confermare un set, una sostituzione, una scelta del coach.

### 2.13 Skeleton (loading)

Blocchi `--rule` con angoli vivi, alti quanto il testo che sostituiscono (`.t-corpo` → 16 px × 1,5 = 24 px di riga, barra 16 px con margine 4/4). Nessuno shimmer. Il contenitore ha `aria-busy="true"` e un testo visually-hidden "Carico…". Massimo 3 blocchi per schermata; oltre, un solo blocco grande.

### 2.14 Toast

`--ink` fondo, `--on-ink` testo `.t-corpo`, `padding: var(--space-3) var(--space-4)`, `position: fixed; bottom: calc(var(--nav-h) + var(--space-4))`, larghezza `calc(100% - 2 * var(--space-4))` max 480 px, `z-index: var(--z-toast)`, un pulsante terziario "Chiudi" (`--on-ink`, sottolineato). Durata 6 s (WCAG: dismissible + abbastanza lungo), `role="status"`. Usi ammessi: "Seduta sincronizzata", "Dati esportati", "Impostazioni salvate". Non per errori (quelli stanno in pagina) e mai in seduta salvo la sincronizzazione.

### 2.15 Navigazione

**Mobile (< 1024)** — barra tab in basso, `--nav-h` 64 px + safe-area, `--surface`, `border-top: var(--border-1) solid var(--ink)`, `z-index: var(--z-nav)`. Quattro voci a parole `.t-etichetta` a 13 px (fissa): **Oggi · Settimana · Coach · Progressi**. Ogni voce `flex: 1`, altezza piena (target 64 × ≥ 93). Corrente: `border-top: var(--border-3) solid var(--ink)` (sovrapposto al bordo) + peso 700 + `aria-current="page"`. "Account" sta in alto a destra in ogni intestazione di pagina come pulsante terziario "Account" (44 px).

**Desktop (≥ 1024)** — rail sinistro `--rail-w` 200 px, `--paper`, `border-right: var(--border-1) solid var(--rule)`, `position: sticky; top: 0; height: 100dvh`. In alto il logotipo `fitcoach¹` (§10), poi le voci `.t-corpo` peso 600, altezza 44, `padding-left: var(--space-4)`: Oggi · Settimana [Pro se editabile] · Coach · Progressi · Account. Corrente: `border-left: var(--border-3) solid var(--ink)` + peso 700. In fondo al rail, `.t-nota` `--text-muted`: "Coach AI · le regole le scrivono persone¹".

Skip link "Vai al contenuto" come primo elemento del DOM, visibile al focus.

### 2.16 Tabella settimana / mesociclo (desktop, e da 768 in sola lettura)

`<table>` vera, `--paper` fondo, celle `--surface`, `border-collapse: collapse`, filetti `--rule` 1 px, intestazione `.t-etichetta` `--text-muted` sticky (`--z-sticky`).

- Righe: settimane (1–4; "Settimana 3 · deload" in `.t-corpo-strong`; in mantenimento "Settimana che si ripete"). Colonne: le sedute della settimana (A · B · C; per split a 4+ giorni fino a 6 colonne, scroll orizzontale sotto 1024 con `overflow-x: auto` e `tabindex="0"` sul contenitore).
- **Cella**: `padding: var(--space-4)`, `min-width: 180px`, `min-height: 96px`, contenuto: giorno `.t-etichetta` ("MAR"), nome seduta `.t-corpo-strong`, riga `.t-nota` `--text-muted` "5 esercizi · 14 serie · 45′", stato in etichetta a parole: `FATTA` / `SALTATA` / `CORTA` / `OGGI` / vuoto se futura. Ogni cella è un `<button>` (o contiene un link) a tutta cella: `aria-label="Martedì, Full Body B, fatta, 14 serie"`.
- **Oggi**: fondo `--highlight` + `border: var(--border-2) solid var(--ink)` + etichetta `OGGI` (tre segnali). 
- **Variazioni annotate**: nella cella di settimana un `.t-nota` "Settimana 3: +1 serie su gambe¹" con apice vero; l'apparato del mesociclo sta sotto la tabella.
- Tap/click su una cella → **pannello dettaglio** a destra (`--panel-w`, stesso slot del pannello note, `role="complementary"`) con l'elenco esercizi della seduta: ogni esercizio una riga `.t-corpo-strong` + prescrizione `.t-numero-riga` a 20 px con apici (override documentato) + RIR target.
- **Editabile** (`week.editable === true`, Pro): nel pannello dettaglio ogni riga ha i terziari "Sostituisci" · "Serie −/+" · "Sposta al giorno…"; ogni modifica passa per `plan_change_proposals` (§9) e mostra il diff con [Applica] [Lascia com'è]. **Sola lettura** (mantenimento free): nessun terziario; in testa al pannello `.t-nota`: "In mantenimento la settimana si ripete uguale. Per modificarla serve il blocco 2 — Pro." con link terziario "Vedi Pro" (è la superficie 3 in forma passiva: nessuna card, nessun blocco).
- Stati: `loading` → tabella con 4×3 celle skeleton; `error` → "Non riesco a caricare il piano." + [Riprova]; `empty` (nessun mesociclo: non dovrebbe accadere post-onboarding) → "Il piano non c'è ancora." + [Vai all'onboarding]; hover cella: bordo `--ink` 1 px; focus: anello.

Sotto 768 la tabella non si mostra: `/settimana` su mobile è una **lista** per giorno (una riga 56 px per seduta con nome, stato a parole e chevron) — stessi dati, layout diverso.

### 2.17 Costanza (Progressi)

`<figure>` con `<figcaption>` visibile.

- Numero: `.t-numero` `10 su 12` + `.t-etichetta` "SEDUTE FATTE NELLE ULTIME 4 SETTIMANE" + apice → nota "contiamo le sedute fatte e quante volte sei tornato, non i giorni di fila" (nota di sistema, `is_own_note: true`).
- Griglia: 4 righe (settimane, dalla più vecchia in alto) × 7 colonne (Lun–Dom), celle 32×32 (mobile) / 40×40 (desktop), gap `--space-1`, intestazioni colonna `.t-etichetta` L M M G V S D (con `abbr title`), righe etichettate "Sett. 34" `.t-etichetta`.

| Stato giorno (`day.status`) | Forma (senza colore) | Colore | Nome accessibile |
|---|---|---|---|
| `done` (fatta) | Quadrato pieno | `--ink` | "Martedì 2 settembre: seduta fatta" |
| `short` (corta) | Quadrato con **metà sinistra piena** (due `div`, non un gradiente) | `--ink` / `--surface` con bordo `--ink` 1 px | "…: seduta corta" |
| `return` (prima seduta dopo ≥ 1 saltata) | Quadrato pieno **con bordo 2 px `--ink` e fondo `--highlight` attorno** (padding 3 px) | `--ink` su `--highlight` | "…: seduta fatta, sei tornato" |
| `skipped` (pianificata, non fatta) | Quadrato **vuoto** con bordo `--text-muted` 1 px | `--surface` | "…: seduta non fatta" |
| `rest` (riposo pianificato) | Punto 6 px | `--text-muted` | "…: riposo" |
| `future` | Niente (cella vuota) | — | "…: in programma" |
| `none` (nessun piano quel giorno) | Cella vuota | — | non annunciata |

- `<figcaption>` `.t-nota`: "10 sedute fatte, 2 corte, 2 non fatte. Sei tornato 2 volte." — la frase porta l'informazione; la griglia è la mappa. Sotto, una **legenda a parole** con le forme (`<dl>`): pieno = fatta, metà = corta, bordo giallo = ritorno, vuoto = non fatta, punto = riposo.
- Nessun rosso, nessuna "striscia", nessun conteggio di giorni di fila.
- Stati: `loading` skeleton 4×7; `error` "Non riesco a caricare la costanza."; `empty` (meno di una settimana di dati): il numero mostra "1 su 3" o quello che c'è, e la caption dice "Prima settimana: la mappa si riempie da qui." — mai una griglia vuota senza parole.
- In free la finestra è 4 settimane (comunque entro le 8 di storico); in Pro compare un terziario "Vedi tutto lo storico".

**Grafici per esercizio** (fuori firma, ma in scope): linea in `--ink` 2 px su griglia `--rule`, punti 6 px, un solo esercizio per grafico, asse Y in kg tnum, asse X in settimane; nessun colore di serie (una serie sola per grafico); PR = punto con bordo `--ink` 2 px + etichetta a parole "PR" `.t-etichetta`; tabella dati equivalente sotto il grafico, in `<details>` "Vedi i numeri". Tooltip = `<title>` SVG + focus sui punti (`tabindex="0"`, `aria-label="Settimana 3: 75 chili per 5"`).

### 2.18 Account

Lista di sezioni, ognuna `<section>` con `<h2 class="t-corpo-strong">` e filetto sotto:

1. **Profilo**: email (readonly), "Verifica email" (banner `.t-nota` con terziario "Rimanda il link" finché non verificata), livello/obiettivo (terziario "Rifai l'onboarding").
2. **Abbonamento**: "Piano: Base" o "Piano: [Pro] · si rinnova il 16/10/2026 · mensile"; pulsanti: primario "Passa a Pro" (free) oppure secondario "Gestisci abbonamento" (Portal Stripe) + terziario **"Disdici"** sempre visibile (porta al Portal con l'intento cancel). Sotto, per 14 giorni da `subscription.started_at`, un pulsante **distruttivo** con etichetta esatta **"Recedi dal contratto qui"**, non in un sottomenu, con apice → nota "Entro 14 giorni dall'acquisto puoi recedere e ricevi il rimborso integrale. Dopo il recesso il piano torna Base." Dopo la conferma (§2.12 "Conferma recesso"): riga `.t-corpo` "Recesso registrato il … Rimborso di 9,99 € in arrivo sulla carta. Ti ho mandato una email di conferma." (`role="status"`).
3. **Dati**: secondario "Scarica i miei dati (JSON)" (loading: "Preparo il file…"); terziario "Consenso su infortuni e dolori: attivo · Revoca" (revoca = dialogo, poi i dati art. 9 vengono cancellati e i vincoli del piano tolti — testo dal backend).
4. **Installazione** (solo mobile, solo se non installata): "Aggiungi fitcoach alla schermata Home" con le istruzioni iOS a parole in `.t-nota` (Condividi → Aggiungi a Home); evento `install_prompt_shown` al render.
5. **Zona pericolosa**: distruttivo "Cancella l'account" → dialogo con la parola "Cancella l'account" da confermare; dopo: logout e pagina "Account cancellato".
6. In fondo: Privacy · Termini · Crediti · Esci (terziari).

---

## 3. Flussi e navigazione

### 3.1 Mappa delle rotte

**Pubbliche** (Next.js App Router, SSR, SEO)

| Rotta | Cosa | Note |
|---|---|---|
| `/` | Landing (direzione §10) | Prezzo above the fold; un solo evento misurato |
| `/prezzi` | Tabella Base/Pro con filetti, IVA inclusa, pulsanti Checkout; query `?da=` per la superficie | Pillola Pro; nota "IVA inclusa"; contatore fondatori a parole |
| `/registrati` | Email + password (+ casella "Accetto Termini e Privacy", obbligatoria, e nulla altro) | Dopo: `/onboarding/1` |
| `/accedi` | Email + password + "Password dimenticata" | Dopo: `/oggi` |
| `/password/reset` | Reset via email | |
| `/privacy`, `/termini`, `/crediti` | Legali; Crediti con attribuzione wger per item | Newsreader per il testo |

**App** (autenticate; senza layout landing)

| Rotta | Cosa |
|---|---|
| `/onboarding/1` … `/onboarding/5` | Obiettivo · Livello · Giorni e minuti · Luogo e attrezzatura · Vincoli (con consenso art. 9 separato) |
| `/onboarding/sicurezza` | Gate: questionario proprio (non PAR-Q+), disclaimer non medico, passo "6 di 6" |
| `/onboarding/pronto` | "La tua scheda è pronta": tabella compatta del piano con apici + la chat aperta sul commento del coach → [Vai a Oggi] |
| `/oggi` | Hub: la seduta di oggi (anteprima + "Inizia" → readiness) **oppure** uno stato vuoto (§2.10) **oppure** redirect a `/chat` se `session_skipped` |
| `/oggi/readiness` | Readiness (§2.3) |
| `/oggi/seduta` | La seduta (§2.2), scala palestra; bozza in IndexedDB |
| `/oggi/chiusa` | Chiusura seduta: riga del coach + due scelte |
| `/settimana` | Piano/mesociclo: lista (mobile) o tabella (768+) + chat a lato (1024+) + pannello note/dettaglio |
| `/chat` | Il coach; `?msg=` per aprire su un messaggio (dalla email) |
| `/progressi` | Costanza + grafici per esercizio + PR |
| `/progressi/[esercizio]` | Grafico singolo + tabella dati |
| `/blocco/[n]/riepilogo` | Fine blocco (§2.11) |
| `/account` | §2.18 |
| `/account/abbonamento/successo` | Ritorno da Checkout: "Sto confermando il pagamento…" con polling di `GET /me` fino a `entitlement.plan === "pro"` (max 60 s, poi "Ci sta mettendo più del solito: il piano si aggiorna da solo appena Stripe conferma. Puoi tornare a Oggi.") |
| `/account/abbonamento/annullato` | "Pagamento non completato. Sei ancora Base, non è cambiato niente." + [Torna a Oggi] |

Regole:
- La barra tab mobile mostra sempre Oggi · Settimana · Coach · Progressi, anche in seduta (nessun tunnel).
- Il paywall (card §2.5) esiste solo in: `/blocco/*/riepilogo`, `/chat` (al posto del composer, o in `options`), e in forma passiva in `/settimana`. Mai in `/oggi/*`, `/onboarding/*`.
- Deep link: ogni stato vuoto e ogni messaggio del coach ha URL (l'email di mancata seduta punta a `/chat?msg=<id>`).
- Back del browser: fa sempre quello che sembra (ogni foglio/pannello **non** aggiunge una voce di history; i dialoghi nemmeno).

### 3.2 Primo accesso → primo valore

| # | Schermata | Azione | Attrito |
|---|---|---|---|
| 1 | `/` | "Fai la tua scheda" | — |
| 2 | `/registrati` | email, password, una casella | Non chiediamo nome, età, peso: non servono al motore v1 |
| 3–7 | `/onboarding/1–5` | 1 tap per schermata (pillole), tranne vincoli (testo libero, facoltativo) | **Passo 5**: il consenso art. 9 è una seconda casella con testo lungo. Mitigazione: casella + apice → nota "Perché lo chiediamo separatamente": chi non vuole, non spunta e va avanti, e il piano non tiene conto di dolori |
| 8 | `/onboarding/sicurezza` | 6–8 domande sì/no come pillole | **Il punto in cui si pensa** ("ancora un form?"). Mitigazione: contato come "Passo 6 di 6", intestazione "Ultima cosa, per sicurezza", nota sul perché. Se un "sì" è bloccante: testo fisso "Prima di iniziare, senti un medico" + [Ho capito, continuo con un piano conservativo] [Esco] — nessun vicolo cieco |
| 9 | `/onboarding/pronto` | Vede la scheda con apici + il coach che la commenta; tap "Vai a Oggi" | Primo valore: **9 schermate, ~2 minuti**, nessuna carta, nessuna verifica email |

### 3.3 La seduta (con la bozza offline)

| # | Passo | Dettaglio |
|---|---|---|
| 1 | `/oggi` → "Inizia" | Anteprima: nome seduta, N esercizi, durata stimata, "Versione corta (25′)" come terziario |
| 2 | `/oggi/readiness` | 3 tap + "Vai alla seduta" (o "Salta"). Il backend risponde con `session` adattata + `diff` |
| 3 | `/oggi/seduta` | Il frontend crea la bozza in IndexedDB (`session_drafts`, chiave `session_id`) con **tutti i set precompilati** e `updated_at` |
| 4 | Per ogni set: (tocca peso/rip solo se diversi) → **check** | Ogni cambio scrive la bozza **prima** di tentare la rete (`PATCH /sessions/{id}/sets/{set_id}`); coda di scritture idempotenti (`client_op_id`) |
| 5 | Timer si apre; RIR pre-selezionato; eventuale tap | Salvato nella bozza; il timer non blocca la lista |
| 6 | "Sostituisci" (2 tocchi) / "Salta esercizio" / "Note 1–2" quando servono | |
| 7 | "Chiudi seduta" | `POST /sessions/{id}/close` con la bozza intera (il server è idempotente e fa la merge per `client_op_id`). Se offline: la chiusura resta in coda, la schermata `/oggi/chiusa` mostra la riga del coach **generica locale** ("Seduta chiusa. Appena torna la rete la mando al coach.") e il vero commento arriva in chat |
| 8 | `/oggi/chiusa` → "Vai a Oggi" o "Parla col coach" | |

Conteggio per un set senza modifiche: **1 tap** (check). Con RIR diverso dal target: 2. Con peso diverso: 3 (campo, digitare, check). È il ritmo Hevy.

Offline in dettaglio:
- Al mount di `/oggi/seduta`: se esiste una bozza con lo stesso `session_id`, si riprende **da lì** senza chiedere ("Bozza ripresa" in etichetta di stato).
- Se il server risponde con una versione più nuova (`server.updated_at > draft.updated_at`, es. da un altro dispositivo): dialogo non distruttivo "Ho trovato una seduta più recente sul server. Quale tengo?" [Quella sul telefono] [Quella sul server].
- Bozze più vecchie di 7 giorni si cancellano.
- Il service worker (`@serwist/next`) precache-a le rotte `/oggi/*`, i font, i token e le GIF dei soli esercizi della seduta di oggi (`session.media[]`); `/chat` non è offline.
- L'indicatore di stato (§2.2.6) è l'unica UI dedicata: nessun banner giallo, nessuna icona.

### 3.4 Giorno no

| # | Passo |
|---|---|
| 0 | Sera del giorno saltato (o email dopo 24–48 h → `/chat?msg=`): il coach ha scritto (`kind: proactive`, protocollo `no_day`) — "Oggi la seduta non c'è stata. Succede, e conta cosa facciamo domani. Com'è andata la giornata?" |
| 1 | L'utente risponde nel composer (questo turno conta nella quota; se a 15/15, le tre opzioni arrivano **subito** al passo 0 senza domanda aperta: il protocollo degrada, non si spegne) |
| 2 | Il coach risponde con `options` (tre secondari): Corta, domani · Sposta · Riposo. In mantenimento: Corta · Riposo · Rinegozia la settimana [Pro] |
| 3 | Un tap → `POST /chat/options/{id}` → il motore ricalcola → messaggio del coach con `plan_change` già applicato (qui non serve conferma: l'utente ha scelto) + apici + terziario "Vedi la settimana" |

Conteggio: **2 tap** dopo l'apertura. Attrito: il turno 1 costa quota; per questo la domanda aperta salta quando la quota è finita.

Seconda seduta saltata di fila e ritorno dopo ≥ 2 settimane seguono lo stesso schema con testi diversi (`protocol: second_skip | return_after_break`).

### 3.5 Paywall (tre superfici)

| Superficie | Da dove | Passi al checkout |
|---|---|---|
| 1 | `/blocco/1/riepilogo` (aperto da `/oggi` quando `mesocycle.status === "completed"`, con lo stato vuoto `maintenance` come alternativa) | "Costruisci il blocco 2" → `/prezzi?da=end_of_block` → "Passa a Pro, mensile/annuale" → Stripe → `/account/abbonamento/successo` → "Sei Pro. Costruisco il blocco 2." → `/settimana` (**4 tap**) |
| 2 | `/chat` a 15/15 | "Passa a Pro" → `/prezzi?da=chat_quota` → … → ritorno a `/chat` con composer attivo |
| 3 | `/chat`, opzione Pro in `options` | "Rinegozia la settimana [Pro]" → `/prezzi?da=maintenance_request` → … → ritorno a `/chat` dove il coach riprende: "Ora posso. La settimana la rifaccio così: …" |

Regole: "Continua in mantenimento — gratis" e "oppure aspetta il 1° ottobre" sono uscite reali, senza secondo tentativo. Nessun countdown. `/prezzi` con `?da=` mostra in testa una riga `.t-voce` che ricorda da dove si viene ("Il blocco 2 sui tuoi numeri: più volume sulle gambe, deload in settimana 4." — testo dal backend, `paywall.context_line`).

### 3.6 Readiness → il piano di oggi cambia

1. Tre tap + "Vai alla seduta" (o auto-invio? **No**: il quarto tap evita invii per sbaglio).
2. Risposta: riga del coach + elenco a parole delle modifiche.
3. In seduta, le righe `changed` ricevono la passata (§7.3) all'ingresso nel viewport, una volta sola; l'esercizio tolto compare compresso in coda con "Rimettilo".
4. "Rimettilo" (1 tap) → l'esercizio torna al suo posto con le serie originali, la riga di stato dice "Rimesso" e il backend registra `readiness.override = true`.

---

## 4. Layout responsive

Tre viewport di riferimento; i valori intermedi seguono il breakpoint inferiore.

### 4.1 Seduta (`/oggi/seduta`)

| | 375 | 768 | 1440 |
|---|---|---|---|
| Colonna | 1, margine 16 px, contenuto 343 | 1, margine 32 px, contenuto max 560 centrato a sinistra | Rail 200 + colonna seduta 480 px + a destra il pannello (note/GIF/sostituisci, 400 px) sempre aperto sull'ultima nota toccata; il resto è carta |
| Riga del set | 316 px (§2.2.2) | Uguale, non si dilata; colonna "N°" 20 px in più | Uguale |
| Timer | Fisso in basso sopra la barra tab | Idem | Fisso in fondo alla colonna seduta (480), non alla finestra |
| Note | Foglio dal basso (modale) | Foglio dal basso (modale, `max-width: 560px` centrato) | Pannello a lato (non modale) |
| Navigazione | Tab in basso | Tab in basso | Rail |
| Sticky header esercizio | Sì | Sì | Sì |

### 4.2 Settimana (`/settimana`)

| | 375 | 768 | 1440 |
|---|---|---|---|
| Piano | Lista per giorno (righe 56 px) | Tabella con scroll orizzontale se > 3 colonne; sola lettura o editabile secondo `editable` | Tabella (fluida, min 560) + colonna chat 400 + pannello 400: 200 + 560 + 400 + 400 = 1560 > 1440 → **il pannello copre la chat** anche a 1440 se la tabella ha 3+ colonne da 180. Regola: pannello in overlay sulla chat con `--scrim` locale alla colonna; da **1680** in su ha spazio proprio |
| Chat | Nella tab Coach | Nella tab Coach | A lato, sempre visibile |
| Apparato | Sotto la lista | Sotto la tabella | Sotto la tabella |

### 4.3 Chat (`/chat`)

| | 375 | 768 | 1440 |
|---|---|---|---|
| Misura | 343 px | 62ch (≈ 560 px) centrata a sinistra con margine 32 | 62ch nella colonna centrale (rail + 640 + carta) |
| Composer | Sticky sopra la tab | Sticky in basso | Sticky in basso della colonna |
| Badge AI | Sticky in alto | Idem | Idem |
| Messaggio utente | max 80% a destra | max 70% | max 60% |

### 4.4 Readiness e stati vuoti

| | 375 | 768 | 1440 |
|---|---|---|---|
| Pillole readiness | 3 per riga, `wide` (≈ 109 px ciascuna, 56 alte) | 3 per riga, max 480 di riga | Idem, colonna 480 |
| Scelte stati vuoti | Impilate, a tutta larghezza | Affiancate, `flex: 1` | Affiancate |
| Spazio sopra il titolo | 40 px | 48 px | 64 px |

### 4.5 Onboarding

| | 375 | 768 | 1440 |
|---|---|---|---|
| Form | 1 colonna, campi a tutta larghezza | Colonna 480 centrata a sinistra, margine 32 | Colonna 480 centrata nella pagina (è l'unica schermata centrata: non ha rail) |
| Pulsanti | Indietro / Avanti in una riga in fondo, `position: sticky; bottom: 0` su `--paper` | In fondo al form, non sticky | Idem |

### 4.6 Landing (`/`)

| | 375 | 768 | 1440 |
|---|---|---|---|
| Griglia | 1 colonna, margine 16 | 1 colonna, margine 32, misura 62ch per il testo | 12 colonne, contenitore 1120, gutter 24 |
| Above the fold | Eyebrow · H1 `--fs-display` 40 px (3 righe) · sottotitolo · riga prezzo (con `9,99 €` in `.t-numero-riga`) · primario "Fai la tua scheda" · sotto `.t-nota` "due minuti, nessuna carta" · terziario "Guarda come funziona". Tutto in 667 px di altezza con `padding-top: var(--space-12)` — verificato: 48 + 16 + 3×42 + 16 + 2×28 + 16 + 48 + 16 + 44 + 8 + 20 + 12 + 44 = 474 px | Idem con H1 52 px su 2 righe | Colonne 1–6 testo, colonne 7–12 l'estratto della scheda di Marco (§10 direzione, sezione 2) come immagine hero **che è HTML vero** (la tabella), non un'immagine |
| La scheda di Marco | Tabella con scroll orizzontale (`overflow-x: auto`, 4 colonne min 520) | Tabella intera | Tabella intera, colonne 2–11 |
| La conversazione | Come in app, misura piena | Misura 62ch | Colonne 3–10 |
| Come funziona | Lista numerata verticale | 2×2 | 4 colonne — sono **numerate**, non tre card equidistanti: 4 passi, con numeri `.t-numero-riga` e filetto sopra ciascuno, non riquadri |
| Per chi / per chi no | Impilate | 2 colonne | 2 colonne (5–8 e 9–12… no: 2–6 e 7–11) |
| Prezzi | Tabella con scroll orizzontale | Tabella | Tabella, colonne 3–10 |
| Apparato | Lista 1–6 | Idem | Colonne 3–10 |
| Sezioni | Gap 48 px | 64 px | 80 px |

Nessuna animazione allo scroll, nessuna immagine tranne il logotipo e le GIF (che in landing non ci sono).

### 4.7 Cosa si nasconde e cosa cambia ordine

- Sotto 1024: il pannello note diventa foglio; la chat esce da `/settimana` e vive in `/chat`; il rail diventa tab; "Account" sale nell'intestazione.
- Sotto 768: la tabella settimana diventa lista; le scelte pari si impilano; i tre numeri del riepilogo si impilano.
- Nulla è nascosto solo su mobile che non sia raggiungibile altrove. Nulla cambia ordine di DOM tra breakpoint (l'ordine visivo segue l'ordine del DOM: niente `order` CSS che rompe il focus).

---

## 5. Contratto di accessibilità

Voce per voce, verificabile dal `qa-engineer`. Ogni riga è o vera o falsa.

### 5.1 Contrasto e colore
- [ ] Ogni coppia testo/fondo usata è in §1.1 con rapporto ≥ 4,5:1; nessun testo su `--highlight` che non sia `--ink`; nessun testo `--rule`.
- [ ] Nessuna informazione è veicolata dal solo colore: serie fatta = glifo pieno + `aria-pressed`; saltata = parola; oggi = bordo 2 px + etichetta; selezionato = bordo 2 px + peso; cambiato = etichetta "oggi"; ritorno = bordo + caption; errore = parola "Errore:"; sicurezza = filetto rosso + testo fisso + `aria-label`.
- [ ] `color-scheme: light` su `:root`; nessuna regola `prefers-color-scheme: dark`.
- [ ] Zoom testo 200%: nessuna perdita di contenuto; la riga del set va a capo (peso/rip su una riga, check sotto) invece di tagliare.

### 5.2 Target e input
- [ ] Ogni elemento interattivo ha area ≥ 44×44 px, tranne l'apice della nota (44 × ≥32, D1) che ha un equivalente 44×44 nell'apparato/riga note.
- [ ] Target adiacenti distano ≥ 8 px.
- [ ] Nessuna azione solo-hover: ogni cosa che si vede in hover è visibile o raggiungibile senza.
- [ ] Nessun input di testo sotto 16 px su mobile (anti-zoom iOS).
- [ ] Nessun `user-scalable=no`, nessun `maximum-scale`.
- [ ] Trascinamenti: nessuno. Nessuno swipe obbligatorio (lo swipe per chiudere un foglio, se esiste, ha il pulsante "Chiudi").

### 5.3 Tastiera e focus
- [ ] Skip link "Vai al contenuto" primo nel DOM.
- [ ] `:focus-visible` con anello `--ink` 2 px offset 2 px ovunque; su fondi `--ink` anello `--on-ink` interno.
- [ ] Ordine di focus in seduta: skip link → intestazione (Chiudi seduta) → timer (se attivo) → per esercizio: "Come si fa" → peso → rip → check (per ogni serie) → Aggiungi serie → Togli → Sostituisci → Salta → Note → esercizio successivo → tab bar.
- [ ] Foglio modale (mobile): focus intrappolato, primo focus sul titolo, Esc chiude, focus torna all'origine. Pannello desktop: non modale, focus sul titolo all'apertura, Esc chiude e torna.
- [ ] `<dialog>` nativo per le conferme; focus iniziale su "Annulla".
- [ ] Nessun `tabindex` > 0. Nessun `order` CSS che cambia l'ordine di lettura.
- [ ] Il timer non ruba il focus.
- [ ] Focus mai nascosto sotto elementi sticky (composer, timer, tab): `scroll-padding-bottom: calc(var(--nav-h) + var(--timer-h))` sul contenitore della seduta; `scroll-padding-top: 56px` per lo sticky header.

### 5.4 Nomi e ruoli
- [ ] Apice: `<button aria-label="Nota N: titolo" aria-expanded aria-controls>`.
- [ ] Check del set: `aria-label="Serie N fatta" aria-pressed`. Input: `<label>` visually-hidden con "Serie N, peso in chili" / "Serie N, ripetizioni".
- [ ] Riga precedente: `aria-label="Precedente: …"`.
- [ ] Timer: `role="timer"`, numero `aria-live="off"`.
- [ ] Regione annunci unica per pagina `#annunci` `aria-live="polite"` `aria-atomic="true"`.
- [ ] Pillole di scelta: radio nativi; readiness in `<fieldset><legend>`.
- [ ] Cella settimana: pulsante con `aria-label` completo (giorno, seduta, stato, serie).
- [ ] Griglia costanza: ogni cella `role="img"` con `aria-label` dalla tabella §2.17; `<figcaption>` visibile.
- [ ] Grafici: `<svg role="img" aria-labelledby>` + tabella dati in `<details>`; punti focusabili con `aria-label`.
- [ ] Messaggi chat: `<article aria-label="Coach, ora">` / `"Tu, ora"`; il blocco sicurezza `role="region" aria-label="Avviso di sicurezza"`.
- [ ] Badge AI `role="note"`, sempre nel DOM.
- [ ] Ogni glifo SVG decorativo `aria-hidden="true"`; ogni pulsante con glifo ha testo visibile.
- [ ] Tab bar `<nav aria-label="Principale">`, voce corrente `aria-current="page"`.
- [ ] Un solo `<h1>` per pagina; gerarchia senza salti.
- [ ] `<html lang="it">`; date con `<time datetime>`.

### 5.5 Annunci
- [ ] Timer: tre annunci (avvio, 10 s, fine). Nessun annuncio al secondo.
- [ ] Set fatto: "Serie N fatta. Riposo: X secondi." (un annuncio, che include l'avvio timer — non due).
- [ ] Quota: annunciata al cambio di fascia (12–14, 15), non a ogni messaggio.
- [ ] Rete: "Senza rete: salvo sul telefono" / "Rete tornata: sincronizzo" — solo ai due passaggi.
- [ ] Streaming del coach: `aria-busy` sul messaggio; a fine stream un annuncio "Il coach ha risposto" (non il testo intero).
- [ ] Errori di form: `role="alert"` sul riepilogo; focus sul primo campo errato.

### 5.6 Movimento
- [ ] Le tre animazioni (§7) e `scale(0.98)` su active sono le uniche transizioni; tutte su `transform`/`opacity`; tutte tra 150 e 300 ms.
- [ ] `@media (prefers-reduced-motion: reduce)`: tutte le durate a 0; l'evidenziatore delle serie cambiate resta; nessuna vibrazione condizionata (la vibrazione del timer resta: non è movimento sullo schermo).
- [ ] Nessuno shimmer, nessun autoplay: le GIF di esecuzione partono solo dentro il foglio "Come si fa" aperto dall'utente, con pulsante "Ferma" (WCAG 2.2.2) e `prefers-reduced-motion` → GIF ferma sul primo frame con pulsante "Avvia".

### 5.7 Contenuto e forma
- [ ] Nessuna emoji; nessuna esclamazione nei testi di sistema.
- [ ] Etichette dei form visibili; placeholder mai come etichetta.
- [ ] `autocomplete` su email/password (`email`, `current-password`, `new-password`); `inputmode` sui numeri.
- [ ] Testo di errore accanto al campo, non solo in cima.
- [ ] Nessun testo in immagine (la scheda di Marco è HTML).
- [ ] Time-out: nessuna sessione che scade in seduta senza avviso; il JWT si rinnova in silenzio; se scade, la bozza resta e il login riporta a `/oggi/seduta`.

---

## 6. Contenuti e microcopy di sistema

Tono: un buon PT su WhatsApp. Mai "dovresti/devi", mai "!", mai "ops", mai "campione". Il fatto, poi la scelta.

### 6.1 Loading (verbo al presente, prima persona quando è il coach)

| Dove | Testo |
|---|---|
| Piano | Carico la scheda… |
| Seduta | Apro la seduta… |
| Readiness → seduta | Adatto la seduta… |
| Chat, thread | Carico la conversazione… |
| Chat, risposta | COACH · sta scrivendo |
| Riepilogo | Preparo il riepilogo del blocco… |
| Checkout | Apro il pagamento… |
| Ritorno da Stripe | Sto confermando il pagamento… |
| Export | Preparo il file… |
| Generico | Carico… |

### 6.2 Errori (forma: "Errore: cosa è successo. Cosa puoi fare.")

| Codice API / situazione | Testo | Azioni |
|---|---|---|
| Rete assente (fetch fallita) fuori seduta | Senza rete. Quello che vedi è l'ultima versione che ho. | [Riprova] |
| Rete assente in seduta | (stato in etichetta: Senza rete · salvo sul telefono) | — |
| `401` | La sessione è scaduta. Entra di nuovo: la seduta, se c'era, è salvata sul telefono. | [Accedi] |
| `403 plan_required` | Per questo serve il blocco 2, e il blocco 2 è Pro. | [Vedi Pro] [Lascia stare] |
| `429 chat_quota_exceeded` | (card §2.5 superficie 2) | |
| `429` generico | Troppe richieste in poco tempo. Aspetta un attimo e riprova. | [Riprova] |
| `409` (bozza vs server) | Ho trovato una seduta più recente sul server. Quale tengo? | [Quella sul telefono] [Quella sul server] |
| `422` validazione | Errore: {detail dal backend, già in italiano} | focus sul campo |
| `5xx` | Errore dalla nostra parte, non tua. Riprova tra un minuto; se continua, scrivimi a {support_email}. | [Riprova] |
| LLM non risponde | Il coach non ha risposto. Il tuo messaggio è salvato. | [Riprova] |
| Stripe non si apre | Errore: il pagamento non si è aperto. Riprova, oppure scrivimi a {support_email}. | [Riprova] |
| Webhook in ritardo (> 60 s) | Ci sta mettendo più del solito: il piano si aggiorna da solo appena Stripe conferma. Puoi tornare a Oggi. | [Vai a Oggi] |
| Login sbagliato | Email o password non corrispondono. | [Password dimenticata] |
| Email già registrata | Questa email è già registrata. | [Accedi] |
| Nota non disponibile | Questa nota non è disponibile adesso. Riprova tra poco. | [Chiudi] |
| Salvataggio locale fallito | Errore: non sono riuscito a salvare questa serie sul telefono. Riprova. | [Riprova] |

### 6.3 Empty (oltre ai cinque stati del coach)

| Dove | Testo |
|---|---|
| Progressi, nessun PR | Nessun record ancora. Arrivano da soli quando un carico supera il precedente. |
| Progressi, esercizio senza storico | Nessuna serie loggata per questo esercizio. |
| Chat, filtro `?msg=` non trovato | Quel messaggio non c'è più. Ecco la conversazione. |
| Settimana, mesociclo assente | Il piano non c'è ancora. [Vai all'onboarding] |
| Account, nessun abbonamento | Piano: Base. Il primo blocco è completo e gratis. |

### 6.4 Conferme e stati

| Situazione | Testo |
|---|---|
| Seduta chiusa (offline) | Seduta chiusa. Appena torna la rete la mando al coach. |
| Toast sync | Seduta sincronizzata. |
| Recesso fatto | Recesso registrato il {data}. Rimborso di {importo} in arrivo sulla carta. Ti ho mandato una email di conferma. |
| Pagamento riuscito | Sei Pro. Costruisco il blocco 2 sui tuoi numeri. |
| Pagamento annullato | Pagamento non completato. Sei ancora Base, non è cambiato niente. |
| Account cancellato | Account cancellato. I dati sono stati eliminati. |
| Email di verifica inviata | Ti ho mandato il link. Vale 24 ore. |
| Install iOS | Per averla come app: tocca Condividi, poi "Aggiungi alla schermata Home". |

### 6.5 Etichette fisse

Oggi · Settimana · Coach · Progressi · Account · Fatto · Saltata · Sostituisci · Salta esercizio · Rimettilo · Note 1–2 · Chiudi seduta · Come si fa · Riposo · Salta · +30″ · Vai alla seduta · Salta, oggi vado così · Invia · Chiudi · Annulla · Riprova · Passa a Pro · Continua in mantenimento — gratis · Costruisci il blocco 2 · Recedi dal contratto qui · Conferma recesso · Disdici · Gestisci abbonamento · Scarica i miei dati (JSON) · Cancella l'account.

---

## 7. Movimento: i tre e la mappa reduced-motion

| # | Movimento | Proprietà | Durata / easing | Con `prefers-reduced-motion: reduce` |
|---|---|---|---|---|
| 1 | **Set fatto** | Riga: `transform: scale(0.96) → 1`, `transform-origin: center`; check: il fondo passa a `--ink` (senza transizione: è un cambio di stato). Timer: `translateY(100%) → 0` + `opacity 0 → 1` | Timbro `--dur-1 --ease-out`; timer `--dur-2 --ease-out`; timer esce `--dur-1 --ease-in` | Nessun timbro; il timer appare/sparisce istantaneamente. Lo stato (check pieno, `aria-pressed`) è identico. |
| 2 | **La nota si apre** | Foglio: `translateY(100%) → 0` (mobile) / `translateX(100%) → 0` (desktop) + `opacity`; scrim `opacity 0 → 1` | Entrata `--dur-2 --ease-out`; uscita `--dur-1 --ease-in` | Appare/sparisce istantaneamente; l'apice invertito resta. |
| 3 | **Il piano di oggi cambia** | Su ogni riga `changed`, uno pseudo-elemento `::before` con fondo `--highlight`, `transform: scaleX(0) → 1`, `transform-origin: left`; la riga sotto ha già fondo `--surface`; l'etichetta "oggi" appare a fine passata | `--dur-3 --ease-out`, `animation-delay: calc(var(--stagger) * n)` per n = 0…4 (dalla sesta riga in poi delay fisso a 160 ms); parte una volta sola, quando la riga entra nel viewport (IntersectionObserver), poi `data-swept="true"` | Fondo `--highlight` ed etichetta "oggi" presenti da subito, nessuna passata. È uno stato, non un'animazione. |
| — | Active dei pulsanti | `scale(0.98)` | `--dur-1` | Nessuna trasformazione. |

Implementazione: `@media (prefers-reduced-motion: reduce) { :root { --dur-1: 0ms; --dur-2: 0ms; --dur-3: 0ms; --stagger: 0ms } }` — un solo punto, nessun `if` in JS. Le animazioni non bloccano l'input: durante la passata la riga è già tappabile.

---

## 8. Landing e logotipo (numeri)

- Griglia 1440: 12 colonne, contenitore 1120, gutter 24, margine esterno automatico.
- Sequenza e misure delle sezioni: in §4.6. Titoli di sezione `.t-titolo`; sottotitoli in grafite `.t-corpo`; testo `.t-voce`; tabelle `.t-corpo` con numeri `.t-numero-riga` tnum.
- Tabella prezzi: `<table>` con `<caption>` visually-hidden "Confronto tra Base e Pro"; intestazioni di colonna con il nome del piano `.t-titolo` a 24 px (override documentato) + prezzo `.t-numero-riga` + apice; righe con filetti `--rule`; celle "per sempre / completo / no — la settimana si ripete uguale" a parole (nessun ✓/✗). Sotto: due primari? **No**: un primario "Passa a Pro" per colonna Pro e un secondario "Inizia gratis" per Base, stessa altezza.
- Contatore fondatori: `.t-corpo` "Prezzo fondatori 49,99 €/anno: ne restano {n}" — numero in `.num`; nessuna barra, nessun timer.
- Footer: `.t-etichetta` `--text-muted`, link sottolineati, e la riga "Parli con un coach AI, non con una persona."

**Logotipo `fitcoach¹`**
- Testo, non immagine: `<a href="/" class="logo">fitcoach<button class="nota-apice" …>1</button></a>` — attenzione: un `button` dentro un `a` non è valido; struttura corretta: `<span class="logo"><a href="/">fitcoach</a><button class="nota-apice" aria-label="Nota 1: cos'è fitcoach">1</button></span>`.
- "fitcoach" in Archivo 700, `wdth` 100, minuscolo, `letter-spacing: -0.01em`, 24 px nel rail e nell'intestazione, 20 px nella tab bar (non c'è: la tab bar non ha logo), 32 px in landing.
- **Versione senza nota** (favicon, email, OG image): "fitcoach" in Archivo 700 senza apice. Favicon 512: fondo `--paper`, "fc" in Archivo 900 `wdth` 125 `--ink` centrato, e in alto a destra un cerchio `--highlight` con bordo `--ink` 2 px (Ø 22% del lato) contenente "1" — è l'apice come marchio. Versioni 32/16: solo "fc" senza cerchio.

---

## 9. Cosa chiede al backend

Il contratto che serve davvero alla UI. Nomi indicativi; il backend li congela in `/openapi.json`. Ogni risposta d'errore: `{ code, detail, ...extra }` con `detail` già in italiano e nel tono (§6.2).

### 9.1 Oggetto `Note` (usato ovunque compare un apice)

```
Note {
  n: int                     // numero locale nella schermata/messaggio (1…)
  rule_id: string            // es. "rest.strength.between_sets"
  rule_version: int
  updated_at: date
  title_it: string           // ≤ 40 caratteri, per aria-label: "recupero di due minuti tra le serie"
  summary_it: string         // cosa dice
  not_says_it: string        // cosa non dice
  grade: "A"|"B"|"C"|null
  grade_label_it: string     // "A: più meta-analisi concordi"
  is_own_note: bool          // true → "Nota nostra, non uno studio."
  rationale_it: string|null  // perché, se is_own_note
  citations: [{ authors, year, title, journal, doi, url, open_access, type }]
}
```

Le note arrivano **inline con il numero** (il frontend non fa una seconda chiamata per aprirle) e ogni numero del piano è `{ value, unit, note_n }` o `{ value, unit, note: null }` — se `note` è null, l'apice non si disegna. Il frontend non decide mai se un numero ha una nota.

### 9.2 `GET /me`

```
{ user: { id, email, email_verified },
  entitlement: { plan: "free"|"pro", source, valid_until, grace_until },
  engine_active: bool,
  chat_quota: { used, limit, resets_at, daily_used?, daily_limit? },
  mesocycle: { index, week, total_weeks, status: "active"|"maintenance"|"completed" }|null,
  subscription: { interval: "month"|"year", status, started_at, renews_at, cancel_at_period_end }|null,
  withdrawal_eligible_until: datetime|null,
  health_consent: { given: bool, given_at },
  onboarding_completed: bool,
  support_email: string,
  pwa: { installed_reported: bool } }
```

### 9.3 `GET /today`

```
{ kind: "session"|"rest_day"|"session_skipped"|"week_skipped"|"return_after_break"|"maintenance"|"block_completed",
  date, 
  session_preview?: { session_id, name, exercises_count, est_minutes, short_available: bool },
  empty_state?: { title, coach_text (con apici come [[n]]), notes: Note[], options: [{ id, label, description, is_pro, action: { type: "route"|"chat_option", target } }] },
  readiness_required: bool,
  redirect?: "/chat?msg=…" }
```

Convenzione per i testi con note: il backend marca gli apici nel testo con `[[n]]` (es. "tolgo lo stacco[[1]]"); il frontend li rende come apici. Vale per `coach_text`, `coach_line`, `coach_paragraph`, i `paragraph` della chat.

### 9.4 Readiness: `POST /sessions/{id}/readiness`

Body `{ sleep: "lt6"|"6to8"|"gt8", mood: "low"|"mid"|"high", pain: "none"|"mild"|"severe" }`. Risposta:

```
{ session: Session (già adattata),
  diff: { removed_exercises: [{ exercise_id, name, reason_it, note_n }],
          changed_sets: [{ set_id, exercise_id, field: "sets"|"reps"|"weight"|"rest", from, to }],
          short_version: bool, est_minutes },
  coach_line: string, notes: Note[],
  safety?: { text, options: [{ id, label }] } }   // se pain = severe
```

Più `POST /sessions/{id}/readiness/restore/{exercise_id}` ("Rimettilo").

### 9.5 Seduta: `GET /sessions/{id}`

```
Session {
  id, name, week, index_in_week, sessions_in_week, updated_at,
  exercises: [{
    id, exercise_id, name_it, order,
    media: { gif_url, poster_url, attribution? },
    prescription: { sets: {value, note_n}, reps: {value|range, note_n}, rest_s: {value, note_n}, rir_target: {value, note_n} },
    substituted_from?: { name_it },
    changed_today?: { label_it: "2 serie invece di 3" },
    removed_today?: bool,
    substitutes: [{ exercise_id, name_it, why_it }]  // max 5
    sets: [{ id, n, target: { weight_kg, reps, rir }, previous: { weight_kg, reps, rir, date }|null,
             logged: { weight_kg, reps, rir, status: "todo"|"done"|"skipped", done_at }|null }],
    notes: Note[] }],
  notes: Note[],       // apparato della seduta
  close_line?: string  // riga del coach alla chiusura, se già nota
}
```

Scritture, tutte idempotenti con `client_op_id` e `client_updated_at`:
- `PATCH /sessions/{id}/sets/{set_id}` `{ weight_kg?, reps?, rir?, status?, client_op_id, client_updated_at }`
- `POST /sessions/{id}/sets` (aggiungi) / `DELETE /sessions/{id}/sets/{set_id}` (togli l'ultima)
- `POST /sessions/{id}/exercises/{ex_id}/substitute` `{ exercise_id }` / `…/skip` / `…/restore`
- `POST /sessions/{id}/close` con la bozza intera → `{ close_line, notes }`; `409` se `server.updated_at` > `client_updated_at` con `{ code: "draft_conflict", server_session }`.
- `POST /sessions/{id}/sync` (batch delle operazioni in coda, stesso formato) — per il ritorno della rete.

### 9.6 Settimana: `GET /plans/current`

```
{ mesocycle: { index, status, total_weeks, editable: bool, maintenance_note_it? },
  weeks: [{ n, label_it ("Settimana 3 · deload"), is_current, changes_it: [{ text (con [[n]]), note_n }],
            sessions: [{ session_id, day: "mon"…"sun", date, name, exercises_count, sets_count, est_minutes,
                         status: "done"|"skipped"|"short"|"today"|"planned"|"none" }] }],
  notes: Note[] }
```

Dettaglio cella: `GET /sessions/{id}` (stesso oggetto di 9.5, senza `logged` se futura).
Modifiche (Pro): `POST /plans/proposals` `{ patch }` → `{ proposal_id, diff: [{ exercise, field, from, to, note_n }], notes, valid: bool, invalid_reason_it? }`; `POST /plans/proposals/{id}/apply` / `/reject`. In free → `403 plan_required`.

### 9.7 Chat

- `GET /chat/messages?before=&limit=` → `[{ id, role: "coach"|"user", kind: "user_turn"|"proactive"|"safety"|"paywall", at, status: "sent"|"failed", blocks: [ {type:"paragraph", text}, {type:"options", options:[{id,label,description,is_pro,chosen}]}, {type:"plan_change", proposal_id, diff, applied: bool|null}, {type:"safety", text, options} ], notes: Note[] }]`
- `POST /chat/messages` `{ text, client_op_id }` → stream SSE con `{ type: "delta", text }` / `{ type: "block", block }` / `{ type: "done", message }`; `429 { code: "chat_quota_exceeded", resets_at, used, limit }`. **Un turno fallito (5xx, LLM down) non conta nella quota**: il backend lo garantisce, la UI lo dice.
- `POST /chat/options/{option_id}` → messaggio di risposta del coach (stesso formato). Le opzioni **non consumano quota**.
- `GET /chat/quota` (o dentro `/me`): `{ used, limit, resets_at }`; la UI la rilegge dopo ogni `done`.
- Testi fissi: `paywall.context_line` per `/prezzi?da=`; `ai_badge_text` con la sua `Note` (nota di sistema 1).

### 9.8 Progressi

- `GET /progress/consistency?weeks=4` → `{ done, planned, returns, days: [{ date, status: "done"|"short"|"return"|"skipped"|"rest"|"future"|"none", session_id? }], caption_it, note: Note, window_limited_by_plan: bool }`
- `GET /progress/exercises` → `[{ exercise_id, name_it, last_weight_kg, pr: { weight_kg, reps, date }|null }]`
- `GET /progress/exercises/{id}?since=` → `{ points: [{ date, week, best_weight_kg, reps, is_pr }] }`; in free `since` è forzato a −8 settimane e la risposta dice `history_limited: true`.

### 9.9 Fine blocco: `GET /mesocycles/{n}/summary`

```
{ block_index, sessions_done, sessions_planned,
  highlights: [{ label_it, from, to, unit, kind: "count"|"weight"|"reps" }],  // max 3
  coach_paragraph (con [[n]]), notes: Note[],
  next_block_preview_it,     // "più volume sulle gambe, deload in settimana 4"
  is_pro: bool }
```

### 9.10 Onboarding

- `GET /onboarding/schema` → i 5 passi + gate con domande, opzioni (`id`, `label_it`, `help_it`), la nota sul consenso art. 9 (`Note`), il testo del disclaimer, le domande del gate con `blocking: bool` e il testo fisso se bloccante. Il frontend non hard-coda domande di sicurezza: sono contenuto legale che cambia.
- `POST /onboarding` con le risposte → `{ mesocycle, first_session_id, coach_comment_message_id }`.
- `POST /consents/health` `{ given: bool }` (separato, revocabile da Account).

### 9.11 Account e billing

- `POST /billing/checkout` `{ price: "month"|"year"|"year_founders", from_surface }` → `{ url }`
- `POST /billing/portal` `{ intent?: "cancel" }` → `{ url }`
- `POST /billing/withdraw` → `{ withdrawn_at, refund_amount, refund_currency }`; `403 { code: "withdrawal_window_closed" }`
- `GET /billing/founders` → `{ remaining: int }` (per il contatore; cache 60 s)
- `POST /me/export` → `{ download_url, expires_at }` (o `202` con polling)
- `DELETE /me` → `204`
- `POST /auth/verify/resend`
- `POST /events` `{ name, props }` per `install_prompt_shown`, `installed`, `paywall_shown` (quando lo emette la UI), `checkout_started`.

### 9.12 Media e offline

- `session.exercises[].media.gif_url` servita dal nostro dominio con `Cache-Control` lungo e `poster_url` (primo frame, PNG) per reduced-motion.
- `GET /sessions/{id}` deve rispondere con `ETag`/`updated_at` per la logica di bozza.
- Il backend accetta `client_updated_at` nel passato di ore (la palestra è un seminterrato) senza rifiutare.

---

## 10. Testi di sistema con nota (contenuto, non codice)

- **Nota 1 di sistema** (logotipo, badge AI, footer): *"fitcoach: una scheda con le note a piè di pagina. I numeri li decide un motore di regole scritte da persone, con lo studio accanto; il coach che ti scrive è un'intelligenza artificiale, e te lo diciamo ogni volta che gli parli."* — `is_own_note: true`.
- **Nota costanza**: *"Contiamo le sedute fatte e quante volte sei tornato, non i giorni di fila. È la regola con cui misuriamo la costanza."* — `is_own_note: true`.
- **Nota consenso art. 9**: *"Infortuni e dolori sono dati sulla salute: la legge (GDPR, art. 9) chiede un consenso separato e lo puoi revocare quando vuoi da Account. Senza, il piano non ne tiene conto."* — `is_own_note: true`.
- **Nota recesso**: *"Entro 14 giorni dall'acquisto puoi recedere e ricevi il rimborso integrale. Dopo, il piano torna Base e puoi comunque disdire a fine periodo."* — `is_own_note: true`.
- **Nota IVA**: *"IVA inclusa. Nessuna carta per il primo blocco: non è un trial a scadenza, è il primo mesociclo intero."* — `is_own_note: true`.
- Le note scientifiche (recupero, volume, RIR, detraining, frequenza) vengono dalla tabella `rules` dopo il validatore DOI: il frontend non ne scrive nessuna.

---

## 11. Consegne al frontend-engineer

Nell'ordine in cui servono. Ogni voce è verificabile.

1. **`tokens.css`** con tutto §1 (colori, le due scale via `[data-scale]`, spazio, misure fisse, raggi, durate, z-index) e il blocco `prefers-reduced-motion` a durate zero. `color-scheme: light`. Nessun altro file dichiara hex o px di layout.
2. **Font**: `next/font/local` per Archivo (`wdth,wght`) e Newsreader (romano + corsivo, `opsz,wght`), `display: swap`, fallback Arial/Georgia con metriche generate. Test: la pagina non fa richieste a domini Google; CLS < 0,1 con cache vuota; U+2032/2033 renderizzati in Archivo (altrimenti `min`/`s` ovunque).
3. **Classi di testo** `.t-*` di §1.2, incluse `.t-voce em` e `.t-voce .num`; il renderer che trasforma `[[n]]` in apici.
4. **Nota**: `NoteMark` (apice, D1), `NoteSheet` (mobile modale / desktop aside), `StudyCard`, `Apparatus`. Un solo stato condiviso "nota aperta" per pagina.
5. **Seduta**: `ExerciseBlock` (header + sticky), `SetRow` con i sei stati, `RestTimer` (con RIR, tempo su timestamp), `SubstituteSheet`, `NotesRow`, `SessionHeader` con stato rete; bozza in IndexedDB (`idb`), coda operazioni con `client_op_id`, sync al `online`, precache via `@serwist/next` delle rotte `/oggi/*` e dei media della seduta di oggi.
6. **Readiness** con `<fieldset>`/radio nativi, pulsante attivo solo a tre risposte, gestione `safety`, passata (§7.3) via IntersectionObserver una volta sola.
7. **Chat**: `AiBadge`, `CoachMessage` (blocks: paragraph/options/plan_change/safety), `UserMessage`, `Composer` con `QuotaLine` e sostituzione con `ProCard` a 15/15, streaming SSE con `aria-busy`, retry senza doppio invio (`client_op_id`).
8. **`ProCard`** con le tre superfici e la garanzia per rotta (mai in `/oggi/*`, `/onboarding/*`).
9. **Pulsanti** (4 varianti × stati), **pillole** (scelta, `wide`, `rir`, Pro), **input** (testo, numero, checkbox, textarea), **Dialog** nativo, **Skeleton**, **Toast**, **Nav** (tab + rail), **skip link**, regione `#annunci`.
10. **Stati vuoti** come un solo componente `EmptyState` alimentato da `GET /today`.
11. **Riepilogo di fine blocco**, **tabella settimana** (+ lista mobile, + pannello dettaglio, + modalità editabile via proposals), **costanza** (griglia con forme, caption, legenda), **grafici** (SVG, una serie, tabella dati in `<details>`).
12. **Rotte** di §3.1 con i redirect di `/oggi`; pagine di ritorno Stripe con polling; Account con "Recedi dal contratto qui" visibile per 14 giorni.
13. **Landing** e **prezzi** come da §4.6 e §8: HTML vero, tabelle vere, apparato in fondo; il primo schermo a 375 contiene prezzo e pulsante senza scorrere (misura da fare su device: ≤ 560 px di altezza totale).
14. **Responsive** verificato a 375/768/1440 su ogni rotta di §4 con screenshot; niente scroll orizzontale salvo le tabelle dichiarate (`overflow-x: auto` + `tabindex="0"`).
15. **Accessibilità**: §5 voce per voce prima di consegnare al QA; axe senza errori critici; navigazione da tastiera della seduta completa registrata.
16. **SEO** pubblico: meta, OG (immagine con il logotipo senza nota), sitemap con `/`, `/prezzi`, `/privacy`, `/termini`, `/crediti`; le rotte app `noindex`.
17. **Cosa non fare**: nessun `border-radius` diverso da 0/pieno, nessuna ombra, nessun gradiente, nessuna icona oltre le quattro, nessuna emoji, nessun rosso fuori da sicurezza/distruttivo, nessun tema scuro, nessuna animazione oltre le tre.

---

## 12. Cosa resta aperto (non bloccante)

- La resa di `′` e `″` in Archivo (verifica del frontend-engineer, fallback deciso).
- Il testo del questionario di sicurezza proprio (legale, non design): il componente è pronto per N domande sì/no con `blocking`.
- Le citazioni reali nelle note della landing: dal validatore DOI nel seeding, come da direzione §10.
- Se il test in palestra (brief §8, rischio 8) chiede numeri ancora più grandi in seduta, si alza `--fs-numero-riga` a 32 e la colonna Peso a 96: la riga resta in 343 (64+96+80+56+36 = 332).
