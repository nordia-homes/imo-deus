# TikTok Ads — raport tehnic de implementare și production readiness

Data evaluării: 14–15 septembrie 2026  
Scope: integrarea plătită TikTok for Business pentru Imodeus; publicarea organică TikTok rămâne în afara acestui scope.

## Verdict executiv

Integrarea TikTok Ads a fost înlocuită cu un boundary MCP oficial, multi-tenant și fail-closed. Workflow-ul critic este implementat astfel:

`asset video Imodeus deținut de tenant → advertiser autorizat → identitate TikTok verificată → upload advertising → Spark Ad cu Only show as ads`

Acest traseu nu importă integrarea organică, nu apelează Content Posting API și nu conține `video.publish`. Toate creările de campaign/ad group/ad, inclusiv pașii interni ai workflow-urilor Spark, sunt forțate inițial în starea `DISABLE`; activarea, resume, schimbarea de buget/bid și extinderea programului cer o autorizație umană exactă, single-use, și sunt blocate global implicit prin `TIKTOK_SPEND_MUTATIONS_ENABLED=false`.

Codul și infrastructura Imodeus sunt pregătite pentru validarea tenantului real, dar verdictul operațional rămâne **NO-GO pentru trafic real** până la discovery MCP cu OAuth real și validarea manuală Nordia fără spend. Secretele, regulile/indexurile/TTL, testele Firestore Rules, rollout-ul App Hosting și scheduler-ul shared sunt închise. Nicio mutație TikTok live și niciun spend nu au fost executate în această implementare.

## Existing implementation

Repository-ul avea deja:

- Next.js App Router, Firebase Admin/Firestore, autentificare și roluri de agenție;
- `agencies/{organizationId}` ca rădăcină tenant-scoped;
- TikTok Studio și un modul separat de organic posting;
- un client TikTok Ads v1.3 minimal, cu OAuth static, token doar parțial gestionat și selectarea implicită a primului advertiser;
- feature card și rutele connect/status/callback;
- infrastructură existentă pentru Firebase App Hosting, Firestore Rules/indexes și FFmpeg.

Au fost reutilizate autentificarea organizației, modelul de roluri, colecția `tiktokStudioAssets`, Firebase Admin, App Hosting și FFmpeg. Modulul organic nu a fost modificat și nu este folosit de provider-ul Ads.

## Capability Matrix

Matricea statică este numai clasificarea de bază. Pentru fiecare organizație, disponibilitatea efectivă se recalculează după OAuth din tool discovery și schema discovery MCP; `available` nu înseamnă automat `executionAllowed`.

| Capability | Clasificare | Clasă operație | Observație de execuție |
|---|---|---:|---|
| Advertiser discovery | `MCP_NATIVE` | READ_ONLY | discovery + reconciliere acces eliminat |
| Advertiser provisioning | `EXTERNAL_APPROVAL_REQUIRED` | NON_FINANCIAL_WRITE | boundary implementat; necesită tool runtime și rol Business Center Admin/permisiunile TikTok aferente |
| Advertiser status | `MCP_NATIVE` | READ_ONLY | approved/review/rejected/suspended/disabled |
| Billing readiness | `MCP_NATIVE` | READ_ONLY | numai stare explicită; fără date PCI |
| TikTok account authorization | `MCP_NATIVE` | NON_FINANCIAL_WRITE | authorization/link boundary |
| TikTok permission discovery | `MCP_NATIVE` | READ_ONLY | contract explicit, fără inferență optimistă |
| Permission reconciliation | `MCP_NATIVE` | READ_ONLY | workflow compus și freshness de 15 minute pentru operații sensibile |
| Asset/post discovery | `MCP_NATIVE` | READ_ONLY | înregistrează ownership local |
| Spark Ad — existing post | `MCP_NATIVE` | SPEND_AFFECTING | cere Deliver ads + Existing posts |
| New video — Only show as ads | `MCP_NATIVE` | SPEND_AFFECTING | cere Deliver ads + Publish/manage new videos + Only show as ads |
| Creative/video upload | `MCP_NATIVE` | NON_FINANCIAL_WRITE | mapping/deduplicare + validare media |
| Campaign read/create/update | `MCP_NATIVE` | READ_ONLY / NON_FINANCIAL_WRITE | create forțat `DISABLE` |
| Campaign activate/pause/resume | `MCP_NATIVE` | SPEND_AFFECTING / NON_FINANCIAL_WRITE | status impus server-side |
| Ad group read/create/update | `MCP_NATIVE` | READ_ONLY / NON_FINANCIAL_WRITE | create forțat `DISABLE` |
| Ad group pause/resume | `MCP_NATIVE` | NON_FINANCIAL_WRITE / SPEND_AFFECTING | status impus server-side |
| Ad read/create/update | `MCP_NATIVE` | READ_ONLY / NON_FINANCIAL_WRITE | create forțat `DISABLE` în operația standard |
| Ad pause/resume | `MCP_NATIVE` | NON_FINANCIAL_WRITE / SPEND_AFFECTING | status impus server-side |
| Ad review/rejection | `MCP_NATIVE` | READ_ONLY | sync de stare și motive expuse de tool |
| Targeting read/update | `MCP_NATIVE` | READ_ONLY / NON_FINANCIAL_WRITE | numai schema TikTok descoperită; IDOR pe audience IDs |
| Budget update | `MCP_NATIVE` | SPEND_AFFECTING | decimal exact, currency/precision, change safeguard |
| Bid update | `MCP_NATIVE` | SPEND_AFFECTING | policy separată, fără bypass prin update generic |
| Schedule update | `MCP_NATIVE` | SPEND_AFFECTING | timezone advertiser + confirmare pentru extensie |
| Reporting | `MCP_NATIVE` | READ_ONLY | paginare, snapshot-uri tenant/property |
| Instant Form library/read | `MCP_NATIVE` | READ_ONLY | form libraries și fields |
| Instant Form create | `CURRENTLY_UNSUPPORTED` | NON_FINANCIAL_WRITE | catalogul oficial curent nu expune creare server-side utilizabilă; fără workaround |
| Lead retrieval | `MCP_NATIVE` | READ_ONLY | dedupe, PII criptat, export/delete admin |
| Ad-account event subscription | `MCP_NATIVE` | NON_FINANCIAL_WRITE | provider-ul oferă Subscription API, dar execuția este blocată local până la validarea autentificării callback; polling activ |
| Account review/status | `MCP_NATIVE` | READ_ONLY | review/verification sync |

Nu a fost identificată în scope o operație necesară care să ceară `BUSINESS_API_REQUIRED`; dublarea aceleiași mutații prin MCP și REST a fost eliminată.

## Official TikTok findings

- TikTok publică serverul oficial TikTok for Business MCP și recomandă varianta progressive disclosure pentru setul mare de tool-uri: [MCP overview](https://ads.tiktok.com/resources/help/article/about-tiktok-for-business-mcp-server?lang=en-GB), [MCP documentation](https://business-api.tiktok.com/portal/docs/tiktok-ads-mcp-server/v1.3).
- Metadata live a resource server-ului declară OAuth authorization-code + refresh, PKCE `S256`, dynamic client registration și scope-ul `mcp:tt4b` pentru `https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer`.
- Catalogul oficial curent expune tool-uri pentru advertisers, Business Center assets, campaigns, ad groups, ads, identities, videos, reports, form libraries/fields, leads și subscriptions: [official tool catalog](https://business-api.tiktok.com/portal/docs/available-tools-in-tiktok-for-business-mcp-server/v1.3), [API endpoint catalog](https://business-api.tiktok.com/gateway/docs/index?doc_id=1735713875563521&identify_key=c0138ffadd90a955c1f0670a56fe348d1d40680b3c89461e09f78ed26785164b&language=ENGLISH).
- TikTok descrie `Only show as ads` ca paid traffic fără apariție organică și separă permisiunile Existing posts de Publish and manage new videos: [account permission documentation](https://ads.tiktok.com/resources/help/article/how-to-edit-tiktok-account-permissions-as-ad-delivery-assets-in-bc?lang=lv-LV).
- Specificațiile creative curente pentru Non-Spark sunt MP4/MOV/MPEG/3GP/AVI, maximum 500 MB, maximum 10 minute, minimum 516 kbps și dimensiunile/aspectele documentate: [TikTok Auction In-Feed Ads](https://ads.tiktok.com/resources/help/article/tiktok-auction-in-feed-ads?Tag=Page%2520Titles&redirected=2).
- Un Business Center verificat permite unui admin să creeze sau să solicite acces la advertiser accounts, iar stările oficiale includ Approved, Not approved, In review, Suspended, Contract not effective și Disabled: [ad account management](https://ads.tiktok.com/resources/help/article/manage-ad-accounts-business-center).

## Architecture

`TikTokAdsPort` este contractul application/domain. `TikTokMcpAdapter` este singurul adapter de transport pentru capabilities executabile. Fațada `src/lib/tiktok-ads.ts` ascunde tokenurile și transportul față de rute și UI.

Module:

- `types.ts`: registry, port și contracte;
- `capabilities.ts`: classification, matching semantic, compoziție și schema hashes;
- `oauth.ts` / `crypto.ts`: authorization lifecycle și secret storage;
- `mcp-client.ts`: Streamable HTTP JSON-RPC, discovery, validare, paginare și retries;
- `mcp-adapter.ts`: policy enforcement, ownership, workflows și post-processing;
- `policy.ts`: roluri, money/spend, kill switches și guards;
- `store.ts`: persistence tenant-scoped, ledger, audit, reports și leads;
- `media-security.ts`: SSRF și validare tehnică video;
- `jobs.ts`: coadă shared pentru sync-uri read-only.

## Multi-tenancy și IDOR

Conexiunea privată și toate referințele provider sunt legate de `organizationId`. Advertiserul este încărcat numai din subcolecția organizației. Orice campaign/ad group/ad/creative/video/identity/post/form/audience ID venit din client este verificat prin `tiktokResourceReferences` înainte de call. Cheia de ownership include advertiserul, tipul și ID-ul resursei, deci aceeași identitate poate fi autorizată la mai mulți advertiseri ai aceluiași tenant fără coliziuni; referințele legacy sunt migrate lazy numai după verificarea advertiserului. Payload-ul advertiserului este suprascris cu valoarea trusted din server, inclusiv când schema îl plasează în obiecte/array-uri nested. Căile de schemă ambigue sunt respinse.

Rutele verifică bearer token, rolul și tenantul proprietății. Firestore Rules refuză accesul client la colecțiile server-managed TikTok și la colecțiile globale de OAuth/client registration/jobs.

## Authentication

Implementarea descoperă Protected Resource Metadata și OAuth Authorization Server Metadata, validează hosturile oficiale și contractul PKCE, înregistrează clientul MCP dinamic, generează state și verifier criptografic și folosește cookie HttpOnly/Secure/SameSite=Lax cu browser binding.

State-ul este tenant/user-bound, expiră în 10 minute și este consumat tranzacțional înainte de token exchange. Callback replay, state tampering, open redirect și connection hijacking sunt respinse. Access/refresh tokens sunt criptate exclusiv server-side cu AES-256-GCM; cheia obligatorie este purpose-separated prin HKDF și suportă rotație/legacy decrypt. Refresh-ul concurent folosește lease tranzacțional. Disconnect încearcă revoke pentru ambele token classes și elimină local secretul chiar dacă provider-ul nu răspunde.

## MCP

Clientul implementează `initialize`, notification, session ID, JSON și SSE, `tools/list`, progressive discovery pe domenii și `tools/call`. Discovery rulează în maximum opt interogări de domeniu și cache-uiește schema/capabilities șase ore per tenant; nu încarcă toate schemele la fiecare request.

AJV 2020 validează input și output complet. Tool name-ul nu este presupus stabil: matching-ul este semantic și ambiguitatea blochează capability-ul. Pentru writes, hash-ul schemei aprobat persistă; un drift ulterior dezactivează operația până la code review. Read-urile au retry limitat (maximum trei, Retry-After, exponential backoff și jitter); write-urile nu sunt retrimise automat când rezultatul remote poate fi necunoscut. Răspunsurile JSON/SSE sunt citite streaming cu limită implicită de 10 MiB, iar evenimentele SSE multi-line sunt reasamblate conform contractului.

## TikTok account permissions

Sunt persistate account ID, username, advertiser mapping, granted/revoked timestamps, patru permisiuni explicite și verification state. Un răspuns incomplet nu devine implicit „authorized”. Absența contului într-o reconciliere țintită îl marchează revoked. Ads-only și Existing Post cer verificare fresh (maximum 15 minute).

## Advertisers

Discovery-ul suportă zero, unul sau mai multe advertiser accounts; selectarea automată are loc numai când există exact unul. Sunt urmărite currency, currency precision, timezone, access/status/review/billing și version. Un advertiser dispărut la reconciliation este marcat `removed_access`. Writes cer o stare pozitivă approved/active, sunt respinse fail-closed pentru stări necunoscute/review/rejected/suspended/disabled/removed, verifică opțional `expectedVersion`, iar spend-ul cere billing explicit `ready`.

## Existing Posts

Asset discovery înregistrează identity/post ownership. `SPARK_EXISTING_POST` cere un `tiktok_item_id` descoperit, identitatea server-bound și permisiunile fresh Deliver ads + Existing posts. Crearea este ledgered, idempotentă și spend-gated.

## New Video Ads Only

Workflow-ul cere un `tiktokStudioAssets/{mediaAssetId}` ready, de tip video și aparținând organizației. URL-ul client nu poate înlocui URL-ul asset-ului. Mapping-ul `(advertiser, Imodeus asset) → TikTok video` evită duplicate uploads.

Înainte de upload sunt validate HTTPS, host allowlist, credentials/ports, DNS public, fiecare redirect, MIME, extensie, content length și maximum 500 MB. FFmpeg decodează server-side primul frame și validează durata, rezoluția/aspectul și bitrate-ul. Campaign/ad group/video/ad IDs sunt salvate după fiecare pas. Identitatea și video ID sunt injectate numai de server. `adsOnly` trebuie să fie exact `true`; orice indiciu de organic/profile/video.publish este respins.

## Campaigns, Ad Groups și Ads

Registry-ul acoperă read/create/update/status pentru toate cele trei nivele, fără a hardcoda un singur objective. Compatibilitatea obiectiv/settings este delegată schemei runtime TikTok. Generic update nu poate transporta budget, bid, schedule sau status și nu poate ocoli capability policy. Review state și rejection reason sunt citite prin capability dedicat.

## Creative și targeting

Creative upload este separat de organic publishing, validat tehnic și deduplicat. Targeting-ul nu inventează enumerări locale: country/region/city/interests/behaviors/devices/audiences/exclusions/placements sunt permise numai când apar în schema tool-ului curent. Audience IDs sunt tenant-owned.

## Leads și GDPR/PII

Form libraries și fields sunt read-only. Crearea unui Instant Form este `CURRENTLY_UNSUPPORTED` deoarece catalogul oficial curent nu expune operația server-side. Lead retrieval este implementat prin MCP, paginat și deduplicat prin `(advertiserId, remoteLeadId)` hash. Reingestia unui duplicat nu prelungește artificial perioada de retenție: `ingestedAt` și `expiresAt` inițiale sunt păstrate.

Payload-ul PII este criptat cu o cheie derivată separată; metadata păstrează numai identificatorii necesari atribuirii. Numele, emailul, telefonul, answers și raw payload nu intră în log/telemetry/audit. Exportul și ștergerea sunt admin-only; retenția implicită este 365 zile și are TTL.

## Reporting și property attribution

Reporting persistă numai metrici allowlisted, ca string-uri precise, cu date range/paginare oferite de schema provider și timezone-ul advertiserului. Snapshot-urile sunt atribuite la property prin campaign/ad group/ad references, cu lookup-uri batch și writes batch. Sunt disponibile spend, impressions, reach, clicks, CTR, CPC, CPM, conversions, leads/CPL/CPA, video views și engagement atunci când provider-ul le returnează.

Imodeus este source of truth pentru `propertyId`; TikTok rămâne source of truth pentru resurse și metrici. Endpoint-ul de property reporting este tenant-scoped.

## AI integration și prompt injection

Application layer și AI folosesc capability IDs, nu raw MCP tools. AI poate face READ_ONLY, dar nu poate face writes. Toate writes cer admin; spend cere actor uman și authorization token exact. Conținutul extern este tratat ca date și nu poate selecta tool-uri sau modifica policy/IDs.

## Money safety

Banii sunt acceptați numai ca string decimal sau integer; valorile JavaScript floating point sunt respinse. Currency și precision vin din advertiser. Conversia în minor units verifică precizia și safe integer range. Minimum/maximum sunt validate și de schema runtime. O schimbare semnificativă (implicit 25%) cere flag explicit, iar schedule extension cere previous end și timezone.

Kill switches sunt independente pentru reads, writes și spend. Spend este off implicit. Autorizația spend este exact-intent, single-use, expiră în 10 minute și este consumată tranzacțional. Lock-urile distribuite de șase minute serializează mutațiile concurente pe resursă inclusiv între capabilities diferite; eliberarea verifică owner-ul lease-ului, astfel încât un worker vechi nu poate șterge lock-ul unuia nou.

## Operation ledger și partial failure

Fiecare write are intent hash, actor, advertiser/property, idempotency key, current step, IDs create, rezultat și recovery state. Workflow-ul ads-only persistă campaign → ad group → video → ad. Un timeout/write cu rezultat necunoscut devine `pending_recovery` și nu este retrimis automat. Recovery poate atașa numai resurse deja descoperite și verificate ca owned.

## Background processing, rate limits și scalabilitate

Există o singură coadă `tiktokAdsJobs`, nu worker/cron per tenant. Joburile automate sunt strict read-only, deduplicate per org/capability/advertiser/property, au leases, maximum cinci încercări, backoff/jitter și limită de 100 per drain. Selecția face o primă trecere tenant-fair. Concurența TikTok este limitată distribuit per tenant (implicit patru).

La conectare se programează advertiser discovery și capability discovery recurente; adminul poate programa permission/status/report/lead reads. Scriptul `scripts/configure-tiktok-ads-scheduler.ps1` configurează un singur Cloud Scheduler shared. Jobul `tiktok-ads-shared-worker` este deployat în `us-central1`, activ, rulează o dată pe minut, are zero retry automat și a trecut validarea production: endpoint 200, coadă goală și primul attempt programat fără eroare.

## Database

Schimbările sunt additive și fără destructive migration. Datele provider sunt subcolecții server-managed ale agenției; OAuth states, MCP client registration și job queue sunt colecții private globale. Au fost adăugate indexuri pentru advertisers, operation recovery, reports și queue, plus TTL pentru OAuth state, authorization, audit, tool schemas, leads, ledger și jobs.

În Firestore nu există foreign keys/RLS SQL; echivalentul este compus din paths tenant-scoped, server-only rules, referințe validate în domain/provider layer și verificări de ownership. Regulile au fost validate și într-un emulator Firestore real, pe un proiect local `demo-*`, folosind un JRE temporar: accesul cross-tenant și accesul client la toate colecțiile TikTok server-managed au fost respinse. Regulile, indexurile compuse și TTL-urile TikTok au fost apoi deployate cu succes în proiectul Firebase configurat.

## Security review

Verificate în cod și teste: OAuth CSRF/PKCE/state/replay/open redirect/browser binding; token encryption și rotație; secret/redaction; client bundle isolation; tenant/advertiser/resource ownership; IDOR; SSRF/redirect/DNS/private IP; media content validation; prototype pollution; raw-tool injection; AI/spend bypass; currency/precision; idempotency/concurrency/unknown remote outcome; PII logging; schema drift.

Subscription API este detectat, dar `EVENT_SUBSCRIBE.executionAllowed=false`: nu există receiver neverificat. Până la un contract oficial de callback authentication verificabil end-to-end, sync-ul folosește polling.

## Observability

MCP emite loguri JSON redacted cu method, outcome, error code, latency și correlation ID. Auditul reține actor/tenant/operation/target/outcome fără payload/token/PII. Capability/schema mismatch, rate limit, refresh, reconciliation și job failures au coduri distincte; joburile și reporting state permit măsurarea lag-ului.

## Tests și verificări

Rezultatele deterministe ale ultimei rulări:

- `npm run test:tiktok-ads -- --reporter=verbose`: **33/33 teste, 5/5 fișiere, PASS**;
- `npm run typecheck:tiktok-ads`: **PASS**;
- `npx tsc --noEmit --incremental false --pretty false`: **PASS pentru întregul repository**;
- `npm run lint:tiktok-ads`: **PASS, zero warnings**;
- `npm run lint`: **PASS, zero errors**; raportează separat 258 warnings legacy ale aplicației;
- `npm run test:tiktok-ads:rules`: **4/4 teste Firestore Rules în emulator, PASS**;
- `npx next build --webpack` cu `NODE_ENV=production`: **PASS**, inclusiv TypeScript și 187/187 pagini generate;
- Firebase App Hosting rollout pentru commitul verificat: **PASS**;
- `git diff --check`: **PASS**;
- JSON parse pentru `firestore.indexes.json`: **PASS**.

Suitele acoperă OAuth valid/invalid/expired/replay/exchange/refresh/concurrent refresh/revoke și host pinning, capability discovery/drift, MCP pagination/SSE/malformed/oversize/auth/rate/timeout/no write retry, ads-only fără organic și create forțat `DISABLE`, advertiser/permission fail-closed, roluri/kill switches/money/bypass, SSRF, FFmpeg metadata, AES-GCM/rotație, AJV, prototype pollution, idempotency, recovery și lock-uri owner-safe, plus server-only rules. Testele nu folosesc spend și nu apelează TikTok live.

Separarea este explicită:

- deterministic automated: rulate local;
- Firestore Rules integration: rulat local în emulator, 4/4 PASS; de păstrat ca gate în CI;
- external MCP sandbox/real OAuth: de rulat după configurarea secretelor;
- Nordia production validation: manual-gated și cu spend switch off.

Build-ul webpack de producție este verde, fără `ignoreBuildErrors`: compilarea, verificarea TypeScript, generarea celor 187 de pagini și build traces au trecut. Pentru a închide această poartă au fost corectate punctual erorile TypeScript legacy găsite de build (null guards, tipuri readonly/select, contracte de componente și utilitare temporare excluse din produs), fără relaxarea modului `strict`.

## Repository rollout blockers

- Testul Firestore Rules este implementat și verde local. Workflow-ul `.github/workflows/tiktok-ads-production.yml` furnizează Java 21 și rulează testele deterministe, emulatorul, lint-ul strict, typecheck-ul global și build-ul de producție la schimbările relevante.
- Warning-ul webpack pentru peer-ul opțional `@opentelemetry/exporter-jaeger` și cele două warnings Tailwind existente nu blochează build-ul, dar trebuie evaluate de ownerii modulelor respective.

## External blockers TikTok

1. `ADVERTISER_PROVISION`: tool-ul oficial poate exista în runtime, dar executarea cere context/rol Business Center Admin și permisiunile acordate de TikTok aplicației/userului. Boundary-ul este implementat și fail-closed.
2. `LEAD_FORM_CREATE`: nu există operație oficială server-side în catalogul MCP/API curent folosit; capability-ul este unsupported, fără workaround.
3. `EVENT_SUBSCRIBE`: endpoint-ul oficial există, dar abonarea rămâne dezactivată până când contractul oficial de autentificare a callback-ului poate fi validat și testat; reconcilierea prin polling acoperă funcțional operațiile curente.

## Checklist de rollout / Production readiness

Înainte de GO live:

1. **Închis:** Secret Manager conține valori independente, aleatorii, de 48 de octeți pentru `TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY` și `TIKTOK_ADS_WORKER_SECRET`; backend-ul App Hosting are acces IAM;
2. **Închis:** Firestore Rules, indexes și TTL configuration sunt deployate, iar rollout-ul App Hosting cu configurația actuală a trecut;
3. **Închis local și în Cloud Build:** typecheck-ul și build-ul de producție sunt verzi; workflow-ul dedicat trebuie păstrat obligatoriu după merge;
4. păstrați workflow-ul TikTok Ads obligatoriu în branch protection; el configurează Java 21 și rulează `npm run test:tiktok-ads:rules`;
5. **Închis:** shared scheduler este activ și validat end-to-end cu workerul production;
6. conectați manual un admin Imodeus la MCP și validați matricea/schema runtime pentru tenantul Nordia;
7. validați fără spend: advertiser/status/billing, identity permissions, asset discovery, campaign/ad group/ad drafts disabled, review, reports/leads și audit/reconciliation;
8. validați manual un video nou cu `Only show as ads`, păstrând campaign/ad group/ad disabled și confirmând că nu apare organic;
9. activați `TIKTOK_SPEND_MUTATIONS_ENABLED=true` numai prin change control separat, după aprobarea explicită a business ownerului.

Până la pașii manuali 6–8 verdictul este **NO-GO pentru trafic/spend real**, nu fake production success. După OAuth/discovery și validarea Nordia fără spend, arhitectura poate primi GO fără schimbarea boundary-ului sau a modelului multi-tenant; pasul 9 rămâne change control separat.
