# Lifted — Design System

Versione 1.0 · 2026-09-22 · Autore: `ui-ux-designer`
Fonte vincolante: `docs/spec.md` (brief utente) + `CLAUDE.md` (standard studio).

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

### 1.14 Breakpoint

| Token | Valore | Cosa cambia |
|---|---|---|
| base | `375px` | mobile-first, nessuna media query |
| `--bp-sm` | `480px` | phablet: la riga serie guadagna la colonna RPE anche se attiva |
| `--bp-md` | `768px` | tablet: griglie a 2 colonne, contenuto centrato max 680px |
| `--bp-lg` | `1024px` | la bottom nav diventa rail laterale |
| `--bp-xl` | `1440px` | sessione a 2 colonne, contenuto max 1120px |

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
}
```

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

### 4.11 `BottomNav` — navigazione a 5 tab

`fixed`, altezza `--nav-h` (56px) `+ env(safe-area-inset-bottom)`, fondo `--background`,
bordo superiore 1px `--border`, `--z-nav`. Ogni tab occupa 20% (75px a 375 → ≥48 ✓).

| # | Rotta | Etichetta | Icona lucide (inattiva → attiva) |
|---|---|---|---|
| 1 | `/allenamento` | Allenamento | `Dumbbell` → `Dumbbell` riempita |
| 2 | `/profilo` | Profilo | `User` → `User` riempita |
| 3 | `/esercizi` | Esercizi | `ListChecks` → riempita |
| 4 | `/misure` | Misure | `Ruler` → riempita |
| 5 | `/statistiche` | Statistiche | `TrendingUp` → riempita |

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

### 6.1 Mappa delle rotte

```
/                                   → redirect a /allenamento

TAB 1 ─ /allenamento                quick start + elenco routine per split
        /allenamento/routine/nuova          editor routine (creazione)
        /allenamento/routine/[id]           dettaglio routine (sola lettura + Avvia)
        /allenamento/routine/[id]/modifica  editor routine (modifica)

TAB 2 ─ /profilo                    riepilogo personale + storico sessioni
        /profilo/sessione/[id]              dettaglio sessione passata (+ PR ottenuti)

TAB 3 ─ /esercizi                   libreria + ricerca + filtri muscolo/attrezzo
        /esercizi/nuovo                     crea esercizio personalizzato
        /esercizi/[id]                      dettaglio: storico, 1RM stimato, PR, note
        /esercizi/[id]/modifica             modifica esercizio personalizzato

TAB 4 ─ /misure                     elenco metriche con ultimo valore e delta
        /misure/[metrica]                   grafico + elenco voci + aggiungi

TAB 5 ─ /statistiche                volume settimanale/mensile, distribuzione, 1RM, PR

FUORI DALLE TAB
        /sessione                   sessione attiva, a schermo intero
        /sessione/riepilogo/[id]    riepilogo post-workout con i PR
        /impostazioni               timer default, unità, RPE on/off, bilanciere, dischi
        /impostazioni/backup        export JSON/CSV, import JSON, cancella tutto
        /impostazioni/info          versione, avviso dati locali, licenze
```

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

### 8.9 Struttura e semantica

- [ ] Un solo `<h1>` per pagina; gerarchia senza salti.
- [ ] `<main>`, `<nav aria-label="Navigazione principale">`, `<header>` semantici.
- [ ] La tabella delle serie è una `<table>` reale con `<th scope="col">`, non un grid di `<div>`.
- [ ] `lang="it"` sull'`<html>`.
- [ ] Titolo di pagina univoco e descrittivo su ogni rotta (`Sessione · Push A — Lifted`).
- [ ] Liste > 50 voci virtualizzate **senza rompere la navigazione da tastiera** (il
      contenitore espone `aria-rowcount`).

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
