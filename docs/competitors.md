# fitcoach — Teardown dei competitor

Data verifica: 2026-09-16. Ogni prezzo e limite è stato letto da una fonte primaria (sito ufficiale, App Store, help center) salvo dove indicato "(secondaria)". Le pagine che non sono riuscito a raggiungere sono segnalate. Non ho installato le app: le descrizioni delle schermate vengono da store, help center, e recensioni di test (indicate). Le note "[ipotesi]" sono mie deduzioni, non fatti verificati.

---

## 1. Categoria e job-to-be-done

**Job:** "Dimmi cosa fare oggi in palestra, adattalo a me quando cambio, e non farmi mollare."
La categoria è quella del *coach di allenamento algoritmico/AI per il singolo utente*, con tre sotto-famiglie che si sovrappongono: (a) generatori di piano adattivi (Fitbod, JuggernautAI, Dr. Muscle, Alpha Progression, Zing), (b) tracker con libreria di programmi — l'alternativa "fai da te" che la gente usa davvero (Hevy, Boostcamp), (c) coaching umano a distanza che vende soprattutto *accountability* (Caliber, Future). La parte "coach mentale" del progetto non ha oggi un incumbent chiaro: Freeletics l'ha tentata (Mindset) e l'ha rimossa; la ricerca accademica (Bloom, Stanford, CHI 2026) l'ha appena dimostrata utile.

**Mercato:** un rapporto di settore stima 8,3 mld $ per il segmento "AI personal trainer" nel 2026, crescita 14-16%/anno (secondaria: [sensai.fit](https://www.sensai.fit/blog/best-ai-personal-trainer-apps-2026), non verificata su fonte primaria — usare come ordine di grandezza, non come numero).

---

## 2. Tabella dei riferimenti

| # | Prodotto | URL | Chi serve | Prezzo d'ingresso | Punto di forza | Punto debole |
|---|---|---|---|---|---|---|
| 1 | **Fitbod** (leader mass-market) | [fitbod.me](https://fitbod.me/) | Chi va in palestra e non vuole pensare alla scheda | 15,99 $/mese · 95,99 $/anno · trial 7 gg, **nessun free permanente** | 15M+ download, 4,8★ su 284k voti; workout generato in un tap, recupero muscolare per gruppo | Logica a volte "a caso" (isolamento prima del composto), bug ricorrenti, esercizi troppo avanzati per principianti dichiarati |
| 2 | **JuggernautAI** (premium, forza) | [juggernautai.app](https://www.juggernautai.app/) | Powerlifter e powerbuilder seri | 34,99 $/mese · 349,99 $/anno · trial 14 gg | Autoregolazione vera (readiness giornaliera, RPE per set, adattamento set→blocco) | Volume percepito eccessivo/imprevedibile; UI blu-su-nero poco leggibile; niente Apple Health né timer |
| 3 | **Dr. Muscle** ("evidence-based" + chat AI) | [dr-muscle.com](https://dr-muscle.com/) | Chi vuole "autopilota" e paga per non pensare | 48,99 $/mese · 399,99 $/anno · free: 1 esercizio raccomandato/giorno | Claim scientifici forti (DUP, rest-pause, RIR), chat AI, deload automatici, update settimanali | Prezzo 3× i rivali, disdetta contestata su Trustpilot, i "59% più veloce" non hanno fonte in pagina |
| 4 | **Alpha Progression** (evidence-based, EU) | [alphaprogression.com](https://alphaprogression.com/en) | Chi vuole progressione guidata senza "AI magica" | 12,99 $/mese · 79,99 $/anno · trial 14 gg · **free usabile per sempre** (log + 795 esercizi) | 4,9★ su 40k+, video reali, generatore + raccomandazioni peso/rep set per set, dichiara base in meta-analisi | Le fonti non sono esposte all'utente; nessun coach conversazionale; motivazione = solo PR e achievement |
| 5 | **Freeletics** (mass-market + Mindset) | [freeletics.com](https://www.freeletics.com/en/) | Chi si allena a corpo libero/casa, vuole "journey" | 34,99 $/mese · 99,99 $/anno (App Store: 34,99–79,99 $ per durata) | Coach adattivo con feedback post-seduta, 4,6★ su 22k; ha *provato* il coaching mentale (audio 5-25') | Mindset Coach **rimosso** nel 2024 (utenti arrabbiati sul forum); non si può salvare una seduta a metà; riposi lunghi; poche statistiche |
| 6 | **Hevy** + **Boostcamp** (free/DIY di default) | [hevyapp.com](https://www.hevyapp.com/) · [boostcamp.app](https://www.boostcamp.app/features) | Chi sa già cosa fare e vuole solo loggare bene | Hevy: 2,99–3,99 $/mese · 23,99 $/anno · 74,99 $ lifetime, free con 4 routine · Boostcamp: free con 11.000+ programmi, Pro da 4,99 $/mese | Logging in palestra veloce e amato (Hevy 4,9★ su 92k); programmi di coach *nominati* (Helms, Nuckols, Wendler) gratis | Zero coaching, zero accountability (BarBend su Boostcamp: "lacks accountability"); il piano lo scegli tu |

**Adiacenti citati nel teardown:** Zing AI (chat + assessment, 18,99 $/mese), Caliber (app free + coach umano 19 $/mese gruppo, 200 $/mese 1:1), Future (coach umano, 199 $/mese), SensAI e Arvo (LLM-native, Arvo in italiano a 4 €/mese), Gym Coach AI (italiano, 6,99 €/mese), Bloom/Beebo (ricerca Stanford, non in vendita).

---

## 3. Teardown per prodotto

### 3.1 Fitbod — il leader

**Flow verso il primo valore** (fonti: [help center "How Fitbod Creates Your Workout"](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout), [blog algoritmo](https://fitbod.me/blog/fitbod-algorithm/), App Store [id1041517543](https://apps.apple.com/us/app/fitbod-workout-fitness-plans/id1041517543)):
1. Obiettivo (forza / ipertrofia / generale) → 2. livello → 3. attrezzatura disponibile (casa / palestra / minimo) → 4. split preferito (PPL, upper/lower, full body) → 5. **workout generato subito**, senza chat. Circa 5 schermate. Prima seduta entro 2 minuti dall'apertura.

**Come genera e adatta:** ogni gruppo muscolare ha un "recupero" 0-100% che scende quando lo alleni e risale in ~7 giorni; l'"Exercise Selector" pesa recupero, attrezzatura, rating dei trainer interni per obiettivo/livello, e feedback storico (esercizi aggiunti/rimossi/preferiti). Il "Capability Recommender" stima 1RM con Epley, chiede ogni tanto un set a cedimento per ricalibrare, e usa RIR loggati. Il blog **cita quattro studi con autori e riviste** (Schoenfeld 2010; Grgic et al. 2018; Schoenfeld et al. 2017; Schoenfeld & Grgic 2019) — ma sono nel blog, non nell'app: l'utente in palestra non vede mai *perché* gli è stato proposto quel set.

**Interfaccia (da store e review TechRadar/justuseapp):** schermata principale = un singolo workout del giorno come lista di esercizi con set×rep×peso già compilati; tap su un esercizio → video demo; "swap" per sostituire. Accento rosa, check verdi. Una lamentela precisa: "Once the workout is started you are not allowed to navigate the rest of the app unless you end your workout" — la modalità seduta è a tunnel.

**Business:** 15,99 $/mese o 95,99 $/anno per i nuovi (12,99/79,99 legacy per chi era già dentro), 7 giorni di trial e poi paghi: **non esiste un free tier**. Nessun add-on. Il trigger di upgrade è la scadenza del trial.

**Lamentele ricorrenti (evidenza):**
- Logica dell'algoritmo: "Why would I do an isolated movement, 3 sets of 6 before a heavy compound lift for 5 sets of 12?" ([justuseapp](https://justuseapp.com/en/app/1041517543/fitbod-workout-fitness-plans/reviews))
- Principianti che ricevono esercizi troppo avanzati e devono sostituirli in continuazione (idem).
- Modifiche alla seduta che si resettano; watch e telefono fuori sync; "going back a year and seeing the same called out, it's time to get it right" (idem).
- "for 10 dollars a month it just doesn't do enough" (idem).
- Un pezzo TechRadar del 2026 titola letteralmente "AI told me to work out less and the results were a disaster" ([techradar](https://www.techradar.com/health-fitness/ai-told-me-to-work-out-less-and-the-results-were-a-disaster) — non sono riuscito a leggere il corpo dell'articolo, solo il titolo: la fiducia nelle decisioni "a scatola nera" è un tema).

**Cosa amano:** "I never have to think about what exercises I should do because it does the work for me" — il valore è la *rimozione della decisione*.

### 3.2 JuggernautAI — l'autoregolazione fatta bene

**Flow** (fonti: [juggernautai.app](https://www.juggernautai.app/), [Garage Gym Reviews](https://www.garagegymreviews.com/juggernautai-review)): anagrafica (nome, età, peso, altezza) → massimali attuali → esperienza → giorni/settimana (2-6) → obiettivo, opzionale data gara. Poi programma a blocchi. Onboarding più lungo di Fitbod (**circa 10+ campi**), ma è dichiaratamente "come un coach che ti fa un intake".

**Come adatta:** ogni giorno chiedono readiness (motivazione 1-5, sonno, calorie, fatica per gruppo muscolare) e adattano i carichi; per ogni set loggano RPE/RIR e modificano i set successivi. Cinque livelli dichiarati: "Set to Set, Day to Day, Week to Week, Block to Block, Program to Program". Questo è lo standard di riferimento per "il piano si adatta".

**Interfaccia:** tre tab — Dashboard (settimana), Workouts (esecuzione del giorno), Exercises (video + cue scritti). Blu su nero, la tester lo trova "hard to read" e la dashboard "initially feels somewhat overwhelming". Nessun toggle tema.

**Business:** 34,99 $/mese o 349,99 $/anno, trial 14 giorni, un solo piano. Include seminari e una consulenza di 30' col capo coach — vendono "il coach umano dietro l'algoritmo".

**Lamentele:** volume "excessive or unpredictable" e "junk volume" su powerbuilding a prescindere dai parametri (secondaria: [aitoolsbakery](https://aitoolsbakery.com/blog/juggernautai-review/), [agent-finder](https://agent-finder.co/reviews/juggernautai)); mancano Apple Health, rack calculator, timer integrato. Non sono riuscito a leggere le recensioni App Store (404 sull'id trovato).

### 3.3 Dr. Muscle — l'"evidence-based" che fa rumore

**Flow** (fonti: [dr-muscle.com](https://dr-muscle.com/), [free plan](https://dr-muscle.com/free-plan/), App Store [id1073943857](https://apps.apple.com/us/app/dr-muscle-ai-personal-trainer/id1073943857)): "Imagine ChatGPT, but for fitness" — onboarding breve, poi la app propone il primo esercizio con set/rep/peso computati; la promessa è "on autopilot". Il free tier dà **una sola raccomandazione al giorno**: "the app will continue to compute your reps, sets, and weights for optimal progress — but only for your first exercise that day". È il paywall più aggressivo della categoria e insieme il più chiaro: assaggi l'algoritmo e poi paghi.

**Come adatta:** progressione con daily undulating periodization, rest-pause, RIR, deload automatici, "light session" automatiche, "AI workout analysis", "AI progress reports", "AI chat for instant coaching". 50+ update/anno.

**Claim scientifici:** "built by an exercise scientist" (Carl Juneau, PhD), "59% faster". Nella home e nella pagina free non c'è **nessuna citazione** a studi; la pagina `/science/` non esiste (404). Il claim del 59% compare negli store senza fonte. La distanza tra "evidence-based" dichiarato e "evidence-based" mostrato è il punto debole più utile per noi.

**Interfaccia:** screenshot store: lista esercizi, grafico progressi, chat. Tono marketing-forward.

**Business:** 48,99 $/mese, 399,99 $/anno (trial 2 settimane sul mensile, "4 mesi gratis" sull'annuale), add-on meal plan 18,99 $/mese. Il più caro della categoria.

**Lamentele:** Trustpilot 3,2 con una sola recensione (1★): "had to respond on so many automatic responding emails before you can cancell", "30x more expensive", app lenta ([trustpilot](https://www.trustpilot.com/review/dr-muscle.com)). Store: 4,5★ su appena 382 voti (per un prodotto del 2016, è poco). Sedute lunghe 45-90' prima dell'introduzione del rest-pause.

### 3.4 Alpha Progression — la progressione onesta

**Flow** (fonti: [alphaprogression.com/en](https://alphaprogression.com/en), [subscribe](https://alphaprogression.com/en/subscribe)): obiettivo → attrezzatura → frequenza → scegli split preset (PPL, upper/lower, full body) o costruisci da 795 esercizi. Il generatore è a form, non conversazionale. Tutto è editabile.

**Come adatta:** "a precise weight, rep count, and intensity target for every set" derivato dallo storico reale; RIR, periodizzazione, deload, profili palestra multipli, "exercise evaluations" (voto di efficacia per gruppo muscolare). Dichiara basi in "meta-analyses regarding volume, intensity, RIR, frequency, and periodization" e prende le distanze da "bro-science or influencer trends" — ma **non espone le fonti** (la pagina `/science` non esiste; nessuna citazione con autori sul sito).

**Interfaccia:** log-first: la seduta è una tabella set/rep/peso con target proposto e video reale girato da trainer (esplicitamente "no stock footage or AI animations"). Motivazione = PR, achievement, grafici per muscolo.

**Business:** free "genuinely usable indefinitely" (log, 795 esercizi con video, misure corporee) — Pro 12,99 $/mese o 79,99 $/anno, trial 14 gg. Gated: generatore, raccomandazioni, grafici, periodizzazione, calcolatori. Il trigger di upgrade è "voglio che mi dica *quanto* caricare".

**Lamentele:** non sono riuscito a leggere le recensioni store (404 sui due id). Il tono è "credible alternative to one-on-one coaching" — ma non c'è nessuna dimensione coach: niente chat, niente gestione dei giorni no.

### 3.5 Freeletics — il tentativo (fallito) di coaching mentale

**Flow** (fonti: [freeletics.com](https://www.freeletics.com/en/), App Store [id654810212](https://apps.apple.com/us/app/freeletics-workouts-fitness/id654810212)): obiettivo → livello → giorni/orari → luogo (casa/palestra/outdoor) e attrezzi → "training journey" a settimane. Dopo ogni seduta, feedback ("too easy / too hard") che regola la successiva. "1 trillion workout combinations", 700+ esercizi.

**Coaching mentale — il caso da studiare:** nel 2020 lanciano **Freeletics Mindset**: corsi audio da 5-25' su routine, ricadute, stress, focus, sonno, box breathing, meditazione ([blog di lancio](https://www.freeletics.com/en/blog/posts/new-freeletics-mindset/), [help center](https://help.freeletics.com/hc/en-us/articles/360010635440-Freeletics-Mindset-Coach)). Era venduto nel bundle "Body & Mind", solo in inglese, con qualche episodio gratis. **Rimosso prima di aprile 2024**: sul forum ufficiale lo staff conferma "Yes, this has been removed"; ora vive solo su Apple Podcasts per abbonati iOS, niente per Android; gli utenti lamentano redirect loop e chiedono il ripristino ([forum](https://forum.freeletics.com/t/has-the-mindset-coach-been-completely-removed/15368)). **Lezione:** contenuto audio *generico e separato* dall'allenamento non regge come prodotto — era una libreria, non un coach che ti conosce.

**Interfaccia:** "Today View" + tab Explore; seduta a timer con video; foto trasformazione before/after nel marketing.

**Business:** App Store lista Training Coach a 34,99 / 59,99 / 74,99 / 79,99 $ per durata, bundle Training & Nutrition 49,99 / 89,99 $; fonti secondarie riportano 34,99 $/mese o 99,99 $/anno. La pagina help sui piani è 403 per me.

**Lamentele (App Store):** non si può salvare una seduta a metà; poca personalizzazione mid-workout; sequenze "awkward" (alterna posizioni inutilmente); riposi fino a 3' sui pesi; "minimal completion celebrations and statistics tracking".

### 3.6 Hevy e Boostcamp — l'alternativa gratis che vince per default

**Hevy** (App Store [id1458862350](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350), 4,9★ su 92k): free senza pubblicità con 4 routine, 7 esercizi custom, 3 mesi di grafici (limiti da fonti secondarie concordi: [sensai](https://www.sensai.fit/blog/hevy-review-2026), [push-pull](https://push-pull.app/blog/push-pull-vs-hevy); la pagina pricing ufficiale è 404). Pro 2,99–3,99 $/mese, 23,99 $/anno, 74,99 $ lifetime. Amato per: "Simple. Free. Tons of graphs. Amazing quality videos." e per lo swap rapido in palestra ("easily replace and add when you're in the gym and you need to use another piece of equipment"). Feed sociale. **È il benchmark della schermata di logging**: ogni riga = set con "precedente" in grigio, peso, rep, check; timer di riposo che parte da solo; sostituzione esercizio in 2 tap.

**Boostcamp** ([features](https://www.boostcamp.app/features), App Store [id1529354455](https://apps.apple.com/us/app/boostcamp-workout-programs/id1529354455), 4,8★ su 10k+): 11.000+ programmi, 130+ di coach nominati (Helms, Nuckols, Wendler, Bromley, Candito), tutto free; Pro da 4,99 $/mese (store: 11,99–79,99 $ per durata; secondaria: 14,99 $/mese, 59,99 $/anno) aggiunge Strength Score, heatmap volume, builder personalizzato. Lo store descrive anche un "AI coach" che costruisce un piano da questionario. BarBend: "lacks accountability", "not really meant for cardio or mobility", community solo dall'estate 2026, nessuna notifica di reminder. Lamentele store: freeze al completamento seduta, workout non registrati.

**Perché contano:** sono la vera concorrenza per il free tier di fitcoach. Se la nostra seduta in palestra è più lenta da loggare di Hevy, l'utente torna a Hevy e usa noi solo per farsi scrivere la scheda.

### 3.7 Adiacenti — brevi

- **Zing AI** (App Store [id1552207792](https://apps.apple.com/us/app/zing-ai-home-gym-workouts/id1552207792), 4,8★ su 31k): onboarding con *test fisico* (fitness + flessibilità) e coach AI "proattivo" che propone obiettivi e pianifica; Premium 18,99 $/mese, 29,99–59,99 $ per durate lunghe, "Body Scan Report" a 19,99 $. Lamentele: musica/video che si interrompono, impossibile riordinare esercizi se l'attrezzo è occupato, doppio conteggio Apple Health. Il dominio zingcoach.com oggi redirige a un marketplace di domini — il brand è "Zing AI". Raccolta 10 M$ nel 2024 ([Athletech](https://athletechnews.com/zing-coach-raises-10m-for-feature-packed-ai-fitness-app/)).
- **Caliber** ([caliberstrong.com](https://caliberstrong.com/), [Garage Gym Reviews](https://www.garagegymreviews.com/caliber-app-review)): app free completa senza coach; Pro 19 $/mese coaching di gruppo; Premium da 200 $/mese 1:1. Metrica-firma "Strength Balance" (equilibrio tra gruppi muscolari, es. 70%) che la tester chiama "a fantastic feature for beginners". Il coach umano manda video check-in settimanali con obiettivi della settimana. Il prezzo non è visibile prima della consultazione — lamentela.
- **Future** ([future.co](https://www.future.co/)): coach umano, 50 $ il primo mese poi 199 $/mese, rimborso entro 30 gg. "98% of members report greater consistency within 4 weeks". È la prova che la gente paga 199 $/mese soprattutto per *qualcuno che ti scrive*.
- **SensAI** ([sensai.fit](https://www.sensai.fit/)): LLM-native, "Remembers your injuries, preferences, and constraints across sessions", modifica seduta conversazionale, "evidence-based volume and recovery guardrails"; free to download, secondaria: 6,99 $/mese o 69,99 $/anno.
- **Arvo** ([arvo.guru](https://arvo.guru/), [pricing](https://arvo.guru/pricing)): LLM-native **in italiano e inglese**, 20 "agenti", adattamento set per set, metodologie nominate (Kuba, Mentzer HIT, FST-7, Y3T, Mountain Dog), MEV/MAV/MRV; free forever, Pro 4 €/mese o 31,99 €/anno, piano Coach 25 €/mese. Tono "Zero guesswork. Only progression.", per lifter tecnici. **È il concorrente italiano più vicino** — ma è per chi conosce già "MRV".
- **Gym Coach AI: Scheda Palestra** (App Store IT [id6478061147](https://apps.apple.com/it/app/gym-coach-ai-scheda-palestra/id6478061147)): 6,99 €/mese, 41,99 €/anno, 1 sola recensione. Segnale di quanto è vuoto lo scaffale italiano.
- **Bloom / Beebo** (Stanford HCI, CHI 2026 Best Paper — [progetto](https://stanfordhci.github.io/Bloom/), [arXiv](https://arxiv.org/html/2510.05449v2)): app iOS con coach LLM fondato su Active Choices, Transtheoretical Model e **Motivational Interviewing**; chiede obiettivi e cosa hai già provato, "praise and empathy", propone e calendarizza il piano settimanale modificabile in chat, tab Insights con riassunti LLM, metafora del giardino sul lockscreen, filtri di sicurezza prompt-based su una tassonomia di danni. RCT n=54, 4 settimane: l'attività fisica cresce uguale nei due gruppi (36%→72% al target 150'), ma **il gruppo LLM cambia mindset** (più credenze positive, più piacere, più auto-compassione sugli obiettivi mancati), passa 5× più tempo in app, e mostra "less activity decline over time". Beebo descritto come "persistent but not aggressive". È l'unica evidenza sperimentale che ho trovato su *come* deve comportarsi un coach mentale LLM.

---

## 4. Convenzioni da rispettare (load-bearing)

Questi pattern sono presenti in tutti e sei; l'utente li dà per scontati. Reinventarli disorienta.

1. **Onboarding a form, 4-6 schermate, seduta pronta alla fine.** Obiettivo → livello → giorni/settimana → attrezzatura/luogo → (vincoli/infortuni). Nessuno chiede più di questo prima di mostrare valore. Una chat *al posto* del form allunga il tempo al primo valore; una chat *dopo* il form per raffinare è il pattern di Bloom e SensAI. [ipotesi] Per fitcoach: form corto, poi il coach commenta il piano in chat.
2. **La seduta è una lista verticale di esercizi, ogni esercizio una tabella set × (precedente, peso, rep, check).** Hevy, Alpha, Boostcamp, Fitbod: tutti uguali. Timer di riposo che parte al check. "Sostituisci esercizio" a portata di pollice. Questo è lo schema da copiare senza vergogna.
3. **Video/GIF di esecuzione a un tap dall'esercizio.** Alpha lo fa girare da trainer veri e lo dichiara; Fitbod, Hevy, Boostcamp hanno demo. Senza, "come si fa?" finisce su YouTube.
4. **Numeri proposti, mai vuoti.** Peso e rep target pre-compilati dallo storico (Fitbod, Alpha, Juggernaut, Dr. Muscle). La cella vuota è l'errore che fa sembrare l'app un foglio Excel.
5. **RIR/RPE per set come feedback minimo.** Tutti gli adattivi lo chiedono; è il linguaggio comune per "quanto era dura".
6. **Split standard nominati** (Push/Pull/Legs, Upper/Lower, Full Body) come scelta o come output. L'utente li cerca per nome.
7. **Grafici per esercizio e PR automatici.** È la ricompensa base; Freeletics viene criticata proprio perché ne ha pochi.
8. **Free tier o trial chiaro dall'inizio.** La categoria è freemium (Hevy, Alpha, Boostcamp, Arvo, Caliber) o trial (Fitbod 7 gg, Juggernaut 14 gg). Caliber viene criticata perché nasconde il prezzo dietro una consultazione.

**Inerzia copiata (dove si può divergere senza rischio):**
- Modalità seduta "a tunnel" che blocca il resto dell'app (Fitbod) — lamentela esplicita.
- Palette scura blu/nero con testo poco leggibile (Juggernaut) — lamentela esplicita.
- Motivazione = badge, PR e streak (Alpha, Hevy). Nessuno la gestisce quando *manca*.
- Spiegazione della raccomandazione = zero. Nessuno dice "perché 3×8 e non 5×5 per te".
- Il coaching mentale come *libreria* separata (Freeletics Mindset) — fallito.

---

## 5. Ispirazione visiva (materiale grezzo per designer e ui-ux-designer)

1. **Hevy — la riga di set.** Rubare: "precedente" in grigio nella stessa riga, peso e rep come due campi grandi tappabili, check che avvia il timer, sostituzione in 2 tap. È il ritmo giusto per un pollice in palestra. Non rubare: il look neutro da spreadsheet — è anonimo.
2. **Caliber — "Strength Balance".** Rubare: una metrica-firma unica, umana, che un principiante capisce ("il tuo lato inferiore è avanti, le spalle indietro") e che compare ogni giorno. Per fitcoach l'equivalente potrebbe essere una metrica di *costanza* o di *aderenza al piano*, non solo di forza. [ipotesi]
3. **Bloom — il giardino sul lockscreen e la tab Insights.** Rubare: un elemento ambientale che cresce con la costanza (non con il volume) e riassunti in linguaggio naturale che collegano i dati all'obiettivo dichiarato. Concretamente: stato vuoto del giorno di riposo che non è "nessun allenamento" ma "oggi il piano è recuperare".
4. **Alpha Progression — video reali + "exercise evaluation".** Rubare: il segnale di credibilità "girato da persone, non stock", e il voto di efficacia per gruppo muscolare accanto all'esercizio. Il nostro equivalente: **la fonte accanto al numero** ("3 set: Schoenfeld 2017" con un tap che apre la scheda studio).
5. **JuggernautAI — readiness del giorno.** Rubare: la domanda di 10 secondi prima della seduta (sonno, motivazione, fatica) che *cambia visibilmente* il piano di oggi. È il momento in cui il coach mentale e il coach di allenamento si toccano: "hai dormito 5 ore e sei a 2/5 di voglia → oggi versione corta, 25 minuti". Non rubare: il blu-su-nero.

Regola da tutti: la palette e la tipografia dei sei sono intercambiabili (nero/bianco/accento acceso, sans geometrica). Il carattere è dove nessuno ha investito — c'è spazio per una direzione dichiarata.

---

## 6. Il varco

**Frase:** *Nessuno dei sei mostra all'utente la fonte della raccomandazione nel momento in cui la riceve, e nessuno gestisce il giorno in cui non hai voglia — fitcoach fa entrambe le cose nello stesso posto, la chat del coach, in italiano.*

**Prove:**
- "Evidence-based" è un claim di marketing in tutta la categoria: Fitbod cita quattro studi nel blog ma non in app; Alpha e Dr. Muscle dichiarano meta-analisi e "exercise scientist" senza una sola citazione raggiungibile (pagine `/science` inesistenti); Dr. Muscle promette "59% faster" senza fonte. Il principiante non ha modo di distinguere Dr. Muscle (49 $) da Gym Coach AI (7 €). Una citazione *in linea*, tappabile, in italiano, è un differenziatore verificabile — e protegge dal tema "AI a scatola nera" che le recensioni Fitbod e TechRadar sollevano.
- Il coaching mentale è un bisogno pagato ma non servito: Future incassa 199 $/mese vendendo consistency ("98% ... greater consistency within 4 weeks"); Caliber vende "daily motivation"; Boostcamp è criticata perché "lacks accountability". L'unico tentativo software (Freeletics Mindset) è stato tolto perché era audio generico scollegato dall'allenamento. Bloom (RCT, CHI 2026) dimostra che un coach LLM con Motivational Interviewing sposta *mindset e auto-compassione*, e che gli utenti lo usano 5× di più — ma non è un prodotto. Il varco è un coach che *conosce il tuo piano e il tuo storico* e interviene quando salti: proponendo la seduta da 20', rinegoziando la settimana, non facendo la predica.
- Il mercato italiano è quasi vuoto: Arvo (tecnico, per chi sa cosa sia MRV) e Gym Coach AI (1 recensione). Nessuno parla al principiante in italiano con tono da coach.

**Perché è sicuro divergere qui:** non tocchiamo le convenzioni load-bearing (form breve, tabella set, video, numeri proposti, free tier chiaro). Aggiungiamo due strati — fonte e coach mentale — *sopra* uno schema che l'utente già conosce. Il rischio è di costo (LLM per la chat) e di scope (v1 deve chiudere il ciclo prima di espandere il coach).

**Cosa NON fare:**
- Non competere con Juggernaut sull'autoregolazione fine per powerlifter: è il loro campo, e l'utente-tipo v1 è "tutti".
- Non fare la libreria di contenuti motivazionali: è Freeletics Mindset e l'hanno spento.
- Non nascondere il prezzo (Caliber) né rendere difficile la disdetta (Dr. Muscle): le recensioni puniscono entrambe.
- Non bloccare l'utente nella seduta (Fitbod) né usare la palette blu-su-nero (Juggernaut).

---

## 7. Consegne

**Per `brainstormer`:**
- Il ciclo v1 (onboarding → piano → seduta → coach) è esattamente il ciclo di Fitbod/Alpha più uno strato chat. L'architettura deve far sì che la chat *veda* piano e log (come SensAI e Bloom), altrimenti è Freeletics Mindset.
- Due feature-firma da progettare, non da appiccicare: (1) citazione in linea per ogni parametro del piano; (2) protocollo "giorno no" del coach (readiness → rinegoziazione della seduta, tono Motivational Interviewing, mai colpevolizzante). Bloom fornisce il framework e i filtri di sicurezza da imitare.
- Il logging in palestra deve essere veloce almeno quanto Hevy; se è più lento, l'utente usa Hevy per loggare e noi per la scheda, e il coach perde i dati.
- Rischio: TechRadar e le review Fitbod mostrano che quando l'AI decide "di meno" o "a caso" senza spiegare, la fiducia crolla. La spiegazione non è un nice-to-have, è la mitigazione.

**Per `product-strategist`:**
- Fascia prezzi consumer: 3-4 $/mese (tracker: Hevy, Arvo) · 13-19 $/mese (generatori: Fitbod 15,99, Alpha 12,99, Zing 18,99) · 35-49 $/mese (premium "coach": Juggernaut 34,99, Freeletics 34,99, Dr. Muscle 48,99) · 199 $/mese (umano: Future). In Italia: Arvo 4 €, Gym Coach AI 6,99 €.
- Annuali tra 60 e 100 $ sono la norma (Alpha 79,99, Fitbod 95,99, Boostcamp 59,99, Zing 59,99); il lifetime esiste solo nei tracker (Hevy 74,99).
- Modelli di free tier che funzionano: "log gratis, raccomandazioni a pagamento" (Alpha) e "1 raccomandazione al giorno" (Dr. Muscle). Quello che *non* funziona per la reputazione: trial e basta (Fitbod, "doesn't do enough"), prezzo nascosto (Caliber), disdetta difficile (Dr. Muscle).
- Il costo LLM della chat è la variabile nuova rispetto a tutti gli algoritmici: va nel calcolo del margine e del limite free.
- La disponibilità a pagare per l'accountability è dimostrata (Future 199 $, Caliber 19-200 $). [ipotesi] Il coach mentale può essere il gate del piano a pagamento più naturale della categoria.

**Per `designer` / `ui-ux-designer`:**
- Direzione libera: i sei sono visivamente intercambiabili. Vietato il blu-su-nero di Juggernaut e il tunnel di Fitbod.
- Elemento firma candidato: la *fonte accanto al numero* (chip tappabile) — nessuno ce l'ha.
- Secondo candidato: un indicatore ambientale di costanza (giardino di Bloom) che non punisce il giorno saltato.
- La schermata seduta si copia da Hevy nel ritmo (riga set, precedente in grigio, timer al check, swap in 2 tap) e si differenzia nel carattere.
- Stati vuoti da progettare con cura: giorno di riposo, settimana saltata, ritorno dopo ricaduta — è lì che vive il coach mentale, e nessun competitor li ha disegnati.
- Desktop: nessuno dei sei è desktop-first (Boostcamp ha una web app). La pianificazione/revisione su schermo grande è terreno libero.

---

## Appendice — pagine non raggiunte

- `fitbod.me/pricing`, `dr-muscle.com/pricing`, `dr-muscle.com/science`, `alphaprogression.com/en/science`, `hevyapp.com/pricing`, `caliberstrong.com/pricing`: 404. Prezzi presi dagli store o dalle pagine subscribe.
- App Store JuggernautAI e Alpha Progression (US): 404 sugli id trovati; recensioni da tester (Garage Gym Reviews) e fonti secondarie.
- `help.freeletics.com` piani: 403. Google Play Freeletics e Dr. Muscle: contenuto troncato.
- Reddit: non raggiungibile dallo strumento. Le lamentele vengono da App Store, Trustpilot, forum ufficiale Freeletics, justuseapp e review di tester.
- Corpo dell'articolo TechRadar "AI told me to work out less": non letto, solo titolo.
