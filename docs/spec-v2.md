# Lifted — specifica v2 (revisione del 2026-09-23)

Integra e **sovrascrive dove diverge** `spec.md`. Fonte: richiesta dell'utente con screenshot di Hevy web.
Restano invariati: local-first (Dexie/IndexedDB), nessun backend, nessun account, nessun costo, uso personale, PWA offline, italiano.

## 1. Il guscio cambia: layout Hevy **web**, palette dark invariata

Riferimenti visivi in `docs/rif-hevy-feed.png` e `rif-hevy-2..6.png` (screenshot di hevy.com).
**Decisione dell'utente: si tiene il tema scuro già costruito e verificato per contrasto; cambia il layout.**

Da Hevy web si prende:
- **Sidebar fissa a sinistra** con logo in alto, ricerca, voci con icona + etichetta
  (Feed/Home · Routine · Esercizi · **Trainer** · Profilo · Impostazioni) e il blocco utente in basso.
- **Contenuto a card** su colonna centrale, con **colonna destra** di supporto
  (riepilogo profilo, azioni rapide tipo "Nuova routine"/"Nuova cartella", calendario).
- **Home a feed**: gli allenamenti come schede con durata, volume, record, elenco esercizi
  e "Visualizza N altri esercizi".
- **Libreria esercizi a due pannelli**: elenco filtrabile a destra (attrezzo, muscolo, ricerca),
  dettaglio/statistiche dell'esercizio al centro.
- **Profilo**: intestazione con conteggio allenamenti, statistiche con tab (Durata/Ripetizioni),
  **calendario mensile** con i giorni di allenamento evidenziati, poi il feed personale.
- **Impostazioni a due colonne**: indice a sinistra (Profilo, Unità, Lingua, Tema, Esporta dati…),
  pannello a destra.
Niente social: nessun follower, nessun commento, nessun "atleti suggeriti", nessun like.
Le sezioni social degli screenshot si ignorano.

Su telefono resta la **bottom navigation** già costruita: la sidebar è il layout da ≥1024px.

## 2. Trainer — nuova funzionalità, deve funzionare davvero

Su Hevy è Pro e solo da app; qui è nativo e sul sito.
**Programma generato e progressivo**: l'utente dichiara obiettivo, muscoli da privilegiare,
attrezzatura disponibile, livello e giorni a settimana; il Trainer genera un **programma di più settimane**
(routine pronte per ogni giorno) e **progredisce da solo** in base a come vanno gli allenamenti
registrati (carichi, ripetizioni, RPE, serie completate o saltate).
Deve essere trasparente: si vede cosa cambia e perché. Tutto locale, nessun servizio esterno.

## 3. Libreria esercizi — completa, variante per variante

Fonte: `docs/esercizi-hevy.md` (lista fornita dall'utente).
Ogni combinazione movimento×attrezzo è un **esercizio distinto** (Panca Piana Bilanciere,
Panca Piana Manubri, Panca Piana Smith, Panca Piana Macchina…), come su Hevy: ~250-300 voci.
Gruppi: petto, dorso/schiena, spalle/trapezi, braccia, gambe, addominali/core, full body/olimpico.
Attrezzi: bilanciere, bilanciere EZ, manubri, cavi, macchina, Smith, corpo libero, zavorrato,
kettlebell, bande, trap/hex bar, palla medica, disco, attrezzo specifico.
Gli esercizi già presenti non si duplicano e i personalizzati dell'utente non si toccano.

## 4. Video di esecuzione — **fuori dalla v2**

Decisione dell'utente: niente video per ora. Lo schema può prevedere il campo, ma nessuna
schermata deve prometterli.
