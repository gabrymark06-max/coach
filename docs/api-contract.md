# fitcoach — Contratto API (congelato)

Versione: **v1.1.3** · Data: 2026-09-17 (v1.1.2: 2026-09-17 · v1.1.1: 2026-09-17 · v1.1: 2026-09-17 · v1.0: 2026-09-16) · Autore: backend-python · Stato: **congelato**. Il frontend
costruisce contro questo documento e contro `/openapi.json` (fonte di verità meccanica: 55 operazioni su 52 percorsi, 115
schemi). Se una rotta deve cambiare, è un evento esplicito che passa dall'orchestratore, mai una modifica silenziosa.
La v1.1 è **additiva e retrocompatibile**: il frontend costruito sulla v1.0 continua a funzionare (changelog in §15).
La v1.1.1 è una **correzione**: nessuna forma cambia, nessun campo nuovo; cambiano tre comportamenti (changelog in §16).
La v1.1.2 chiude i difetti del rapporto QA assegnati al backend: **additiva** (un codice 503 nuovo, `Retry-After` sul 429,
header di sicurezza), nessuna forma cambia; cambiano quattro comportamenti (changelog in §17).
La v1.1.3 chiude due buchi segnalati dal frontend: **additiva** (`Retry-After` esposto in CORS, nuova rotta pubblica
`GET /billing/prices`), nessuna forma esistente cambia (changelog in §18).

- Server locale: `http://127.0.0.1:8000` · Swagger: `/docs` · Contratto: `/openapi.json`
- Codice: `backend/` (README con avvio, `.env.example`, `python -m scripts.seed`)

---

## 0. Convenzioni (valgono ovunque)

**Autenticazione.** `Authorization: Bearer <access_token>` (JWT, 60 min). Refresh token opaco (30 giorni) con rotazione:
`POST /auth/refresh` restituisce una coppia nuova e revoca la vecchia. Le rotte pubbliche sono: `/auth/*` (tranne logout e
verify/resend), `/onboarding/schema`, `/knowledge/*`, `/chat/texts`, `/billing/founders`, `/billing/prices`, `/billing/webhook`.

**Errori: una sola forma.** Ogni errore è `{ code, detail, ...extra }`. `code` è per la macchina, `detail` è già in italiano
e nel tono (design-system §6.2). Codici trasversali:

| HTTP | `code` | Quando |
|---|---|---|
| 401 | `unauthorized` | token assente/scaduto (`detail`: "La sessione è scaduta. Entra di nuovo.") |
| 403 | `plan_required` | azione del blocco 2 in free (`detail`: "Per questo serve il blocco 2, e il blocco 2 è Pro.") |
| 404 | `not_found` | risorsa inesistente **o di un altro utente** (non riveliamo che esiste) |
| 422 | `validation_error` | input non valido; `errors: [{field, message, type}]`, `detail` cita il primo campo |
| 429 | `rate_limited` | troppe richieste (in-process, 120/min per utente o IP; auth 10/min; chat 20/min); header `Retry-After` in secondi (v1.1.2), esposto in CORS (v1.1.3) |
| 429 | `chat_quota_exceeded` | quota chat (`resets_at`, `used`, `limit` in extra) |
| 500 | `internal_error` | errore nostro; `detail` chiede di riprovare. Anche il 500 esce con CORS e `X-Request-Id` (v1.1.2) |
| 502 | `llm_failed` | il provider LLM non ha risposto **o il tool loop è caduto**: il turno **non conta**, il messaggio utente resta `status:"failed"` |
| 503 | `billing_unavailable` | (v1.1.2) Stripe non è configurato: `detail` dice che i pagamenti non sono attivi e dà l'email di supporto |

Ogni risposta porta `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(),
microphone=(), geolocation=(), payment=()` (v1.1.2).

**Numeri con nota.** Ogni numero del piano è `{ value, unit, note_n }` (o `{ value|range, unit, note_n }` per le
ripetizioni). Se `note_n` è `null` l'apice non si disegna. **Il frontend non decide mai se un numero ha una nota.**

**Oggetto `Note`** (design-system §9.1, identico):
`{ n, rule_id, rule_version, updated_at, title_it (≤80), summary_it, not_says_it, grade: "A"|"B"|"C"|null, grade_label_it,
is_own_note, rationale_it|null, citations: [{authors, year, title, journal, doi, url, open_access, type}] }`.
Le note arrivano inline nella stessa risposta, numerate da 1 **per risposta** (seduta, messaggio, piano, readiness).
I testi del coach marcano gli apici con `[[n]]`.

**Idempotenza delle scritture in seduta.** Ogni scrittura porta `client_op_id` (stringa ≤64, generata dal client) e
`client_updated_at` (ISO 8601, ora del client; può essere ore nel passato). Stesso `client_op_id` → stessa risposta,
nessuna riapplicazione. Vale anche per due richieste **in volo nello stesso istante** sulla stessa seduta (QA2 N2):
le scritture sono serializzate per seduta lato server, la seconda risponde con lo stato già applicato (`duplicate` in
`sync`, 200/201 altrove) — mai 500.

**Date.** `date` = `YYYY-MM-DD`; `datetime` = ISO 8601 con offset (UTC). **"Oggi" è la data di calendario nel fuso
dell'app** (`TIMEZONE`, default `Europe/Rome`), non la data UTC (v1.1.1): `GET /today.date`, quale seduta è "di oggi",
quando una seduta passata diventa `skipped`, la finestra della costanza, il giorno del job email e l'inizio del piano
all'onboarding usano tutti la stessa funzione (`app/clock.py: today_local`). Alle 00:30 a Roma è già domani anche se
in UTC è ancora ieri. Gli istanti (`at`, `closed_at`, `updated_at`, `resets_at`) restano UTC. La quota si azzera sul
mese solare nello stesso fuso: `resets_at` è l'istante UTC corrispondente (es. `2026-09-30T22:00:00Z` = 1° ottobre
00:00 a Roma). Il frontend, che mostra la data di `/today` e confronta `session.date` con il suo "oggi", deve usare
la data locale del dispositivo, non `toISOString().slice(0,10)`.

**ETag.** `GET /sessions/{id}` risponde con `ETag: W/"<updated_at>"` e accetta `If-None-Match` → `304`.

---

## 1. Auth

| Metodo | Rotta | Entra | Esce | Errori |
|---|---|---|---|---|
| POST | `/auth/register` | `{ email, password (≥10), accept_terms: true }` | `201 { access_token, refresh_token, token_type:"bearer", expires_in, user:{id,email,email_verified} }` — manda l'email di verifica | 409 `email_taken` |
| POST | `/auth/login` | `{ email, password }` | `200` stessa forma | 401 `invalid_credentials` ("Email o password non corrispondono.") |
| POST | `/auth/refresh` | `{ refresh_token }` | `200` coppia nuova (vecchio refresh revocato) | 401 `invalid_refresh_token` |
| POST | `/auth/logout` | `{ refresh_token }` + Bearer | `204` | |
| POST | `/auth/verify/resend` | Bearer | `202 { accepted, detail:"Ti ho mandato il link. Vale 24 ore." }` | |
| POST | `/auth/verify` | `{ token }` (dal link `FRONTEND_URL/verifica?token=`) | `200 user` | 400 `invalid_token` |
| POST | `/auth/password/forgot` | `{ email }` | `202` sempre (non rivela chi è registrato); link `FRONTEND_URL/password/reset?token=` | |
| POST | `/auth/password/reset` | `{ token, password }` | `200`; tutte le sessioni aperte cadono | 400 `invalid_token` |

Password: argon2id. Nessuna verifica email richiesta per usare l'app (design §3.2: "nessuna verifica email").

## 2. `GET /me` (design §9.2, identico)

```
{ user: { id, email, email_verified },
  entitlement: { plan: "free"|"pro", source: "stripe"|"promo"|"manual"|"none", valid_until, grace_until },
  engine_active: bool,                       // is_pro OR (mesocycle.index == 1 AND status == "active"); true senza piano
  chat_quota: { used, limit, resets_at, daily_used|null, daily_limit|null },   // daily_* solo Pro (40/giorno)
  mesocycle: { index, week, total_weeks, status: "active"|"maintenance"|"completed" } | null,
  subscription: { interval:"month"|"year", price_key:"month"|"year"|"year_founders", status, started_at, renews_at|null, cancel_at_period_end } | null,
  withdrawal_eligible_until: datetime|null,  // started_at + 14 giorni, solo se abbonamento attivo
  health_consent: { given, given_at },
  onboarding_completed: bool,
  support_email, pwa: { installed_reported } }
```

`DELETE /me` → `204`: cancellazione vera (cascade); gli eventi restano anonimi. Poi login → 401.

## 3. Onboarding (design §9.10)

| Metodo | Rotta | Entra | Esce |
|---|---|---|---|
| GET | `/onboarding/schema` | — | `{ steps:[{id,title_it,fields:[{id,type:"single"|"multi"|"text",label_it,help_it,options:[{id,label_it,help_it}],required}]}], consent:{label_it,text_it,note:Note}, disclaimer_it, gate:{title_it,intro_it,questions:[{id:"q1".."q7",text_it,blocking}],blocking_text_it,acknowledge_label_it,note:Note} }` |
| POST | `/onboarding` | `{ goal:"hypertrophy"|"strength"|"health", level:"beginner"|"intermediate", days_per_week:2..6, minutes_per_session:30|45|60|75, location:"gym"|"home_dumbbells"|"bodyweight", equipment:["band","pull_up_bar"], health_consent:bool, constraints_text?, safety_answers:{q1..q7:bool}, safety_acknowledged?:bool }` | `201 { mesocycle:{index,week,total_weeks,status}, first_session_id, coach_comment_message_id, safety_notice_it|null }` |
| POST | `/consents/health` | `{ given: bool }` | `{ given, given_at, detail }` — la revoca **cancella** `constraints_text` e i vincoli del piano |

Errori: 422 `health_consent_required` (testo vincoli senza consenso); 409 `safety_ack_required` (una domanda bloccante è
"sì" e manca `safety_acknowledged: true`; `detail` è il testo fisso "Prima di iniziare, senti un medico…",
`blocking_questions: [...]`); 409 `onboarding_locked` (piano già partito con sedute loggate).
Gli step sono `goal, level, schedule, place, constraints`; il gate è il "passo 6 di 6". Le domande sono nostre
(non PAR-Q+). Un "sì" qualunque → piano conservativo (RIR +, niente carichi alti sulla colonna).

## 4. Oggi — `GET /today` (design §9.3)

```
{ kind: "session"|"rest_day"|"session_skipped"|"week_skipped"|"return_after_break"|"maintenance"|"block_completed",
  date,
  session_preview?: { session_id, name, exercises_count, est_minutes, short_available, status },   // status: aggiunta additiva
  empty_state?: { title, coach_text (con [[n]]), notes: Note[], options:[{ id, label, description, is_pro,
                  action:{ type:"route"|"chat_option", target, message_id: uuid|null } }] },   // message_id: v1.1
  readiness_required: bool,
  redirect?: "/chat?msg=<id>" }
```

- `action` (v1.1): con `type:"route"` `target` è il percorso e `message_id` è `null`; con `type:"chat_option"` `target` è
  l'`option_id` e `message_id` è il messaggio del coach che porta quell'opzione — si esegue con
  `POST /chat/options/{target} { message_id }` **senza** ricavare l'id da `redirect` (che resta, per compatibilità, e
  punta allo stesso messaggio).
- `session_preview.short_available` (v1.1): `true` se la seduta è ancora aperta **e non è già in versione corta**; il
  terziario "Versione corta (25′)" chiama `POST /sessions/{id}/short` (§6).

- `session_skipped` → solo `redirect` (il coach ha già aperto il giorno no: messaggio `proactive`, protocollo `no_day` o
  `second_skip`, con blocco `options` = `short_tomorrow`, `move` (o `rest` in mantenimento), `renegotiate`).
  `week_skipped` e `return_after_break` hanno `empty_state` **e** `redirect`.
- **Dopo la scelta si va avanti (v1.1.2).** Finché l'utente non sceglie, `/today` ripropone lo stesso stato e lo stesso
  messaggio (mai un secondo "Bentornato"). Appena un'opzione del messaggio è `chosen`, `session_skipped`,
  `week_skipped` e `return_after_break` **non tornano più**: `/today` passa allo stato successivo coerente — `session` se
  oggi c'è una seduta, altrimenti `rest_day` ("La prossima seduta è venerdì 18 settembre: Full Body B.") o `maintenance`.
  Un nuovo salto è un nuovo evento, con un messaggio nuovo.
- **Invariante (v1.1.1):** le opzioni `chat_option` di `empty_state.options` sono sempre un sottoinsieme del blocco
  `options` del messaggio indicato da `action.message_id`. Per `week_skipped` e `return_after_break` il messaggio porta
  esattamente `short_tomorrow` ("Corta") e `full` ("Intera") — design §2.10: la domanda del coach è "corta o intera?",
  non "sposto o rinegozio?". `full` = la prossima seduta com'è nel piano: nessun `plan_change`, il coach conferma la
  data e il nome della seduta.
- `block_completed`: `options = [build_block_2 (is_pro se free, route /blocco/{n}/riepilogo), continue_maintenance (route /settimana)]`; il backend emette `paywall_shown{surface:end_of_block}`.
- 404 `no_plan` se l'onboarding non è fatto ("Il piano non c'è ancora.").
- Le sedute passate non chiuse diventano `skipped` alla prima lettura di `/today` o `/plans/current`.

## 5. Piano (design §9.6)

`GET /plans/current`:
```
{ mesocycle: { index, status, total_weeks, editable, split, started_on, maintenance_note_it|null },
  weeks: [{ n, label_it ("Settimana 4 · deload", "Settimana che si ripete"), is_current, is_deload, is_maintenance,
            changes_it: [{ text (con [[n]]), note_n }],
            sessions: [{ session_id, day:"mon".."sun", date, name, exercises_count, sets_count, est_minutes,
                         status: "done"|"skipped"|"short"|"today"|"planned"|"none" }] }],
  notes: Note[] }
```
`editable = engine_active AND status == "active"`. 404 `no_plan`.

| Metodo | Rotta | Cosa | Errori |
|---|---|---|---|
| POST | `/plans/maintenance` | free a blocco finito: `status → maintenance`, la settimana si ripete (settimane generate lazy fino a oggi). Risponde `PlanOut` | 409 `block_not_completed` |
| POST | `/plans/mesocycles` | Pro: costruisce il blocco successivo (index+1) da oggi, carichi dagli ultimi loggati. `201 { mesocycle, first_session_id, coach_comment_message_id:null }` | 403 `plan_required`; 409 `block_not_completed` |
| GET | `/mesocycles/{n}/summary` | design §9.9 + `paywall_context_line`: `{ block_index, sessions_done, sessions_planned, highlights[≤3]:{label_it, from, to, unit, kind}, coach_paragraph, notes, next_block_preview_it, is_pro, paywall_context_line }` | 409 `block_not_completed`; 404 |

**Proposte di modifica** (audit trail `plan_change_proposals`; l'unica scrittura sul piano oltre alla seduta):

| Metodo | Rotta | Entra | Esce |
|---|---|---|---|
| POST | `/plans/proposals` | `{ patch: { op:"adjust_sets"|"substitute"|"move_session", session_id?, exercise_id? (id dell'esercizio nella seduta), exercise_query?, delta:-2..2, new_exercise_id? (slug), new_day_offset:-6..6, scope:"session"|"rest_of_block" } }` | `{ proposal_id, status:"proposed"|"invalid", diff:[{exercise, field, from, to, note_n}], notes, valid, invalid_reason_it }` |
| GET | `/plans/proposals/{id}` | | stessa forma |
| POST | `/plans/proposals/{id}/apply` | | `status:"accepted"`; aggiorna il blocco `plan_change` nel messaggio del coach (`applied:true`) |
| POST | `/plans/proposals/{id}/reject` | | `status:"rejected"` |

Errori: 403 `plan_required` (free fuori dal blocco 1, o in mantenimento); 409 `proposal_not_applicable`.
`adjust_sets` non tocca la settimana di deload (deriva dalle settimane di allenamento). Limiti: 2..5 serie per esercizio
(3 per principiante, 2 per salute), regola `volume.sets_per_exercise.bounds`.

## 6. Seduta (design §9.5)

`GET /sessions/{id}` → `Session`:
```
{ id, name, date, week, index_in_week, sessions_in_week, status:"planned"|"done"|"short"|"skipped", short_version, est_minutes,
  updated_at, readiness_done, close_line|null,
  exercises: [{ id, exercise_id (slug), name_it, pattern, order,
                media: { gif_url:null, poster_url:null, attribution },          // v1: nessuna GIF (vedi §11)
                prescription: { sets:{value,note_n}, reps:{range:[min,max],note_n}, rest_s:{value,unit:"s",note_n}, rir_target:{value,note_n} },
                substituted_from?: { name_it }, changed_today?: { label_it }, removed_today, removed_reason_it, skipped,
                substitutes: [{ exercise_id, name_it, why_it }] (≤5),
                instructions_it: [string],
                sets: [{ id, n, target:{weight_kg|null, reps, rir}, previous:{weight_kg, reps, rir, date}|null,
                         logged:{weight_kg, reps, rir, status:"todo"|"done"|"skipped", done_at}|null }],
                notes: Note[]  // sottoinsieme di `notes` della seduta, stessi numeri
              }],
  notes: Note[] }
```
`target.weight_kg` è `null` nella settimana 1 ("trovi il carico", regola `progression.week1.find_load`) e dopo una
sostituzione; dalla settimana 2 arriva dalla progressione doppia sul RIR loggato.

**Scritture** (tutte con `client_op_id`, `client_updated_at`):

| Metodo | Rotta | Entra | Esce | Errori |
|---|---|---|---|---|
| POST | `/sessions/{id}/readiness` | `{ sleep:"lt6"|"6to8"|"gt8", mood:"low"|"mid"|"high", pain:"none"|"mild"|"severe" }` | `{ session, diff:{ removed_exercises:[{exercise_id,name,reason_it,note_n}], changed_sets:[{set_id:null, exercise_id, field:"sets"|"reps"|"weight"|"rest"|"rir", from, to}], short_version, est_minutes }, coach_line (con [[n]]), notes, safety: { text, options:[{id,label}], message_id }|null }` | 409 `readiness_already_done`, `session_closed` |
| POST | `/sessions/{id}/short` **(v1.1)** | — (nessun body) | stessa forma della readiness: `{ session, diff, coach_line (con [[n]]), notes, safety:null }` | 409 `already_short`, `session_closed`; 404 |
| POST | `/sessions/{id}/readiness/restore/{exercise_id}` | — (slug) | `Session`; registra `override=true` | 409 `not_removed`, `session_closed` |
| PATCH | `/sessions/{id}/sets/{set_id}` | `{ weight_kg?, reps?, rir?, status?, client_op_id, client_updated_at }` | `SetOut` | 404; 409 `session_closed` |
| POST | `/sessions/{id}/sets` | `{ exercise_id (id nella seduta), client_op_id, client_updated_at }` | `201 SetOut` (copia l'ultimo target) | 409 `session_closed` |
| DELETE | `/sessions/{id}/sets/{set_id}?client_op_id=` | | `204` | 409 `not_last_set`, `min_sets`, `session_closed` |
| POST | `/sessions/{id}/exercises/{ex_id}/substitute` | `{ exercise_id (slug da substitutes), … }` | `SessionExerciseOut` (carichi azzerati) | 422 `invalid_substitute`; 409 `session_closed` |
| POST | `…/exercises/{ex_id}/skip` · `…/restore` | `{ client_op_id, client_updated_at }` | `SessionExerciseOut` | 409 `session_closed` |
| POST | `/sessions/{id}/close` | `{ client_op_id, client_updated_at, sets:[{set_id, weight_kg?, reps?, rir?, status}] }` (la bozza intera) | `{ close_line (con [[n]]), notes, session }` | 409 `draft_conflict` (+ `server_session`), `session_closed` |
| POST | `/sessions/{id}/sync` | `{ ops:[{ op:"patch_set"|"add_set"|"delete_set"|"substitute"|"skip"|"restore"|"close", client_op_id, client_updated_at, set_id?, exercise_id?, new_exercise_id?, weight_kg?, reps?, rir?, status?, sets? }] }` | `{ results:[{client_op_id, status:"applied"|"duplicate"|"error", code?, detail?}], session }` | |

**Readiness con `pain:"severe"` (v1.1).** Il blocco di sicurezza non è più solo un pezzo della risposta: il backend crea
in chat un messaggio del coach `kind:"safety"`, `protocol:"safety.readiness"`, con lo stesso blocco `{type:"safety", text,
options}` del filtro di sicurezza della chat, e ne restituisce l'id in `safety.message_id`. Le tre opzioni (`pause_plan`,
`remove_exercise`, `continue_anyway`) si eseguono con `POST /chat/options/{option_id} { message_id: safety.message_id }`
esattamente come da chat (una sola scelta per messaggio: la seconda è 409 `option_already_chosen`). Nessun LLM, nessuna
quota. Il messaggio resta nel thread: se l'utente esce dalla readiness lo ritrova in `/chat`. Emette `safety_triggered`.
Scelta architetturale: una rotta dedicata (`/sessions/{id}/readiness/safety/{option}`) avrebbe duplicato la macchina delle
opzioni (chosen, 409, plan_change applicato, risposta del coach); un messaggio è la forma che il frontend già sa disegnare
(design §2.4.5: "è un messaggio del coach").

**Versione corta dall'anteprima (v1.1).** `POST /sessions/{id}/short` (design §3.3 passo 1) applica la regola
`session.short_version` del motore — primi 3 esercizi, 2 serie, riposo ≤ 90 s, **stessi carichi** — senza le tre
domande. La risposta ha la stessa forma della readiness: `diff.changed_sets` con `sets`/`rest` per esercizio,
`diff.removed_exercises` per quelli oltre il terzo (nota `session.short_version`), `diff.short_version:true`,
`diff.est_minutes`, `coach_line` "Versione corta: gli esercizi principali, 2 serie, stessi carichi[[1]]. Durata: N minuti.",
`notes`, `safety:null`. Non registra una readiness (`readiness_done` resta `false`, `readiness_required` resta `true`:
la readiness è ancora possibile e si applica **sopra** la corta, deterministicamente). Idempotenza: la seconda chiamata è
409 `already_short` (mai una doppia riduzione); seduta chiusa → 409 `session_closed`. Aggiorna `updated_at` (ETag).
Dopo la corta `GET /today` mostra `est_minutes` ridotti e `short_available:false`. Gli esercizi cambiati hanno
`changed_today.label_it` ("2 serie invece di 5") e i tolti `removed_today:true` con "Rimettilo" via
`/readiness/restore/{exercise_id}` come per la readiness.

Semantica:
- **Per riga, last-write-wins** su `client_updated_at`: una scrittura più vecchia di quella già applicata sulla stessa serie
  non sovrascrive (risposta 200 con lo stato del server). Timestamp di ore fa sono accettati.
- **`session.updated_at`** = massimo tra i `client_updated_at` applicati e le modifiche server (readiness). Alla chiusura,
  se `client_updated_at` della bozza < `updated_at` del server → 409 `draft_conflict` con `server_session` intero: la UI
  chiede "Quale tengo?". Per tenere quella del telefono: rimandare `close` con `client_updated_at` = adesso.
- **Stato alla chiusura**: 0 serie fatte → `skipped`; versione corta o < 50% delle serie → `short`; altrimenti `done`.
- **Seduta chiusa = sola lettura (v1.1.2).** Dopo `close`, ogni scrittura (`PATCH/POST/DELETE` serie, sostituisci, salta,
  ripristina, readiness, corta, "Rimettilo") risponde 409 `session_closed` e non tocca nulla: la progressione calcolata alla
  chiusura è un fatto. Eccezione voluta: rimandare un'operazione **già applicata** con lo stesso `client_op_id` resta
  idempotente (200/201/204 con lo stato del server, `duplicate` in `sync`). In `POST /sync` su una seduta chiusa nel
  frattempo (altro dispositivo) ogni op nuova è `{status:"error", code:"session_closed", detail}`, le già applicate sono
  `duplicate`, il batch resta 200 con `session` intera: la UI svuota la coda e mostra la seduta chiusa.
- **Progressione**: alla chiusura, la prossima seduta con lo stesso template riceve i nuovi target (regola
  `progression.double.reps_then_load`: tutte le serie al massimo del range con RIR ≥ target → carico +5 kg gambe/bilanciere,
  +2,5 parte alta, +2 manubri, +5 macchine, +2,5 cavi, +2 rip. a corpo libero; RIR ≤ target−2 o rip. sotto il minimo →
  −5% (`progression.reduce_when_too_hard`); altrimenti +1 ripetizione). Nel deload il carico è ×0,9.
- `first_session_logged` viene emesso alla prima chiusura non-skipped.

## 7. Progressi (design §9.8, identico)

- `GET /progress/consistency?weeks=4` → `{ done, planned, returns, days:[{date, status:"done"|"short"|"return"|"skipped"|"rest"|"future"|"none", session_id?}], caption_it, note: Note (system.consistency), window_limited_by_plan }` — free: max 8 settimane.
  - **`planned` (v1.1)** conta solo le sedute pianificate **fino a oggi incluso** ("contiamo i ritorni", non il futuro):
    le sedute con `date > oggi` hanno `status:"future"` e non entrano in `planned`. La seduta di oggi non ancora chiusa è
    `future` (in programma) ma **conta** in `planned`; chiusa, diventa `done`/`short`/`skipped`. Esempio reale: piano di
    4 settimane, 2 passate, 1 seduta fatta → `planned:8, done:1` (prima: 11).
- `GET /progress/exercises` → `[{ exercise_id, name_it, last_weight_kg, pr:{weight_kg, reps, date}|null }]`
- `GET /progress/exercises/{slug}?since=` → `{ exercise_id, name_it, points:[{date, week, best_weight_kg, reps, is_pr}], history_limited, since }` — free: `since` forzato a −8 settimane.

## 8. Chat (design §9.7)

`GET /chat/messages?before=&limit=` → `[ChatMessageOut]` in ordine cronologico:
```
{ id, role:"coach"|"user", kind:"user_turn"|"proactive"|"safety"|"paywall", at, status:"sent"|"failed", protocol|null, reply_to_id|null,
  blocks: [ {type:"paragraph", text}                                                  // apici [[n]]
          | {type:"options", options:[{id,label,description,is_pro,chosen}]}
          | {type:"plan_change", proposal_id, diff:[{exercise,field,from,to,note_n}], applied:bool|null, valid, invalid_reason_it}
          | {type:"safety", text, options:[{id,label}]}
          | {type:"paywall", surface:"chat_quota"|"maintenance_request", context_line, resets_at} ],
  notes: Note[] }
```
`protocol` ∈ `plan_comment | no_day | second_skip | return_after_break | week_skipped | block_summary | options_reply | safety.*`
(v1.1: `safety.readiness` è il blocco di sicurezza creato da `POST /sessions/{id}/readiness` con `pain:"severe"`, §6).

**`POST /chat/messages`** `{ text (≤2000), client_op_id }` → **SSE** (`text/event-stream`), eventi `data: {...}`:
`{type:"delta", text}` (parole del paragrafo) → `{type:"block", block}` (blocchi non-paragrafo) → `{type:"done", message: ChatMessageOut}`.
Prima dello stream possono arrivare, come JSON normale: 429 `chat_quota_exceeded {resets_at, used, limit}`, 502 `llm_failed`
(messaggio utente salvato con `status:"failed"`, **non conta**; rimandare con lo stesso `client_op_id` riparte), 422.
Stesso `client_op_id` di un turno riuscito → lo stesso messaggio del coach, senza consumo.
Il filtro di sicurezza (dolore acuto, sintomi cardiaci, cibo/peso, temi medici) risponde con `kind:"safety"`, testo
fisso, nessun LLM, nessuna quota. Nota: le `delta` sono emesse dal backend a parole dopo la risposta completa (v1: il
time-to-first-token è quello della chiamata intera; vedi §11).

**`POST /chat/options/{option_id}`** `{ message_id }` → `ChatMessageOut` (risposta del coach, `kind:"proactive"`,
`protocol:"options_reply"`, con `plan_change` già `applied:true` se qualcosa è cambiato). Non consuma quota. Opzioni del
giorno no: `short_tomorrow`, `move`, `rest`, `renegotiate` (Pro fuori dal blocco 1 → 403 `plan_required`), `full`; del
blocco sicurezza: `pause_plan` (sposta tutto di 7 giorni), `remove_exercise`, `continue_anyway`, `acknowledge`. Errori:
404 (messaggio/opzione), 409 `option_already_chosen`. Emette `no_day_option_chosen`.

Chi scrive la risposta (v1.1.1): quando il motore ha **ricalcolato** (`short_tomorrow`, `move`, `renegotiate`) il testo lo
genera l'LLM nel protocollo `options_reply` e il `plan_change` porta il diff. Quando l'opzione è un **fatto** senza
ricalcolo o di sicurezza, il testo è fisso, deterministico e senza LLM (come il filtro di sicurezza):
- `pause_plan` → "Piano in pausa per 7 giorni: tutte le sedute slittano di una settimana. Riparte {giorno d mese} con
  {seduta}. Se per quella data il dolore c'è ancora, la pausa si allunga: basta dirmelo." + `plan_change` con
  `{field:"pausa", from: oggi, to: oggi+7}`.
- `remove_exercise` → **non toglie niente** (il messaggio di sicurezza non sa quale esercizio fa male): "Per toglierlo mi
  serve sapere quale: scrivimi qui l'esercizio che fa male e lo sostituisco dalla prossima seduta. In seduta trovi anche
  Sostituisci e Salta su ogni esercizio." Nessun `plan_change`, la seduta non cambia (`updated_at` invariato).
- `full` / `rest` / `acknowledge` → "Intera, allora. / Riposo, allora. / Ricevuto. La prossima seduta è {giorno d mese}:
  {nome}, com'è nel piano." Nessun `plan_change`.
- `continue_anyway` → "Va bene. In seduta, se un esercizio fa male, su ognuno trovi Sostituisci e Salta: il piano non ne
  risente."

- `GET /chat/quota` → `{ used, limit, resets_at, daily_used, daily_limit, exhausted }` (la UI la rilegge dopo ogni `done`).
- `GET /chat/texts` (**pubblica**, senza Bearer) → `{ ai_badge_text, ai_badge_note: Note (system.about), paywall_context_line: {end_of_block, chat_quota, maintenance_request}, support_email }` — `support_email` (v1.1) è la stessa di `GET /me`: il footer pubblico e `/prezzi` la leggono da qui, non da una env del client.

Quota: 15 turni utente/mese free; Pro 300/mese e 40/giorno; contano solo `role:"user", kind:"user_turn", status:"sent"`.
Il coach, quando chiede di cambiare il piano in mantenimento, risponde nel suo tono e aggiunge un blocco `paywall`
(`surface:"maintenance_request"`); il backend emette `paywall_shown`.

## 9. Billing (design §9.11)

| Metodo | Rotta | Entra | Esce | Errori |
|---|---|---|---|---|
| POST | `/billing/checkout` | `{ price:"month"|"year"|"year_founders", from_surface:"end_of_block"|"chat_quota"|"maintenance_request"|"pricing"|"account" }` | `{ url }` (Checkout hosted, IVA inclusa, Stripe Tax, senza trial); emette `checkout_started` | 409 `founders_sold_out`; 503 `billing_unavailable` |
| POST | `/billing/portal` | `{ intent?: "cancel"|"update_payment"|"switch_plan" }` | `{ url }` | 409 `no_subscription`; 503 `billing_unavailable` |
| POST | `/billing/withdraw` | — | `{ withdrawn_at, refund_amount (es. 9.99), refund_currency }`; cancella subito, rimborso integrale, email di conferma, `entitlement → free` | 403 `withdrawal_window_closed`; 409 `no_subscription`, `already_withdrawn`; 503 `billing_unavailable` |
| GET | `/billing/founders` | — | `{ remaining, price_eur }` (`price_eur` = annuale fondatori da env, es. 49.99; senza Stripe: `remaining` = massimo, la pagina prezzi resta viva) | |
| GET | `/billing/prices` | — | `PricesOut` (v1.1.3, pubblica): `{ currency:"EUR", vat_included:true, prices:[PriceOut ×3], founders:{ available, remaining } }`. Sempre nell'ordine `month, year, year_founders`. Vive anche senza Stripe. | |
| POST | `/billing/webhook` | corpo Stripe + `Stripe-Signature` | `{ received, duplicate }` | 400 `invalid_signature`; 503 `billing_unavailable` |

**Listino (v1.1.3).** `GET /billing/prices` è la sola fonte dei numeri della pagina prezzi: il frontend non tiene 9,99 / 59,99 /
49,99 come costanti. Ogni `PriceOut` è:

```
{ key:"month"|"year"|"year_founders",   // lo stesso `price` da mandare a POST /billing/checkout
  interval:"month"|"year",
  amount_cents: 999,                    // IVA inclusa, intero
  amount_eur: 9.99,                     // IVA inclusa, unità
  per_month_eur: 9.99,                  // annuale/12 arrotondato a 2 decimali (59.99 → 5.0, 49.99 → 4.17), per il confronto
  label_it: "Mensile"|"Annuale"|"Annuale fondatori",
  available: true }                     // false solo per year_founders quando i posti sono finiti
```

`founders.available == false` ⇔ `founders.remaining == 0` ⇔ `prices[2].available == false`; in quel caso la card fondatori si
mostra esaurita (o si nasconde) e `POST /billing/checkout` con `year_founders` risponde 409 `founders_sold_out`.
`founders.remaining` e `price_eur` di `/billing/founders` coincidono con `/billing/prices` (stessa fonte: env
`PRO_PRICE_*_CENTS`, `STRIPE_FOUNDERS_MAX`, contatore del promo code). Cache consigliata lato client: 60 s, come `/founders`.

Esempio reale (Stripe disabilitato):

```json
{"currency":"EUR","vat_included":true,
 "prices":[{"key":"month","interval":"month","amount_cents":999,"amount_eur":9.99,"per_month_eur":9.99,"label_it":"Mensile","available":true},
           {"key":"year","interval":"year","amount_cents":5999,"amount_eur":59.99,"per_month_eur":5.0,"label_it":"Annuale","available":true},
           {"key":"year_founders","interval":"year","amount_cents":4999,"amount_eur":49.99,"per_month_eur":4.17,"label_it":"Annuale fondatori","available":true}],
 "founders":{"available":true,"remaining":100}}
```

**Senza chiavi Stripe (v1.1.2).** Con `STRIPE_SECRET_KEY` vuota il gateway è "disabilitato": checkout, portale, recesso e
webhook rispondono 503 `billing_unavailable` con `detail` "I pagamenti non sono ancora attivi. Se ti serve Pro adesso
scrivimi a {support_email}." — un errore normale, con CORS, non un 500. I 409 (`no_subscription`, ecc.) vengono **prima**:
un utente senza abbonamento vede `no_subscription` anche senza Stripe.

Webhook gestiti, idempotenti per `event.id`: `checkout.session.completed`, `customer.subscription.created|updated|deleted`,
`invoice.paid`, `invoice.payment_failed` (→ `grace_until = +7 giorni`, poi il `deleted` porta a free/mantenimento).
Ritorno da Checkout: la UI fa polling di `GET /me` finché `entitlement.plan == "pro"` (max 60 s).

## 10. Account, eventi, conoscenza

- `POST /me/export` → `202 { download_url: "/me/export/<token>", expires_at }`; `GET /me/export/<token>` (Bearer dello stesso utente) → il JSON completo; 404 se scaduto o altrui.
- `POST /events` `{ name:"install_prompt_shown"|"installed"|"paywall_shown"|"checkout_started", props }` → `201`. `installed` imposta `pwa.installed_reported`. `GET /events/mine` → i propri eventi.
- `GET /knowledge/rules` → `[Note]` (tutte le 43 regole); `GET /knowledge/rules/{rule_id}`; `GET /knowledge/exercises` → `[{ exercise_id, name_it, name_en, pattern, primary_muscle, secondary_muscles, equipment, mechanic, instructions_it, media }]` (per Crediti e schede).

---

## 11. Deviazioni dal design-system §9, con il motivo

| Dove | Chiesto | Fatto | Perché |
|---|---|---|---|
| §9.4 `changed_sets[].set_id` | id della serie | `set_id: null` + `exercise_id` | le modifiche della readiness (serie, riposo, RIR) valgono per tutte le serie dell'esercizio, non per una riga |
| §9.5 `media.gif_url` | GIF dell'esecuzione | sempre `null`, `poster_url` `null`, `instructions_it` (passi in italiano) | le GIF Gymvisual hanno licenza separata; ExerciseDB ($199) è una decisione d'acquisto del business (§8): quando c'è, si popola `gif_url` senza cambiare il contratto |
| §9.5 `exercises[].notes` | note per esercizio | sottoinsieme delle note della seduta, **stessi numeri** | i numeri sono locali alla seduta (un solo apparato), non all'esercizio |
| §9.3 `session_preview` | 5 campi | + `status` | serve a `/oggi` per mostrare "fatta" senza una seconda chiamata |
| §9.7 `POST /chat/messages` | stream token per token | SSE con `delta` a parole dopo la risposta completa | il tool loop (proposte, RAG) va eseguito prima del testo finale; lo streaming vero del provider è un debito (§12), il contratto SSE non cambia |
| §9.7 turno fallito | "non conta" | 502 `llm_failed` come JSON prima dello stream | il fallimento avviene nel tool loop, prima che lo stream parta: la UI riceve un errore normale |
| §9.9 summary | 6 campi | + `paywall_context_line` | è il testo di `/prezzi?da=end_of_block` (§3.5): meglio che la UI non lo componga |
| §9.10 `POST /onboarding` | `{mesocycle, first_session_id, coach_comment_message_id}` | + `safety_notice_it`; 409 `safety_ack_required` prima del `safety_acknowledged` | il gate deve poter mostrare "Prima di iniziare, senti un medico" e poi continuare senza vicolo cieco |
| §9.11 `POST /me/export` | `{download_url, expires_at}` o 202 | entrambi: 202 con url relativo, che richiede il Bearer | un url anonimo con dati sanitari è un rischio inutile |
| §9.6 `POST /plans/proposals` | `{ patch }` libero | `patch` tipizzato (`adjust_sets` / `substitute` / `move_session`) | il motore valida solo ciò che sa validare; è lo stesso schema del tool `propose_plan_change` del coach |
| business §6 "mantenimento ripete l'ultima settimana" | ultima settimana del blocco | ultima settimana **di allenamento** (la 3ª; il deload non si ripete) | ripetere il deload per sempre non è mantenimento |
| business §10 `POST /plans/mesocycles` index≥2 → 403 | solo 403 | 403 `plan_required` in free; 409 `block_not_completed` se il blocco è ancora in corso | onestà: un Pro che chiede il blocco 2 a settimana 2 non è un problema di piano |

## 12. Cosa il frontend deve sapere

1. **Bozza offline.** `GET /sessions/{id}` con `ETag`; ogni cambio scrive la bozza locale e poi tenta `PATCH` con
   `client_op_id` univoco; al ritorno della rete `POST /sync` con la coda (ordine di creazione). `close` con la bozza intera
   e `client_updated_at` = ultimo cambio locale; su 409 `draft_conflict` mostrare "Quale tengo?".
2. **Idempotenza ovunque**: rimandare la stessa operazione con lo stesso `client_op_id` è sempre sicuro (200/201/204 o `duplicate`).
3. **Quota**: rileggere `GET /chat/quota` dopo ogni `done`; a `exhausted` sostituire il composer con la card Pro
   (`paywall_context_line.chat_quota`, `resets_at`). I messaggi proattivi e le opzioni non consumano.
4. **Paywall**: il backend dice dove sta il muro con `engine_active`, `mesocycle.status`, 403 `plan_required`, i blocchi
   `paywall` e `is_pro` sulle opzioni; la UI garantisce per rotta che non compaia mai in `/oggi/*` e `/onboarding/*`.
5. **Testi con note**: renderizzare `[[n]]` come apici; le note sono nella stessa risposta; mai una seconda chiamata.
6. **Mantenimento**: `GET /plans/current` genera le settimane che si ripetono man mano; `editable:false`; la readiness
   continua a funzionare (corta/riposo sono deterministici).
7. **Sicurezza**: un messaggio `kind:"safety"` ha il filetto rosso e le opzioni; `POST /chat/options/pause_plan` mette in
   pausa (sposta di 7 giorni, seduta di oggi compresa). Dalla readiness `severe` (v1.1) i pulsanti "Metti in pausa il
   piano" / "Vai comunque alla seduta" chiamano `POST /chat/options/{id}` con `safety.message_id`.
8. **Opzioni di `/today`** (v1.1): `action.type:"chat_option"` → `POST /chat/options/{action.target} { message_id: action.message_id }`;
   `action.type:"route"` → naviga a `action.target`. Non ricavare più l'id da `redirect`.
9. **Versione corta dall'anteprima** (v1.1): "Versione corta (25′)" → `POST /sessions/{id}/short` → poi `/oggi/seduta`
   (o la readiness, se l'utente la vuole comunque). Mostrare il terziario solo se `short_available`.
10. **`support_email`** (v1.1): nelle pagine pubbliche da `GET /chat/texts`; nell'app anche da `GET /me` (stesso valore).

## 13. Dati di prova e avvio

- Avvio: vedi `backend/README.md` (`alembic upgrade head`, `python -m scripts.seed` con `CROSSREF_MAILTO`, `uvicorn app.main:app`).
- Con `LLM_PROVIDER=fake` (default senza chiave) il coach è deterministico: "perché…/quanto…/riposo/RIR" → cerca nel corpus e
  cita; "togli/aggiungi/sostituisci/cambia…" → propone una modifica; "storico/ultima volta" → legge lo storico; "dolore
  forte al petto" → blocco sicurezza. I protocolli (commento al piano, giorno no) usano i template in `app/llm/fake.py`.
- Non ci sono utenti precaricati: `POST /auth/register` + `POST /onboarding` creano tutto in due chiamate (esempio di body in §3).
- Per vedere fine blocco / mantenimento / blocco 2 senza aspettare 4 settimane: spostare indietro `mesocycles.started_on`,
  `plan_weeks.starts_on` e `planned_sessions.date` di 35 giorni (è quello che fanno i test in `tests/test_onboarding_plan.py`).
- Pro senza Stripe: `UPDATE entitlements SET plan='pro', source='manual'` per l'utente.

## 14. Debiti dichiarati (non nascosti)

- Streaming: `delta` a parole dopo la risposta completa (vedi §11); i provider hanno già `stream()`, va cablato nel
  tool loop.
- Media esercizi: nessuna GIF finché il business non compra ExerciseDB; `instructions_it` c'è per tutti i 76.
- `move`/`renegotiate` ridatano le sedute in modo semplice (giorno successivo libero / una al giorno da domani); non
  ottimizzano il recupero tra sedute.
- `pause_plan` sposta tutto di 7 giorni (non esiste uno stato "paused" nel contratto: si è scelto di non aggiungerlo).
- `remove_exercise` dal blocco di sicurezza non toglie niente: il messaggio non porta l'elenco degli esercizi della
  prossima seduta (opzioni dinamiche `remove:<planned_exercise_id>` esistono nel servizio ma nessun messaggio le
  emette). Costo per chiuderlo: il blocco `safety` della readiness deve elencare gli esercizi della seduta come opzioni
  `remove:<id>` — è un cambio di forma del blocco, quindi un evento di contratto, non una v1.1.x.
- Plank e core sono prescritti a ripetizioni (8-12), non a tempo.
- Provider LLM reali (Anthropic, OpenAI UE) scritti e importabili, **non eseguiti**: nessuna chiave in questa sessione.
- Stripe reale non eseguito (nessuna chiave): la gateway è testata con un doppio; `create_portal` con `intent` non usa i
  "flow" del portale (serve l'id abbonamento: si apre il portale generico).
- Rate limiting in memoria: 1 worker / 1 replica.

## 15. Changelog — contratto v1.1 — 2026-09-17

Chiude i cinque buchi trovati dal `frontend-engineer` costruendo contro la v1.0. Tutto additivo: nessun campo tolto o
rinominato, nessuno status code cambiato su rotte esistenti. Test: `backend/tests/test_contract_v11.py` (8 test),
suite intera 118 verdi.

| # | Buco | Cosa cambia | Dove |
|---|---|---|---|
| 1 | Le opzioni di `readiness.safety` non erano eseguibili | `POST /sessions/{id}/readiness` con `pain:"severe"` crea in chat un messaggio `kind:"safety"`, `protocol:"safety.readiness"` e risponde con `safety.message_id` (campo nuovo, obbligatorio quando `safety` non è `null`). Le opzioni si eseguono con `POST /chat/options/{id} { message_id }`. Evento nuovo `safety_triggered`. | §6, §8, §12.7 |
| 2 | `/today` `action` di tipo `chat_option` senza `message_id` | `action: { type, target, message_id }` — `message_id` valorizzato per `chat_option`, `null` per `route`. `redirect` resta. | §4, §12.8 |
| 3 | Nessuna rotta per la versione corta dall'anteprima | **Rotta nuova** `POST /sessions/{id}/short` → `ReadinessOut` (stessa forma della readiness, `safety:null`); 409 `already_short` · `session_closed`; 404. `session_preview.short_available` ora è `false` anche quando la seduta è già corta. | §4, §6, §12.9 |
| 4 | `support_email` solo in `GET /me` | `GET /chat/texts` (pubblica) porta `support_email`. | §8, §12.10 |
| 5 | `consistency.planned` contava le sedute future | `planned` conta solo le sedute pianificate fino a oggi incluso; le future hanno `status:"future"`. Bug corretto, non un cambio di forma. | §7 |

Codici errore nuovi: 409 `already_short`. Schemi toccati in `/openapi.json`: `SafetyOut` (+`message_id`),
`TodayOptionAction` (+`message_id`), `ChatTextsOut` (+`support_email`), `SessionPreviewOut` (descrizione di
`short_available`). Operazioni: 53 → 54.

## 16. Changelog — contratto v1.1.1 — 2026-09-17

Tre difetti trovati dal `frontend-engineer` in browser sulla v1.1. **Nessuna forma cambia**: nessun campo nuovo o tolto,
nessuno status code diverso, `/openapi.json` identico nelle 54 operazioni e nei 112 schemi. Il frontend v1.1 non deve
cambiare nulla, con una raccomandazione (§0 Date). Test: `backend/tests/test_contract_v111.py` (8) +
`backend/tests/test_clock.py` (4); suite intera 130 verdi.

| # | Difetto | Cosa cambia | Dove |
|---|---|---|---|
| 1 | `/today` in `return_after_break` (e `week_skipped`) offriva `full`, ma il messaggio del coach portava `short_tomorrow, move, renegotiate`: `POST /chat/options/full` → 404 | Il messaggio dei protocolli `return_after_break` e `week_skipped` porta esattamente `short_tomorrow` ("Corta") e `full` ("Intera"), come la schermata (design §2.10). Invariante testato: le `chat_option` di `/today` ⊆ `options` del messaggio, per tutti gli stati vuoti con `redirect`. `no_day`/`second_skip` restano `short_tomorrow, move|rest, renegotiate`. | §4, §8 |
| 2 | `pause_plan` e `remove_exercise` rispondevano entrambi "Fatto. Ho sistemato la settimana…" | Risposte fisse e vere, senza LLM: `pause_plan` dice la data e la seduta con cui il piano riparte; `remove_exercise` non afferma di aver tolto nulla e indica la via (in chat, o Sostituisci/Salta in seduta); `full`/`rest`/`acknowledge` nominano la prossima seduta. Solo le opzioni che ricalcolano (`short_tomorrow`, `move`, `renegotiate`) passano dall'LLM. | §8, §14 |
| 3 | "Oggi" era la data UTC: dopo mezzanotte a Roma `/today`, la costanza, la readiness e il job email vivevano ancora in ieri | Un'unica `today_local()` (`app/clock.py`, fuso da `TIMEZONE`, default `Europe/Rome`) usata da `/today`, `/plans/*`, `/mesocycles/{n}/summary`, costanza e storico, proposte, state card della chat, opzioni del giorno no, `/me`, onboarding (inizio piano) e job email. La quota già ragionava in Europe/Rome: ora legge lo stesso valore. Env: `TIMEZONE` (nuovo nome; `QUOTA_TIMEZONE` resta accettato). | §0 Date, `.env.example` |

## 17. Changelog — contratto v1.1.2 — 2026-09-17

Correzioni dal rapporto QA (`docs/qa-report.md`), difetti assegnati al backend: B1, B2, G1, G5, M11, M12. **Nessuna forma
cambia**: nessun campo nuovo o tolto, `/openapi.json` resta a 54 operazioni su 51 percorsi e 112 schemi; entrano un codice
503 nuovo, tre header di risposta e `Retry-After`. Il frontend v1.1 continua a funzionare; le note per il frontend sono
nella colonna "Cosa deve sapere". Test: `backend/tests/test_qa_fixes.py` (18); suite intera 148 verdi.

| # | QA | Difetto | Cosa cambia | Cosa deve sapere il frontend |
|---|---|---|---|---|
| 1 | B1 | Chat con `!`, `:`, `&`, `<`, `(` → 500 e quota addebitata: il fallback della ricerca nel corpus usava `to_tsquery` con le parole grezze; la transazione abortita impediva anche di marcare il messaggio `failed` | Il fallback usa `websearch_to_tsquery` su sole lettere (≥4, max 6); qualunque eccezione nel tool loop chiude la transazione rotta e scrive `failed` in una nuova: 502 `llm_failed`, quota intatta (§8). | Niente: 200 come sempre. Su 502 `llm_failed` il messaggio utente è nel thread con `status:"failed"`: rimandarlo con lo stesso `client_op_id` riparte. |
| 2 | B2 | Ogni 500 usciva senza CORS né `X-Request-Id` (l'handler girava fuori dal `CORSMiddleware`) e il client lo leggeva come "Senza rete" | Un middleware interno cattura le eccezioni sotto CORS e log: il 500 è `{code:"internal_error", detail}` con `Access-Control-Allow-Origin` e `X-Request-Id`. | Un 500 è un errore del server, non offline: mostrare `detail` e il `request_id`, non entrare in modalità offline. |
| 3 | G1 | Seduta chiusa accettava `PATCH`/`POST sets`/`sync` | 409 `session_closed` su ogni scrittura; in `sync` ogni op nuova è `error/session_closed`, batch 200. Dettagli in §6. | Su `s.status !== "planned"` schermata di sola lettura (QA G2); su `sync` con `session_closed` svuotare la coda e mostrare `session`. |
| 4 | G5 | Dopo "Corta"/"Intera" `/today` riproponeva `return_after_break` e il secondo tap era 409 `option_already_chosen` | Con un'opzione `chosen`, `return_after_break`, `week_skipped` e `session_skipped` non tornano: `/today` passa a `session`/`rest_day`/`maintenance`. Dettagli in §4. | Niente di obbligatorio; disabilitare comunque le opzioni con `chosen` nel messaggio in chat. |
| 5 | M11 | 429 senza `Retry-After`; nessun header di sicurezza | `Retry-After` (secondi) su ogni 429 `rate_limited`; `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` su ogni risposta. | Opzionale: rispettare `Retry-After` prima di riprovare. |
| 6 | M12 | Senza chiavi Stripe `/billing/*` faceva 500 (`APIConnectionError`) | Gateway disabilitato: 503 `billing_unavailable` con `detail` onesto; `/billing/founders` resta 200. Dettagli in §9. Log di avvio `stripe_disabled`. | Trattare 503 `billing_unavailable` come errore normale con `detail` ("il pagamento non si è aperto" resta valido). |

## 18. Changelog — contratto v1.1.3 — 2026-09-17

Due buchi segnalati dal `frontend-engineer`. **Additiva**: nessuna forma esistente cambia; `/openapi.json` passa a 55
operazioni su 52 percorsi e 115 schemi (`PricesOut`, `PriceOut`, `FoundersStatusOut`). Test: `backend/tests/test_contract_v113.py`
(7); suite intera 155 verdi.

| # | Buco | Cosa cambia | Cosa deve sapere il frontend |
|---|---|---|---|
| 1 | `Retry-After` c'era sul 429 ma il browser non lo leggeva: `Access-Control-Expose-Headers` conteneva solo `X-Request-Id, ETag` | `expose_headers` = `X-Request-Id, ETag, Retry-After` su ogni risposta con `Origin` in allowlist (§0). | `response.headers.get("Retry-After")` ora è leggibile: usarlo per l'attesa prima del retry. |
| 2 | I prezzi Pro vivevano come costanti nel frontend (9,99 / 59,99 / 49,99); l'API esponeva solo `founders.price_eur` | Nuova rotta pubblica `GET /billing/prices` (§9): le tre opzioni da env (`PRO_PRICE_MONTH_CENTS`, `PRO_PRICE_YEAR_CENTS`, `PRO_PRICE_YEAR_FOUNDERS_CENTS`, IVA inclusa), `per_month_eur` già calcolato, `available` per fondatori, `founders:{available, remaining}`. Vive anche senza Stripe. `price_eur` di `/billing/founders` e il fallback dell'importo di rimborso del recesso leggono la stessa env. | Sostituire le costanti con `GET /billing/prices`; `key` è il valore da mandare a `POST /billing/checkout`. Tre stati come ogni fetch: in errore la pagina prezzi mostra il messaggio, non numeri inventati. |
