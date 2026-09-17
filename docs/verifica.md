# fitcoach — Verifica (fase 4)

Data di verifica: **2026-09-16** · Autore: ricercatore · Input: `brief.md` sezione 9 (domande 1–30), sezioni 6–7, appendice.

Ogni risposta ha un verdetto (`VERIFICATO` / `SMENTITO` / `NON VERIFICABILE`), la risposta secca, la citazione dalla fonte e l'URL o il comando. Tutto ciò che non ho letto o eseguito oggi è marcato come tale. I prezzi sono in USD salvo indicazione.

---

## 0. Riepilogo

**30 domande: 19 verificate, 6 smentite (in tutto o in parte), 5 non verificabili (in tutto o in parte).**

Le smentite che toccano il brief, in ordine di peso:

| # | Cosa dava per buono il brief | Cosa è vero invece |
|---|---|---|
| **14** | PAR-Q+ utilizzabile in app, "da verificare licenza" | **Non utilizzabile senza permesso scritto**: "may not be sold or incorporated into a product to be sold, without the expressed written approval/consent of the PAR-Q+ Collaboration"; "may not under any circumstances, be changed in any way". Non esiste traduzione italiana ufficiale. |
| **10** | Linee guida OMS 2020 "a licenza aperta e citabili integralmente" | Licenza **CC BY-NC-SA 3.0 IGO**: NonCommercial. In un'app a pagamento si può citare/riassumere (brevi estratti), non riprodurre integralmente. ACSM e NSCA: nessuna licenza aperta (copyright dell'editore). |
| **2** | "Endpoint UE" per ciascun provider | **Anthropic first-party non ha un endpoint UE**: `inference_geo` accetta solo `"us"` e `"global"`; workspace geo solo `"us"`. UE solo via Vertex AI / Bedrock (regione EU). **Gemini API: nessuna residenza UE** e il free tier è vietato per utenti SEE. OpenAI: sì, `eu.api.openai.com` con +10 %. |
| **17** | ExerciseDB = API RapidAPI a canone | Il sito ufficiale vende ora un **dataset one-time self-hosted** ($199 Starter / $599 Pro, licenza commerciale, GIF ospitabili). Lo stato del listing RapidAPI non è verificabile senza login. |
| **1 / 7** | Costo LLM per messaggio / OpenAlex "gratis con polite pool" | Costo LLM: **dentro le attese** (vedi §1, stima). OpenAlex: ora **a budget** ($1/giorno con API key gratuita, $0,10/giorno senza); il lookup per singolo DOI resta gratuito/quasi (vedi #7). |
| **7 (parziale)** | pgvector: nessun vincolo sul modello di embedding | Gli indici HNSW/IVFFlat accettano **≤ 2.000 dimensioni** su `vector` (≤ 4.000 su `halfvec`): embedding a 3.072 dimensioni (OpenAI large, Gemini) vanno ridotti (`dimensions`/`output_dimensionality`) o messi in `halfvec`. |

**La domanda 19 (professione riservata) non smentisce il brief**: il testo dell'art. 41 D.Lgs. 36/2021 istituisce le figure di chinesiologo con laurea ma **non contiene una clausola di riserva né una sanzione**, e una Regione (Emilia-Romagna, risposta del 27-03-2026) ammette personal trainer con qualifica federale senza laurea. Nessuna norma primaria disciplina schede generate da software. Resta un parere legale da prendere, non un blocco.

**La domanda 26 (PWA iOS) non smentisce il brief**: la IndexedDB di una web app aggiunta alla Home non è soggetta al tetto dei 7 giorni di Safari ("have their own counter of days of use"), e Web Push esiste dalla 16.4 solo da Home Screen. Il timer in background resta non verificabile da doc Apple: va progettato su timestamp, non su `setInterval`.

---

## 1. LLM ed embedding

### 1. Modelli small/fast: prezzi, caching, tool use, output strutturato, contesto, rate limit — `VERIFICATO`

Prezzi per 1M token, dalle pagine ufficiali (2026-09-16):

| Provider / modello | Input | Output | Cache read | Cache write | Contesto | Batch |
|---|---|---|---|---|---|---|
| **Anthropic Claude Haiku 4.5** (`claude-haiku-4-5`) | $1 | $5 | $0,10 (0,1×) | $1,25 (5 min) / $2 (1 h) | 200K, out 64K | −50 % |
| **Anthropic Claude Sonnet 5** (`claude-sonnet-5`) | $2 | $10 | $0,20 | $2,50 / $4 | 1M, out 128K | −50 % |
| Anthropic Claude Opus 5 (per riferimento) | $5 | $25 | $0,50 | $6,25 / $10 | 1M, out 128K | −50 % |
| **OpenAI gpt-5.4-mini** | $0,75 | $4,50 | $0,075 | automatico | 400K, out 128K | −50 % |
| **OpenAI gpt-5.4-nano** | $0,20 | $1,25 | $0,02 | automatico | n.v. | −50 % |
| OpenAI gpt-5-mini / gpt-5-nano (gen. precedente) | $0,25 / $0,05 | $2 / $0,40 | $0,025 / $0,005 | automatico | — | −50 % |
| **Google Gemini 3.8 Flash** | $0,75 (→ $1,50 dal 2027-01-01) | $3,75 (→ $7,50) | $0,075 + storage $0,50/M/h | implicito ≥ 4.096 tok | 1M | $0,375 / $1,875 |
| **Google Gemini 3.5 Flash-Lite** | $0,30 | $2,50 | storage $1/M/h | implicito ≥ 4.096 tok | n.v. | $0,15 / $1,25 |
| Google Gemini 2.5 Flash-Lite (gen. precedente) | $0,10 | $0,40 | — | implicito ≥ 2.048 tok | — | $0,05 / $0,20 |

Fonti e citazioni:
- Anthropic pricing: "Claude Haiku 4.5 | $1 / MTok | $1.25 / MTok | $2 / MTok | $0.10 / MTok | $5 / MTok"; "Claude Sonnet 5 | $2 / MTok | $2.50 / MTok | $4 / MTok | $0.20 / MTok | $10 / MTok"; "The $2/$10 per million input/output token pricing for Claude Sonnet 5 [...] is now the standard price." — https://platform.claude.com/docs/en/about-claude/pricing
- Anthropic caching: "5-minute cache write | 1.25x base input price"; "1-hour cache write | 2x"; "Cache read (hit) | 0.1x". Lunghezza minima cacheabile: "512 tokens for [...] Claude Opus 5"; "1,024 tokens for [...] Claude Sonnet 5"; "**4,096 tokens for Claude Haiku 4.5**". — https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Anthropic contesto: "Context window | 1M tokens | 1M tokens | 1M tokens | 200K tokens"; "Max output | 128K | 128K | 128K | 64K". Tool use su tutti ("All current models support [...] tool use"). Output strutturato: `output_config.format` e `strict: true` sui tool (skill `claude-api`, verificato sulla doc streaming/tool use). — https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic rate limit tier d'ingresso ("Start tier"): "Claude Sonnet 5 | 1,000 | 2,000,000 | 400,000"; "Claude Haiku 4.5 | 1,000 | 2,000,000 | 400,000" (RPM / ITPM / OTPM). Tetto di spesa mensile: "Start | $500 USD"; "Build | $1,000"; "Scale | $200,000". Nota: "New organizations [...] may start in the Evaluation tier, with limits below the standard limits". I token letti da cache **non** contano nell'ITPM. — https://platform.claude.com/docs/en/api/rate-limits
- OpenAI pricing (righe verbatim): "gpt-5.4-mini | $0.75 | $0.075 | $4.50"; "gpt-5.4-nano | $0.20 | $0.02 | $1.25"; "gpt-5-mini | $0.25 | $0.025 | $2.00"; "gpt-5-nano | $0.05 | $0.005 | $0.40". — https://developers.openai.com/api/docs/pricing
- OpenAI gpt-5.4-mini: "400,000 context window", "128,000 max output tokens", "function_calling, structured_outputs, streaming"; Tier 1: "500 RPM" e "500,000 TPM". — https://developers.openai.com/api/docs/models/gpt-5.4-mini
- OpenAI tier: "Tier 1 | $5 paid | $100 / month"; "Tier 2 | $50 paid | $500 / month". Caching: "Prompt caching is enabled by default"; "discounted up to 90%"; minimo "1,024 tokens". — https://developers.openai.com/api/docs/guides/rate-limits · https://developers.openai.com/api/docs/guides/prompt-caching
- OpenAI structured outputs/function calling: "Setting `strict` to `true` will ensure function calls reliably adhere to the function schema". — https://developers.openai.com/api/docs/guides/function-calling
- Google pricing: Gemini 3.8 Flash "Input: $0.75 through December 31, 2026. $1.50 starting January 1, 2027"; "Output: $3.75 through December 31, 2026. $7.50 starting January 1, 2027"; Gemini 3.5 Flash-Lite "Input: $0.30", "Output: $2.50". — https://ai.google.dev/gemini-api/docs/pricing
- Google caching: "Implicit caching is enabled by default for all Gemini 2.5 and newer models"; minimo "Gemini 3.8/3.7/3.6/3.5 Flash: 4,096 tokens". — https://ai.google.dev/gemini-api/docs/caching
- Google rate limit: la pagina **non pubblica più numeri per modello** ("Rate limits depend on a variety of factors [...] and can be viewed in Google AI Studio"); Tier 1 = billing attivo, cap "$250"; Tier 2 = "$100 + 3 days". Contesto Gemini 3.8 Flash: 1M. — https://ai.google.dev/gemini-api/docs/rate-limits · https://ai.google.dev/gemini-api/docs/models

**Stima di costo per utente free (etichettata `stima`, ipotesi dichiarate).** Turno tipo: system prompt 2.000 tok + tool 800 + state card 600 + storico 2.000 + chunk RAG 1.500 ≈ 6.900 tok input, 300 tok output.

| Modello | Costo/turno senza cache | Con cache su system+tool (2.800 tok) | 30 turni/mese | 100 turni/mese |
|---|---|---|---|---|
| Claude Haiku 4.5 | $0,0084 | **non cacheabile** (< 4.096 tok) | $0,25 | $0,84 |
| Claude Sonnet 5 | $0,0168 | $0,0118 | $0,35–0,50 | $1,2–1,7 |
| gpt-5.4-mini | $0,0065 | $0,0046 | $0,14–0,20 | $0,46–0,65 |
| Gemini 3.5 Flash-Lite | $0,0028 | — | $0,08 | $0,28 |

Verdetto sull'appendice: **il costo LLM è dentro le attese del brief** (soglia: 20–30 % di un Pro a 5–7 €/mese ≈ €1–2). Anche 100 messaggi/mese su Sonnet 5 stanno sotto €2. Il "giorno no" deterministico con una sola chiamata per turno resta una buona pratica, non una necessità.

### 2. Regione UE, DPA, training sui dati — `SMENTITO` (in parte)

| Provider | Endpoint/regione UE | Training per default | DPA |
|---|---|---|---|
| **Anthropic (first-party)** | **No.** "Inference geo: Only `"us"` and `"global"` are available"; "Workspace geo: Only `"us"` is currently available". UE possibile solo via Vertex AI (multi-region `eu`, +10 %) o Bedrock (regione EU). | **No**: "By default, we will not use your inputs or outputs from our commercial products (e.g. [...] Anthropic API [...]) to train our models." Termini: "Anthropic may not train models on Customer Content from Services." Retention: "we automatically delete inputs and outputs on our backend within 30 days". | Sì, incorporato nei Commercial Terms; SCC Modulo 2 e UK Addendum: "the terms of the SCCs Module Two (controller to processor) [...] are hereby incorporated by reference." |
| **OpenAI** | **Sì**: "Europe (EEA + Switzerland)" con `eu.api.openai.com`; "Data residency endpoints are charged a 10% uplift for models released on or after March 5, 2026". | **No**: "data sent to the OpenAI API is not used to train or improve OpenAI models (unless you explicitly opt in)". Log abusi 30 giorni; ZDR disponibile. | DPA non citato nella pagina "your data" (esiste nei termini, non verificato oggi). |
| **Google Gemini API** | **No** residenza UE: dati "may be stored transiently or cached in any country in which Google or its agents maintain facilities". **Free tier vietato per utenti SEE**: "You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom." (UE via Vertex AI.) | Paid: "Google doesn't use your prompts [...] or responses to improve our products"; Free: "Google uses the content you submit [...] to provide, improve, and develop Google products". | Paid: "Data Processing Addendum for Products Where Google is a Data Processor". |

Fonti: https://platform.claude.com/docs/en/manage-claude/data-residency · https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training · https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data · https://www.anthropic.com/legal/commercial-terms · https://www.anthropic.com/legal/data-processing-addendum · https://developers.openai.com/api/docs/guides/your-data · https://ai.google.dev/gemini-api/terms

Impatto: il requisito del brief "endpoint UE o DPA adeguato" è soddisfatto da tutti e tre **via DPA + SCC**, ma solo OpenAI ha un endpoint UE first-party. Se il product-strategist o il legale vuole inferenza in UE con Claude, la strada è Vertex AI (client `AnthropicVertex`, region `eu`), con prezzo partner e +10 %.

### 3. Qualità in italiano e benchmark pubblico — `NON VERIFICABILE`

Esistono benchmark italiani pubblici: **ITALIC** (10.000 domande a scelta multipla), **Evalita-LLM** (10 task nativi), **CALAMITA** (AILC, rolling), **ita-bench** (SapienzaNLP), **Open Ita LLM Leaderboard** (HF `mii-llm`). Tutti valutano prevalentemente modelli open-weight; nessuno pubblica un confronto Haiku 4.5 / Sonnet 5 / gpt-5.4-mini / Gemini 3.x Flash sull'italiano. Le pagine ufficiali dei provider dichiarano solo "multilingual capabilities" (Anthropic overview).

Per chiudere: un eval nostro di 50 prompt in italiano (tono coach, MI, termini tecnici) sui 3–4 candidati, con giudice umano. Costo: < $2 di API.
Fonti: https://github.com/SapienzaNLP/ita-bench · https://huggingface.co/spaces/mii-llm/open_ita_llm_leaderboard · https://aclanthology.org/2025.clicit-1.61.pdf

### 4. Embedding e pgvector — `VERIFICATO` con un vincolo `SMENTITO`

| Modello | Prezzo/1M tok | Dimensioni | Multilingue | Note |
|---|---|---|---|---|
| OpenAI text-embedding-3-small | $0,02 | 1536 (riducibili con `dimensions`) | sì (MTEB 62,3 %) | max input 8.192 |
| OpenAI text-embedding-3-large | $0,13 | 3072 (riducibili) | sì (64,6 %) | max input 8.192 |
| Google gemini-embedding-2 (GA) | $0,20 (batch $0,10) | 3072 default, 128–3072 ("recommended: 768, 1536, 3072") | "Over 100" lingue | max input 8.192; free tier con uso dati |
| Voyage voyage-4-lite / voyage-4 / voyage-4-large | $0,02 / $0,06 / $0,12 | — | non dichiarato in pricing | 200M token gratis |

Anthropic non offre embedding propri (la doc rimanda a Voyage).

**pgvector**: "By default, pgvector performs exact nearest neighbor search, which provides perfect recall." → **5.000–50.000 chunk reggono senza indice** (scan sequenziale). Vincolo trovato: HNSW e IVFFlat "Supported types are: `vector` - up to 2,000 dimensions", "`halfvec` - up to 4,000 dimensions". Quindi con embedding a 3072 dimensioni **non si può creare un indice su `vector`**: o si riduce a ≤ 2000 (1536/768, supportato da tutti i modelli sopra) o si usa `halfvec`. Versione corrente pgvector 0.8.6, Postgres ≥ 13.
Fonti: https://developers.openai.com/api/docs/guides/embeddings · https://ai.google.dev/gemini-api/docs/embeddings · https://docs.voyageai.com/docs/pricing · https://raw.githubusercontent.com/pgvector/pgvector/master/README.md

Raccomandazione tecnica (non di prodotto): 768 o 1536 dimensioni, qualunque provider.

### 5. Streaming + tool use nella stessa risposta — `VERIFICATO` (tutti e tre)

- Anthropic: "The deltas for `tool_use` content blocks correspond to updates for the `input` field of the block [...] the deltas are *partial JSON strings*" (evento `input_json_delta`); "Tool use supports fine-grained streaming for parameter values. Enable it per tool with `eager_input_streaming`." — https://platform.claude.com/docs/en/build-with-claude/streaming
- OpenAI: "you will receive a series of events of type `response.function_call_arguments.delta` which will contain the `delta` of the `arguments` field." — https://developers.openai.com/api/docs/guides/function-calling
- Google: "When using tools with streaming, the model generates function calls as a sequence of `step.delta` events on the stream. Tool arguments can be streamed as partial arguments". — https://ai.google.dev/gemini-api/docs/function-calling

---

## 2. Fonti scientifiche

### 6. PubMed E-utilities — `VERIFICATO`

Gratuite (servizio pubblico NLM, nessuna tariffa). Limiti: "post no more than three URL requests per second" senza chiave; "By including an API key, a site can post up to 10 requests per second by default". Va registrato `tool` ed `email`. "EFetch can produce abstracts from Entrez PubMed". Job grandi "either weekends or between 9:00 PM and 5:00 AM Eastern time".
Condizioni per mostrare abstract in app commerciale: NLM chiede di "acknowledge NLM as the source of the data by including the phrase 'Courtesy of the U.S. National Library of Medicine'" e di "not indicate or imply that NLM has endorsed its products". **Gli abstract non sono opera del governo USA**: NCBI avverte che il sito "contains resources which incorporate material contributed or licensed by individuals, companies, or organizations that may be protected by U.S. and foreign copyright laws" e che "Use beyond fair use requires written permission from copyright owners". → Coerente col brief: PubMed per **verificare**, non per mostrare abstract integrali. I riassunti in italiano scritti da noi (strato 3) non hanno questo problema.
Fonti: https://www.ncbi.nlm.nih.gov/books/NBK25497/ · https://www.nlm.nih.gov/databases/download/terms_and_conditions.html · https://www.ncbi.nlm.nih.gov/home/about/policies/

### 7. OpenAlex — `SMENTITO` (modello di accesso cambiato) / dati `VERIFICATO`

Non è più "gratis con polite pool": ora c'è un **budget giornaliero**. "every account gets **$1 of API usage per day for free**" con API key gratuita; senza chiave "$0.10/day". Tariffe: "Get single entity: Retrieve one entity by ID or DOI - Free"; "List + filter [...] $0.10" per 1.000 chiamate; "Search: Full-text keyword search - $1" per 1.000. Piani: pay-as-you-go a "$1 increments", Member "$5,000/year".
Test reale eseguito oggi senza chiave (`curl https://api.openalex.org/works/https://doi.org/10.1080/02640414.2016.1210197`): HTTP 200, header `X-RateLimit-Cost-USD: 0.0001`, `X-RateLimit-Limit-USD: 0.1`, `X-RateLimit-Limit: 1000` → **~1.000 lookup per DOI al giorno senza chiave**, 10.000 con chiave gratuita. Il record restituisce `abstract_inverted_index` (presente nel test) e `open_access.is_oa`.
Licenza dati: "released under a **CC0** public-domain license with no 'personal use only' carve-out".
Impatto: per verificare 60–200 citazioni una tantum basta e avanza. Da non usare come corpus vivo (già escluso dal brief).
Fonti: https://help.openalex.org/access/pricing/ · https://help.openalex.org/access/example-costs/ · test `curl` 2026-09-16

### 8. Semantic Scholar — `VERIFICATO` (con riserva sull'uso commerciale)

Chiave non obbligatoria per la maggior parte degli endpoint: "rate-limited to 1000 requests per second shared among all unauthenticated users"; con chiave "The introductory rate limit for an API key is 1 RPS on all endpoints" (chiave su richiesta). Restituisce `abstract` e `tldr`.
Licenza API: "limited, non-exclusive, non-transferable, non-sublicensable and terminable license to use the API solely in operation with compatible third-party platforms"; obbligo di "an attribution to 'Semantic Scholar' on its website"; divieto di "repackage, sell, rent, lease, lend, distribute, or sublicense the API"; contenuti terzi sotto "CC BY-NC or ODC-BY". **L'uso commerciale non è né permesso né vietato esplicitamente**; i TLDR/abstract potrebbero ricadere in CC BY-NC. → Utile solo come terzo verificatore; non mostrare TLDR nell'app.
Fonti: https://www.semanticscholar.org/product/api · https://www.semanticscholar.org/product/api/license

### 9. Crossref — `VERIFICATO`

Polite pool: parametro `mailto=` o User-Agent "MyApp/1.0 (https://example.org; mailto:user@example.org)", solo HTTPS. Rate limit dichiarato negli header `X-Rate-Limit-Limit` / `X-Rate-Limit-Interval`. Test reale oggi con `mailto`: `x-rate-limit-limit: 10`, `x-rate-limit-interval: 1s`, `x-api-pool: polite-single` → **10 req/s** (la doc cita 50 come esempio; il valore reale odierno è 10). Metadati: "Crossref asserts no claims of ownership to individual items of bibliographic metadata and associated Digital Object Identifiers (DOIs)". Servizio Plus a pagamento con SLA.
Nota pratica dal test: per Schoenfeld 2017 Crossref restituisce `issued` = 2016 (online first) e `published-print` = 2017 — il validatore deve confrontare l'anno con tolleranza ±1 o usare `published-print`.
Fonti: https://github.com/CrossRef/rest-api-doc · test `curl` 2026-09-16

### 10. Linee guida a licenza aperta — `SMENTITO` (in parte)

| Documento | Licenza / disponibilità | Citabile integralmente in app commerciale? |
|---|---|---|
| **WHO guidelines on physical activity and sedentary behaviour** (25 nov 2020, ISBN 9789240015128) | **CC BY-NC-SA 3.0 IGO**, PDF scaricabile | **No** (NonCommercial). Sì citazioni brevi + riassunto nostro + link. |
| ACSM 2009 "Progression Models in Resistance Training for Healthy Adults" (MSSE, DOI 10.1249/MSS.0b013e3181915670) | Nessuna licenza aperta in Crossref (`license: []`), copyright Wolters Kluwer | No. Solo citazione + riassunto. |
| ACSM 2011 "Quantity and Quality of Exercise..." (DOI 10.1249/MSS.0b013e318213fefb) | idem | No. |
| NSCA 2019 "Resistance Training for Older Adults: Position Statement" (JSCR, DOI 10.1519/jsc.0000000000003230) | idem | No. |

Impatto: la scheda studio del brief ("cosa dice / cosa non dice", riassunto in italiano) funziona; "citabili integralmente" no. Nessuna delle tre fonti-cardine è a licenza aperta per uso commerciale.
Fonti: https://www.who.int/publications/i/item/9789240015128 · Crossref API (campo `license`) 2026-09-16

### 11. Meta-analisi chiave: DOI, anno, open access — `VERIFICATO` (DOI risolti oggi su Crossref)

Tutti i DOI qui sotto sono stati risolti oggi via `api.crossref.org/works/{doi}`; titolo e rivista coincidono. OA = licenza CC dichiarata in Crossref (assenza di licenza ≠ necessariamente chiuso, ma va trattato come tale).

| Tema | Riferimento | DOI | Anno | OA |
|---|---|---|---|---|
| Volume (ipertrofia) | Schoenfeld, Ogborn, Krieger — Dose-response weekly volume, *J Sports Sci* | 10.1080/02640414.2016.1210197 | 2017 (online 2016) | no |
| Volume (forza) | Ralston et al. — Weekly set volume on strength, *Sports Med* | 10.1007/s40279-017-0762-7 | 2017 | **CC BY** |
| Volume (revisione) | Baz-Valle et al. — Different RT volumes on hypertrophy, *J Hum Kinet* | 10.2478/hukin-2022-0017 | 2022 | **CC BY** |
| Volume/frequenza (meta-regressione) | Pelland et al. — RT dose-response, *SportRxiv* (preprint) | 10.51224/srxiv.460 | 2024 | **CC BY** (preprint) |
| Frequenza (ipertrofia) | Schoenfeld, Ogborn, Krieger — RT frequency & hypertrophy, *Sports Med* | 10.1007/s40279-016-0543-8 | 2016 | no |
| Frequenza (forza) | Grgic et al. — RT frequency & strength, *Sports Med* | 10.1007/s40279-018-0872-x | 2018 | no |
| Carico / range di rep | Schoenfeld, Grgic, Ogborn, Krieger — Low- vs high-load, *JSCR* | 10.1519/JSC.0000000000002200 | 2017 | no |
| Carico / range di rep | Schoenfeld et al. — Repetition continuum re-examination, *Sports* (MDPI) | 10.3390/sports9020032 | 2021 | **CC BY** |
| Carico (network MA) | Lopez et al. — RT load effects, *MSSE* | 10.1249/mss.0000000000002838 | 2022 | no |
| Carico/set/frequenza (network MA) | Currier et al. — RT prescription, *BJSM* | 10.1136/bjsports-2023-106807 | 2023 | CC BY-NC |
| Cedimento | Grgic et al. — Failure vs non-failure, *J Sport Health Sci* | 10.1016/j.jshs.2021.01.007 | 2022 | no (Elsevier TDM) |
| Prossimità al cedimento / RIR | Refalo et al. — Proximity-to-failure & hypertrophy, *Sports Med* | 10.1007/s40279-022-01784-y | 2023 | **CC BY** |
| Prossimità al cedimento (meta-regressione) | Robinson et al. — Estimated proximity to failure, *Sports Med* | 10.1007/s40279-024-02069-2 | 2024 | no (preprint CC BY: 10.51224/srxiv.295) |
| Riposo tra set | Grgic et al. — Rest interval & strength, *Sports Med* | 10.1007/s40279-017-0788-x | 2018 | no |
| Riposo tra set (RCT) | Schoenfeld et al. — 1 vs 3 min rest, *JSCR* | 10.1519/JSC.0000000000001272 | 2016 | no |
| Periodizzazione | Williams et al. — Periodized vs non-periodized, *Sports Med* | 10.1007/s40279-017-0734-y | 2017 | no |
| Periodizzazione (volume-equated) | Moesgaard et al. — Periodization on strength & hypertrophy, *Sports Med* | 10.1007/s40279-021-01636-1 | 2022 | no |
| Autoregolazione | Hickmott et al. — Load & volume autoregulation, *Sports Med Open* | 10.1186/s40798-021-00404-9 | 2022 | **CC BY** |
| Deload (consenso) | Bell et al. — Integrating deloading, Delphi consensus, *Sports Med Open* | 10.1186/s40798-023-00633-0 | 2023 | **CC BY** |
| Deload (RCT) | Coleman et al. — One-week deload, *PeerJ* | 10.7717/peerj.16777 | 2024 | **CC BY** |
| Linee guida generali | ACSM 2009 Progression models, *MSSE* | 10.1249/MSS.0b013e3181915670 | 2009 | no |
| Anziani / salute | NSCA 2019 position statement older adults, *JSCR* | 10.1519/jsc.0000000000003230 | 2019 | no |

Avvertenza per chi scrive le regole: **cinque DOI che ricordavo "a memoria" erano sbagliati** (risolvevano ad articoli non correlati o 404) prima del controllo su Crossref. Il validatore DOI + confronto titolo previsto dal brief (strato 2) è indispensabile, non opzionale. Manca in lista una meta-analisi dedicata all'ordine degli esercizi e una ai principianti puri: da cercare quando si scrivono quelle regole.
Fonte: Crossref REST API, 2026-09-16 (script nello scratchpad della sessione).

### 12. Paper Bloom (Stanford, CHI 2026) — `VERIFICATO`

Paper: "Bloom: Designing for LLM-Augmented Behavior Change Interactions", CHI 2026, DOI 10.1145/3772318.3790506; preprint arXiv 2510.05449. Repo pubblico: https://github.com/StanfordHCI/Bloom. Licenza **doppia**: codice MIT; **prompt e tassonomia di sicurezza proprietari** ("Use requires prior written approval from the Stanford HEARTS Lab Faculty Director" per `backend/llm/prompts` e `safety/taxonomy.pdf`). Nel repo esistono `safety/taxonomy.pdf`, dataset di benchmark e script di valutazione in `safety/results`.
Impatto: la "tassonomia Bloom" citata nel brief (sezione 5, #7) **si può leggere ma non riusare** senza permesso scritto. La tassonomia dei nostri filtri va scritta da noi, ispirata alle categorie, non copiata. I prompt MI idem.
Fonti: https://github.com/StanfordHCI/Bloom · https://doi.org/10.1145/3772318.3790506

### 13. Griglia MITI per valutare la fedeltà al Motivational Interviewing — `VERIFICATO` (disponibilità), `NON VERIFICABILE` (licenza)

Il manuale **MITI 4.2.1** (Moyers, Manuel, Ernst, 2014) è pubblicato in PDF da CASAA/UNM: https://casaa.unm.edu/assets/docs/miti4_21.pdf (pagina indice https://casaa.unm.edu/tools/miti.html). Contiene punteggi globali (technical/relational) e codici comportamentali (rapporto riflessioni/domande, % MI-adherent). La pagina **non dichiara una licenza** né condizioni d'uso. Esiste anche un preprint 2026 "Benchmarking Motivational Interviewing Competence of Large Language Models" (arXiv 2603.03846) che usa MITI come rubrica per LLM.
Per chiudere la licenza: una mail a CASAA. Come rubrica interna di test (non ridistribuita) il rischio è basso.

### 14. PAR-Q+ in un'app commerciale — `SMENTITO`

Termini ufficiali: "Use of the PAR-Q+ and ePARmed-X+ (and related forms), without charge, [...] is limited to participants, exercise professionals, and clinicians using them for pre-participation screening, to researchers using them only for non-commercially related research, and to other not-for-profit users." · "The instruments may not be sold or incorporated into a product to be sold, without the expressed written approval/consent of the PAR-Q+ Collaboration." · "The instruments may not under any circumstances, be changed in any way as even minor changes may alter performance." · "Any other use requires advance written permission". Copyright "PAR-Q+ Collaboration 2007-2026. All rights reserved." Versione corrente 2025. Traduzioni ufficiali: Brazilian Portuguese, Chinese, English, French (Canadian), German, Gujarati, Malay, Spanish, Turkish, Vietnamese — **niente italiano**.
Impatto sul brief (#1 onboarding, #10 obiezioni): il gate di sicurezza **non può essere "il PAR-Q+"** né una sua traduzione. Opzioni: (a) chiedere licenza commerciale alla PAR-Q+ Collaboration (costo e tempi ignoti); (b) scrivere un questionario nostro di 7 domande "tipo PAR-Q" (le domande di screening sono fatti clinici comuni; non copiare il testo né il logo, non chiamarlo PAR-Q+). Il brief già diceva "questionario tipo PAR-Q+": la (b) è la strada coerente.
Fonti: https://eparmedx.com/?page_id=746 · https://eparmedx.com/?page_id=1006 · https://eparmedx.com/

---

## 3. Database esercizi

### 15. free-exercise-db (yuhonas) — `VERIFICATO`, con un rischio sulle immagini

Licenza repo: **Unlicense** (GitHub API `license.spdx_id = Unlicense`; l'upstream `wrkout/exercises.json` è anch'esso Unlicense). Dataset scaricato e contato oggi: **876 esercizi, 873 con immagini** (2 foto ciascuno, JPG), campi `name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category, images, id`. Ultimo push 2026-08-30. **Nessun nome italiano** (solo inglese). Il README riconosce 25 immagini duplicate e campi incompleti.
**Rischio**: né il repo né l'upstream dichiarano la provenienza delle foto ("does not specify the original sources of individual exercises or images"). Un "Unlicense" apposto da chi non è l'autore delle foto non trasferisce diritti. Le immagini sono utilizzabili a rischio dell'utilizzatore; i dati testuali (nomi, muscoli, istruzioni) sono a rischio basso.
Fonti: https://github.com/yuhonas/free-exercise-db · https://github.com/wrkout/exercises.json · `curl` + conteggio locale 2026-09-16

### 16. wger — `VERIFICATO`

Interrogata oggi l'API pubblica `https://wger.de/api/v2/`: **865 esercizi**, **138 con traduzione italiana** (lingua id 13), **273 con almeno un'immagine, 374 immagini totali**. Licenze presenti nel DB: CC-BY-SA 3, CC-BY 4, CC-BY-SA 4, CC0, ODbL; le immagini sono **286 CC-BY-SA 4 + 88 CC-BY-SA 3**, ognuna con `license_author`. → **Uso commerciale ammesso** (CC-BY-SA non vieta il commerciale) con **attribuzione per singolo item** (autore + licenza) e **ShareAlike** su opere derivate (immagini modificate vanno ridistribuite con la stessa licenza; i dati testuali adattati idem).
API: "Public endpoints, such as the list of exercises or the ingredients, can be accessed without authentication"; throttling solo su auth/registrazione/ingredienti; "All other endpoints are unthrottled".
Impatto: wger copre nomi italiani per ~16 % degli esercizi e immagini per ~32 %. Da solo non basta per la v1; combinato con free-exercise-db (testo) e traduzione nostra dei nomi copre il repertorio 3 split × 3 livelli.
Fonti: https://wger.readthedocs.io/en/latest/api/api.html · query `wger.de/api/v2/exerciseinfo`, `/license`, `/language`, `/exerciseimage` 2026-09-16

### 17. ExerciseDB — `SMENTITO` (premessa), `VERIFICATO` (offerta attuale)

Il sito ufficiale non vende più un abbonamento API ma un **dataset one-time self-hosted**: "STARTER - $199" con "1,394 structured exercises", "180x180 animated GIF" e "360x360 animated GIF for each exercise", "Self-hosted data and media files", "Platform-neutral commercial license", "One-time purchase"; "PRO - $599" aggiunge tassonomia a 17 campi, sostituzioni/progressioni, GIF 720 e 1080. Il FAQ dice che si possono ospitare GIF e JSON in proprio ma non "resell, redistribute, or publish the raw dataset or GIF files as a standalone library". La pagina RapidAPI non è leggibile senza login: stato del listing **non verificabile**.
Fonti: https://exercisedb.io/pricing · https://exercisedb.io/faq

### 18. Dataset aperto con nomi italiani e mappatura muscolare — `VERIFICATO` (esiste, con limiti)

- **wger**: 138 esercizi con nome+descrizione in italiano e muscoli mappati (vedi #16). Licenza CC-BY-SA.
- **hasaneyldrm/exercises-dataset**: "1,324 exercises", istruzioni in 10 lingue tra cui **Italian**, muscoli ed attrezzatura; **codice e testi MIT**, ma le GIF sono "© Gym visual — https://gymvisual.com/" e "Reuse is governed by Gym visual's Terms & Conditions; obtain your own license there before reusing the media". → Testi italiani riusabili, GIF no.
Nessun dataset aperto copre insieme nomi italiani + immagini libere per tutti gli esercizi: la combinazione (wger IT + exercises-dataset IT + free-exercise-db foto/inglese) più una revisione umana dei nomi è la strada realistica per la v1.
Fonti: https://github.com/hasaneyldrm/exercises-dataset · wger API 2026-09-16

---

## 4. Legale (Italia/UE)

### 19. Schede via software: professione riservata? — `VERIFICATO` (nessuna riserva nel testo di legge), `NON VERIFICABILE` (disclaimer delle app italiane)

Testo dell'**art. 41 D.Lgs. 36/2021** (Gazzetta Ufficiale): "sono istituite le figure professionali del chinesiologo di base, del chinesiologo delle attivita' motorie preventive ed adattate, del chinesiologo sportivo e del manager dello sport"; "Per l'esercizio dell'attivita' professionale di chinesiologo di base e' necessario il possesso della laurea triennale in Scienze delle attivita' motorie e sportive (classe L-22). L'esercizio [...] ha ad oggetto: [...] b) [...] personal training e di preparazione atletica non agonistica." L'articolo **non contiene** una clausola di esclusiva, un albo, né una sanzione per chi svolge personal training senza laurea; il comma 7 rimanda a un DPCM attuativo per il profilo professionale (non risulta emanato: non verificato oggi). Il correttivo D.Lgs. 163/2022 (art. 27) sopprime "anche di livello agonistico" e aggiunge il comma 8-bis; niente sulla riserva.
Interpretazione di un'autorità pubblica (Regione Emilia-Romagna, FAQ del 27-03-2026): la laurea "non è assolutamente obbligatoria"; i personal trainer sono "istruttori di specifica disciplina" con "qualifiche rilasciate da federazioni sportive riconosciute dal CONI/CIP, non necessariamente la laurea in scienze motorie"; la Regione richiama che i criteri di equipollenza attendono l'accordo Stato-Regioni (art. 41 c. 6). Le leggi regionali sulle palestre (es. LR ER 8/2017 art. 11 c. 4: "almeno un istruttore qualificato al quale viene affidato il coordinamento") regolano i **locali**, non il software.
Verdetto: **nessuna norma primaria riserva la generazione di schede via software a una professione**; il rischio è quello ordinario di un prodotto informativo (disclaimer, non sostituisce un professionista, esclusione di soggetti con patologie → rimando). **Non serve un professionista dietro l'app per legge**; un parere legale scritto resta consigliabile prima del lancio, perché la materia è in evoluzione (DPCM attuativo, accordo Stato-Regioni).
Disclaimer usati dalle app in commercio in Italia: **non verificato** (le pagine termini di Freeletics IT e Buddyfit hanno restituito 404 oggi). Per chiudere: leggere i ToS di 3 app (Freeletics, Fitbod, un'app italiana) dagli store.
Fonti: https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.versione=1&art.idGruppo=10&art.flagTipoArticolo=0&art.codiceRedazionale=21G00043&art.idArticolo=41&art.idSottoArticolo=1&art.idSottoArticolo1=10&art.dataPubblicazioneGazzetta=2021-03-18&art.progressivo=0 · correttivo 22G00174 art. 27 (GU) · FAQ Regione Emilia-Romagna (URL lungo, sportello unico "centro fitness / requisiti attività")

### 20. Dati su allenamento, infortuni, dolori: art. 9 GDPR? DPIA? — `VERIFICATO`

- Infortuni e dolori dichiarati sono "dati relativi alla salute" (art. 4(15) GDPR: dati "che rivelano informazioni relative allo stato di salute"); i soli log di allenamento (peso/rep) da soli non lo sono, ma combinati con readiness (sonno, dolori) lo diventano. Base giuridica pratica: **consenso esplicito** art. 9(2)(a), separato e revocabile — coerente con brief #13.
- DPIA: il **Garante, provvedimento n. 467 dell'11 ottobre 2018**, elenca i trattamenti che la richiedono; i criteri citati includono "valutazione o scoring, in particolare in considerazione di aspetti riguardanti [...] la salute", "uso innovativo o applicazione di nuove soluzioni tecnologiche od organizzative", "valutazione o assegnazione di un punteggio, inclusiva di profilazione e previsione", "monitoraggio sistematico degli interessati"; **due o più criteri → DPIA obbligatoria**. fitcoach ne tocca almeno tre (salute, AI, scoring/readiness). → **DPIA sì**, prima del lancio. Non è un blocco: è un documento.
Fonte: https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/9058979 · Reg. (UE) 2016/679 art. 4(15), 9, 35 (non riletti oggi su EUR-Lex; testo di legge stabile)

### 21. AI Act — `VERIFICATO`

Un coach fitness conversazionale **non rientra nell'Allegato III** (alto rischio) né nelle pratiche vietate dell'art. 5 (salvo manipolazione subliminale/sfruttamento di vulnerabilità: il protocollo MI "mai colpa, sempre una scelta" va nella direzione giusta). Obbligo applicabile: **art. 50(1)**: "Providers shall ensure that AI systems intended to interact directly with natural persons are designed and developed in such a way that the natural persons concerned are informed that they are interacting with an AI system"; art. 50(5): "at the latest at the time of the first interaction or exposure". Applicazione: art. 113, "shall apply from 2 August 2026" → **già in vigore oggi** (2026-09-16). Nota: la pagina segnala che "The Digital Omnibus amendment modified several of these application dates"; non ho verificato se tocca l'art. 50(1) — per un'app che nasce oggi la differenza è nulla: il badge "stai parlando con un coach AI" del brief (consegne UI) è obbligatorio, non stilistico.
Fonti: https://artificialintelligenceact.eu/article/50/ · https://artificialintelligenceact.eu/article/113/ (testo consolidato; EUR-Lex per il testo ufficiale: Reg. (UE) 2024/1689)

### 22. Nuova direttiva responsabilità da prodotto — `VERIFICATO`

**Direttiva (UE) 2024/2853** del 23 ottobre 2024: "product" = "all movables [...]; it includes electricity, digital manufacturing files, raw materials and software"; esclusione del FOSS "developed or supplied outside the course of a commercial activity"; produttore include "a developer or producer of software, including AI system providers"; presunzione di difettosità in caso di violazione di requisiti di sicurezza obbligatori o "obvious malfunction during reasonably foreseeable use"; si applica a "products placed on the market or put into service after **9 December 2026**"; recepimento entro la stessa data.
Cosa cambia per fitcoach: se lanciata dopo il 9-12-2026 (probabile), il software è "prodotto" e il danno alla salute da difetto è risarcibile con onere della prova alleggerito. Mitigazioni già nel brief: motore deterministico tracciabile (`rule_id`), audit trail delle proposte, filtri su dolore/infortunio, disclaimer. Aggiungere: log di versione delle regole per ogni piano generato (già previsto: regole versionate) e un processo di aggiornamento documentato.
Fonte: https://eur-lex.europa.eu/eli/dir/2024/2853/oj/eng

### 23. Abbonamenti digitali in Italia — `VERIFICATO` (con un punto non verificato)

- **Recesso**: Codice del consumo art. 52 (14 giorni) con eccezione art. 59 lett. o) per contenuti digitali con esecuzione iniziata previo consenso espresso (testo di legge stabile, non riletto oggi). **Novità verificata**: Direttiva (UE) 2023/2673 inserisce l'**art. 11a in Dir. 2011/83/UE**: un "withdrawal function" online, etichettato "withdraw from contract here", "continuously available throughout the withdrawal period", "prominently displayed", con conferma "confirm withdrawal" e ricevuta "on a durable medium"; recepimento entro 19-12-2025, **applicazione dal 19-06-2026** → già applicabile. Recepimento italiano: non verificato oggi.
- **IVA**: "In Italy the standard Vat rate is 22%" (Agenzia Entrate). Per B2C digitale intra-UE vale la regola del Paese del consumatore con soglia €10.000 e OSS (non riletto oggi su fonte UE: le pagine della Commissione hanno risposto 404; Stripe rimanda alla pagina OSS dell'Agenzia).
- **Stripe Tax copre l'Italia**: riga "IT | Tutti i codici imposta prodotto | IVA | ✓ Supported (business) | ✓ Supported (customer) | 02/10/2023"; "Registration threshold: 1 transaction" per business italiano.
Fonti: https://eur-lex.europa.eu/eli/dir/2023/2673/oj/eng · https://www.agenziaentrate.gov.it/portale/web/english/nse/business/vat-in-italy · https://docs.stripe.com/tax/supported-countries

---

## 5. Stack e infrastruttura

### 24. Railway / Render: pgvector, costo minimo, sleep, backup — `VERIFICATO`

| | Render | Railway | Neon | Supabase |
|---|---|---|---|---|
| pgvector | Sì: "pgvector \| Enable this extension with `CREATE EXTENSION vector;`" (PG ≥ 13) | **Non nel template ufficiale**: "we do not plan to add extensions to the PostgreSQL templates"; template community "Deploy pgvector" (`pgvector/pgvector:pg18`, di Brody's Projects) | Sì: "pgvector \| 0.8.0 \| ... \| 0.8.6" (PG18) | Non verificato oggi (non in pricing) |
| Istanza minima | Free: "fixed storage capacity of 1 GB", "expire 30 days after creation", una per workspace. Paid: prezzo non leggibile oggi (pagina pricing JS); PITR "Hobby: Past 3 days", "Pro or higher: Past 7 days" | Hobby "$5 / month" con "$5 of resource usage" inclusi; RAM "$10 / GB / month", CPU "$20 / vCPU / month", volume "$0.15 / GB / month"; Free "$0" | Free "0.5 GB/project", "100 CU-hours/project"; Launch pay-as-you-go | Free "500 MB database size", "paused after 1 week of inactivity"; Pro "from $25/month", "8 GB disk" |
| Sleep | Web service free: sospeso dopo 15 min di inattività, "750 Free instance hours" al mese; Postgres free non dorme ma scade | Nessuna dichiarazione di sleep in pricing (non verificato) | Compute "suspends automatically after inactivity (scale-to-zero)" dopo 5 min sul Free | Free: pausa dopo 1 settimana |
| Backup | Free: "Render does not create logical backups for databases on the Free compute plan"; paid: backup logici "retained [...] for seven days" + PITR | "native Backups feature" su volumi (dettagli non verificati) | Restore window Free "6 hours (1 GB limit)", Launch "Up to 7 days" | Pro "Daily backups stored for 7 days"; PITR add-on "$100 per month per 7 days retention" |

Implicazione: su Render il Postgres free **scade dopo 30 giorni** e non ha backup: per la v1 serve un piano a pagamento o Neon (pgvector 0.8.x, scale-to-zero, PITR 7 giorni sul Launch). Regioni UE: Neon e Render le offrono (non verificato oggi quale).
Fonti: https://render.com/docs/postgresql-extensions · https://render.com/docs/free · https://render.com/docs/postgresql-backups · https://docs.railway.com/guides/postgresql · https://docs.railway.com/reference/pricing/plans · https://railway.com/deploy/pgvector · https://neon.com/pricing · https://neon.com/docs/extensions/pg-extensions · https://supabase.com/pricing

### 25. Stripe: Checkout + Portal + trial + webhook; consumo; limiti sandbox — `VERIFICATO`

- Trial in Checkout: `subscription_data[trial_period_days]` o `subscription_data.trial_end`; senza carta: "passing `payment_method_collection=if_required`" + `trial_settings.end_behavior.missing_payment_method` = `cancel` | `pause`; evento `customer.subscription.trial_will_end`; portale cliente per aggiungere il metodo. Max trial "2 years (730 days)".
- **Consumo per messaggi extra**: praticabile con **Billing Meters** (`price` a consumo + `meter events`), ma Stripe ora scrive: "Metronome è la piattaforma principale di addebito a consumo di Stripe, consigliata per tutte le nuove integrazioni"; Billing Meters "rimane completamente supportato" e resta la scelta se serve "piena compatibilità con Connect, **Checkout**, Adaptive Pricing" ("Metronome ha un supporto limitato per alcuni di questi"). Billing Meters "riconcilia l'utilizzo solo al momento della fattura" (niente visibilità in tempo reale: il contatore in-app va tenuto in `llm_usage`, come già previsto).
- Limiti sandbox: "Modalità live: 100 richieste al secondo"; "Sandbox: 25 richieste al secondo"; per endpoint 25 rps; Subscriptions "10 nuove fatture per abbonamento, al minuto", "20 [...] al giorno". Le mail di promemoria trial "non [vengono inviate] in una sandbox".
Fonti: https://docs.stripe.com/payments/checkout/free-trials.md?payment-ui=stripe-hosted · https://docs.stripe.com/billing/subscriptions/usage-based · https://docs.stripe.com/rate-limits

### 26. PWA su iOS Safari — `VERIFICATO` (persistenza, installazione, push), `NON VERIFICABILE` (timer in background)

- **Persistenza IndexedDB**: Safari cancella "all of a website's script-writable storage after seven days of Safari use without user interaction on the site" (IndexedDB, LocalStorage, SW registrations, cache), **ma** "Web applications added to the home screen are not part of Safari and thus have their own counter of days of use. Their days of use will match actual use of the web application which resets the timer." → La bozza seduta in IndexedDB di un'app installata sopravvive; in Safari puro sopravvive finché l'utente usa il sito almeno una volta ogni 7 giorni di uso di Safari. Per la seduta in corso (ore, non settimane) il rischio è nullo in entrambi i casi.
- **Installazione**: da Share > "Add to Home Screen"; dalla 16.4 anche "third-party browsers can now offer their users the ability to add websites and web apps to the Home Screen". Nessun `beforeinstallprompt` (va spiegato all'utente con un'istruzione).
- **Web Push**: "Now with iOS and iPadOS 16.4, we are adding support for Web Push to Home Screen web apps"; permesso solo "in response to direct user interaction"; Badging API disponibile. → **Solo da Home Screen, da iOS 16.4**. Coerente col taglio "niente push in v1".
- **Timer in background**: nessun documento Apple primario trovato che descriva il comportamento di `setTimeout`/`setInterval` di una web app in background; il comportamento noto (sospensione del JS) non è verificabile da fonte. Progettare il timer riposo come `end_at = now + rest` salvato in IndexedDB e ricalcolato al ritorno in foreground, con `Notification` locale opzionale; mai contare tick.
Fonti: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ · https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

### 27. Next.js e libreria PWA per App Router — `VERIFICATO`

`npm view next version` → **16.3.5** (pubblicata 2026-09-14). Libreria PWA mantenuta: **`@serwist/next` 9.5.12** (2026-07-22), peer `next >=14.0.0`, guida separata per Turbopack ("This quick guide is meant for webpack. If you are using Turbopack, head to the Turbopack quick guide"). **`next-pwa` 5.6.0 è ferma al 2022-08-23** e `@ducanh2912/next-pwa` 10.2.9 al 2024-09-18: entrambe da non usare.
Fonti: `npm view next version time.modified`; `npm view @serwist/next ...`; https://serwist.pages.dev/docs/next/getting-started

### 28. Email transazionale — `VERIFICATO`

| Provider | Free | Primo piano | Regione UE |
|---|---|---|---|
| **Resend** | "3,000" email/mese, "100 emails a day", 3 domini, "30-day data retention" | Pro "$20/mo for 50,000 emails" | Invio da "Ireland (eu-west-1)" disponibile, **ma** "It does not control where customer data is stored [...] All account data, including email metadata, logs, and API records, is stored in the United States." |
| **Postmark** | "100 emails/month. No overages allowed" | Basic "$15.00/mo", "10,000 emails/month", extra "$1.80 / 1,000" | Nessuna menzione di residenza UE in pricing |
| Brevo / Mailjet (UE) | non verificato oggi (pagina pricing non leggibile) | — | — |

Per una mail al giorno per utente mancante, Resend free copre fino a ~100 utenti attivi/giorno; DPA+SCC da verificare per entrambi (non fatto oggi).
Fonti: https://resend.com/pricing · https://resend.com/docs/dashboard/domains/regions · https://postmarkapp.com/pricing

### 29. SQLAlchemy async + pgvector — `VERIFICATO`

`pip index versions`: **pgvector 0.5.0** (2026-07-06, `requires_python >=3.10`, MIT), **SQLAlchemy 2.0.54**, **asyncpg 0.31.0**, **alembic 1.20.0**, **FastAPI 0.141.1**, **anthropic 1.6.0**. pgvector-python "Supports Django, SQLAlchemy, SQLModel, Psycopg 3, Psycopg 2, asyncpg, pg8000, and Peewee"; per asyncpg "register the types with your connection" con `await register_vector(conn)` (o `init` del pool); per SQLAlchemy async + psycopg 3 `register_vector_async` via event listener. Mantenuta e compatibile.
Fonti: `pip index versions ...` 2026-09-16 · https://github.com/pgvector/pgvector-python

### 30. Rate limiting in-process con più worker — `VERIFICATO` (per costruzione)

`slowapi` 0.1.10 (2026-06-13) usa `limits` con "redis, memcached and memory backends [...] (memory as a fallback)" e avverte: "this is alpha quality code still, the API may change". Lo storage `memory://` è un dizionario nel processo: **con N worker uvicorn/gunicorn ogni worker conta per sé**, quindi il limite effettivo è ≈ N× quello dichiarato e non è deterministico per client. `limits` elenca come storage condivisi Redis, Redis Cluster, Memcached, MongoDB, Valkey. Nessuna delle due doc lo dice in una frase citabile: è la conseguenza del modello di processo.
Conclusione per il brief ("niente Redis in v1"): regge **solo se il backend gira con un singolo worker** (accettabile per la v1 su Railway/Render con 1 replica) oppure se il rate limit è a livello di proxy. Se si scala a più worker/repliche, serve Redis (Render "Key Value" free non persiste; Railway Redis a consumo).
Fonti: https://slowapi.readthedocs.io/en/latest/ · https://limits.readthedocs.io/en/stable/storage.html · `pip index versions slowapi`

---

## 6. Non verificabili — e cosa servirebbe

| # | Cosa manca | Come chiudere |
|---|---|---|
| 3 | Confronto pubblico in italiano tra Haiku 4.5 / Sonnet 5 / gpt-5.4-mini / Gemini 3.x Flash | Eval nostro: 50 prompt in italiano, giudizio umano, < $2 di API. |
| 13 | Licenza del manuale MITI 4.2.1 | Mail a CASAA (UNM). Come rubrica interna non ridistribuita il rischio è basso. |
| 17 | Stato del listing ExerciseDB su RapidAPI | Login RapidAPI; oppure ignorarlo: il sito ufficiale vende il dataset one-time. |
| 19 (parte) | Disclaimer effettivi delle app fitness vendute in Italia | Leggere i ToS in-app di 3 prodotti (Freeletics, Fitbod, un'app italiana); le pagine web hanno dato 404. |
| 21 (parte) | Se il "Digital Omnibus" ha spostato la data dell'art. 50(1) | Testo consolidato su EUR-Lex 2024/1689; irrilevante per un lancio dopo il 2-8-2026. |
| 23 (parte) | Recepimento italiano della Dir. 2023/2673 (pulsante di recesso) e testo aggiornato Codice del consumo | Normattiva: D.Lgs. 206/2005 versione vigente. |
| 24 (parte) | Prezzo esatto dell'istanza Postgres minima Render; regioni UE di Neon/Render | Pagine pricing sono JS-only: aprirle nel browser. |
| 26 (parte) | Comportamento dei timer JS in background su iOS (fonte Apple) | Test sul campo (già previsto: rischio #8 del brief). Design a timestamp in ogni caso. |
| 28 (parte) | DPA/SCC di Resend e Postmark; prezzi Brevo/Mailjet | Pagine legal dei provider. |

---

## 7. Trovato senza cercarlo

1. **Claude Haiku 4.5 ha data di ritiro tentativa "Not sooner than October 15, 2026"** (stato: Active, non deprecato). È la data più vicina di tutta la lineup; Sonnet 5 "Not sooner than June 30, 2027". Se si sceglie Haiku 4.5, il provider dietro interfaccia (brief §7) va dato per scontato che cambi entro l'anno. — https://platform.claude.com/docs/en/about-claude/model-deprecations
2. **Haiku 4.5 non cacheabile sotto 4.096 token**: con system prompt + tool + state card intorno a 3.500 token la cache non scatta mai. Sonnet 5 (1.024) e Opus 5 (512) sì. — prompt-caching doc.
3. **Gemini 3.8 Flash raddoppia il 1° gennaio 2027** ($0,75→$1,50 input, $3,75→$7,50 output). Qualunque simulazione di costo su Gemini 3.x Flash va fatta col prezzo 2027. — Gemini pricing.
4. **Gemini API free tier vietato per utenti nel SEE** ("You may use only Paid Services when making API Clients available to users in the European Economic Area"). — Gemini terms.
5. **Claude API: la lingua dei "Start tier" limiti è generosa (2M ITPM), ma le nuove organizzazioni partono in "Evaluation tier" con limiti inferiori non pubblicati.** Da tenere presente per il test avversario dei 100 prompt (rischio #3). — rate-limits doc.
6. **`temperature`/`top_p`/`top_k` sono deprecati su Claude 4.7+ e restituiscono 400 se non di default**; lo SDK Python 1.x li ha rimossi. L'interfaccia provider del brief non deve esporre `temperature` come parametro comune. — model-deprecations doc.
7. **Stripe consiglia Metronome per i nuovi consumi, ma Metronome ha "supporto limitato" per Checkout**: per fitcoach (Checkout + Portal) Billing Meters è la scelta coerente, ed è ancora "completamente supportato". — Stripe usage-based doc.
8. **OpenAlex single-entity ha un costo tecnico di $0,0001/chiamata negli header** anche se la pagina prezzi dice "Free"; senza chiave il budget è $0,10/giorno = 1.000 lookup. Con chiave gratuita 10.000/giorno. — test `curl`.
9. **Crossref polite pool oggi limita a 10 req/s** (la doc porta 50 come esempio). — header `x-rate-limit-limit: 10`.
10. **Le foto di free-exercise-db hanno provenienza non dichiarata**; il dataset con nomi italiani (`exercises-dataset`) ha GIF Gymvisual a licenza separata. Gymvisual è con ogni probabilità anche la fonte delle GIF ExerciseDB (stesso stile): non verificato.
11. **Bloom: prompt e tassonomia di sicurezza proprietari** nonostante il repo MIT. Il brief cita "tassonomia Bloom" come base dei filtri: va riscritta.
12. **Direttiva 2023/2673: pulsante "recedi dal contratto qui" obbligatorio dal 19-06-2026** per contratti online: il portale Stripe copre la disdetta dell'abbonamento, non il recesso da contratto; serve una funzione dedicata nei 14 giorni.
13. **Render Postgres free scade dopo 30 giorni e non ha backup**; Supabase free si mette in pausa dopo 7 giorni di inattività; Neon free scala a zero dopo 5 min (cold start al primo accesso).
14. **Claude Sonnet 5 a $2/$10 è ora prezzo standard** (l'aumento a $3/$15 previsto per il 1-9-2026 "will not occur"). Sonnet 5 costa meno di Sonnet 4.6. — pricing doc.

---

## 8. Impatto sul piano

**Da riaprire nel brief**
- **§5 #1 e §10 (gate di sicurezza)**: sostituire "questionario tipo PAR-Q+ (da verificare licenza)" con "questionario di screening proprio, 7 domande, non denominato PAR-Q+"; oppure mettere a calendario la richiesta di licenza alla PAR-Q+ Collaboration (tempi/costi ignoti). La traduzione italiana ufficiale non esiste comunque.
- **§5 #7 (filtri su tassonomia Bloom)**: "ispirata a", non "su". Tassonomia e prompt MI vanno scritti da noi.
- **§6 strato 2/3 (linee guida "citabili integralmente")**: OMS 2020 è NC; ACSM/NSCA chiuse. Il formato "cosa dice / cosa non dice + DOI + link" regge; "testo integrale" no.
- **§7 (provider LLM, "endpoint UE o DPA adeguato")**: tutti e tre hanno DPA+SCC; endpoint UE first-party solo OpenAI. Se il legale chiede inferenza in UE con Claude → Vertex AI (`AnthropicVertex`, region `eu`). Da decidere insieme al product-strategist, non cambia l'architettura (provider dietro interfaccia).
- **§7 (pgvector)**: fissare le dimensioni dell'embedding a ≤ 2.000 (768 o 1.536) nel contratto dati, per poter indicizzare in futuro.
- **§7 ("niente Redis")**: regge con 1 worker/1 replica. Scriverlo come vincolo esplicito di deploy per la v1.
- **§8 rischio #7 (legale)**: aggiungere DPIA (obbligatoria, provv. Garante 467/2018) e banner AI Act art. 50(1) (già in vigore) alla definizione di fatto; aggiungere il pulsante di recesso ex Dir. 2023/2673.

**Regge**
- **Strada A e il costo LLM**: dentro le attese; il free tier con decine di messaggi/mese costa centesimi, non euro. Il piano B "giorno no deterministico" non è necessario per costo.
- **Professione riservata (19)**: nessuna riserva di legge; non rientra la strada C per obbligo normativo. Parere legale consigliato, non bloccante.
- **PWA iOS (26)**: IndexedDB da Home Screen non è soggetta al tetto 7 giorni; Web Push esiste (16.4+, solo installata). Il timer va progettato a timestamp. La scelta "app nativa" non si riapre per ora; resta il test sul campo (rischio #8).
- **Database esercizi (15–18)**: esiste materiale usabile commercialmente (wger CC-BY-SA con immagini; free-exercise-db Unlicense per i testi; nomi italiani parziali), e un'opzione a pagamento one-time (ExerciseDB $199) con GIF self-hosted. La v1 non deve partire "solo nomi + link esterni".
- **Fonti scientifiche (6–9, 11)**: la pipeline "Crossref/OpenAlex per verificare, riassunti nostri per mostrare" è corretta e gratuita ai volumi della v1; 22 DOI già risolti e pronti per la tabella `citations`.
- **Stack (24, 25, 27, 29)**: Next 16.3 + `@serwist/next`, FastAPI 0.141 + SQLAlchemy 2.0.54 + pgvector 0.5, Stripe Checkout/Portal/trial/Billing Meters: tutto disponibile e mantenuto.
