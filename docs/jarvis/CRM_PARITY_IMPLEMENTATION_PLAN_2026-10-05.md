# Jarvis — plan de implementare pentru paritate completă cu CRM

Data: 5 octombrie 2026. Stare: implementare etapizată în curs. Documentul definește criteriile de acceptare; o înregistrare în catalog nu certifică verificarea funcțională completă.

Referințe: [audit complet](./CRM_PARITY_AUDIT_2026-10-05.md), [inventar static](./CRM_PARITY_INVENTORY_2026-10-05.json).

## Rezultatul urmărit

Agentul cere o operație în limbaj natural, iar Jarvis identifică datele autorizate, clarifică numai ambiguitățile relevante, construiește pașii, cere confirmarea potrivită și execută prin aceleași servicii ca interfața manuală. Rezultatul arată ce s-a modificat, ce este încă în procesare și ce a fost confirmat de furnizor. Text și Voice au aceeași acoperire.

„Toate acțiunile” înseamnă toate operațiile de business accesibile utilizatorului în modulele CRM montate în aplicație, inclusiv câmpuri, fișiere, exporturi și operații în lot. Clickurile fără efect de business, endpoint-urile interne, webhook-urile și administrarea platformei din afara drepturilor utilizatorului nu sunt acțiuni suplimentare ale agentului.

„Toate datele” înseamnă datele și evenimentele autorizate, interogabile la cerere, cu proveniență și actualitate. Modelul nu primește integral baza de date și nu primește credențiale. OAuth, plata și confirmarea umană a acordului sunt pași integrați în flux, cu reluare după finalizare.

## Audit al soluției propuse: corecții de arhitectură

| Abordare incompletă | Soluția de implementat |
|---|---|
| Un tool pentru fiecare URL, apoi declarăm proiectul complet | Catalog de capabilități de business; acoperire per operație și câmp manual, inclusiv scrieri client și comportamente catch-all |
| Dublăm validările în actions.ts și componente | Servicii comune de domeniu cu schemă, autorizare, concurență și efecte secundare; manual și AI apelează același serviciu |
| Dăm AI acces generic la orice colecție sau endpoint | Unelte semantice înregistrate explicit, politici pe entitate și câmp, proiecții autorizate și contracte versionate |
| Încărcăm toate datele în prompt ca să știe tot | Catalog de date + căutare, query-uri, relații și timeline; sumar actualizabil și detalii citite la cerere |
| Adăugăm un trigger și promitem cunoaștere instantanee | Evenimente idempotente, outbox/proiecții, monitorizare lag și reconciliere; citire autoritativă înaintea unei decizii sensibile |
| Mărim limita de tokens ca să executăm loturi | Discovery compact, query-uri agregate, planuri persistente și joburi pe pași/entități; buget măsurat și continuation |
| Construim alt sistem de joburi de la zero | Extindem jobs.ts, ledger-ul, worker-ele și cozile de domeniu existente; verificăm semantic și operațional ce lipsește |
| queued/running sau HTTP 200 înseamnă succes | Stări distincte pentru comandă, pas și rezultat de business; verificare provider/job până la rezultat și evidență |
| AI confirmă că proprietarul a dat acord | Buton uman autentificat, disponibil agentului autorizat; scop și dovadă înregistrate; modelul poate doar pregăti solicitarea |
| Toate integrările devin disponibile după deploy | Availability runtime pe actor și entitate: connected, permissions, quota, budget, worker, provider support și handoff necesar |

### Precizări față de auditul inițial

- Atribuirea în aceeași agenție este permisă agenților în fluxurile manuale existente. Eliminăm restricția admin suplimentară a Jarvis pentru contacts/properties/tasks; validăm apartenența și rolul agentului destinatar.

- Există deja `assistantAgentJobs`, coadă per agent, lease, autentificare revalidată și planuri durabile în `src/lib/ai-assistant/jobs.ts`. Lipsa este orchestrarea completă pentru loturi mari, controlul execuției și rezultatul final din domenii externe.
- Un job de plan poate avea `status=completed` împreună cu `planStatus=failed/unknown`. La extindere, UI și API trebuie să distingă „worker-ul a terminat” de „acțiunea a reușit”; nu se afișează succes doar din statusul jobului.
- TikTok Ads are adaptor generic și capabilități runtime. Nu implementăm din nou comenzile care sunt deja suportate în conector; conectăm discovery, aprobările, drafturile, recovery și statusurile lipsă.
- Corecție: OwnerConsentDialog și endpoint-ul /api/ai-assistant/owner-consent există deja în Text și Voice pentru agentul autorizat. B23 urmărește verificarea și completarea fluxului, nu recrearea lui. Confirmarea WhatsApp și schimbarea rolurilor sunt decizii separate. Endpoint-ul uman de acord trebuie să permită agentul autorizat pentru conversația/prospectul lui, fără expunerea unui tool care fabricatează acord.
- Nu există o bază pentru un procent precis de paritate sau un termen calendaristic ferm până când inventarul semantic al operațiilor montate în UI este validat. Numărul de API-uri nu este un denominator valid.

## Contractul comun al unei capabilități

Definiție propusă, implementată incremental lângă `registry.ts`, fără ruperea acțiunilor și adaptoarelor actuale:

| Componentă | Conținut obligatoriu |
|---|---|
| Identitate | ID stabil, versiune, modul, operație, aliasuri românești și exemple |
| Contract | Input/output, câmpuri editabile, tipuri/unități, referințe, validări și erori explicabile |
| Acces | Actor/tenant, rol, ownership/collaboratori, politici pe câmp și revalidare la execuție și citirea rezultatului |
| Eligibilitate | Starea entității, dependențe, conexiune externă, feature flag, worker, quota și motivul indisponibilității |
| Execuție | Handler comun, expectedVersion, idempotencyKey, lock, efecte secundare și job/provider correlation |
| Confirmare | Politica de risc existentă, diferența înainte/după, destinatari, cost/plafon când se aplică, handoff uman |
| Rezultat | Stare de business, entități afectate, provenance, timestamps, completitudine, erori și pași următori |
| Prezentare | Card/view-model și acțiuni permise în context |
| Dovadă | Buton/flux manual sursă, serviciu comun și teste de paritate/acceptare |

Registry-ul existent rămâne compatibil; capabilitățile noi sunt migrate pe rând. Adapterul AI este subțire: nu copiază algoritmul de matching, logica providerului sau regulile de vânzare.

Stări de availability: `available`, `needs_input`, `needs_human_step`, `needs_connection`, `blocked_by_role`, `blocked_by_state`, `blocked_by_budget`, `provider_unsupported`, `not_implemented`. Motivele nu expun secrete.

## Etape, dependențe și condiții de închidere

### E0 — Inventar semantic și contract de paritate

**Dependențe:** niciuna. **Prioritate:** P0 pentru completitudinea proiectului.

1. Urmărim paginile montate, componentele folosite, butoanele, meniurile, formularele, wrappers NonBlocking, hook-urile, rutele dinamice și helper-ele desktop.
2. Fiecare operație primește ID, roluri, câmpuri, serviciu existent, tool actual, lacună, efecte, handoff și test. Rutele interne/publice sunt clasificate explicit.
3. Generăm un manifest de paritate și verificare CI pentru capabilități neînregistrate/contracte învechite. Nu pretindem că analiza statică dovedește montarea sau funcționarea; verificăm fluxurile reale separat.
4. Capturăm baseline de funcționare și latență pentru comenzi simple, citire, plan, write și provider. Inventariem deployment flags și readiness fără valori de secret.

**Închidere:** toate modulele auditului au operații/câmpuri clasificate, iar fiecare lacună este legată de un element al backlogului. Orice funcție nouă din UI trebuie să declare echivalentul AI sau handoff-ul.

### E1 — Fundament comun: servicii, drepturi și execuție

**Dependențe:** E0. **Prioritate:** P0/P1.

- Migrare incrementală a scrierilor manuale spre servicii server comune; începem cu contacte, proprietăți, calendar și dosare. Păstrăm numele tool-urilor existente prin adaptoare de compatibilitate.
- Unificăm activare/status/rezervare/vânzare/retragere: precondiții, motive, istoric, disponibilitate și sincronizarea portalurilor. Nu ștergem documente direct ca substitut pentru lifecycle.
- Calendar comun pentru toate căile de creare/update, lock per resursă/interval unde este necesar, expectedVersion și revalidarea intervalului. Migrare și din dashboard, property detail, lead detail și dialogs, nu numai pagina Viewings.
- Politici comune pe actor și entitate; aliniem GET TikTok capabilities la drepturile handlerului, păstrând refresh-ul admin.
- Ledger pentru operație/pas și chei de idempotency consistente. Efectele externe necunoscute intră în reconciliere; nu se retrimit automat.
- Înregistrări de business și event/outbox scrise atomic când sunt în aceeași bază; provider-ul nu este apelat în tranzacția Firestore. Pentru servicii externe, corelăm job/receipt și reconciliem separat.

**Închidere:** aceeași operație manuală și AI are aceeași stare finală, validări și evenimente; activarea nu are cale alternativă cu validare mai slabă; concurența manual/AI este testată.

### E2 — Paritate pentru operațiile zilnice de CRM

**Dependențe:** E1. **Prioritate:** P1.

- Contacte/preferințe/sursă/atribuire: toate câmpurile existente, duplicate, inițializare din buget și comportamentul archiving/unarchive.
- Oferte: create/update/status/delete și interacțiuni conform operațiilor manuale constatate în E0. Nu adăugăm operații distructive doar pentru că „ar fi utile”.
- Proprietăți: schema completă a formularului, caracteristici, adresă/geo, tip, tranzacție, imagini prin assets, featured și note; validări canonice/unități identice.
- Vizionări și task-uri: toate câmpurile/relațiile manuale, statusuri, atribuire permisă, conflicte și feedback/reminder ca pași separați.
- Prospectare: preluare, rezervare, colaborare, rezultat negativ/follow-up, note/telefon și ownership; import cu dedup și revizuire înaintea activării.
- Portal client: activate/regenerate/deactivate, recomandări add/remove, feedback și linkuri de preferințe, cu invalidarea accesului vechi unde comportamentul manual o cere.
- Storia lead: listă/status/unread, conversie în contact cu sursă/metadata și evitarea dublurilor; handoff pentru răspunsul extern dacă integrarea îl cere.
- Dosar vânzare: create din proprietate, setup, participanți, etapă și toate acțiunile din UI, folosind serviciile Sales existente.

**Închidere:** comenzile uzuale trec prin servicii comune; niciun câmp manual relevant nu este pierdut de schema AI; matching-ul existent rămâne identic pentru aceleași date.

### E3 — Fișiere, comunicare și rezultate externe

**Dependențe:** E1; obiectele din E2 când operația le referă. **Prioritate:** P1.

- Upload autorizat și selecție fișier/asset în AI Assistant, inclusiv Voice cu alegere vizuală. Modelul primește referințe și metadata, nu pretinde că poate citi un fișier local neatașat.
- Mime/size, path/tenant, acces download, versiune și retenție conforme domeniului. Refolosim media/Storage și uploadurile Sales; fără URL arbitrar folosit drept fișier de încredere.
- RLV, poze, documente Sales, OCR CI, image enhancement și atașamente mesaje; status de procesare, verificare umană a extragerilor și job recovery.
- WhatsApp: selector șablon și parametri, preview, upload/media, sync/link contact; cardul de acord uman, scop/evidență/istoric, agent autorizat, opt-out aplicat înainte de enqueue și înainte de send. Meta test mode și destinatarii eligibili sunt afișați ca disponibilitate runtime.
- Apeluri AI: POST existent de inițiere/programare, setări permise, rezultat/manual review, transcript/audit; restricțiile de încercări/orar/concurență ale outreach rămân în serviciu.
- Gmail: draft și metadata Sales create prin serviciu comun; atașamente, runner desktop sau handoff web și evidență. Nu declarăm email „trimis” când doar s-a deschis compose. Pentru trimitere complet server-side, o integrare Gmail API autorizată este o extindere separată, dacă fluxul manual actual nu o oferă.
- Exporturi PDF/ZIP/CSV, template-uri contracte și contracte generate: autorizare la creare și download, liste/preview/edit/delete conform rolului. Artefactele se servesc prin rute private.
- Adaptăm results din fiecare domeniu: `queued`/`running`/`succeeded`/`failed`/`unknown`/`cancelled`, plus dovezi separate precum message delivered/read și email sendEvidence. HTTP 200 nu stabilește singur rezultatul final.

**Închidere:** un apel, mesaj, email sau upload poate fi urmărit până la dovada disponibilă; dubla execuție și timeout după efect extern sunt tratate corect.

### E4 — Citire completă, timeline și actualitatea datelor

**Dependențe:** catalog E0 și politici E1. Poate avansa în paralel cu E2/E3 în implementarea viitoare. **Prioritate:** P1.

- Catalog explicit pentru toate resursele/subcolecțiile autorizate: CRM, prospectare, portal feedback, apeluri/transcripturi, documente/extrageri, email audit, integrări/assets, campanii/joburi, setări și rapoarte.
- Query-uri semantice pe domenii, count/aggregate la server, relații client–proprietate–vizionare–ofertă–dosar–mesaj, căutare globală și timeline. Indexurile și schema sunt administrate de server; fără query SQL/Firestore arbitrar din model.
- Eveniment canonic propus: tenant, entity/type/id, actor/source, occurredAt/recordedAt, version, changedFields sanitizate, correlationId și access policy. Mesajele private și documentele nu sunt copiate într-un jurnal mai permisiv.
- Outbox/trigger-e idempotente, proiecții și reconciliere. Trigger-ele Firestore pot sosi repetat sau în altă ordine; dedup și versionare obligatorii. Backfill marcat `historical_snapshot`; nu inventăm actorul sau data unui eveniment care nu au fost păstrate.
- Proveniență în rezultat: `source`, `asOf`, `lastVerifiedAt`, `complete`, cursor și lag relevant. Cache validat/invalidat la schimbare; citire live înainte de operații sensibile.
- Index proprietari: verificare tuturor căilor de scriere, corpus revision per scope, cursor legat de criterii/revision și reluare explicită când datele se schimbă. Monitorizăm separately lag scraper/import/index; afișăm prospețimea colectării.
- Matching: păstrăm motorul existent. Seturile referă versiunea criteriilor; la schimbarea preferințelor/statusului anunțăm și recomputăm numai prin serviciul existent, nu păstrăm tacit scoruri vechi.
- Definim metricile Reports/Dashboard în servicii comune, cu aceleași filtre, timezone și definiții ca UI. Indicatorii derivați sunt marcați ca atare; totalurile parțiale nu sunt prezentate ca globale.

**Închidere:** întrebările „ce s-a întâmplat?”, „ce e nou?” și „de ce a eșuat?” au surse concrete; drepturile și revocările sunt respectate și în timeline/index/cache/artifacts.

### E5 — Marketing, portaluri și administrare

**Dependențe:** E1, infrastructura assets/handoff/status E3 și citiri E4. **Prioritate:** P1/P2, dar obligatorie pentru finalizarea parității.

- Portaluri: configuration, link/unlink, promoții, refresh/retry/reconcile și sincronizare după schimbările proprietății. Refolosim handler-ele existente și păstrăm limitările per provider.
- Facebook/Instagram: draft/publish, destinații, comments/replies/like, diagnostic și remove; separat promovarea în grupuri și management joburi/conexiuni/helper local/Cloud.
- Meta Ads: assets, draft edit/delete, ready, publish/pause/status/reporting, upload și plafon de cheltuieli conform serviciului.
- TikTok organic/Studio: draft list/edit/status, unschedule, creator info, brief/script, assets/projects/render/voices. TikTok Ads: workspace/manager, discovery, drafts/publication, spend authorization, status/recovery și capabilities realmente disponibile. Funcția unsupported devine handoff, nu succes simulat.
- Agenți/agenție/profil/domeniu/site branding: toate operațiile expuse rolului din UI; upload și onboarding. Parole/tokenuri nu apar în conversație.
- Notificări: read/unread/read-all, preferințe și push; activarea permisiunii browserului este handoff normal.
- Billing: summary/plan/seats/checkout/portal cu aceeași autorizare; preview al schimbării și handoff la plată.
- Colaborări: catalog/cases/leads/actions, onboarding/team, cu permisiuni și acceptările umane existente.

**Închidere:** fiecare familie de operații manuale are tool sau handoff complet; lipsa aprobării providerului este diferențiată de lipsa implementării CRM.

### E6 — Discovery, planuri mari și automatizări

**Dependențe:** E1; capabilitățile E2–E5 sunt adăugate incremental. **Prioritate:** P1/P2.

- Înlocuim filtrarea exclusiv regex cu discovery semantic pe aliasuri/module/capabilități, filtrat după rol și availability. La ambiguitate se caută în catalog înainte de refuz.
- Resolver entități cu ID-uri verificate, aliasuri și selecție când sunt mai mulți clienți cu același nume; date relative prin resolver-ul Europe/Bucharest existent.
- Catalog/scheme cerute la nevoie, query-uri deterministe pentru întrebări simple și buget urmărit per comandă. Testăm costul/latency, nu rezolvăm toate problemele prin mărirea limitei.
- Extindem jobs.ts cu pași și rezultate persistente, checkpoint, dependencies, pause/cancel, status de business și continuation. Loturile au un manifest de destinatari/entități și plafon; schimbarea materială cere revalidarea aprobării existente.
- Cancel oprește pașii viitori; nu promite retragerea unui mesaj deja trimis. Rollback/compensare numai unde serviciul oferă operație inversă validă.
- Rule engine peste catalog: trigger de eveniment/program, condiții deterministe, acțiuni permise, dedup, ownership, run history, stop-on-reply/opt-out și escaladare. Nu rulăm un model permanent pe fiecare modificare dacă regula poate fi deterministă.
- Păstrăm cele 5 automatizări actuale și migrăm definițiile compatibil. Adăugăm editare, test/preview, history și control complet.

**Închidere:** o solicitare mare nu este trunchiată la 12 pași; execuția este reluabilă, anulabilă și raportată per entitate fără a repeta efecte externe necunoscute.

### E7 — Carduri, validare finală și rollout

**Dependențe:** E1–E6 pentru modulul lansat. **Prioritate:** criteriu obligatoriu de lansare.

- View-model-uri dedicate pentru proprietate/client/vizionare/task/ofertă/dosar/campanie/apel/mesaj/document/job/raport și confirmări/handoff. Cardurile consumă rezultate structurate, nu HTML inventat de model.
- Imagini reale autorizate, preț/localizare/status, motivul potrivirii, provenance, butoane permise și „Vezi potrivirile din CRM” cu aceleași criterii. Fără clienți/activități fictive pe fundal.
- Text și Voice reutilizează aceleași rezultate și acțiuni; vocea spune concis rezultatul real, iar cardul păstrează detaliile. Teste desktop/browser și responsive.
- Contract tests, service tests, concurrency și E2E per capabilitate; rules emulator pornit explicit pentru testele anterior omise. Verificăm furnizorii prin probe controlate și accounts eligibile, nu prin trimitere către destinatari reali fără scop.
- Deploy progresiv pe module/capability versions și feature flags. Indexurile/migrările backward-compatible sunt pregătite înainte de enable; shadow reads/dry run unde este posibil; canary și smoke după deploy.
- Monitorizare rate succes/failure/unknown, duplicate, durata/lag worker/proiecții, cost, tools undiscovered și manual-vs-AI drift. Rollback code/flags nu reanulează efectele externe deja executate.

**Închidere globală:** manifestul E0 nu are capabilități obligatorii absent/parțial; toate au dovezi de paritate sau handoff verificat. Nu declarăm „complet” doar pentru că build-ul și testele unitare trec.

## Backlog de acoperire: maparea tuturor problemelor auditului

ID-urile de mai jos sunt elemente propuse de implementare, nu nume de tool-uri deja disponibile. Fiecare se detaliază în capabilități/câmpuri în E0.

| ID | Lucrare / problemă rezolvată | Etapă | Dovadă minimă |
|---|---|---|---|
| B01 | Manifest manual/AI, wrappers și catch-all | E0 | Nicio operație montată neclasificată |
| B02 | Contract comun, compatibility adapters, disponibilitate runtime | E1 | UI/tool aceeași schemă și același handler |
| B03 | Drepturi/ownership/câmpuri și discrepanța TikTok read | E1 | Agent/admin/revoked/alt tenant |
| B04 | Idempotency, expectedVersion, audit/outbox | E1 | Double submit și timeout fără duplicat |
| B05 | Lifecycle proprietate, activare și efecte portaluri | E1 | Aceleași precondiții pe toate căile |
| B06 | Calendar comun manual/AI | E1 | Două cereri concurente nu creează conflict |
| B07 | Contact create complet, duplicate/default-uri/sursă/atribuire | E2 | Aceleași date și matching ca formularul |
| B08 | Contact update/preferințe/status/arhivare/pipeline | E2 | Fiecare câmp/status manual validat |
| B09 | Ofertă update/status/delete, interacțiuni conform UI | E2 | Nu se confundă log cu send/call |
| B10 | Property create/update cu formular complet și geocoding | E2 | Câmpuri, unități și geo identice |
| B11 | Vizionări: relații/agent/status/note/feedback | E2 | Paritate și conflicte |
| B12 | Tasks: relații/agent/termene/status | E2 | Creare/update/delete/reopen verificate |
| B13 | Favorites: preluare/colaborare/outcome/note/telefon | E2 | Ownership și istoric identice |
| B14 | Import proprietar, dedup și activare după review | E2 | Monedă/eligibilitate/dubluri |
| B15 | Portal activate/regenerate/deactivate/recommendations/feedback | E2/E4 | Token vechi și feedback autorizat |
| B16 | Linkuri preferințe și recomandări în portal | E2 | Acces și efecte identice |
| B17 | Storia inbox status/unread/conversie/handoff | E2 | Contact cu metadata, fără duplicat |
| B18 | Create dosar Sales și toate operațiile dosarului | E2 | Aceleași date ca createSaleFromProperty |
| B19 | Upload comun și selecție assets/private download | E3 | Acces la fișier per actor/tenant |
| B20 | Documente Sales/RLV/OCR/image processing | E3 | Job, versions și review verificat |
| B21 | Contract templates CRUD/generated artifacts | E3 | Rol admin și artefact valid |
| B22 | Export PDF/ZIP/CSV și pachete dosar | E3 | Fișier corect și download autorizat |
| B23 | Verificare flux existent de acord WhatsApp uman pentru agent autorizat | E3 | Modelul nu îl acordă; evidență auditabilă |
| B24 | WhatsApp send/templates/media/sync/link | E3 | Preview, queue și receipt reale |
| B25 | Opt-out, tarife, quota și test mode | E3 | Blocare și la execuția programată |
| B26 | AI calls initiate/schedule/settings/review/transcript | E3 | Provider call ID și rezultat verificat |
| B27 | Gmail draft/attachments/runner/handoff/evidence | E3 | Pregătit diferit de trimis |
| B28 | Email forwarding/health/template personal overrides | E3/E5 | Aceleași opțiuni și actor ca UI |
| B29 | Stări normalizate comandă/pas/job/provider | E3/E6 | Worker completed nu maschează plan failed |
| B30 | Catalog date/relații/subcolecții complete | E4 | Fiecare resursă autorizată interogabilă |
| B31 | Timeline/outbox/proiecții/reconciliere/backfill | E4 | Dedup, ordering, lag și drepturi |
| B32 | Query/count/aggregate/search global și Reports | E4 | Totale exacte sau explicit parțiale |
| B33 | Owner index/write paths/revision/pagination freshness | E4 | Create/update/delete concurent și lag |
| B34 | Matching results version/invalidation | E4 | Motor existent și avertizare date schimbate |
| B35 | Imobiliare/Storia/Romimo configurații și promoții | E5 | Echivalent manual și status provider |
| B36 | Facebook/Instagram draft/comment/diagnostic/remove | E5 | Capabilități catch-all individuale |
| B37 | Facebook groups/local helper/Cloud jobs | E5 | Helper readiness și progres real |
| B38 | Meta assets/drafts/ready/edit/delete/publish/report | E5 | Drepturi și buget real |
| B39 | TikTok organic/Studio complet | E5 | Draft/assets/project/render/schedule lifecycle |
| B40 | TikTok Ads workspace/drafts/spend/recovery/report | E5 | Refolosește capabilitățile existente |
| B41 | Video tour voices/upload/preview/job controls | E3/E5 | Script/job/video final diferențiate |
| B42 | Agenți, agency/profile, domeniu și branding | E5 | Operații permise rolului, upload valid |
| B43 | Notificări read-all/preferințe/push | E5 | Numai utilizatorul autorizat |
| B44 | Billing plan/seats/checkout/handoff | E5 | Cost și rezultat checkout explicit |
| B45 | Colaborări onboarding/team și fluxuri existente | E5 | Acceptările și drepturile păstrate |
| B46 | Discovery semantic, entity/date resolver, budget | E6 | Sinonime și comenzi simple fără consum excesiv |
| B47 | Loturi/checkpoints/pause/cancel/continuation | E6 | Reluare sigură și rezultat per entitate |
| B48 | Rules/automations editor/history și stop conditions | E6 | Evenimente repetate nu dublează efectul |
| B49 | Carduri toate domeniile, proveniență și Voice parity | E7 | Aceleași date/acțiuni în Text și Voice |
| B50 | CI/E2E/provider probes/deploy/observability | E7 | Manifest și probe pe release verificate |

## Scenarii de acceptare pentru rezultatul final

1. „Dă-mi 5 apartamente în Titan sub 130.000 euro.” Rezultate proprietari din corpusul eligibil, criterii explicite, prospețime și paginare; butonul CRM păstrează criteriile. Un anunț nou colectat devine găsibil conform țintei măsurate de lag, fără a pretinde acces instantaneu la toate portalurile.
2. „Programează o vizionare pentru Maria mâine la 18:30.” Selectează clientul/proprietatea reală; detectează conflict inclusiv cu scriere manuală concurentă; creează vizionarea o singură dată; confirmarea prin mesaj este un pas separat.
3. „Trimite cele mai bune 3 oferte lui Andrei.” Matching existent; proprietăți încă active; recomandări în portal plus canal eligibil; acord/șablon/attachment/buget verificate; starea trimiterii este reală.
4. „Găsește 10 apartamente în Pipera și contactează proprietarii pentru colaborare.” Dedup, prospectare și destinatari fixați; handoff pentru acord real unde este necesar; apel/mesaj doar prin canal eligibil; outcomes/follow-up și progres per proprietar.
5. „Am obținut acordul din apel.” Jarvis afișează cardul uman; agentul confirmă destinatarul, scopul și dovada. Scrierea este făcută de endpoint-ul uman; o propoziție a modelului sau o notă nu acordă consent automat.
6. „Ce s-a întâmplat cu clientul X în ultimele 7 zile?” Timeline autorizat cu apeluri, mesaje, vizionări, oferte, tasks și dosar; limitele istoricului și datele indisponibile sunt explicite.
7. „Creează dosarul, încarcă actele și pregătește emailul notarului.” Dosar creat, fișiere selectate/încărcate, OCR revizuit, checklist și email pregătit; nu declară trimitere fără evidență.
8. „Schimbă etajul și anul construcției și republică anunțul.” Aceleași câmpuri/validări ca UI, versiune actuală, integrare disponibilă, rezultat portal verificat.
9. „Urmărește ofertele noi pentru acest client și oprește mesajele dacă răspunde.” Automatizare cu condiții și history, stop la răspuns/opt-out/revocare, fără dubluri.
10. „Oprește această operație.” Pașii viitori se opresc, efectele deja produse sunt listate; provider outcome necunoscut se reconciliază înainte de reluare.
11. „Publică o campanie și arată-mi rezultatele.” Draft și preview, drepturi/buget, publish, status și raport; UI nu confundă submission cu active/live.
12. Agent fără drepturi admin cere modificarea altui cont/tenant. Refuz explicabil sau handoff către rolul potrivit; fără schimbarea privilegiilor prin AI.

## Validare, migrare și finalizare

Fiecare capabilitate are patru dovezi: schema/permission, paritate de serviciu, comandă naturală în Text/Voice și verificare a rezultatului real. Pentru o operație externă, probele sunt condiționate de cont și autorizări; lipsa lor este raportată distinct, nu bifată drept verificată.

Înainte de rollout: tests relevante domeniului, rules emulator, typecheck/build, contract drift, migrare/index status. După rollout: auth/role, citiri reale, command smoke, worker readiness, status/evidence și cost. Lansarea este incrementală; nu se schimbă simultan toate scrierile și toate regulile Firestore.

Pentru migrarea unei scrieri client: extragem serviciul și schema; verificăm paritatea; conectăm UI și AI; inventariem toate căile alternative/worker-ele; observăm noul flux în canary; abia apoi restrângem scrierea directă prin reguli dacă politica de acces o cere. Tratăm clienții desktop/browser rămași pe versiuni vechi prin compatibilitate sau refresh/version gate explicit. Nu blocăm un formular încă nemigrat printr-un deploy prematur de reguli.

Riscurile urmărite pe parcurs: drift al schemelor și datelor vechi, side effects duble între trigger și serviciu, proiecții cu drepturi prea largi, chei de idempotency diferite manual/AI, efecte externe confirmate târziu și sesiuni expirate la handoff. Fiecare are test sau reconciliere explicită; nu presupunem garanție exactly-once de la un furnizor extern.

Țintele de latență și lag se stabilesc după baseline E0, separat pentru query intern, colectare anunț, răspuns AI, job și furnizor. Nu promitem aceeași durată pentru un count intern și o randare video.

Paritate completă = toate capabilitățile obligatorii din manifest sunt **executabile și verificate** sau au **handoff funcțional verificat**, cu aceleași drepturi și efecte ca manual. La final se publică matricea efectivă de disponibilitate și limitările providerilor. Funcțiile suplimentare care nu există manual (de exemplu merge/import în masă sau Gmail server-side) se marchează separat ca extinderi și nu umflă artificial deficitul actual.

## Puncte de integrare existente

- `src/lib/ai-assistant/{registry,contracts,operations,actions,planner,tool-dispatch,workspace,approval,jobs,automation-worker,context,search,readiness}.ts`
- `src/lib/communications/{server,outbound,media,templates,sync,optout,model}.ts`
- `src/lib/ai-outreach/{server,vapi,status,types}.ts`
- `src/lib/{sales,sales-server,sales-workspace,sales-documents,sales-document-processing,sales-inbound}.ts`
- `src/lib/property-removal/{service,lifecycle,portals,schema}.ts`
- `src/lib/desktop/gmail-runner.ts`, handler-ele marketing/portaluri și worker-ele existente
- `functions/src/{index,notifications,communications,collaboration}.ts`, regulile Firestore/Storage și indexurile proiectului
- `src/components/ai/AssistantResultCard.tsx` și componentele Jarvis Voice: rezultate comune, fără executor Voice separat

Numele pentru servicii/capabilități noi se stabilesc după manifestul E0. Refolosirea acestor module este prioritară față de construirea unor implementări paralele.
