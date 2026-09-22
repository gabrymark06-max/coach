# Lifted — specifica

Fonte: richiesta dell'utente, 2026-09-22. È il brief: non si rinegozia, si implementa.

## Obiettivo
Clone di **Hevy** a **uso strettamente personale**, con tutte le funzioni Pro/Premium native,
**senza alcun costo di gestione o infrastruttura**: 100% gratuito e **local-first**.

## 1. Stack
- Next.js (App Router), React 19, TypeScript
- Tailwind CSS, lucide-react, Radix UI / shadcn/ui
- Recharts
- **Persistenza: IndexedDB via Dexie.js** — nessun server, nessun database a pagamento, i dati restano sul dispositivo
- PWA: manifest + service worker, offline, installabile su iOS/Android

## 2. Design system (stile Hevy dark)
- Sfondo primario `#0B0C0E`; card e contenitori `#16181D` / `#1F222A`; bordi `#2A2E39`
- Accenti: blu elettrico `#007AFF` / `#1D70F5` per pulsanti principali, completamento serie e grafici;
  arancione/giallo per PR e badge
- Tipografia sans-serif moderna, pulita, compatta, alto contrasto
- Mobile-first, **bottom navigation a 5 tab**:
  1. Allenamento (quick start, routine)
  2. Profilo/Feed (storico e riepilogo)
  3. Esercizi (libreria con filtri per muscolo/attrezzo)
  4. Misurazioni (tracking corporeo)
  5. Statistiche (analisi avanzata e grafici)

## 3. Funzionalità

### 3.1 Routine e workout tracking (illimitati)
- Routine illimitate, suddivise per split
- Tracker di sessione attivo: inserimento rapido di peso (kg) e ripetizioni, **RPE 1-10 opzionale**
- Tipi di serie: **Normale, Riscaldamento (W), Drop set (D), Cedimento (F)**
- Volume totale sollevato (kg × reps) calcolato in tempo reale
- **Timer di recupero** automatico configurabile: popup / floating pill, avviso sonoro

### 3.2 Calcolatore di riscaldamento automatico
Dato il peso target della prima serie allenante, genera le serie di riscaldamento a percentuali
progressive (bilanciere vuoto, 50%, 70%, 85-90%) con le ripetizioni consigliate.

### 3.3 Calcolatore di dischi (plate calculator)
Dato il carico target e il peso del bilanciere (20 kg standard o personalizzabile), calcola la
combinazione esatta di piastre (20, 15, 10, 5, 2.5, 1.25 kg) **per lato**, con visualizzazione
grafica del bilanciere.

### 3.4 Libreria esercizi e custom illimitati
- Database precaricato: principali multiarticolari e di isolamento per gruppo muscolare
  (petto, dorso, spalle, gambe, braccia, core)
- Esercizi personalizzati illimitati, con muscolo target e attrezzatura
  (bilanciere, manubri, cavi, macchinari, corpo libero)

### 3.5 Statistiche avanzate e cronologia illimitata
- **1RM stimato** con formula Epley/Brzycki, e suo andamento
- Grafico del volume totale settimanale e mensile
- Distribuzione del volume per gruppo muscolare (torta o barre radiali)
- **Rilevamento automatico dei PR** (1RM, volume, reps) con notifica

### 3.6 Misure corporee
Peso corporeo, % massa grassa, circonferenze (braccia, torace, vita, fianchi, cosce, polpacci),
con grafici di andamento per ciascuna metrica.

### 3.7 Esportazione e backup (portabile)
- Export completo di storico e misure in **JSON e CSV**
- **Ripristino da backup JSON** per cambio dispositivo o sincronizzazione manuale

## Conseguenze da tenere ferme
- Nessun backend, nessuna autenticazione, nessun pagamento, nessuna telemetria.
- I dati vivono solo nel browser: il backup manuale è l'unica rete di sicurezza, quindi
  export e import sono funzioni di prima classe, non un ripensamento.
- Uso personale: niente landing di vendita, niente SEO di acquisizione, niente paywall.
