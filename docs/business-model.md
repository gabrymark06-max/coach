# fitcoach — Modello di business (fase 5)

Data: 2026-09-16 · Autore: product-strategist · Input: `allineamento.md`, `competitors.md` (§6 consegne), `brief.md` (approvato; §5, §7, §11, emendamenti), `verifica.md` (#1, #15–18, #23, #25).

Ogni numero è `stima` salvo dove è citata la fonte con URL e data. Le assunzioni sono marcate `[assunzione]`. Nessuna cifra qui è una previsione di ricavo: è aritmetica di pareggio.

---

## 0. Verdetto di vendibilità

**Si vende, ma è un prodotto da 10 €/mese in un mercato dove gli italiani ne pagano 4–7, senza store, con una conversione freemium che nella categoria sta tra il 2 e il 5 %.** Tradotto: per fare 500 €/mese servono circa 100 abbonati Pro, per farne 5.000 ne servono circa 1.000, e per avere 1.000 paganti servono nell'ordine di 25.000 account registrati. Con i canali gratuiti a disposizione di una persona sola, il primo numero è raggiungibile in mesi; il secondo richiede un canale di distribuzione che oggi non c'è (palestre, oppure store).

Il motivo per cui vale comunque: il dolore che vendiamo — *non mollare* — è quello per cui la gente paga di più in tutta la categoria (Future 199 $/mese, Caliber 19–200 $/mese, teardown §3.7), nessuno lo serve via software dopo il fallimento di Freeletics Mindset, e in italiano lo scaffale è vuoto (Arvo per tecnici, Gym Coach AI con una recensione). Il prezzo può stare *sopra* la fascia italiana perché non vendiamo una scheda: vendiamo il coach che resta.

Raccomandazione sull'ambizione (l'utente non è qui per rispondere, quindi scelgo): **costruire e prezzare come side business** — un solo piano Pro, nessuna macchina enterprise, nessuna vendita alle palestre finché non ci sono 100 paganti. La struttura scelta (motore + entitlements + audit trail) non preclude il salto a "azienda" (§10), ma il salto si fa con i dati, non prima.

---

## 1. Cliente pagante

**Chi.** Il profilo stretto del brief §2: 25–45 anni, in palestra da solo da meno di un anno o rientrato dopo una pausa, 2–4 sedute a settimana, **ha già mollato almeno una volta**. Paga un abbonamento in palestra che usa meno di quanto vorrebbe.

**Quale dolore paga per togliersi.** Non "non so che scheda fare" (quello lo risolve gratis Boostcamp o un PT della palestra in 10 minuti). Paga per **non ripetere la fine di febbraio**: il momento in cui salta una seduta, poi due, e l'abbonamento diventa un senso di colpa mensile. Il coach mentale che conosce il suo piano è la risposta a questo, e il chip di fonte è quello che gli fa credere ai numeri abbastanza da non cercarne altri su YouTube.

**Quanto vale per lui.** L'abbonamento in palestra che non usa vale, in Italia, nell'ordine di 30–60 €/mese `[assunzione, non verificato]`. Un coach a 10 €/mese è un'assicurazione sul 20–30 % di quella spesa. Il confronto mentale che vince: "un PT costa 30–50 € l'ora, questo costa meno di un'ora al mese e c'è tutti i giorni". Il confronto che perde: "Hevy è gratis" — per questo il logging resta gratis per sempre (§5).

**Chi NON è il cliente pagante.** L'intermedio che sa cosa sia il RIR ha già Alpha/Hevy/Arvo e paga 4–13 $ per non avere coaching. Chi vuole FST-7 o un peaking ha Arvo e Juggernaut. Non riapro la sezione 2 del brief.

---

## 2. Value metric

**Mesi sotto coaching.** L'unità che cresce insieme al valore per il cliente è il tempo in cui il coach lo conosce: ogni settimana loggata rende il blocco successivo più suo, e ogni "giorno no" gestito è una ricaduta evitata. Il valore è cumulativo nel tempo, non nel numero di messaggi.

**Perché non i messaggi.** I messaggi sono il nostro costo variabile, non il valore dell'utente. Se li vendiamo a pacchetti, l'utente razionerà la conversazione proprio nella sera in cui non ha voglia di allenarsi — ovvero quando il prodotto serve. Bloom (RCT, CHI 2026) mostra che il gruppo col coach LLM passa 5× più tempo in app e cambia mindset: è l'effetto che vogliamo, e un tassametro lo spegne. I messaggi vanno **misurati** (per proteggere il margine, §7) e mai **fatturati**.

**Perché non le sedute o i mesocicli.** Un prezzo per blocco da 4 settimane (§3, modello D) è coerente col valore ma spegne il coach tra un blocco e l'altro, che è esattamente il buco in cui la gente molla.

---

## 3. Modelli valutati

Sei modelli genuinamente diversi, non sei taglie dello stesso abbonamento. Le fasce di prezzo vengono dal teardown §6 (prezzi letti 2026-09-16 su store/siti ufficiali).

| Modello | Chi paga, per cosa | Cosa lo rompe | Quando lo sceglierei |
|---|---|---|---|
| **A. Freemium + abbonamento Pro flat** (Alpha, Hevy, Arvo) | L'utente, ogni mese, per il coach che continua oltre il primo blocco | Conversione 2–5 %: il free deve costare centesimi, non euro. Free "troppo buono" (Alpha) → nessuno paga; free "troppo stretto" (Dr. Muscle) → reputazione | **Scelto.** Il free è il canale di acquisizione in assenza di store; il logging gratis è l'unico modo per far vedere al coach i dati |
| **B. Solo trial 7–14 gg con carta, poi paghi** (Fitbod, Juggernaut) | L'utente, dopo il trial | "Trial e basta" è la lamentela #1 di Fitbod ("doesn't do enough"); la carta in anticipo ammazza la registrazione senza store; il coach mentale non fa in tempo a dimostrarsi in 7 giorni (il "giorno no" arriva in settimana 2–4) | Se avessimo un brand o uno store che porta traffico qualificato. Non oggi |
| **C. A consumo: crediti/pacchetti di messaggi** | L'utente, per ogni conversazione | Razionamento nel momento sbagliato (§2); Stripe Billing Meters riconcilia solo a fattura (verifica #25) → doppia contabilità; anxiety da contatore | Mai per il consumer. Utile solo come fair-use interno |
| **D. Acquisto una tantum per blocco** (14,99 € per mesociclo di 4–6 settimane) | L'utente, ogni blocco che vuole | Nessuna ricorrenza automatica → il coach si spegne tra i blocchi; ogni blocco è una nuova decisione d'acquisto; il "giorno no" cade nel vuoto tra i blocchi. Legalmente più semplice (niente rinnovo) | Come **opzione secondaria** se i dati dicono che gli italiani rifiutano l'abbonamento. Tenuto in tasca, non in v1 |
| **E. Lifetime** (Hevy 74,99 $) | L'utente, una volta | Un utente lifetime con chat LLM è una passività a vita: costo variabile ricorrente contro ricavo fisso. Esiste solo nei tracker senza costi variabili | Mai con un LLM nel prodotto |
| **F. B2B2C: la palestra paga per i nuovi iscritti** (2–3 €/iscritto/mese, white-label leggero) | La palestra, per ridurre il churn degli iscritti di gennaio | Vendita porta a porta; la palestra vuole il suo brand; serve multi-tenant, codici, reportistica; nessun primo pagante da cui imparare | **Strada d'espansione** dopo 100 paganti diretti. È anche il canale di distribuzione più credibile senza store (§9) |

Una settima via, **G. Pro+ con revisione umana** (strada C del brief, 29–39 €/mese), è il piano premium naturale quando ci saranno abbastanza utenti da giustificare le ore: l'audit trail delle proposte del coach è già il pannello che un umano rivedrebbe. Non in v1.

**Pressure test dell'utente 100× la media.** In A, un Pro che manda 300 messaggi/mese su Sonnet 5 costa ≈ 3,2 €/mese contro 7,7 € netti: sotto il 50 %, sostenibile ma sopra la soglia del brief (20–30 %). Mitigazione: fair-use cap a 300 turni/mese e 40/giorno, e modello economico (gpt-5.4-mini) sui turni ordinari (§7). In free, il cap a 15 turni chiude il problema per costruzione.

---

## 4. Raccomandazione

**Modello A: freemium con un solo piano Pro ad abbonamento flat, mensile o annuale.** Value metric: mesi sotto coaching. Metering dei messaggi solo come protezione del margine.

**La ragione unica per cui vince:** senza store, il free è il nostro unico canale di acquisizione, e senza logging gratis il coach non vede i dati che gli servono per fare l'unica cosa che vendiamo. Ogni altro modello o chiude la porta all'ingresso (B) o spegne il coach nel momento in cui serve (C, D).

**Cosa cambia rispetto alle alternative del brief §11.** Il brief lasciava aperto "piano nel free (Alpha) o dietro il paywall (Fitbod)". La risposta è: **il primo mesociclo è gratis e completo, dal secondo in poi il motore è Pro.** Il paywall è a *tempo di valore*, non a *giorni di calendario*: cade esattamente quando il prodotto ha quattro settimane di dati sull'utente e può dimostrare di conoscerlo. È il "assaggia l'algoritmo" di Dr. Muscle con la generosità di Alpha.

**Provider LLM (ai fini economici).** Le stime in §7 assumono **gpt-5.4-mini su `eu.api.openai.com` (+10 %)** come modello di base e **Claude Sonnet 5** come tetto per i turni del protocollo "giorno no", dove il tono conta. Entrambi stanno nel margine. La scelta finale resta al build dopo l'eval in italiano (verifica #3); ai fini di questo documento non cambia il listino.

---

## 5. Listino

Prezzi al pubblico, **IVA 22 % inclusa**, mercato italiano. Vanno esposti così (IVA inclusa) su landing, pagina prezzi e checkout: per il B2C è un obbligo, non una scelta.

| | **Base** (gratis) | **Pro** |
|---|---|---|
| **Prezzo** | 0 € | **9,99 €/mese** oppure **59,99 €/anno** (= 5,00 €/mese, −50 %) |
| Onboarding, screening di sicurezza, profilo | ✓ | ✓ |
| **Primo mesociclo** (4 settimane) generato dal motore, con chip di fonte e schede studio | ✓ completo | ✓ |
| **Mesocicli successivi** (progressione sui tuoi dati, deload, cambio di blocco) | ✗ — dopo il blocco 1 il piano entra in **modalità mantenimento** (§6) | ✓ illimitati |
| **Seduta**: logging completo, timer, RIR, sostituzione esercizio, bozza offline, immagini/GIF | ✓ **per sempre, senza limiti** | ✓ |
| **Readiness** giornaliera + versione corta automatica della seduta | ✓ per sempre | ✓ |
| Commento del coach al piano | ✓ | ✓ |
| **Chat col coach** (turni utente) | **15 al mese** | illimitata (fair use: 300/mese, 40/giorno) |
| **Protocollo "giorno no"** (apertura MI + tre opzioni + settimana ricalcolata) | ✓ durante il blocco 1; dopo, solo "versione corta" e "riposo" | ✓ sempre, con rinegoziazione della settimana |
| Modifiche al piano proposte dal coach e validate dal motore | ✓ durante il blocco 1 | ✓ |
| Progressi: grafici per esercizio, PR, metrica di costanza | ✓ ultime 8 settimane | ✓ storico completo |
| Email di mancata seduta | ✓ | ✓ |
| Vista desktop settimana/mesociclo | ✓ (sola lettura fuori dal blocco 1) | ✓ editabile |
| Esporta dati (JSON), cancella account | ✓ | ✓ |
| Disdetta dal portale, **recesso 14 giorni con rimborso integrale** | — | ✓ |

**Deliberatamente escluso da entrambi (non è "in arrivo", è fuori v1):** nutrizione, wearable, social, notifiche push, coach umano, builder da zero, calcolatori 1RM/dischi, multi-palestra. Non vanno mostrati come "Pro" barrati: sarebbe vendere quello che non c'è.

**Perché questi numeri.**
- **9,99 € e non 4–7 €** (Arvo 4 €, Gym Coach AI 6,99 €): quei prezzi sono per schede; un prezzo da tracker segnala un tracker (Jason Cohen: il prezzo è un segnale di qualità). Restiamo sotto la soglia psicologica dei 10 € e sotto i generatori internazionali (Alpha 12,99 $, Fitbod 15,99 $ — teardown §2, 2026-09-16), che non hanno coach.
- **59,99 €/anno**: −50 % è la convenzione della categoria (Fitbod 95,99/191,88, Alpha 79,99/155,88, Gym Coach AI 41,99/83,88). L'annuale è il piano che vogliamo vendere: abbatte il churn nel periodo in cui il cliente rischia di mollare (settimane 6–12) e paga in anticipo l'LLM.
- **Un solo piano Pro**: con zero paganti, due tiers sono una decisione senza dati. Si rivede a 100 paganti (§11) e ogni 6 mesi.
- **Nessun trial Stripe con carta**: il primo mesociclo *è* il trial, senza carta e senza scadenza in giorni. Meno attrito, meno obblighi informativi, niente reputazione "trial e basta".

**Leva di lancio (limitata e a scadenza):** *Prezzo fondatori* 49,99 €/anno per i primi 100 abbonati, garantito finché non disdicono. Costo: 10 € l'anno per 100 persone; beneficio: 100 casi studio e recensioni. Da implementare come Stripe Promotion Code su un prezzo dedicato, con contatore.

---

## 6. Free tier come meccanismo

**Un solo compito:** portare l'utente al momento di valore in fretta e farlo sbattere contro un muro che sia *naturale*.

**Momento di valore** (in quest'ordine, entro la prima settimana):
1. Piano pronto a fine onboarding, con i chip di fonte — 2 minuti.
2. Prima seduta loggata con numeri precompilati — giorno 1.
3. **Il primo "giorno no" gestito dal coach** — tipicamente settimana 2–3. Questo è il momento in cui il prodotto si distingue da tutto il resto e **deve** avvenire nel free, altrimenti stiamo vendendo una promessa invisibile.

**Il muro:** la fine del mesociclo 1 (settimana 4, o prima se l'utente lo completa in anticipo).

**Cosa succede al muro — "modalità mantenimento":**
- Il piano continua a esistere: l'ultima settimana del blocco 1 si ripete, identica. Le sedute si loggano normalmente, "precedente" in grigio resta, il timer parte, le sostituzioni manuali funzionano.
- Il motore **smette di pensare**: nessuna progressione di carico/rep, nessun deload, nessuna proposta di modifica, nessuna rinegoziazione della settimana. La readiness continua a offrire versione corta e riposo (sono deterministici e costano zero).
- La chat resta a 15 turni/mese: il coach risponde a domande di tecnica e motivazione ma dice, quando gli chiedi di cambiare il piano, che per farlo gli serve il blocco 2.
- È lo stesso pattern di Alpha ("log gratis, raccomandazioni a pagamento"), ma la raccomandazione l'hai già ricevuta per quattro settimane.

**Limite chat: 15 turni utente per mese solare (Europe/Rome).** Non contano: i messaggi proattivi del coach (commento al piano, apertura del "giorno no", riepilogo fine blocco) e i testi fissi di sicurezza. Il costo massimo di un free è quindi 15 turni + ~5 proattivi ≈ 20 chiamate/mese (§7). Il limite è dichiarato nella pagina prezzi; nessun trucco.

**Trigger di upgrade — tre superfici, in ordine di forza:**
1. **Riepilogo di fine blocco** (la superficie principale). Non un popup: una schermata del coach, generata dai dati reali, del tipo "Blocco 1 chiuso: 11 sedute su 12, il tuo stacco è passato da 60 a 75 kg, hai saltato il martedì due volte e sei sempre tornato. Il blocco 2 lo costruisco su questi numeri: più volume sulle gambe, deload in settimana 4." Sotto, due scelte pari dignità: *Costruisci il blocco 2 (Pro)* e *Continua in mantenimento (gratis)*. Il valore mostrato è specifico e non replicabile altrove: è la prova che il coach ti conosce.
2. **Quota chat**: a 12/15 un avviso inline nel composer ("ti restano 3 messaggi questo mese"); a 15/15 il composer si trasforma in una card Pro con il conteggio e la data di reset. La conversazione non viene interrotta a metà da un modale; i messaggi proattivi continuano ad arrivare.
3. **Richiesta di modifica in mantenimento**: se in mantenimento l'utente chiede un cambio di piano o scatta un secondo "giorno no", il coach risponde nel suo tono e offre le due opzioni gratuite (corta/riposo) più la terza (rinegoziare la settimana) marcata Pro, con link al checkout. Mai colpa, sempre una scelta: la card Pro non è la punizione del giorno saltato.

**Dove il paywall non compare mai:** dentro la schermata seduta, durante l'onboarding, nel flusso di sicurezza (dolore, temi medici). Un paywall in seduta è il tunnel di Fitbod in peggio.

**Perché non gate-are il primo "giorno no".** Il teardown propone "il coach mentale come gate naturale". Lo è — ma come *continuazione*, non come *prima volta*. Se il primo giorno no finisce dietro il paywall, l'utente vede solo una card e non capisce cosa sta comprando; se lo vede funzionare una volta, il blocco 2 si vende da solo.

---

## 7. Unit economics

**Ipotesi dichiarate.** Cambio 1 $ = 0,90 € `[assunzione, non verificato oggi]`. Costo per turno con cache dalla verifica #1 (2026-09-16, stima del ricercatore: 6.900 token in / 300 out): gpt-5.4-mini 0,0046 $, +10 % endpoint UE → **0,0051 $**; Claude Sonnet 5 **0,0118 $**. Commissioni Stripe Italia lette il 2026-09-16 su https://stripe.com/it/pricing: carte SEE **1,5 % + 0,25 €**, Stripe Billing **0,7 %** del volume, Stripe Tax **0,5 %** per transazione → **2,7 % + 0,25 €** per addebito. IVA **22 %** (Agenzia Entrate, verifica #23).

### Ricavo netto per abbonamento

| | Lordo IVA incl. | Netto IVA | Stripe (2,7 % + 0,25) | **Netto per noi** | Per mese |
|---|---|---|---|---|---|
| Pro mensile | 9,99 € | 8,19 € | 0,52 € | **7,67 €** | 7,67 € |
| Pro annuale | 59,99 € | 49,17 € | 1,87 € | **47,30 €** | 3,94 € |
| Fondatori annuale | 49,99 € | 40,97 € | 1,60 € | 39,37 € | 3,28 € |

### Costo LLM per utente al mese `stima`

| Profilo | Turni/mese | gpt-5.4-mini UE | Sonnet 5 | Note |
|---|---|---|---|---|
| Free tipico | 6 + 4 proattivi = 10 | 0,05 $ ≈ **0,05 €** | 0,12 $ ≈ 0,11 € | La maggior parte dei free non usa la chat |
| Free al cap | 15 + 5 = 20 | 0,10 $ ≈ **0,09 €** | 0,24 $ ≈ 0,21 € | Peggior caso per costruzione |
| Pro tipico | 40 + 8 = 48 | 0,24 $ ≈ **0,22 €** | 0,57 $ ≈ 0,51 € | 3 % del netto mensile con mini |
| Pro pesante | 150 | 0,77 $ ≈ 0,69 € | 1,77 $ ≈ 1,59 € | 9 % / 21 % del netto mensile |
| Pro al fair-use | 300 | 1,53 $ ≈ 1,38 € | 3,54 $ ≈ 3,19 € | 18 % / 42 % — il cap esiste per questo |

Routing raccomandato per tenere il tetto sotto il 30 % anche sull'annuale (3,94 €/mese netti): mini per i turni ordinari, Sonnet solo per i turni del protocollo "giorno no" (`stima` 10–15 % dei turni). Costo Pro tipico blended ≈ **0,25–0,30 €/mese**. Embedding: trascurabile (corpus < 5.000 chunk, text-embedding-3-small 0,02 $/1M token, verifica #4).

Verdetto: **il costo LLM non decide il prezzo**. Anche un Pro annuale pesante su Sonnet resta in margine positivo. Il vincolo del brief (free ≤ 20–30 % del Pro) è rispettato con un fattore 10 di scarto.

### Costi fissi mensili `stima`

| Voce | Stima | Fonte / stato |
|---|---|---|
| Backend Railway Hobby | 5 $ + consumo, ≈ 10–15 $ | docs.railway.com pricing, verifica #24 |
| Postgres Neon Launch (pgvector, PITR 7 gg) | ≈ 10–20 $ | Prezzo a consumo, **non verificato oggi** |
| Frontend Vercel | 0 € (Hobby) o 20 $ (Pro) | Il piano Hobby vieta l'uso commerciale: **non verificato oggi**, da confermare prima del lancio |
| Email Resend | 0 € fino a ~100 utenti attivi/giorno; poi 20 $ | resend.com/pricing, verifica #28 |
| LLM free users | 0,05 € × N free | §7 sopra |
| Dominio | ≈ 1–2 €/mese | non verificato |
| **Totale fisso a regime piccolo** | **≈ 40–60 €/mese** | |

Una tantum: **ExerciseDB Starter 199 $** (exercisedb.io/pricing, verifica #17 — vedi §8), parere legale + DPIA + privacy/ToS `stima` 500–1.500 € **non verificato** (dipende dal professionista).

### Aritmetica del pareggio (non è una previsione)

Contribuzione netta per Pro, mix `[assunzione]` 60 % mensili / 40 % annuali, LLM 0,30 €: 0,6 × 7,37 + 0,4 × 3,64 = **5,88 €/mese**. Zavorra dei free: a conversione 4 % `[assunzione, mediana della categoria]` ci sono 24 free per ogni Pro × 0,05 € = 1,20 € → contribuzione per Pro **≈ 4,70 €/mese** free compresi.

| Obiettivo | Fissi | Pro necessari | Account registrati a 4 % | A 2 % |
|---|---|---|---|---|
| **500 €/mese** | ≈ 50 € | **≈ 117** | ≈ 2.900 | ≈ 5.900 |
| **5.000 €/mese** | ≈ 150 € (Resend Pro, DB più grande) | **≈ 1.100** | ≈ 27.000 | ≈ 55.000 |

Se si vende solo l'annuale (fondatori), il numero di Pro per 500 €/mese sale a ≈ 170; se si vende solo il mensile scende a ≈ 90. La leva vera non è il prezzo: è la conversione e il canale (§9). Con 10.000 registrati e il 4 % si sta a ≈ 1.900 €/mese: **side business onesto, non un'azienda**. È questo il numero da tenere davanti.

---

## 8. Decisione sul database esercizi

Il brief (emendamento 4) chiede a me di valutare il costo. **Comprare ExerciseDB Starter, 199 $ una tantum** (exercisedb.io/pricing, 2026-09-16: 1.394 esercizi, GIF 180 e 360 px, licenza commerciale self-hosted, no ridistribuzione del dataset grezzo).

Motivi: (1) le GIF di esecuzione sono una convenzione load-bearing (teardown §4 #3), (2) le foto di free-exercise-db hanno provenienza non dichiarata (verifica #15) e un "Unlicense" apposto da chi non è l'autore non trasferisce diritti — un rischio legale che 199 $ eliminano, (3) 199 $ sono 26 abbonamenti mensili: non è la cifra che decide. Non comprare il Pro (599 $): sostituzioni e progressioni le fa il nostro motore.

Nomi e istruzioni in italiano: ExerciseDB non li ha. Si mappano dal dataset MIT `hasaneyldrm/exercises-dataset` (verifica #18, testi italiani riusabili, GIF no) e da wger (138 in italiano, CC-BY-SA con attribuzione per item) sul repertorio v1 di 3 split × 3 livelli — `stima` 80–120 esercizi, una giornata di revisione umana dei nomi. Obbligo: pagina "Crediti" con attribuzione wger per ogni item usato.

---

## 9. Distribuzione senza store: i primi 100 utenti italiani

**Il rischio.** Nessuno cerca "coach palestra" su un sito: lo cerca sullo store. Una PWA ha tre attriti che un'app nativa non ha: nessuna scoperta organica, "Aggiungi a Home" su iOS senza `beforeinstallprompt` (verifica #26, va spiegato con un'istruzione), e la sensazione di "non è una vera app". Il vantaggio: **Stripe senza commissione dello store** (Apple/Google trattengono una quota sugli abbonamenti in-app, 15–30 % `[non verificato oggi]`) e un prodotto desktop+mobile con un solo codebase.

**Come si trovano i primi 100 — canali in ordine di resa attesa, tutti a costo zero:**

1. **I 10 del Wizard-of-Oz** (brief §8 rischio #5) sono i primi 10 utenti, poi i primi 10 fondatori, poi le prime 10 recensioni. Il test non è solo di prodotto: è il seme della distribuzione.
2. **Tre palestre indipendenti, di persona.** Non un contratto B2B: un QR sul banco e un codice "1 mese Pro gratis per i nuovi iscritti". La palestra ha il nostro stesso problema (il nuovo iscritto di gennaio che non rinnova ad aprile) e non ha nulla da perdere. Tre palestre × 30 nuovi iscritti al mese = 90 registrazioni qualificate al mese `stima`. È anche il test a costo zero del modello F.
3. **Contenuti in italiano che il prodotto genera da solo.** Il chip di fonte è contenuto nativo: un video/post a settimana "perché 3 serie e non 5 — ecco lo studio" su TikTok/Instagram/YouTube Shorts, sempre chiudendo sulla scheda gratis. Nessun competitor italiano parla al principiante in questo tono; lo spazio è libero.
4. **SEO sulla scheda gratis.** "scheda palestra principiante", "scheda full body 3 giorni", "quante serie per muscolo": query italiane ad alto volume `[assunzione, non verificato]` per cui la risposta migliore è *generarla su misura*. Ogni landing di split (Full Body / Upper-Lower / PPL) è una pagina indicizzabile con un generatore in cima. Lento (mesi), ma composto.
5. **Comunità esistenti**: r/italy e i subreddit fitness italiani, gruppi Telegram/Facebook di palestra, forum. Con la regola di chiedere feedback, non di vendere.

**Cosa NON fare adesso:** pubblicità a pagamento (a 4,70 € di contribuzione un CAC sostenibile è sotto i 20 € `stima`, irraggiungibile su Meta senza dati), influencer (costo, e il pubblico è di intermedi), store (vedi sotto).

**Store, quando.** Se i dati mostrano che l'installazione su iOS è il punto di caduta (evento `install_prompt_shown` → `installed`), la strada meno costosa è **Android via TWA** (prezzo registrazione Play `[non verificato oggi]`, nessuna commissione se il pagamento resta sul web... `[non verificato: le policy Play sui pagamenti esterni cambiano]`). iOS con wrapper nativo implica IAP e commissione: lo si valuta solo con 100 paganti e un motivo scritto.

---

## 10. Cosa deve esistere nel prodotto (consegna a `backend-python` e `frontend-engineer`)

Questo modello **obbliga** a costruire in v1 le cose sotto. Ho tolto tutto ciò che il modello non richiede: **niente Billing Meters, niente trial Stripe, niente multi-tenant, niente prezzo a consumo, niente SSO**.

### Backend

**Entitlements e piani**
- `entitlements`: `user_id`, `plan` ∈ {`free`, `pro`}, `source` ∈ {`stripe`, `promo`, `manual`}, `valid_until`, `grace_until`. Un solo predicato letto ovunque: `is_pro(user, now)`.
- Regola di dominio del motore: `engine_active = is_pro OR mesocycle.index == 1`. Quando è falso, il generatore produce la settimana in **modalità mantenimento** (ripete l'ultima settimana del blocco 1: nessuna progressione, deload, proposta o rinegoziazione). `POST /plans/mesocycles` con `index ≥ 2` → `403 { code: "plan_required" }`.
- `renegotiate_week` e `propose_plan_change`: consentiti se `engine_active`; altrimenti `403 plan_required` e il coach lo sa dalla state card (campo `entitlement: free|pro`, `engine_active`, `chat_turns_left`).
- Storico: in free le query di progressi accettano `since ≥ now − 8 settimane`.
- Grant manuale (admin) e promo per fondatori/palestre: `source = manual|promo` con `valid_until`.

**Metering della chat**
- `llm_usage` per messaggio (già nel brief): token in/out/cache, modello, costo stimato in USD, `turn_kind` ∈ {`user_turn`, `proactive`, `safety`}.
- Contatore mensile per utente sul mese solare Europe/Rome: `chat_quota { used, limit, resets_at }` esposto in `GET /me`. Free `limit = 15`; Pro `limit = 300` con limite giornaliero 40. Contano solo i `user_turn`. A quota esaurita: `429 { code: "chat_quota_exceeded", detail, resets_at }`.
- Routing per `turn_kind`/protocollo: modello base per i turni ordinari, modello "tono" per i turni del giorno no. Provider dietro interfaccia, come da brief.

**Stripe**
- Prodotti: `fitcoach_pro` con due prezzi (`month` 9,99 €, `year` 59,99 €) + un prezzo `year_founders` 49,99 € con Promotion Code a 100 utilizzi. Tutti con `tax_behavior = inclusive`.
- **Stripe Tax attivo** con raccolta dell'indirizzo del cliente in Checkout (necessaria per il calcolo); il conto Stripe registrato per l'IVA italiana (verifica #23: "Registration threshold: 1 transaction").
- Checkout Session (hosted) senza trial; Customer Portal con: aggiorna carta, cambia mensile↔annuale, disdici a fine periodo, fatture/ricevute.
- Webhook idempotenti: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed` → aggiornano `subscriptions` (stripe ids, status, `current_period_end`, `cancel_at_period_end`) e `entitlements`. Pagamento fallito: `grace_until = +7 giorni` in Pro, poi downgrade a free (mantenimento).
- **Recesso (Dir. 2023/2673, in vigore dal 19-06-2026, verifica #23):** endpoint `POST /billing/withdraw` attivo per 14 giorni da `subscription.started_at`: cancella subito l'abbonamento, emette **rimborso integrale** via Refund API, invia email di conferma (supporto durevole) e registra `withdrawals { requested_at, refund_id }`. Le commissioni Stripe su un rimborso **non vengono restituite** `[non verificato oggi]`: costo ≈ 0,52 € per recesso, accettato.
- Ricevute: quelle di Stripe. Fatturazione elettronica B2C su richiesta: **flag per il legale**, non si costruisce nulla in v1.

**Eventi di prodotto (tabella `events`, prima parte, niente terze parti)**
`onboarding_completed`, `first_session_logged`, `no_day_triggered`, `no_day_option_chosen`, `mesocycle_completed`, `paywall_shown { surface: end_of_block | chat_quota | maintenance_request }`, `checkout_started { price }`, `subscription_started`, `withdrawn`, `churned`, `install_prompt_shown`, `installed`. Senza questi non si può decidere nulla in §11.

### Frontend

- **Pagina prezzi pubblica** con i due piani, prezzi IVA inclusa, la riga del free scritta chiaramente ("15 messaggi al mese, primo blocco completo, seduta gratis per sempre"), "disdici quando vuoi", "rimborso entro 14 giorni". Prezzo visibile anche sulla landing above the fold (lezione Caliber).
- **Le tre superfici del paywall** di §6, con il vincolo: mai in seduta, mai in onboarding, mai nel flusso di sicurezza. Il riepilogo di fine blocco è una schermata vera, disegnata (consegna a `ui-ux-designer`).
- **Indicatore quota** nel composer della chat (discreto, testuale, non una barra rossa); card Pro al posto del composer a 15/15.
- **Impostazioni → Abbonamento**: piano corrente, data di rinnovo, "Gestisci abbonamento" (Portal), "Disdici" sempre visibile, e il pulsante **"Recedi dal contratto qui"** — etichetta esatta, ben visibile per 14 giorni dall'acquisto, con conferma "Conferma recesso" e messaggio di ricevuta. Non è nascosto in un sottomenu: la direttiva chiede "prominently displayed".
- Pagine di ritorno da Checkout (successo/annullato) che aspettano il webhook (polling di `GET /me` per l'entitlement) prima di mostrare "Sei Pro".
- Badge **"stai parlando con un coach AI"** in chat (AI Act art. 50, in vigore): obbligo, non stile.
- Istruzione "Aggiungi a Home" per iOS con evento tracciato.

---

## 11. Cosa misurare e quando rivedere il listino

**Esperimenti di validazione a costo quasi zero, in ordine:**
1. **Landing con prezzo visibile e waitlist** (brief §8 rischio #6): messaggio per il profilo stretto, "9,99 €/mese, primo blocco gratis". Misura: tasso di iscrizione alla waitlist. Se converte l'intermedio e non il principiante, si riapre il §2 del brief.
2. **Wizard-of-Oz del "giorno no"** (già in brief): alla fine delle 2 settimane, chiedere ai 10 "a quanto lo pagheresti al mese?" con la griglia Van Westendorp (troppo caro / caro / affare / troppo economico). Dieci risposte non sono statistica ma smentiscono un ordine di grandezza sbagliato.
3. **Porta finta del Pro in beta**: pagina prezzi reale, checkout reale, primi 20 paganti. Il tasso `paywall_shown(end_of_block) → checkout_started` è il numero che decide se il muro è nel posto giusto. Sotto il 10 % `stima` il riepilogo di fine blocco non sta mostrando abbastanza; sopra il 30 % il free è troppo stretto o il prezzo troppo basso.

**Revisione del listino:** a 100 paganti e comunque ogni 6 mesi. Domande da farsi allora: (a) i Pro usano la chat abbastanza da giustificare un Pro+ umano? (b) il mix mensile/annuale è sotto il 40 % annuale → aumentare lo sconto o vendere solo annuale? (c) chi non converte a fine blocco, cosa fa nelle 2 settimane dopo? (d) è il momento del modello F (palestre)?

---

## 12. Rischi e bandiere

**Commerciali**
- **Conversione sotto il 2 %**: il modello regge ma i numeri di §7 raddoppiano. Mitigazione già dentro: il muro a fine blocco è a valore mostrato, non a tempo.
- **"Troppo poco AI"** per chi si aspetta ChatGPT (rinuncia del brief §4): nel posizionamento non si vende "AI", si vende "coach che sa perché". Il prezzo a 9,99 € va difeso con la spiegazione, non con il chatbot.
- **Il free in mantenimento è percepito come punitivo**: differenza da Alpha, che lascia il log gratis ma non ha mai dato raccomandazioni. Mitigazione: il coach lo spiega nel suo tono, la seduta continua a funzionare, e i grafici restano. Da osservare nell'evento `churned` post-blocco.
- **Prezzo sopra lo scaffale italiano** (4–7 €): è una scelta. Se la landing dice che 9,99 non passa, il primo passo è 7,99/49,99, non 4,99.

**Piattaforma**
- **Nessuno store**: rischio #10 del brief, risposta in §9. È il rischio commerciale più grosso e non ha una mitigazione software.
- **Provider LLM**: Haiku 4.5 con ritiro possibile da ottobre 2026 e Gemini Flash che raddoppia dal 2027 (verifica §7): le stime di §7 sono su mini/Sonnet apposta. Provider dietro interfaccia, come da brief.
- **Vercel Hobby e uso commerciale**: da verificare prima del lancio; il costo Pro (20 $/mese) è dentro i fissi ma cambia il pareggio di ~4 Pro.

**Conformità (bandiere per l'utente — non è consulenza legale, indico la cosa da guardare)**
- **Partita IVA e regime fiscale** per vendere abbonamenti B2C online: da aprire prima del primo checkout. Stripe Tax calcola e riscuote l'IVA, non la dichiara.
- **IVA 22 % inclusa e Stripe Tax** attivo dalla prima transazione (verifica #23). Vendite a consumatori di altri Paesi UE: soglia 10.000 € e OSS — sotto soglia si applica l'IVA italiana; da tenere d'occhio se compaiono clienti esteri.
- **Pulsante di recesso** ex Dir. 2023/2673 (art. 11a Dir. 2011/83): applicabile dal 19-06-2026; il recepimento italiano non è stato verificato (verifica #23). Il portale Stripe **non basta**: serve la funzione dedicata di §10.
- **Rinnovo automatico**: eventuali obblighi italiani di preavviso prima del rinnovo (in particolare sull'annuale) `[non verificato]`: chiedere al legale; nel dubbio, email 7 giorni prima del rinnovo annuale costa nulla e previene i chargeback.
- **Fatturazione elettronica** per B2C su richiesta del cliente `[non verificato]`: da chiedere al commercialista.
- **AI Act art. 50(1)** (in vigore dal 2-8-2026): badge AI obbligatorio in chat.
- **GDPR art. 9 + DPIA obbligatoria** (Garante provv. 467/2018, verifica #20): consenso esplicito separato per infortuni/dolori; la DPIA è un documento da fare prima del lancio, non dopo.
- **Trasferimento extra-UE dei dati verso il provider LLM**: con `eu.api.openai.com` la voce in privacy policy è semplice; con Anthropic first-party serve la clausola SCC (verifica #2). Va scritto nella privacy policy qualunque sia la scelta.
- **Dir. 2024/2853 responsabilità da prodotto** (dal 9-12-2026): il software è "prodotto"; le mitigazioni sono già nell'architettura (regole versionate, audit trail). Nessun impatto sul listino, ma un motivo in più per non promettere risultati ("59% faster" alla Dr. Muscle è esattamente la frase da non scrivere mai).
- **Prezzi e sconti**: "−50 %" sull'annuale è un confronto col mensile, non uno sconto su un prezzo precedente; va scritto come "equivale a 5 €/mese" per non ricadere nelle regole sugli annunci di riduzione di prezzo `[non verificato]`.

---

## Appendice — cosa cambierebbe questo documento

- Se la landing o i 10 del WoZ dicono che 9,99 € non passa: 7,99 €/mese e 49,99 €/anno, e il prezzo fondatori scende a 39,99 €. Il modello non cambia.
- Se la conversione a fine blocco è sotto il 5 % e la quota chat non viene mai toccata: il muro è troppo tardi → mesociclo 1 di 3 settimane invece di 4, oppure blocco 1 completo ma "giorno no" con rinegoziazione solo Pro dalla seconda volta.
- Se i Pro annuali pesanti su Sonnet superano il 30 % del netto: routing più aggressivo verso mini, poi fair-use a 200. Mai vendere messaggi.
- Se compaiono 3 palestre che chiedono "quanto per tutti i miei iscritti": si riapre il modello F con un prezzo per iscritto attivo, e a quel punto serve il multi-tenant che oggi non si costruisce.
