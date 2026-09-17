# fitcoach — Allineamento (fase 0)

Data: 2026-09-16

## Idea
Un coach di palestra personale: in base alla situazione della persona (livello, obiettivo,
vincoli, tempo) costruisce e adatta il percorso per raggiungere l'obiettivo, con
raccomandazioni fondate su studi scientifici (ipertrofia, forza, dimagrimento,
programmazione, recupero). È anche un coach mentale: gestisce i momenti in cui non si ha
voglia di allenarsi, i cali di motivazione, le ricadute, la costanza.

## Decisioni prese con l'utente
- **Utente tipo v1**: tutti — l'onboarding profila (principiante / intermedio / obiettivo salute)
  e l'app si adatta.
- **Meccanica del coach**: chat AI (LLM) con base di conoscenza scientifica curata, che genera
  piani personalizzati e dialoga. Il coaching mentale passa dalla stessa chat.
- **Piattaforma**: web app, desktop + mobile. Desktop per pianificazione e revisione,
  telefono in palestra per seguire la seduta.
- **Ambito v1**: allenamento + coaching mentale. Nutrizione fuori dalla v1.
- **Lingua v1**: italiano.
- **Definizione di "fatto" per la v1**: ciclo completo
  onboarding → piano personalizzato → seguire/loggare l'allenamento → il coach risponde
  (tecnica, adattamenti, motivazione).

## Cartella
`progetti/fitcoach/` — `backend/`, `frontend/`, `docs/`.
