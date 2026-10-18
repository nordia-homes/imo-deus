# Jarvis — producție actualizată la 17 octombrie 2026

Versiunea activă: **build-20261017-jarvis-140**, commit aplicație **c06958bc203423f29634de06743221374ce7c4d3**, READY cu **100% trafic** pe https://imodeus.ro. Raportul verificabil este [RELEASE_2026_10_17.json](RELEASE_2026_10_17.json), iar rezumatul validării este în [MASTER_BATCH_PROGRESS.md](MASTER_BATCH_PROGRESS.md).

Regulile Firestore sunt sincronizate cu sursa și cele 80 de indexuri sunt READY. Funcțiile și installerul desktop 0.1.12 existente nu au necesitat republicare. Reper pentru rollbackul aplicației: **build-20261013-facebook-012**, commit **a720a76c015a31feaa3b94d497ef3f1cdb54be6b**. Rollbackul aplicației nu inversează date CRM sau mesaje trimise.

Publicarea folosește commitul exact din ramura `codex/jarvis-production-2026-10-04`. Nu s-a făcut merge în `main`; politica de rollout automat rămâne neschimbată. Înainte de o publicare ulterioară din `main`, schimbările trebuie integrate în acea ramură. Secțiunea de mai jos păstrează raportul istoric din 4 octombrie.

# Jarvis — publicare în producție, 2026-10-04

Implementarea este activă pe [imodeus.ro/ai-assistant](https://imodeus.ro/ai-assistant), în proiectul Firebase `studio-652232171-42fb6`, backend `studio`, regiune `us-central1`.

## Versiunea publicată

- Commit aplicație: `f49fe36eb1ccf3633dceb54512a127c1ea46282a`.
- Ramură: `codex/jarvis-production-2026-10-04`.
- App Hosting build: `build-2026-10-04-004`, stare `READY`, trafic **100%**.
- Cloud Run: `RoutesReady` și `ConfigurationsReady` confirmate.
- Reper anterior pentru rollbackul aplicației: `build-2026-10-04-002`. Un rollback al aplicației nu anulează efectele CRM și nu justifică reluarea mesajelor cu rezultat incert.

Rolloutul folosește commitul exact publicat pe GitHub. Politica existentă de rollout automat rămâne pe `main`; această publicare nu a efectuat merge. Înainte de un rollout ulterior din `main`, trebuie integrate schimbările Jarvis în sursa respectivă.

## Infrastructură și configurare

- Regulile din `src/firestore.rules` au fost compilate și publicate cu succes.
- Indexurile din `firestore.indexes.json` au fost publicate; indexurile pentru căutarea anunțurilor, joburile Jarvis și telemetrie au fost verificate `READY`.
- Secretul `AI_ASSISTANT_WORKER_SECRET`, versiunea 1, a fost creat și acordat backendului App Hosting și funcției programate. Valorile secrete nu sunt incluse în repository sau raport.
- Cheia OpenAI existentă în Secret Manager corespunde cheii din `.env.local`; nu a fost necesară rotația. Bindingul Cloud Run folosește `OPENAI_API_KEY`, versiunea 1.
- Modelul implicit configurat în runtime: `gpt-6-luna`; routerul permite numai `gpt-6.1-sol` pentru escaladările justificate.
- Funcția `aiAssistantAutomationsDrain` este `ACTIVE`.
- Jobul `firebase-schedule-aiAssistantAutomationsDrain-us-central1` este `ENABLED`, rulează la fiecare 5 minute și a executat cu succes traseul Functions → API worker → Firestore heartbeat. `lastSuccessAt` verificat: `2026-10-04T19:52:09.194Z`.

## Backfill

Dry-runul inițial a verificat 184.771 de anunțuri. Primul backfill a verificat 184.778 și a actualizat 184.710; restul aveau deja proiecția curentă, inclusiv anunțuri procesate de noua versiune în timpul rulării. Nu au existat conflicte de scriere.

Reconcilierea după rollout a verificat **184.780** de anunțuri și a corectat unul rămas neindexat în timpul migrării. Scrierile au folosit precondiția `updateTime` și au modificat exclusiv `searchVersion`, `searchCurrency`, `searchPrice`, `searchLocation` și `priceValue`, calculate cu funcțiile existente din `search-index.ts`.

Acoperirea finală verificată separat prin agregări Firestore: **184.780 total, 184.780 indexate, 0 neindexate**. Indexul folosește datele live; anunțurile noi ingestate de noua versiune primesc proiecția în aceeași scriere. Apariția unui anunț pe un portal extern depinde în continuare de ingestie și publicarea sa în corpusul eligibil.

## Probe live

| Probă | Rezultat |
| --- | --- |
| Pagina `/ai-assistant` | HTTP 200 |
| API workspace fără autentificare | HTTP 401 |
| API metrics fără autentificare | HTTP 401 |
| API worker cu secretul serverului | HTTP 200, fără joburi restante la verificare |
| Scheduler declanșat explicit | Execuție reușită și heartbeat actualizat |

Aplicația desktop încarcă backendul App Hosting de producție; nu este necesar un installer nou pentru această schimbare.

Aceste probe confirmă publicarea și infrastructura. Nu au fost create comenzi CRM în numele unui agent și nu au fost trimise mesaje sau publicate campanii de test. Aprobările și limitele conturilor Meta, WhatsApp, TikTok și portaluri rămân cele existente; deployul nu schimbă modul WhatsApp `test` și nu activează MCP fără configurație explicită.

Verificările locale anterioare rămân în [TESTING.md](TESTING.md). Mențiunile despre lipsa deployului din raportul implementării descriu etapa locală, anterioară acestei publicări.

## 2026-10-18 — semantic recovery release, verified 11:31 UTC

Production now serves `build-20261018-jarvis-174` at commit `0a54c5b30bffd392371a0819d3b20f21d0964902`, READY, 100% traffic in both App Hosting and Cloud Run. Evidence: `RELEASE_2026_10_18_SEMANTIC.json`. This supersedes the production version recorded above.

Includes all 14 unpublished commits through `781fcda4`, plus a build-only `NODE_OPTIONS=--max-old-space-size=4096` correction. Build 173 failed on the default Node heap during TypeScript checking; build 174 passed TypeScript, all 227 pages, packaging and deployment. Runtime allocation and Jev mode (`off`) remain unchanged. No rules, indexes, functions or data migration changed in this release. Source branch: `codex/jarvis-semantic-20261018`; deployment pins the exact commit without changing the auto-rollout branch.

Read-only production probes: `/ai-assistant` 200; `/api/ai-assistant/workspace` and `/api/ai-assistant/metrics` 401 without authentication. No live outbound test messages/posts were sent. These probes do not certify arbitrary-phrase task completion; authenticated user acceptance remains pending. Latest application lot previously passed 198 local checks.

Rollback: create a new App Hosting rollout for existing READY build `projects/studio-652232171-42fb6/locations/us-central1/backends/studio/builds/build-20261018-jarvis-171` (commit `0182bc7eeed3dcb20f322584b6a966cde2b7c5e0`), then verify every traffic split and Cloud Run allocation returns to that build at 100%. Use a fresh rollout ID. No database rollback, deletion or replay is required. Do not replay uncertain external effects. Historical request checkpoints may be version-incompatible; use a fresh conversation for initial acceptance testing.

## 2026-10-18 — Facebook names and conversational clarification release

Verified at 12:17 UTC: `build-20261018-jarvis-175`, commit `2ef242c1f30c4e43985e889261be1ec6453e99de`, READY and 100% traffic in App Hosting and Cloud Run. Evidence: `RELEASE_2026_10_18_FACEBOOK_NAMES.json`. Supersedes build 174. Includes account-name resolution, property clarification candidates, preserved pending context, and explicit conversational questions. Jev remains off.

Cloud build and all publishing stages passed. Local checks: 206 tests, ESLint and full build passed. Read-only live probes: Jarvis page 200; unauthenticated workspace/metrics 401. No external test posts or messages; live arbitrary-language completion is not certified by these probes.

Rollback: create a fresh App Hosting rollout for `projects/studio-652232171-42fb6/locations/us-central1/backends/studio/builds/build-20261018-jarvis-174` (commit `0a54c5b30bffd392371a0819d3b20f21d0964902`), then verify all traffic splits and Cloud Run allocations at 100%. No database migration or data rollback is required. No auto-rollout branch change.

## 2026-10-18 — conversational voice explanations

Verified 14:30 UTC: build-20261018-jarvis-176, commit 442ee76e31d62d87dbc88b393c150897622a23b2, READY and 100% traffic in App Hosting and Cloud Run. Evidence: RELEASE_2026_10_18_VOICE_EXPLANATIONS.json. Supersedes build 175. Keeps server explanations instead of replacing them with first-card counts; includes named Facebook execution receipts and expanded speech limits. Jev stays off.

Firebase build passed. Local functional checks: 128 passed; production-source TypeScript passed. Existing fixture typing limitations remain documented in the implementation report. Live availability: Jarvis page 200, anonymous workspace/metrics 401. No paid speech or live CRM posting test performed.

Rollback: create a fresh App Hosting rollout for projects/studio-652232171-42fb6/locations/us-central1/backends/studio/builds/build-20261018-jarvis-175, commit 2ef242c1f30c4e43985e889261be1ec6453e99de. Verify every traffic split and Cloud Run allocation returns to 100%. No database migration, data deletion or operation replay is needed. Auto-rollout branch unchanged.
