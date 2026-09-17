# fitcoach — Direzione visiva (fase 6a)

Data: 2026-09-16 · Autore: designer · Input: `allineamento.md`, `competitors.md` (§5, §6), `brief.md` (approvato: §2, §5, §11), `business-model.md` (approvato: §5, §6, §10), `CLAUDE.md`.

Questo documento decide il **carattere**. I numeri (token, scala in px, stati dei componenti) li mette `ui-ux-designer` nella fase successiva: dove qui c'è una proporzione o una regola, lì ci sarà un valore.

---

## 1. La direzione

> **Una scheda da palestra con le note a piè di pagina: numeri da lavagna, spiegazioni da paper.**

La tensione è tutta lì. La *scheda* è l'oggetto che ogni italiano che va in palestra conosce: l'A4 nella busta di plastica, sudato, con la tabella esercizio · serie · rip · recupero, che l'istruttore compila in dieci minuti e nessuno spiega. La *nota a piè di pagina* è l'apparato del paper scientifico: il numeretto in apice che dice "questo non l'ho inventato, guarda qui". Mettere le due cose insieme è esattamente ciò che il prodotto fa — e nessuno dei sei competitor lo fa, né nel prodotto né nell'aspetto (teardown §5: "la palette e la tipografia dei sei sono intercambiabili").

Il test "copri il logo": una schermata con numeri grandi in grottesco largo, un numeretto in apice evidenziato accanto a ogni numero, e sotto una riga in corsivo-serif che spiega — è questa app. Non è Hevy (spreadsheet neutro), non è Fitbod (rosa e check verdi), non è Juggernaut (blu su nero), non è Freeletics (foto e fuoco).

### Perché questa e non altre

Il pubblico (brief §2) va in palestra da solo, non sa cosa sia il RIR, ha già mollato una volta, e **si fida di chi gli spiega le cose senza fargli la predica**. La fiducia si costruisce con due segnali visivi: (1) i numeri sono grandi e sicuri — chi li ha scritti non ha dubbi; (2) ogni numero ha una nota — chi li ha scritti sa da dove vengono e te lo mostra. Il paper senza la scheda intimidisce; la scheda senza il paper è Excel. Insieme dicono "so cosa faccio, e te lo spiego".

Il lavoro (business model §1): vendiamo "il coach che resta", a 9,99 € in un mercato da 4–7 €. Il prezzo va difeso con la spiegazione, non col chatbot (business model §12). Una direzione che rende la spiegazione *l'elemento più riconoscibile dello schermo* fa esattamente questo lavoro.

### Cosa ho scartato

- **"Lavagna scura da box"** — fondo nero, condensato pesante, gesso. Scartata: al neon lo schermo nero diventa uno specchio pieno di ditate; è il registro del drill sergeant; è la famiglia visiva di Juggernaut/Freeletics/Dr. Muscle, cioè la cosa da cui dobbiamo distinguerci.
- **"Quaderno caldo"** — crema, serif ad alto contrasto, terracotta, calligrafia. Scartata: è il primo default dell'estetica generata da AI, e sposta il coach mentale verso il diario/meditazione, che il brief esclude.
- **"Terminale dati"** — mono, griglia densa, tutto in maiuscoletto. Scartata: è il territorio di Arvo, per chi conosce l'MRV. Il nostro utente lo chiude in tre secondi.

---

## 2. Il brand

### Nome proposto: **Ancora**

"fitcoach" descrive la categoria, non il prodotto, e non è difendibile (esiste in ogni store con ogni suffisso). Propongo **Ancora**, per tre ragioni:

1. **Dice la promessa senza dirla.** *Ancóra* = di nuovo, un'altra volta: ancora una serie, ancora in palestra a marzo, ancora qui dopo la settimana saltata. *Àncora* = quello che ti tiene fermo quando tira. È la metrica del brief (aderenza a 8 settimane) in una parola sola.
2. **È la parola del coach.** "Ancora una." "Ancora qui." "Ancora tu, bentornato." Il tono di voce ci si appoggia sopra da solo.
3. **È italiana e si scrive come si pronuncia.** Il mercato v1 è l'Italia (allineamento); Arvo e Gym Coach AI hanno nomi che non dicono nulla a un principiante.

L'ambiguità di accento è una risorsa, e la sfruttiamo col marchio stesso: il logotipo è la parola in minuscolo con una nota in apice — **ancora¹** — e la nota 1, ovunque compaia il marchio, recita: *"1 — ancóra: di nuovo. àncora: quello che ti tiene."* Il brand è il primo esempio dell'elemento firma.

Dominio: **non verificato**. Da controllare `ancora.coach`, `ancora.fit`, `usaancora.it`, `ancora.app`. Se nessuno è disponibile a prezzo sensato, il ripiego è **Ripresa** (la ripresa dopo la pausa, la ripresa tra le serie) — più esplicito sul "sei tornato", meno positivo. La cartella resta `fitcoach/`.

### Tono di voce del coach

Il coach è **un buon PT che ti scrive su WhatsApp**: breve, concreto, dà del tu, fa una domanda alla volta, mette un numero quando ce l'ha e una nota quando ha una fonte. Non è un'app di meditazione ("respira, accogli") e non è un sergente ("no excuses"). Regole di scrittura, vincolanti per il prompt e per ogni microcopy:

- **Mai "dovresti", mai "devi".** Sempre una scelta, tipicamente tre.
- **Mai un'esclamazione, mai un'emoji, mai "campione".** La calma è il segnale che sa cosa fa.
- **Il fatto prima del giudizio, e il giudizio non c'è.** "Oggi la seduta non c'è stata" — punto. Non "purtroppo", non "peccato".
- **Se non ha una fonte lo dice**, e lo dice come nota: *"Nota nostra, non uno studio."*
- **Usa le parole della persona, non le nostre.** "Serie" e "ripetizioni", mai "RIR" nudo: "quante ne avevi ancora in canna (RIR)" la prima volta, poi "RIR".
- **Dichiara sempre di essere un'AI**, in una riga fissa e visibile, senza scusarsi.

#### Microcopy — il "giorno no" (seduta saltata, la sera)

> **Coach** — Oggi la seduta non c'è stata. Succede, e conta cosa facciamo domani. Com'è andata la giornata?
>
> **Tu** — un casino al lavoro, sono arrivato a casa alle 21
>
> **Coach** — Alle 21 la panca può aspettare. Tre strade, scegli tu:
> **Corta, domani** — 25 minuti, 4 esercizi, stessi carichi.
> **Sposta** — la seduta di oggi va a giovedì, la settimana resta da 3.
> **Riposo** — chiudo la settimana a 2 e ricalcolo la prossima.
> Non c'è quella giusta. C'è quella che fai.

#### Microcopy — readiness bassa (prima della seduta)

> Hai dormito 5 ore e la voglia è 2 su 5. Oggi il piano cambia: versione corta, 25 minuti, e tolgo lo stacco¹. Se a metà ti senti meglio, lo rimetti con un tap.
>
> ¹ Con poco sonno la forza cala e sui movimenti pesanti salgono gli errori tecnici — per questo oggi lo stacco esce, non per punizione. *(Knowles et al. 2018 — citazione da confermare nel seeding delle regole.)*

#### Microcopy — paywall, superficie 1: riepilogo di fine blocco

> **Blocco 1, chiuso.**
> **11 su 12** sedute · **Stacco 60 → 75 kg** · **Panca 8 → 10 rip a 50 kg**
>
> Hai saltato il martedì due volte e sei tornato tutte e due le volte — è la cosa che conta di più di tutte¹. Il blocco 2 lo costruirei così: un po' più di volume sulle gambe, che hanno risposto meglio², e un deload in settimana 4³.
>
> [ Costruisci il blocco 2 — Pro, 9,99 €/mese ]   [ Continua in mantenimento — gratis ]
>
> ¹ Nota nostra, non uno studio: contiamo quante volte torni, non quanti giorni di fila fai. È la regola con cui misuriamo la costanza.

I due pulsanti hanno **pari peso visivo**. Il secondo non è un link grigio.

#### Microcopy — paywall, superficie 2: quota chat

A 12/15, una riga sotto il composer, in grafite: *"Ti restano 3 messaggi questo mese. Si azzerano il 1° ottobre."*

A 15/15, al posto del composer:

> **15 su 15 messaggi usati.**
> Il coach continua a scriverti lui — commento al piano, giorno no, fine blocco. Per rispondergli prima del 1° ottobre serve Pro.
> [ Passa a Pro — 9,99 €/mese ]   oppure aspetta il 1° ottobre.

#### Microcopy — paywall, superficie 3: richiesta di modifica in mantenimento

> Per cambiare il piano mi serve il blocco 2, e il blocco 2 è Pro. Quello che posso fare adesso, gratis: la versione corta di oggi, o riposo con la settimana che si ripete. Scegli tu.
> **Corta** · **Riposo** · **Rinegozia la settimana** — Pro

#### Microcopy — filtro di sicurezza (unico posto in cui compare il rosso)

> Dolore acuto, vertigini o fiato corto non sono cose da coach: fermati e senti un medico. Qui non do consigli medici — posso però mettere in pausa il piano o togliere l'esercizio che ti fa male.

#### Microcopy — badge AI (sempre visibile in chat, AI Act art. 50)

> Parli con un coach AI, non con una persona. Le regole dietro ai numeri le hanno scritte delle persone¹.

---

## 3. Chiaro, non scuro

**Chiaro, un solo tema in v1.** Tre ragioni, tutte dal contesto d'uso e non dal gusto:

1. **Il neon.** Sotto luce forte uno schermo scuro riflette la stanza e ogni ditata; uno schermo chiaro con inchiostro quasi nero è il contrasto massimo possibile a 40 cm per 3 secondi. È lo stesso motivo per cui la scheda in palestra è un foglio bianco e non una lavagna.
2. **La conversazione.** Da desktop, il coach si legge come una pagina, non come un terminale. Il chiaro è il registro della lettura.
3. **La distinzione.** Il blu-su-nero è la lamentela esplicita di Juggernaut e la famiglia visiva della fascia premium: stare nel chiaro ci separa a colpo d'occhio.

Un secondo tema raddoppia la superficie di QA per uno studio di una persona e non porta nulla al ciclo v1. Chi ha `prefers-color-scheme: dark` riceve comunque il tema chiaro, dichiaratamente. Si riapre solo se il test in palestra su iPhone (brief §8, rischio 8) mostra un problema di leggibilità reale — e se si riapre, il tema scuro sarà inchiostro su carta nera, **mai** blu.

---

## 4. Tipografia

Il carattere del prodotto sta nel tipo, non nel colore. Due famiglie, con due ruoli che l'utente impara senza che glielo diciamo: **l'app parla in grottesco, il coach parla in serif.**

### Display e interfaccia: Archivo (variabile, assi `wdth` 62–125 e `wght` 100–900)

Archivo è un grottesco con un asse di larghezza vero. Lo usiamo in due estremi che sono lo stesso font:
- **I numeri della scheda** — peso, ripetizioni, serie, secondi di recupero, i numeri della costanza — in **Archivo Expanded Black** (larghezza al massimo, peso al massimo). Sono i numeri da lavagna: larghi, piantati, leggibili a 40 cm con gli occhiali appannati. Cifre **tabulari** obbligatorie (`tnum`), così "100 kg" e "62,5 kg" stanno in colonna.
- **Tutto il resto dell'interfaccia** — etichette, pulsanti, navigazione, i messaggi dell'utente in chat — in Archivo a larghezza normale, pesi medio e semibold. Le etichette di tabella in maiuscoletto spaziato.

Fallback: `"Archivo", "Arial Narrow", Arial, system-ui, sans-serif`.

### Voce del coach e note: Newsreader (variabile, asse `opsz` 6–72)

Newsreader è un serif editoriale disegnato per essere letto, con ottiche diverse per testo e display. Lo usiamo per **tutto ciò che il coach dice**: i messaggi in chat, la riga sotto la readiness, il commento al piano, le schermate vuote, il riepilogo di fine blocco — e per **il testo delle note a piè di pagina**. Corsivo per il "cosa non dice" della scheda studio. Ottica piccola (`opsz` basso) per le note, così restano leggibili anche in corpo ridotto.

Fallback: `"Newsreader", Georgia, "Times New Roman", serif`.

### Perché questo accoppiamento

Il grottesco largo e nero è la palestra: fisico, sicuro, non negoziabile. Il serif è la pagina: paziente, argomentato, umano. Quando in seduta vedi una riga in serif sotto ai numeri, sai *senza leggerla* che è il coach che parla. Quando in chat il coach cita un numero, quel numero è in grottesco: è un fatto, non un'opinione. Il contrasto di forma fa il lavoro che negli altri sei prodotti fa (male) il colore dell'accento.

### Scala: due, non una

Il prodotto vive a due distanze di lettura: 40 cm per 3 secondi in palestra, 60 cm per 20 minuti alla scrivania. La base tipografica sale sul mobile in seduta e scende su desktop. Sei gradini, contrasto forte:

| Gradino | Cosa | Famiglia | Proporzione rispetto al corpo |
|---|---|---|---|
| **Numero** | peso, rip, serie in seduta; numeri del riepilogo; il prezzo in landing | Archivo Expanded Black, tnum | ≈ 3,5–4× |
| **Titolo** | nome esercizio, titolo della schermata vuota, H1 landing | Archivo Bold, larghezza normale | ≈ 1,8–2,2× |
| **Voce** | i messaggi del coach | Newsreader, ottica testo | ≈ 1,1× — leggermente sopra il corpo, mai sotto |
| **Corpo** | interfaccia, messaggi dell'utente, tabelle | Archivo Medium | 1× |
| **Nota** | testo delle note a piè di pagina, "precedente" | Newsreader ottica piccola / Archivo | ≈ 0,85–0,9× — con un **pavimento più alto sul mobile in seduta** |
| **Etichetta** | intestazioni di tabella, "PRO", "OGGI" | Archivo Semibold maiuscoletto spaziato | ≈ 0,75× |

L'apice della nota (il numeretto) è Archivo tabulare, mai un carattere Unicode in apice: va disegnato come componente, con un target tappabile che non dipende dalla dimensione del glifo.

### Self-hosting obbligatorio

Entrambe le famiglie sono su Google Fonts con licenza OFL: si scaricano e si servono dal nostro dominio (Fontsource o file statici). **Nessuna chiamata a `fonts.googleapis.com`**: la CDN di Google Fonts è un caso GDPR noto in UE e non vogliamo una voce in più nella privacy policy. `font-display: swap` con metriche di fallback allineate per non avere CLS.

---

## 5. Colore

Il colore qui è **carta, inchiostro, evidenziatore**. Se stampi la pagina in scala di grigi, l'identità resta intera: numeri larghi, note in apice, serif del coach. Il colore fa una cosa sola — dice "questo è tappabile e ha una nota" — e la fa con un evidenziatore giallo, l'unico colore acceso del sistema.

| Nome | Valore | Ruolo nel racconto |
|---|---|---|
| **Carta** | `#F4F4F1` | Il fondo della pagina. Non crema (niente calore da diario), non bianco puro: la carta da fotocopia della scheda. |
| **Bianco** | `#FFFFFF` | Le superfici che contengono dati: la riga del set, la cella della settimana, la scheda studio. Sulla carta si stacca senza ombre. |
| **Inchiostro** | `#17181A` | Testo, numeri, pulsanti primari, check di set fatto, anello di focus. Il "fatto" è inchiostro, non verde. |
| **Grafite** | `#5C5F63` | Testo secondario: il "precedente" nella riga del set, le etichette, il contatore dei messaggi. Contrasto 6,4:1 su bianco, 5,8:1 su carta. |
| **Riga** | `#D9DAD5` | Filetti di tabella e separatori. Le tabelle hanno righe, non ombre. |
| **Evidenziatore** | `#FFDD57` | **Solo sfondo, mai testo.** La nota in apice, la cella "oggi" nella settimana, le serie cambiate dalla readiness, la scelta selezionata. Con inchiostro sopra: 13:1. |
| **Attenzione** | `#B3261E` | Solo il blocco di sicurezza (dolore, temi medici) e le azioni distruttive (cancella account, recesso). **Mai** per la seduta saltata, mai per la quota chat, mai per il "giorno no". |

Regole d'uso:
- L'evidenziatore contro carta o bianco è 1,3:1 — **non può essere l'unico indicatore** di un componente. La nota in apice è riconoscibile per il numero in inchiostro e per il bordo/sottolineatura in inchiostro; il giallo rinforza, non identifica. Vale per ogni uso del giallo.
- Nessun gradiente, da nessuna parte. Nessuna ombra portata: la profondità è bianco-su-carta e filetti.
- Il "Pro" è una pillola inchiostro con testo bianco in etichetta. Niente oro, niente corona, niente lucchetto.
- Nessun verde. Il verde nel fitness dice "check, sei stato bravo" ed è la grammatica del badge che abbiamo tagliato.

---

## 6. L'elemento firma: la nota

**Ogni numero che il motore ha deciso porta una nota in apice.** Il numeretto — inchiostro su evidenziatore, tappabile — apre in loco la nota in Newsreader: una riga in italiano che dice cosa dice lo studio, una in corsivo che dice cosa *non* dice, e sotto autori, anno, rivista, DOI. Quando la fonte non c'è, la nota esiste lo stesso e dice: *"Nota nostra, non uno studio."* Dove ci sono più note su una schermata, in fondo c'è **l'apparato**: la lista numerata delle note, come le referenze in coda a un paper.

È una firma e non una decorazione perché **codifica un fatto vero sul contenuto**: quel numero ha un `rule_id` e una citazione nel database (brief §6). La nota è una join, non un ornamento. E risolve il dubbio del brief §11 sulle "due firme": la **metrica di costanza è una firma di contenuto** (cosa misuriamo), la **nota è la firma visiva** (come lo mostriamo). La costanza compare *con* la nota, non accanto a un secondo linguaggio grafico.

### Dove ricorre

| Schermata | Come compare la nota |
|---|---|
| **Seduta** (mobile) | Nell'intestazione di ogni esercizio: `3 × 8¹ · 90″²`. Le note dell'esercizio sono raccolte in una riga chiusa sotto l'ultima serie ("Note 1–2") che si apre in loco. Non interrompe il ritmo Hevy: la riga del set resta precedente-in-grafite · peso · rip · check. |
| **Readiness** | La riga del coach che dice cosa cambia oggi ha la sua nota; le serie modificate ricevono l'evidenziatore. |
| **Piano / settimana** (desktop e mobile) | Ogni variazione tra settimane è annotata: "Settimana 3: +1 serie su gambe¹". Il mesociclo si legge come un documento con apparato in fondo. |
| **Chat** | I messaggi del coach in serif portano note in apice quando citano; l'apparato è in coda al messaggio. Il badge AI in alto ha la nota che spiega da dove vengono le regole. |
| **Stati vuoti** | Il titolo in Archivo, una frase del coach in Newsreader con la sua nota, al massimo tre scelte. Vedi §7. |
| **Progressi** | La costanza è un numero largo ("10 su 12") con nota: *"contiamo le sedute fatte e quante volte sei tornato, non i giorni di fila"*. |
| **Riepilogo di fine blocco** | Tre numeri larghi, il paragrafo del coach con tre note, due pulsanti pari. |
| **Onboarding** | Il questionario di sicurezza ha una nota su *perché* lo chiediamo (art. 9 GDPR, consenso separato). |
| **Prezzi / impostazioni** | Il prezzo ha la nota "IVA inclusa"; il pulsante "Recedi dal contratto qui" ha la nota sui 14 giorni. |
| **Landing** | Il titolo, il prezzo e ogni affermazione portano una nota; il footer è l'apparato con le referenze vere. |
| **Marchio** | `ancora¹`. |

### Tre regole per non farla degenerare
1. **Una nota per numero, non per parola.** Se una frase ha tre note, è scritta male.
2. **La nota si apre dove sei**, in un foglio che sale dal basso su mobile e un pannello a lato su desktop: non si naviga via dalla seduta per leggerla.
3. **Nessuna nota decorativa.** Se non c'è né studio né "nota nostra", non c'è apice.

---

## 7. Gli stati vuoti: dove vive il coach

Sono schermate vere, non messaggi in un rettangolo grigio. Struttura fissa: **titolo in Archivo** (il fatto), **la voce del coach in Newsreader** (il senso, con nota), **al massimo tre scelte** con pari peso. Molta carta intorno.

**Giorno di riposo**
> **Oggi: recupero.**
> Non è un giorno vuoto: è il giorno in cui i muscoli fanno quello per cui li hai allenati ieri¹. Domani: Full Body B, 45 minuti.
> ¹ L'adattamento avviene tra una seduta e l'altra; per questo il piano mette almeno 48 ore tra due sedute sullo stesso gruppo. *(Schoenfeld, Ogborn, Krieger 2016, frequenza — da confermare nel seeding.)*

**Seduta saltata** — vedi il "giorno no" in §2: la schermata è la chat aperta sul primo messaggio del coach, con le tre scelte come pulsanti.

**Settimana saltata**
> **Questa settimana: 0 su 3.**
> Non serve recuperarle. Il piano riparte da dove sei, non da dove eri: stessi esercizi, carichi al 90%¹, da lunedì. Vuoi che la prima sia la versione corta?
> [ Sì, corta ]   [ No, intera ]   [ Parliamone ]

**Ritorno dopo due o più settimane**
> **Bentornato. Sono passate tre settimane.**
> I carichi li abbasso del 10–15% per la prima seduta¹, poi si risale in fretta: la forza persa in tre settimane torna in una o due². Il resto è uguale. Corta o intera?
> ¹ ² *(Bosquet et al. 2013, meta-analisi sul detraining — da confermare nel seeding.)*

**Mantenimento (fine blocco 1, free)**
> **Blocco 1 chiuso. La settimana ora si ripete.**
> Stessi carichi, stesse serie. Timer, sostituzioni e readiness funzionano come prima. Se vuoi che costruisca il blocco 2 sui tuoi numeri, è Pro.
> [ Vedi il riepilogo del blocco ]   [ Vai alla seduta di oggi ]

Nessuno di questi usa il rosso, un'icona triste, o un contatore a zero in evidenza.

---

## 8. Densità: dove stringe, dove respira

**Stringe — la palestra.** La seduta è una tabella: righe di set compatte, numeri larghi, il nome dell'esercizio fisso in alto mentre scorri, le note chiuse. Tutto ciò che si tocca sta nella metà bassa dello schermo: check, timer, "Sostituisci", "Versione corta". Le azioni sono **parole**, non icone: "Sostituisci", "Fatto", "Salta" — sotto il neon con le mani sudate una parola si legge, un'icona si interpreta. Il timer di riposo sale dal basso, non copre la lista.

**Respira — il coach.** La readiness sono tre domande, ognuna una riga alta con tre scelte larghe, una schermata sola. La chat è una pagina: i messaggi del coach non stanno in bolle ma in paragrafi con un filetto a sinistra, misura di lettura da libro, interlinea generosa; i messaggi dell'utente in Archivo, allineati a destra, senza filetto. Gli stati vuoti hanno più carta che testo.

**Desktop — due densità sullo stesso schermo.** A sinistra la settimana/mesociclo come tabella con filetti (denso, editabile in Pro); a destra la chat come colonna di lettura (larga, con margine). L'apparato delle note è un pannello che si apre a lato senza spostare la tabella.

**Landing.** Il primo schermo respira (titolo, una frase, prezzo, un pulsante). La prova è densa perché è una scheda vera. La tabella prezzi è una tabella, con filetti, senza card.

**Raggi.** Le superfici — righe, celle, pannelli, pulsanti — hanno **angoli vivi**: la carta non ha angoli tondi. Solo la nota in apice e la pillola "Pro" sono tonde. Due raggi in tutto il sistema: zero e pieno.

---

## 9. Movimento

Tre movimenti, tutti su `transform`/`opacity`, tutti tra 150 e 300 ms, ognuno spiega un cambio di stato. Il resto è istantaneo.

1. **Set fatto.** Il check si riempie d'inchiostro e il numero della riga fa un "timbro" (scala 0,96 → 1, 150 ms). Il timer di riposo sale dal basso (translateY, 200 ms). È il ritmo di Hevy con il nostro peso.
2. **La nota si apre.** Il foglio della nota sale dal basso (mobile) o entra da destra (desktop) con opacità + traslazione, 200 ms. Chiude allo stesso modo.
3. **Il piano di oggi cambia.** Dopo la readiness, le serie modificate ricevono l'evidenziatore con una **passata da sinistra a destra** (scaleX da 0 a 1 sull'origine sinistra, 300 ms, sfalsata di poco riga per riga). È l'unico momento "di delizia" del prodotto e coincide col requisito del brief: il cambiamento deve essere *visibile*.

Con `prefers-reduced-motion`: i tre diventano cambi di stato istantanei; l'evidenziatore resta (è uno stato, non un'animazione). Nessun parallasse, nessuna animazione allo scroll in landing, nessun confetti, nessun contatore che sale.

---

## 10. La landing

Un argomento in ordine: **cos'è → la prova → per chi → quanto costa → l'azione**, con le note in apice che fanno da firma dal titolo al footer. Il primo schermo, a 375 px senza scorrere, contiene titolo, sottotitolo, prezzo e pulsante. Nessuna foto stock, nessun corpo, nessun before/after: la prova è il prodotto.

### 1. Apertura (above the fold)

Eyebrow (etichetta): `ancora¹ — coach di palestra, in italiano`

**H1** (Archivo Bold, tre righe su mobile):
> Una scheda che dice perché.
> Un coach che ti scrive
> il giorno in cui non hai voglia².

Sottotitolo (Newsreader):
> Per chi va in palestra da solo, da poco o dopo una pausa, e almeno una volta ha smesso senza decidere di smettere.

Riga del prezzo (Archivo, con il numero in gradino "Numero"):
> **Il primo blocco di 4 settimane è gratis e completo. Poi 9,99 €/mese³**, o 59,99 €/anno⁴. Disdici quando vuoi.

Pulsante primario (inchiostro): **Fai la tua scheda** — sotto, in grafite: *due minuti, nessuna carta.*
Pulsante secondario (testo): **Guarda come funziona**

Sotto la piega ma ancorato al primo schermo su desktop: un estratto della scheda vera (sezione 2) a grandezza da lavagna, cioè il prodotto stesso come immagine hero.

Note dell'apertura (nell'apparato in fondo):
> ¹ ancóra: di nuovo. àncora: quello che ti tiene.
> ² Il coach è un'intelligenza artificiale con una base di regole scritte da persone. Te lo diciamo ogni volta che gli parli.
> ³ IVA inclusa. Nessuna carta richiesta per il primo blocco: non è un trial a scadenza, è il primo mesociclo intero.
> ⁴ Equivale a 5 € al mese.

### 2. La prova, parte prima: una scheda vera

Titolo: **Questa è la scheda di Marco, 34 anni, tornato in palestra dopo otto mesi.**
Sotto, in grafite: *Tre giorni a settimana, palestra commerciale, obiettivo: ricominciare e restare.*

La tabella (Archivo, numeri larghi, filetti), Full Body A:

| Esercizio | Serie × rip | Recupero | Quanto vicino al limite |
|---|---|---|---|
| Squat con bilanciere | 3 × 8¹ | 2′² | 2–3 ripetizioni in canna³ |
| Panca piana | 3 × 8¹ | 2′² | 2–3 in canna³ |
| Rematore con manubrio | 3 × 10 | 90″ | 2 in canna |
| Lento avanti in piedi | 2 × 10 | 90″ | 2 in canna |
| Plank | 3 × 30″ | 60″ | — |

Apparato sotto la tabella, in Newsreader:
> ¹ Per chi ricomincia, 6–10 serie a settimana per gruppo muscolare bastano a crescere; oltre le 10 il beneficio in più c'è ma è piccolo. *Non dice* che più è sempre meglio. — Schoenfeld, Ogborn, Krieger 2017, meta-analisi, *J Sports Sci*.
> ² Due minuti di recupero tra le serie pesanti danno più forza e più massa di un minuto. *Non dice* che tre siano meglio di due. — Schoenfeld et al. 2016, *J Strength Cond Res*.
> ³ Fermarsi a 2–3 ripetizioni dal limite dà risultati simili all'andare a cedimento, con meno fatica accumulata. *Non dice* che il cedimento sia da evitare sempre. — Grgic et al. 2022, meta-analisi, *J Sport Health Sci*.

Riga di chiusura: *Ogni numero nella tua scheda ha una nota così. Se non ce l'ha, la nota dice "nota nostra, non uno studio".*

Vincolo: gli estremi delle citazioni vanno **confermati dal validatore DOI nel seeding** (brief, emendamento 5) prima di andare in pagina. In landing compaiono autori, anno e rivista; il DOI lo aggiunge il backend dalla tabella `citations`.

### 3. La prova, parte seconda: il giorno in cui non hai voglia

Titolo: **Martedì, ore 21:40. Marco ha saltato.**

La conversazione del §2 ("Oggi la seduta non c'è stata…"), impaginata come in app: coach in Newsreader con filetto, Marco in Archivo a destra, le tre scelte come pulsanti pari. Sotto, una frase:

> Il coach conosce la tua scheda, le tue ultime sedute e quante volte sei tornato. Non ti fa la predica, non ti manda un audio motivazionale: ti dà tre strade e ricalcola la settimana su quella che scegli⁵.

> ⁵ In uno studio controllato di Stanford (Bloom, CHI 2026), chi aveva un coach che scriveva così ha cambiato il modo di pensare ai propri obiettivi, ha usato l'app cinque volte di più e ha perso meno attività nel tempo. *Non dice* che si allena di più chi ha il coach: in quattro settimane l'attività è cresciuta uguale nei due gruppi.

### 4. Come funziona — in quattro passi (numerati perché sono una sequenza)

1. **Rispondi a cinque domande.** Obiettivo, livello, giorni, attrezzatura, vincoli. Due minuti.
2. **Ricevi la scheda con le note.** Il coach la commenta in tre righe: perché questo split, questo volume, questa progressione.
3. **Segui la seduta dal telefono.** Numeri già compilati, timer che parte al check, sostituisci un esercizio in due tocchi. Funziona anche senza rete.
4. **Il coach ti scrive quando serve.** Prima della seduta ti chiede come stai e adatta il giorno. Se salti, ti scrive lui.

### 5. Per chi è, per chi no

Due colonne, stesso peso.

**È per te se**
- vai in palestra da solo, senza PT;
- ci vai da meno di un anno, o ci sei tornato dopo una pausa;
- ti alleni 2–4 volte a settimana;
- vuoi capire perché fai una cosa, senza laurearti.

**Non è per te se**
- prepari una gara di powerlifting: Juggernaut fa quello meglio di noi;
- vuoi il metodo Mentzer, FST-7 o l'MRV settimana per settimana: Arvo parla la tua lingua;
- cerchi un piano alimentare: non lo facciamo, e non lo scriviamo "in arrivo".

### 6. Quanto costa

Titolo: **Un piano gratis per sempre, un piano Pro. Nessuna sorpresa.**

Tabella con filetti, senza card:

| | **Base** — 0 € | **Pro** — 9,99 €/mese³ o 59,99 €/anno⁴ |
|---|---|---|
| Primo blocco di 4 settimane con le note | completo | completo |
| Blocchi successivi costruiti sui tuoi dati | no — la settimana si ripete uguale | illimitati |
| Seduta: logging, timer, sostituzioni, bozza senza rete | per sempre | per sempre |
| Readiness e versione corta della seduta | per sempre | per sempre |
| Messaggi al coach | 15 al mese | illimitati⁶ |
| "Giorno no" con la settimana ricalcolata | nel primo blocco | sempre |
| Progressi e costanza | ultime 8 settimane | tutto lo storico |
| Disdetta dal tuo account | — | quando vuoi |
| Recesso entro 14 giorni | — | rimborso integrale |

Sotto la tabella:
> **I primi 100 abbonati: 49,99 €/anno, per sempre finché non disdici.** Contatore visibile: *"ne restano 100"*.
> ⁶ Uso ragionevole: 300 messaggi al mese, 40 al giorno. Non li vendiamo a pacchetti: il coach serve la sera in cui non hai voglia, non quando hai crediti.

### 7. L'azione

Titolo (Archivo, grande): **Fai la tua scheda.**
Sotto, Newsreader: *Due minuti, nessuna carta. Il primo blocco è intero e gratis. A fine blocco decidi tu.*
Pulsante: **Fai la tua scheda**

### 8. Apparato e footer

Titolo di sezione: **Note** — la lista numerata 1–6 in Newsreader, come le referenze in coda a un paper. È l'apparato della pagina e chiude la firma.

Footer in etichetta: Privacy · Termini · Crediti (attribuzione wger CC BY-SA e dataset MIT, come richiesto dal business model §8) · *Parli con un coach AI, non con una persona.* · Contatti.

### Cosa misura la landing

Un solo evento: iscrizione/registrazione dal pulsante. È l'esperimento 1 del business model §11: se converte l'intermedio e non il principiante, si riapre il brief §2 — e con lui questa sezione.

---

## 11. Cosa non faremo mai in questo progetto

- **Nessun fondo scuro, nessun gradiente, nessun vetro.** Carta, inchiostro, evidenziatore.
- **Nessuno streak, badge, fuoco, coriandoli, PR con la fanfara.** La seduta finita è una riga del coach, non un'esplosione.
- **Nessun rosso per il giorno saltato**, per la quota chat, per il mantenimento. Il rosso è solo sicurezza e cancellazione.
- **Nessuna emoji, nessuna esclamazione, nessun "campione", nessun "no excuses", nessun "respira".** Il coach non è un sergente e non è un'app di meditazione.
- **Nessuna foto stock di corpi, nessun before/after.** La prova è la scheda.
- **Nessuna azione solo-icona in seduta.** Sotto il neon le azioni sono parole.
- **Nessun tunnel.** La seduta non blocca la navigazione; il paywall non compare mai in seduta, in onboarding o nel flusso di sicurezza (business model §6).
- **Nessun numero senza nota.** E nessuna promessa di risultato: "59% più veloce" è la frase che non scriviamo (business model §12).
- **Nessun prezzo nascosto, nessun countdown, nessun "solo oggi".** Il contatore dei fondatori è un contatore, non una pressione.
- **Nessun lucchetto, nessuna corona, nessun oro** per il Pro. Una pillola inchiostro con la parola.
- **Nessuna icona di IA scintillante**, né nel badge né nel marchio.
- **Nessun raggio intermedio.** Zero o pieno.
- **Nessun font da CDN di terzi.**

---

## 12. Consegne a `ui-ux-designer`

Da trasformare in numeri, nell'ordine in cui servono al frontend:

1. **Token di colore** dalla tavolozza in §5, con i controlli di contrasto rifatti sui valori finali (inchiostro/grafite su carta e bianco; inchiostro su evidenziatore; attenzione su bianco) e la regola "l'evidenziatore non identifica mai da solo".
2. **Le due scale tipografiche** (palestra e scrivania) dai sei gradini di §4: valori, interlinee, tracking del maiuscoletto, pavimento di leggibilità per la Nota su mobile. Verificare `tnum` su Archivo e coprire l'italiano (accenti, virgolette basse). Setup del self-hosting con metriche di fallback.
3. **Il componente Nota**: apice (dimensione, target ≥ 44×44 anche se il glifo è piccolo, stati riposo/focus/aperto), il foglio della nota (mobile dal basso, desktop a lato), la scheda studio (cosa dice / cosa non dice / metadati / DOI), l'apparato in coda alla schermata. Focus visibile in inchiostro, tastiera e screen reader (l'apice è un pulsante con nome accessibile "Nota 1: …").
4. **La riga del set** con tutti gli stati (da fare, in corso, fatto, saltato, sostituito) e i due campi grandi tappabili; il timer che sale dal basso; "Sostituisci" a due tocchi; la riga "Note 1–2" chiusa/aperta. Densità da palestra: metà bassa dello schermo per tutto ciò che si tocca.
5. **Readiness**: tre righe, tre scelte larghe, una schermata; la passata dell'evidenziatore sulle serie cambiate (§9.3) e il suo equivalente a movimento ridotto.
6. **La chat come pagina**: paragrafi del coach con filetto, messaggi dell'utente a destra, composer con l'indicatore di quota testuale, la card Pro al posto del composer a 15/15, il badge AI sempre visibile, il blocco di sicurezza con filetto rosso (non un modale).
7. **Gli stati vuoti di §7 come schermate complete**, con la struttura fissa titolo / voce / tre scelte pari.
8. **Il riepilogo di fine blocco** come schermata: tre numeri larghi, il paragrafo con note, due pulsanti a pari peso.
9. **La costanza**: rappresentazione della finestra di 4 settimane che mostra le sedute fatte, le corte, i riposi e i ritorni dopo un buco, senza rosso e senza contatore a zero; il numero "10 su 12" con nota.
10. **Desktop**: tabella settimana/mesociclo (celle bianche su carta, filetti, editabile in Pro, sola lettura in mantenimento) con la colonna chat a lato e il pannello note.
11. **Pulsanti e pillole**: primario inchiostro, secondario con bordo inchiostro, terziario testo; angoli vivi; la pillola "Pro"; la pillola della nota. Stati hover/focus/attivo/disabilitato senza affidarsi al solo colore.
12. **Movimento**: i tre movimenti di §9 con durate, easing e la mappa `prefers-reduced-motion`.
13. **Landing**: griglia, misura di lettura, il primo schermo a 375/768/1440 con prezzo e pulsante sopra la piega, la tabella prezzi, l'apparato in fondo.
14. **Il logotipo** `ancora¹` in Archivo minuscolo con l'apice come componente reale, e la sua versione senza nota per i contesti in cui non si può aprire (favicon, email).

Non faccio io: nessun valore in px, nessuna enumerazione di stati. Se una scelta qui contraddice la soglia di accessibilità quando la traduci in numeri, cambia la scelta e dimmelo.

---

## Decisione dell'utente (2026-09-16)

Direzione **approvata** così com'è. **Nome del prodotto: `fitcoach`** — la proposta "Ancora" non è adottata. Il logotipo diventa `fitcoach¹`, con la nota 1 da riscrivere (il gioco ancóra/àncora decade; la nota può spiegare cos'è il chip di fonte o restare "coach: un buon PT che ti scrive il perché"). Tutto il resto (tema chiaro, Archivo + Newsreader, palette, la nota come firma, tono, landing) resta vincolante.
