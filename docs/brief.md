# fitcoach — Brief (fase 2)

Data: 2026-09-16 · Autore: brainstormer · Input: `allineamento.md`, `competitors.md`, `CLAUDE.md`

Ogni numero in questo documento è etichettato `stima` salvo dove è citata la fonte. Le assunzioni sono marcate `[assunzione]` con cosa le cambierebbe.

---

## 0. Verdetto

**Vale la pena, con una correzione che non è negoziabile: l'LLM non deve mai essere la fonte dei numeri del piano.** Se i set, le rep, i carichi e i deload escono dal modello linguistico, le citazioni sono decorazione e le allucinazioni su temi di salute sono una questione di quando, non di se. La correzione è architetturale (sezione 7) e cambia l'ordine di costruzione: prima il motore e la base di regole, poi la chat.

Seconda avvertenza, non fatale: "utente = tutti" è un vincolo preso, e lo rispetto, ma non è una guida per le decisioni di design. Sotto nomino il profilo che vince quando due scelte confliggono.

---

## 1. L'obiettivo vero

Quello che l'utente ha chiesto è "un coach AI con base scientifica". Il passo indietro:

> **Se funziona, chi si è iscritto in palestra ed è andato da solo è ancora lì dopo tre mesi: sa perché fa quello che fa, e il giorno in cui non ha voglia non è il giorno in cui molla.**

La metrica che dice se stiamo vincendo non è "qualità del piano" (lì Alpha Progression e Fitbod sono avanti di anni) ma **aderenza a 8 settimane**: quante persone che hanno completato l'onboarding hanno loggato almeno una seduta nella settimana 8. Tutto il resto — piano, citazioni, chat — è strumentale a quel numero.

Perché la frase regge: il teardown mostra che la gente paga 199 $/mese (Future) e 19–200 $/mese (Caliber) per *qualcuno che ti scrive*, e che il software che ha provato a farlo (Freeletics Mindset) è morto perché scollegato dal piano. Il bisogno è pagato e non servito.

---

## 2. Per chi (versione stretta)

Vincolo dall'allineamento, non in discussione: **tutti, profilati in onboarding** (principiante / intermedio / obiettivo salute). L'app deve funzionare per i tre profili.

Ma "tutti" non decide nulla. Quando una scelta di design serve un profilo e ne penalizza un altro, vince questo:

> **Chi ha tra i 25 e i 45 anni, va in palestra da solo (senza PT), da meno di un anno o ci è tornato dopo una pausa, si allena 2–4 volte a settimana, e ha già mollato almeno una volta.** Ha un abbonamento che paga e non usa abbastanza. Non sa cosa sia "RIR". Si fida di chi gli spiega le cose senza fargli la predica.

`[assunzione]` Questo è il profilo con il dolore più forte e il mercato italiano più vuoto (Arvo parla a chi conosce "MRV"; Gym Coach AI ha una recensione). Lo cambierei se il product-strategist trovasse che chi paga davvero è l'intermedio — ma il teardown dice che l'intermedio ha già Alpha/Hevy e paga 4–13 $ perché non ha bisogno di coaching.

Gli altri due profili sono serviti, non ottimizzati: l'intermedio riceve un motore più aggressivo e meno spiegazioni; l'"obiettivo salute" riceve parametri conservativi e un gate di sicurezza più stretto (sezione 6).

**Job-to-be-done** (dal teardown): "Dimmi cosa fare oggi, adattalo a me quando cambio, e non farmi mollare." Il terzo pezzo è il nostro.

---

## 3. Le tre strade

Tre approcci diversi, non tre taglie della stessa cosa.

| | **A. Il motore decide, il coach parla** | **B. LLM-first con RAG** | **C. Coach umano assistito dall'AI** |
|---|---|---|---|
| **Approccio** | Motore deterministico di programmazione (regole derivate da studi, con citazione attaccata a ogni regola) genera e adatta il piano. L'LLM è l'interfaccia: spiega, dialoga, gestisce il "giorno no", e *propone* modifiche che il motore valida. | L'LLM genera il piano direttamente, ancorato con retrieval su un corpus di studi/linee guida; le citazioni vengono dai chunk recuperati. | Un coach umano (all'inizio il founder o un collaboratore qualificato) approva ogni piano e risponde alle domande difficili; l'LLM prepara le bozze e gestisce le risposte semplici. |
| **Costo di build** `stima` | Alto all'inizio: motore + curazione di 40–60 regole con fonti verificate (2–4 settimane di lavoro umano su paper) prima di vedere la chat. Poi lineare. | Basso all'inizio: prompt + corpus + RAG in giorni. Alto dopo: ogni allucinazione è un caso a mano; valutazione continua. | Basso in software, altissimo in ore-persona: non scala senza assumere. |
| **Costo di esercizio** | LLM solo per il dialogo, con contesto compatto. La generazione del piano costa zero token. | Ogni piano e ogni adattamento passa dal modello con contesto lungo (corpus). Il più caro per utente. | Ore umane per utente; prezzo di vendita obbligato sopra i 50 €/mese (Caliber, Future). |
| **Cosa ci guadagni** | Numeri riproducibili e spiegabili; citazioni *vere* per costruzione; allucinazioni confinate al testo, mai ai carichi; costo per utente controllabile; testabile senza LLM. | Flessibilità totale (qualunque metodologia, qualunque richiesta); time-to-demo brevissimo; il "wow" della chat che sputa il piano. | Fiducia massima; nessun problema di allucinazione; disponibilità a pagare dimostrata (199 $/mese). |
| **Cosa ti preclude** | Il coach non può programmare fuori dallo spazio delle regole ("fammi un Mentzer HIT" → "non è nel mio repertorio"). Il repertorio iniziale è stretto (3 split × 3 livelli). | Un free tier sostenibile (ogni interazione costa). La verificabilità: una citazione recuperata non garantisce che il numero generato la rispetti. La fiducia, appena un utente becca un errore. | Il modello di business freemium consumer; il target "principiante che paga 10 €"; la scalabilità. Cambia prodotto, non solo architettura. |
| **Rischio dominante** | Il motore è "troppo poco AI" per l'utente che si aspettava ChatGPT. | Salute: un consiglio sbagliato su dolore/infortunio. Costo. | Non è un'app, è un'agenzia. |

Una quarta strada, tenuta come piano B se il costo LLM uccide tutto: **D. Tracker con schede fondate e spiegate, senza chat** — Hevy con la fonte accanto al numero. Vale meno (non serve il "giorno no"), ma è la parte di A che sopravvive a qualunque scenario.

---

## 4. La raccomandazione

**Strada A**, con un pezzo di B confinato: RAG *solo* per le domande libere in chat ("perché il riposo di 2 minuti?", "mi fa male la spalla in panca") e mai per generare parametri.

**Perché A e non B.** Il varco individuato dallo scout è "la fonte nel momento della raccomandazione". Con B la fonte è probabilisticamente corretta; con A è corretta per costruzione, perché la citazione è un campo della regola che ha prodotto il numero. È l'unica architettura in cui il chip "3 set/sett: Schoenfeld 2017" non può mentire. In più rende la chat *opzionale*: l'app chiude il ciclo onboarding → piano → seduta anche con zero messaggi, il che protegge il costo LLM e serve chi non vuole parlare.

**Perché A e non C.** C è un business diverso (Caliber/Future) e l'utente ha deciso "chat LLM". Ma C resta la strada d'uscita naturale per un piano premium futuro: il motore + l'audit trail delle proposte del coach (sezione 7) sono esattamente quello che un coach umano rivedrebbe.

**Rispetto del vincolo "il coach genera piani e dialoga".** Dal punto di vista dell'utente il coach genera il piano: lo chiede in chat, il coach lo commenta, lo modifica quando glielo chiedi. Sotto, il coach lo fa chiamando il motore, non scrivendo numeri. È una scelta di come, non di cosa.

**Cosa stiamo rinunciando a scegliere A:**
1. **La flessibilità.** Il coach non improvvisa metodologie. Chi vuole FST-7 o un peaking da gara ha Arvo e Juggernaut.
2. **La velocità di demo.** Con B avremmo una chat che produce un piano in tre giorni. Con A le prime tre settimane `stima` sono motore e curazione delle regole, senza niente da mostrare. Va detto all'utente adesso, non alla settimana tre.
3. **Il "wow" conversazionale in onboarding.** L'onboarding resta un form (convenzione load-bearing del teardown); la chat arriva dopo, a commentare. Meno magico, più veloce al primo valore.
4. **La copertura.** 3 split × 3 livelli × attrezzatura (palestra / casa con manubri / corpo libero) è il repertorio v1. Chi non ci sta dentro riceve il più vicino, con la spiegazione del perché.

---

## 5. Scope v1

**Definizione di fatto** (dall'allineamento): onboarding → piano personalizzato → seguire/loggare la seduta → il coach risponde (tecnica, adattamenti, motivazione). In più, la v1 non è finita senza il **protocollo "giorno no"** funzionante, perché è la ragione per cui questo prodotto esiste.

### Entra

| # | Cosa | Perché entra |
|---|---|---|
| 1 | **Onboarding a form, 5 schermate**: obiettivo · livello · giorni/settimana · luogo e attrezzatura · vincoli (infortuni, dolori, tempo per seduta) + gate di sicurezza (questionario tipo PAR-Q+, da verificare licenza). Alla fine il piano è pronto. | Convenzione load-bearing di tutti e sei i competitor. Chat al posto del form = tempo al primo valore più lungo. |
| 2 | **Il coach commenta il piano in chat** subito dopo l'onboarding: tre righe in italiano su perché questo split, questo volume, questa progressione, con i chip di fonte. | È il primo momento in cui il prodotto si differenzia. Pattern Bloom/SensAI. |
| 3 | **Motore di programmazione**: mesociclo di 4–6 settimane; split Full Body (2–3×) / Upper-Lower (4×) / PPL (5–6×); selezione esercizi per attrezzatura con sostituzioni; volume per gruppo muscolare per livello; progressione doppia (rep poi carico) guidata dal RIR loggato; deload a regola; versione corta di ogni seduta (≈25'). | È il prodotto. Ogni parametro porta il `rule_id` che l'ha generato. |
| 4 | **Chip di fonte accanto al numero** + scheda studio (autori, anno, rivista, DOI, cosa dice in una riga in italiano, cosa *non* dice). | Il varco. Nessun competitor ce l'ha. |
| 5 | **Schermata seduta** (mobile-first): lista verticale esercizi, riga set con "precedente" in grigio, peso e rep grandi, check che avvia il timer, RIR per set, sostituzione esercizio in 2 tap, GIF/immagine dell'esecuzione a un tap. Bozza salvata in locale e sincronizzata quando c'è rete. Nessun tunnel: si può navigare altrove. | Se è più lenta di Hevy, l'utente logga su Hevy e il coach resta cieco. La resilienza alla rete è obbligata: le palestre sono seminterrati. |
| 6 | **Readiness in 10 secondi** prima della seduta (sonno, voglia, dolori) → il motore adatta oggi (versione corta, scambio, riposo) e lo dice. | È dove coach mentale e coach di allenamento si toccano. Pattern Juggernaut, riletto per il principiante. |
| 7 | **Protocollo "giorno no"**: seduta saltata o readiness bassa → il coach apre con Motivational Interviewing (domanda aperta, riflessione, mai colpa), offre tre opzioni (seduta da 20', spostare, riposo con settimana rinegoziata), il motore ricalcola la settimana. Filtri di sicurezza su tassonomia Bloom (dolore/infortunio, segnali di disturbo alimentare, temi medici → testo fisso + rimando al professionista). | Seconda feature-firma. Freeletics è morto perché era una libreria; questo *conosce* il piano. |
| 8 | **Chat del coach** con stato strutturato (profilo, mesociclo, settimana, ultime sedute, readiness, aderenza) e tool: leggere lo storico, proporre una modifica al piano (validata dal motore, confermata dall'utente), cercare nel corpus. Italiano. Contatore messaggi per piano. | Il vincolo dell'allineamento. Metered dal giorno uno perché il paywall va progettato. |
| 9 | **Progressi**: grafico per esercizio, PR automatici, e una **metrica-firma di costanza** (aderenza al piano su 4 settimane) che non punisce il giorno saltato ma mostra il recupero. | Ricompensa base della categoria + il nostro angolo (Caliber "Strength Balance", Bloom "giardino"). |
| 10 | **Desktop**: vista settimana/mesociclo per rivedere e modificare il piano, storico, chat a schermo largo. Stessa app Next.js responsive, non un secondo prodotto. | Vincolo dell'allineamento; nessun competitor è desktop-first. |
| 11 | **Account, piani Free/Pro, Stripe** (checkout, portale cliente, webhook → entitlement), tabella di consumo LLM per utente. | Il paywall si progetta, non si appiccica. Il limite free lo decide il product-strategist sui dati di consumo. |
| 12 | **Email di mancata seduta** (una, dopo 24–48h, con link al "giorno no"). Nessuna altra notifica. | Il coach mentale deve poter bussare; questo è il canale più economico. `[assunzione]` che basti: lo cambia il test in sezione 8. |
| 13 | **Disclaimer non medico** in onboarding e in chat, consenso esplicito per i dati su infortuni, "scarica i tuoi dati" (JSON), cancellazione account. | Obblighi (da verificare la forma esatta, sezione 9). |

### Tagli (deliberati)

| Tagliato | Motivo |
|---|---|
| **Nutrizione** | Deciso in allineamento. Inoltre è il tema con più rischio legale e allucinatorio. |
| **Video propri girati da trainer** | Costo di produzione fuori scala per la v1. Usiamo un database esercizi open con immagini/GIF (licenza da verificare). Il segnale di credibilità lo diamo con la fonte, non col video. |
| **Wearable / Apple Health / Garmin** | Integrazione costosa, doppio conteggio (lamentela Zing), non serve al ciclo. |
| **Social, feed, condivisione** | Hevy lo fa; non è il nostro job. |
| **Notifiche push** | Web Push su iOS ha vincoli (da verificare); una email basta per testare se il "bussare" funziona. |
| **Cardio e mobilità programmati** | Solo allenamento con sovraccarico. Il profilo "salute" riceve una raccomandazione testuale di attività aerobica (linee guida), non un piano. Motivo: raddoppierebbe la base di regole. |
| **Builder di programma da zero** | L'utente modifica e sostituisce, non parte da bianco. Chi vuole il builder ha Boostcamp gratis. |
| **Autoregolazione fine set-per-set** (Juggernaut) | Non competere sul loro campo. Readiness per seduta + RIR per set che alimenta la settimana dopo. |
| **Peaking, gare, powerlifting** | Fuori dal profilo. |
| **Badge, streak, achievement** | Deliberato: lo streak punisce il giorno saltato, che è esattamente il momento che vogliamo trattare con cura. |
| **Metriche corporee, foto progressi** | Fuori dal ciclo; rischio su segnali di disturbo alimentare. |
| **Multi-lingua, voce, coach umano, marketplace, profili palestra multipli, calcolatori 1RM/dischi** | Dopo. |
| **App native** | Web app responsive + PWA installabile. Se il test in palestra (sezione 8) fallisce su iOS, si riapre. |
| **Chat libera per generare il piano** | Vedi sezione 4: rinuncia esplicita. |

---

## 6. Base di conoscenza scientifica: come è fatta

Tre strati, con tre ruoli diversi. La distinzione è il cuore della raccomandazione.

### Strato 1 — Regole (governano i numeri)

Una tabella `rules`, versionata, curata da umani. Ogni regola:

```
id:            volume.hypertrophy.intermediate.weekly_sets
governa:       set settimanali per gruppo muscolare
si applica a:  obiettivo=ipertrofia, livello=intermedio
valore:        10–20 (default 12)
grado:         A/B/C (forza dell'evidenza, scala nostra, dichiarata)
citazioni:     [cit_0012, cit_0031]
riassunto_it:  "Le meta-analisi mostrano che 10+ set/settimana per muscolo
                producono più ipertrofia di <5; oltre 20 il beneficio è incerto."
non_dice:      "Non dice che più è sempre meglio, né vale per i principianti."
```

Ambito v1 `stima`: 40–60 regole su volume, frequenza, range di rep, RIR/prossimità al cedimento, riposo tra set, ordine esercizi, progressione, deload, selezione per principiante, adattamenti per dolore/infortunio (solo: riduci, sostituisci, rimanda al professionista). Il motore legge le regole; ogni parametro del piano esce con `rule_id` → il chip di fonte è una join, non una generazione.

Chi le scrive: una persona che legge i paper (l'LLM può preparare la bozza, un umano verifica sull'abstract). È il costo nascosto del progetto e va messo a calendario.

### Strato 2 — Citazioni (verificate)

Tabella `citations`: DOI, autori, anno, rivista, titolo, tipo (meta-analisi / RCT / linea guida / position stand), open access sì/no, link. Ogni record è verificato via API (Crossref / OpenAlex / PubMed: il DOI risolve e il titolo coincide) prima di entrare. Le API pubbliche servono a **verificare** le citazioni, non come corpus vivo: abstract grezzi sono rumorosi, contraddittori e in inglese.

### Strato 3 — Corpus per il dialogo (RAG, solo testo)

Documenti scritti da noi in italiano, chunkati e indicizzati in Postgres con pgvector:
- riassunti in italiano di ogni citazione (dallo strato 2),
- schede tecnica esercizio (cue, errori comuni, sostituzioni),
- protocolli del coach mentale (Motivational Interviewing, ricadute, "giorno no", ritorno dopo pausa),
- testi fissi di sicurezza (dolore acuto, vertigini, temi medici, disturbi alimentari).

L'LLM può citare **solo ID presenti nei chunk recuperati**. Un validatore post-risposta rimuove qualunque citazione non nel set recuperato e, se la risposta ne dipendeva, la sostituisce con "non ho una fonte su questo". Non è una speranza: è un controllo su stringhe.

### Come il coach "vede" piano e log

A ogni turno l'LLM riceve una **state card** compatta (`stima` 300–600 token): profilo, obiettivo, mesociclo e settimana corrente, sedute pianificate/fatte/saltate della settimana, ultime 3 sedute in sintesi (esercizi, carichi, RIR medio), readiness di oggi, aderenza a 4 settimane, PR recenti, vincoli dichiarati. Più tool:

- `get_exercise_history(exercise, n)` — lettura
- `get_session(date)` — lettura
- `search_corpus(query)` — RAG
- `propose_plan_change(patch)` — scrittura **mediata**: il motore valida il patch contro le regole, produce il diff, l'utente conferma, poi si applica. L'LLM non scrive mai nel DB direttamente.
- `renegotiate_week(reason, option)` — il "giorno no": il motore ricalcola.

Ogni proposta finisce in `plan_change_proposals` con stato (proposta / accettata / rifiutata / non valida): è l'audit trail che rende leggibile cosa ha fatto il coach e che un coach umano potrebbe rivedere in futuro.

### Il coach mentale non è retrieval

È un **protocollo**: stati (seduta saltata, readiness bassa, seconda seduta saltata di fila, ritorno dopo 2+ settimane), per ogni stato un'apertura MI e tre opzioni concrete. Il testo lo genera l'LLM dentro il protocollo; le opzioni e i ricalcoli li fa il motore. Bloom (RCT, CHI 2026) è il riferimento per il tono: "persistent but not aggressive". Il vincolo di prompt: mai giudicare, mai "dovresti", sempre una scelta.

---

## 7. Architettura

Studio default, senza scostamenti che cambino stack. Le scelte dentro i default sono argomentate.

```
[Browser desktop/mobile — Next.js App Router, PWA]
   │  HTTPS / JSON
   ▼
[FastAPI — Railway/Render]
   ├── auth (email+password, sessione JWT)
   ├── /onboarding, /plans, /sessions, /sets, /readiness, /progress
   ├── /chat  ──► orchestratore LLM ──► provider LLM (API esterna)
   │                 │  state card + tools
   │                 ├── plan_engine (deterministico, regole)
   │                 ├── rag (pgvector)
   │                 └── citation_validator
   ├── /billing ◄──► Stripe (checkout, portal, webhook)
   └── worker leggero (email mancata seduta)
   │
   ▼
[PostgreSQL + pgvector — async SQLAlchemy, Alembic]
```

**Comprato vs costruito**
- Comprato: LLM (API), embedding (API), Stripe, email transazionale (provider da verificare), hosting, database esercizi open (licenza da verificare).
- Costruito: motore di programmazione, base di regole, corpus italiano, orchestratore chat con tool, validatore citazioni, schermata seduta, protocollo "giorno no".

**Scelte dentro i default, con argomento**
- **pgvector nel Postgres principale, niente vector DB separato.** Il corpus v1 è `stima` < 5.000 chunk: un servizio in più non si giustifica. Va verificato che il provider Postgres scelto abbia l'estensione.
- **Niente Redis/coda in v1.** L'unico job è l'email di mancata seduta: un task schedulato nel processo backend basta. Il rate limiting si fa in-process o via proxy. Se compaiono job lunghi (report settimanali), si aggiunge.
- **Provider LLM dietro un'interfaccia** con struttura del messaggio, tool e streaming astratti: il modello cambierà, i prezzi cambieranno, e il costo per utente è il rischio #2. Il modello lo sceglie il ricercatore sui dati (sezione 9); requisito: tool use affidabile, output strutturato, buon italiano, prompt caching, endpoint UE o DPA adeguato.
- **Motore di programmazione come modulo puro** (input: profilo + storico + regole → output: piano), testabile senza LLM né DB. È il pezzo con più test.
- **PWA con bozza seduta in IndexedDB** e sync al ritorno della rete. Non "offline-first" completo (troppo per v1): solo la seduta in corso non si perde.
- **Stripe dal giorno uno, attivato dopo.** Tabelle `subscriptions` e `entitlements` esistono da subito; `llm_usage` (token in/out, modello, costo stimato, per messaggio) esiste da subito perché il limite free è una decisione del product-strategist che ha bisogno di quei dati.

**Modello dati (entità principali)**
`users`, `profiles` (livello, obiettivo, vincoli, consenso dati salute), `exercises`, `exercise_media`, `muscle_groups`, `rules`, `citations`, `corpus_chunks` (con embedding), `mesocycles`, `plan_weeks`, `planned_sessions`, `planned_sets` (con `rule_id` per parametro), `logged_sessions`, `logged_sets` (peso, rep, RIR), `readiness_checks`, `chat_threads`, `chat_messages`, `plan_change_proposals`, `llm_usage`, `subscriptions`, `entitlements`.

**Contratto**: il backend congela `/openapi.json` prima che parta il frontend (regola dello studio). Errori con `code` macchina + `detail` umano su tutta l'API; `response_model` ovunque; Alembic, mai `create_all`.

---

## 8. Rischi, ordinati, con la prova più economica

| # | Rischio | Tipo | Prova più economica |
|---|---|---|---|
| 1 | **La seduta è più lenta di Hevy** → l'utente logga altrove, il coach non vede nulla, il "giorno no" non scatta mai. | Non funziona | Prima di costruire il coach: prototipo della sola schermata seduta, 5 persone loggano la stessa seduta su Hevy e su di noi, cronometro. Se siamo oltre il +20% `stima`, si riprogetta. |
| 2 | **Costo LLM per utente free** mangia il margine. | Non si vende | `llm_usage` dal primo giorno; simulazione di un utente pesante per 30 giorni con la state card reale; il ricercatore porta i prezzi; il product-strategist fissa il limite. Se il costo di un free attivo supera il 20–30% `stima` del prezzo Pro mensile, la chat free si restringe. |
| 3 | **Allucinazione su salute** (dolore, infortunio, "allenati lo stesso"). | Non funziona / legale | Prima del lancio: 100 prompt avversari (dolore acuto, vertigini, "voglio perdere 5 kg in una settimana", "ho 60 anni e pressione alta") contro prompt + filtri; conteggio delle fughe. Soglia: zero fughe sulle categorie rosse. |
| 4 | **Citazioni infedeli** (ID giusto, contenuto piegato). | Fiducia | Validatore automatico (ID ⊂ chunk recuperati) su 200 risposte generate; 30 lette da una persona che controlla che la frase rispetti l'abstract. |
| 5 | **Il "giorno no" è percepito come nagging** o come vuoto. | Non funziona | Wizard-of-Oz: 10 persone, 2 settimane, un umano scrive su WhatsApp seguendo il protocollo MI. Misura: quanti rispondono, quanti fanno la seduta corta, quanti chiedono di smettere. Costa zero codice. |
| 6 | **Il target "tutti" diluisce tutto.** | Non si vende | Landing con il messaggio per il profilo stretto (sezione 2) e prezzo visibile; misurare iscrizione alla waitlist. Se converte l'intermedio e non il principiante, si riapre la sezione 2. |
| 7 | **Vincoli legali/GDPR** (dati salute art. 9, disclaimer, AI Act trasparenza). | Legale | Domande secche al ricercatore (sezione 9); se una risposta impone un professionista dietro l'app, la strada C rientra. |
| 8 | **PWA su iOS in palestra** (persistenza, installazione, timer in background). | Non funziona | Una persona usa il prototipo seduta in una palestra vera per una settimana su iPhone. |
| 9 | **La base di regole invecchia** o è sbagliata. | Non si mantiene | Regole in dati versionati con `grado` e data; una revisione ogni 6 mesi `stima`. Test del motore sulle regole: se cambio una regola, i piani di prova cambiano dove atteso. |
| 10 | **Nessun canale di distribuzione** (web app senza store). | Non si vende | Fuori dal mio ambito: al product-strategist. Segnalo che è il rischio commerciale che il teardown non copre. |

---

## 9. Da verificare (per il `ricercatore`)

Domande secche. Ogni risposta con fonte primaria e data.

**LLM e embedding**
1. Per i modelli "small/fast" correnti di Anthropic, OpenAI e Google: prezzo per 1M token input e output, sconto e meccanica del prompt caching, supporto a tool use e output strutturato (JSON schema), finestra di contesto, rate limit al tier d'ingresso.
2. Esiste un endpoint o una regione UE per ciascuno? Il DPA copre GDPR? I dati inviati via API sono usati per training per default?
3. Quale ha la migliore qualità in italiano? Esiste un benchmark pubblico in italiano recente?
4. Modelli di embedding: prezzo, dimensioni, qualità multilingue (italiano); il pgvector regge 5.000–50.000 chunk senza indice specializzato?
5. Streaming + tool use insieme: quali provider lo supportano nella stessa risposta?

**Fonti scientifiche**
6. PubMed E-utilities: gratuito? limiti di richieste al secondo con e senza API key? Restituisce abstract? Condizioni per mostrare abstract in un'app commerciale.
7. OpenAlex API: limiti, restituisce abstract (indice invertito)? Licenza dei dati (CC0?).
8. Semantic Scholar API: serve una key? limiti? termini d'uso per un'app commerciale? restituisce TLDR/abstract?
9. Crossref API per la verifica DOI: limiti e "polite pool".
10. Quali linee guida di riferimento sono a licenza aperta e citabili integralmente: linee guida OMS attività fisica 2020, position stand ACSM, NSCA? Per ciascuna: licenza e disponibilità del testo.
11. Elenco delle meta-analisi chiave su volume, frequenza, RIR/cedimento, riposo tra set, range di rep, periodizzazione, deload, principianti: per ciascuna DOI, anno, e se è open access.
12. Il paper Bloom (Stanford, CHI 2026): sono pubblicati prompt, tassonomia dei danni e filtri di sicurezza? Con quale licenza?
13. Esiste una griglia pubblica per valutare la fedeltà al Motivational Interviewing (es. MITI) utilizzabile come rubrica di test?
14. Il questionario PAR-Q+ è utilizzabile in un'app commerciale? Licenza e condizioni.

**Database esercizi**
15. free-exercise-db (yuhonas): licenza, numero esercizi, licenza delle immagini, presenza di nomi italiani.
16. wger: licenza dei dati esercizi e delle immagini; uso commerciale ammesso? obblighi di attribuzione; traduzioni italiane disponibili? limiti API.
17. ExerciseDB (RapidAPI): prezzo, si possono scaricare e ospitare le GIF? uso commerciale? termini.
18. Esiste un dataset aperto con nomi degli esercizi in italiano e mappatura ai gruppi muscolari?

**Legale (Italia/UE)**
19. In Italia, fornire schede di allenamento via software è attività riservata a una professione (chinesiologo, D.Lgs. 36/2021; legge 4/2013)? Serve un professionista dietro l'app? Quali disclaimer usano le app in commercio in Italia?
20. Dati su allenamento, infortuni e dolori: sono "dati relativi alla salute" ex art. 9 GDPR? Serve consenso esplicito? Serve una DPIA?
21. AI Act: un coach fitness conversazionale rientra in una categoria di rischio? Obbligo di dichiarare che si parla con un'AI (art. 50): da quando si applica?
22. Nuova direttiva responsabilità da prodotto (2024) applicata al software: cosa cambia per un'app che dà consigli di allenamento?
23. Abbonamenti digitali in Italia: requisiti di disdetta (Codice del consumo), IVA sui servizi digitali B2C, Stripe Tax copre l'Italia?

**Stack e infrastruttura**
24. Railway e Render: Postgres con estensione pgvector disponibile? costo dell'istanza minima, politica di sleep, backup. Alternativa gestita (Neon/Supabase) se no.
25. Stripe: Checkout + Customer Portal + trial + webhook per abbonamenti; Billing a consumo per messaggi extra è praticabile? Limiti in test mode.
26. PWA su iOS Safari: persistenza IndexedDB (cancellazione dopo inattività?), installazione, Web Push (solo da home screen? da quale versione?), timer in background.
27. Next.js: versione corrente e libreria PWA mantenuta per App Router.
28. Provider email transazionale: free tier, prezzo, regione UE (Resend, Postmark, o altro).
29. SQLAlchemy async + pgvector: libreria mantenuta e compatibile con la versione corrente.
30. FastAPI: rate limiting in-process affidabile con più worker, o serve Redis fin da subito?

---

## 10. Obiezioni che ho mosso alla bozza (e cosa hanno cambiato)

- *"Il principiante non legge gli studi: il chip è rumore."* Vero. Il chip non è da leggere: è il segnale che rende possibile la spiegazione in una riga in italiano, e quella sì la leggono. Il valore per il principiante è `riassunto_it`, non il DOI. Entrambi vengono dalla stessa regola. Cambiato: la scheda studio ha "cosa dice / cosa non dice" in italiano prima dei metadati.
- *"È Alpha Progression più un chatbot: perché cambiare?"* Perché il piano non è dove vinciamo. Vinciamo nel momento in cui l'utente sta per mollare. Cambiato: la metrica di successo è l'aderenza a 8 settimane, non la qualità del piano; e il "giorno no" è nella definizione di fatto.
- *"L'utente che non vuole parlare?"* L'app chiude il ciclo con zero messaggi. Cambiato: la chat è uno strato, e questo protegge anche il costo.
- *"Il motore non è abbastanza AI per chi si aspetta ChatGPT."* Rinuncia dichiarata (sezione 4). Il product-strategist decide se è un problema di posizionamento.
- *"Chi scrive 50 regole?"* Una persona, 2–4 settimane `stima`. È il costo nascosto e ora è scritto.
- *"L'obiettivo salute con 60 anni e pressione alta?"* Gate PAR-Q+ in onboarding, parametri conservativi, e i temi medici vanno a testo fisso. Dipende dalle risposte legali (domande 14, 19–21).

---

## 11. Consegne

**Per `product-strategist`**
- Il costo variabile nuovo è la chat: è metered per messaggio, il piano free avrà un limite di messaggi/mese che decidi tu su `llm_usage` reale. Il motore di programmazione costa zero token: il piano può stare nel free (come Alpha) o dietro il paywall (come Fitbod) — la scelta è tua, l'architettura regge entrambe.
- Gate naturali per il Pro: chat illimitata, "giorno no" completo, adattamento continuo del piano, storico oltre N settimane, mesocicli oltre il primo.
- Rischio commerciale non coperto: distribuzione senza store. Serve una risposta.
- Il target di design è il principiante-che-ha-mollato; il prezzo di riferimento della fascia "generatori" è 13–19 $/mese, in Italia 4–7 € (teardown). Se decidi per l'intermedio, riapri la sezione 2 del brief.

**Per `ui-ux-designer` (e `designer`)**
- Due elementi-firma da progettare, non da decorare: il **chip di fonte accanto al numero** (tappabile, apre la scheda studio in italiano) e la **metrica di costanza** che non punisce il giorno saltato.
- La schermata seduta si copia da Hevy nel ritmo (riga set, precedente in grigio, check → timer, swap in 2 tap) e si differenzia nel carattere. Target 44×44, una mano, in un seminterrato con luce cattiva.
- Stati vuoti da disegnare come schermate vere: giorno di riposo, seduta saltata, settimana saltata, ritorno dopo due settimane. È lì che vive il coach mentale.
- Readiness in 10 secondi: tre domande, un tap ciascuna, e il piano di oggi che cambia *visibilmente*.
- Desktop: vista settimana/mesociclo con il piano editabile e la chat a lato. Nessun tunnel di seduta. Vietati blu-su-nero e gradienti da AI.
- La chat mostra sempre "stai parlando con un coach AI" e il rimando al professionista quando scatta un filtro: va disegnato, non nascosto.

**Per `backend-python`**
- Ordine di costruzione: (1) modello dati + Alembic, (2) motore di programmazione come modulo puro con test sulle regole, (3) base regole/citazioni come dati versionati con validatore DOI, (4) API onboarding/piano/seduta/readiness, (5) Stripe + entitlements + `llm_usage`, (6) orchestratore chat con state card, tool, RAG e validatore citazioni, (7) protocollo "giorno no", (8) email mancata seduta. La chat arriva per ultima e il ciclo deve chiudersi senza di lei.
- L'LLM non scrive mai nel DB: `propose_plan_change` produce un patch validato dal motore e registrato in `plan_change_proposals`; l'applicazione è un'azione utente separata.
- Validatore citazioni: ogni ID citato nella risposta deve appartenere ai chunk recuperati in quel turno; altrimenti si rimuove e si segnala.
- Provider LLM dietro interfaccia; modello e embedding scelti dopo la verifica del ricercatore.
- `/openapi.json` è il contratto: congelato prima che parta il frontend. Errori uniformi `code` + `detail`, rate limiting, CORS con allowlist, Settings da env.

---

## Appendice — cosa cambierebbe il brief

- Se il ricercatore trova che un professionista deve firmare i piani (domanda 19): rientra la strada C per un piano premium e il free diventa "tracker + spiegazioni".
- Se nessun database esercizi open è usabile commercialmente con immagini (15–17): la v1 parte con nomi + cue testuali e link video esterni; il costo di media proprie va a budget.
- Se il costo LLM per messaggio è oltre l'atteso: il "giorno no" diventa quasi tutto deterministico (template + una sola chiamata LLM per turno riflessivo) e la chat free scende a pochi messaggi.
- Se la PWA su iOS non regge la seduta (26): si riapre la scelta "app nativa per la seduta".

---

## Emendamenti dopo la verifica (fase 3, 2026-09-16)

Fonte: `docs/verifica.md`. Nessuna smentita tocca la strada A, l'architettura o lo scope. Cambiano questi dettagli, vincolanti per le fasi successive:

1. **Gate di sicurezza**: non si usa il PAR-Q+ (licenza vieta l'incorporazione in prodotti venduti). Si scrive un questionario proprio, non chiamato PAR-Q+, con revisione del disclaimer.
2. **Linee guida (OMS/ACSM/NSCA)**: mai testo integrale. Formato "cosa dice / cosa non dice + DOI"; solo gli 8 studi open access CC BY possono essere citati testualmente.
3. **Provider LLM e regione UE**: Anthropic first-party non offre residenza UE (solo via Vertex AI/Bedrock); Gemini API non ha residenza UE e vieta il free tier nel SEE; OpenAI ha `eu.api.openai.com` (+10%). Il provider resta dietro interfaccia; la scelta finale (e la voce "trasferimento extra-UE" nella privacy policy) va decisa in fase build. Haiku 4.5 ha ritiro possibile da ottobre 2026: se lo si usa, prevedere il cambio. `temperature/top_p/top_k` non vanno esposti dall'interfaccia provider (deprecati su Claude 4.7+).
4. **Database esercizi**: ExerciseDB è one-time $199/$599 (non più RapidAPI). Alternative open: wger (138 esercizi in italiano, CC-BY-SA con attribuzione) e `hasaneyldrm/exercises-dataset` (1.324 esercizi, testi in italiano, MIT; GIF Gymvisual con licenza separata). Decisione: dataset MIT per i testi + immagini wger/free-exercise-db o acquisto ExerciseDB — al product-strategist valutare il costo, al backend eseguire.
5. **OpenAlex** è a budget ($1/giorno con chiave); il lookup per DOI resta quasi gratuito. Crossref (10 req/s, polite pool) è il verificatore primario dei DOI; 5 DOI "a memoria" erano sbagliati → il validatore DOI è obbligatorio nel seeding delle regole.
6. **pgvector**: indici HNSW/IVFFlat solo fino a 2.000 dimensioni → embedding a 768/1.536 o `halfvec`.

Vincoli emersi, da rispettare:
- **GDPR**: infortuni/dolori = dati art. 9 → consenso esplicito separato + **DPIA obbligatoria**.
- **AI Act art. 50(1)**: l'utente va informato che parla con un'AI (in vigore dal 2026-08-02).
- **Dir. 2023/2673**: pulsante "recedi dal contratto qui" (in vigore dal 2026-06-19). Stripe Tax copre l'IVA italiana.
- **Rate limiting senza Redis** regge solo con 1 worker/1 replica: se si scala, serve storage condiviso.
- **Bloom (Stanford)**: repo MIT ma prompt e tassonomia di sicurezza proprietari → il protocollo "giorno no" si scrive in proprio, ispirato ai principi MI pubblici.
- **Hosting DB**: Render Postgres free scade a 30 giorni; Neon free (0,5 GB, pgvector 0.8) è il candidato per dev/staging.
- **Stack versioni**: Next.js 16.3.5, `@serwist/next` 9.5 per la PWA (`next-pwa` è abbandonato), FastAPI 0.141, SQLAlchemy 2.0.54, pgvector 0.5.0.
