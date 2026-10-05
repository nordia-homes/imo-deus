# Audit de paritate AI Assistant / CRM — 5 octombrie 2026

## Concluzie

Jarvis execută deja operații reale, dar **nu are paritate completă cu agentul și nu cunoaște toate evenimentele CRM**. Există o bază bună de orchestrare, permisiuni, matching, căutare, planuri și execuție. Lacunele principale sunt conectarea tuturor operațiilor manuale, completitudinea câmpurilor, fișierele, istoricul transversal și urmărirea rezultatelor externe.

Obiectivul corect: orice operație de business disponibilă utilizatorului în CRM trebuie să poată fi descoperită, pregătită și executată prin AI cu **aceleași drepturi, validări și efecte**. Pașii care cer prezența omului, precum autorizarea contului extern, confirmarea acordului real sau plata în portalul furnizorului, trebuie integrați în conversație ca pași expliciți. AI nu primește drepturi suplimentare.

Acest document păstrează constatarea de bază. Implementarea etapizată este în curs; catalogul curent se găsește în CRM_PARITY_LIVE_MANIFEST.json. Numerele de mai jos descriu baza auditată, nu release-ul curent.

Corecție verificată în implementare: atribuirea contactelor/proprietăților/sarcinilor în aceeași agenție este permisă agentului prin fluxurile manuale și regulile existente. Mențiunile de mai jos „de către admin” descriu restricția catalogului Jarvis inițial, nu drepturile manuale corecte. Executorul comun validează agentul ales și agenția sa, fără a impune o restricție admin suplimentară.

## Metodă și limite ale dovezilor

- Comparare între modulele dashboard, componentele lor, scrierile directe Firestore/Storage, API-uri, catalogul AI, schemele acțiunilor, executor, citiri, planner și worker.
- Inventar complet static separat: [CRM_PARITY_INVENTORY_2026-10-05.json](./CRM_PARITY_INVENTORY_2026-10-05.json). Conține adaptoarele, API-urile, metodele, referințele UI și liniile scrierilor manuale.
- 67 de adaptoare înregistrate: 30 de citire și 37 de scriere. 24 de tipuri de acțiuni validate, 24 de resurse pentru citirea generică și 5 tipuri de automatizări.
- 185 fișiere de rute API inventariate; adaptoarele importă 47 dintre ele. Aceste numere **nu măsoară procentul de acoperire**: există rute interne/publice/webhook, metode reexportate și rute catch-all cu numeroase operații distincte. Un adaptor poate acoperi mai multe acțiuni.
- 46 de fișiere UI inventariate conțin scrieri directe, inclusiv wrapper-ele `*DocumentNonBlocking`; 92 de fișiere au asemenea scrieri sau referințe API. Nu toate sunt lacune: unele comportamente au echivalent AI. Referințele statice nu demonstrează singure că orice componentă este montată și accesibilă în fiecare configurație.
- Verificare efectuată acum: `npm run test:ai-assistant` — **197 teste trecute; 3 teste Firestore rules omise; 22 fișiere trecute, 1 omis**. Nu au fost inițiate apeluri, trimise mesaje, schimbate bugete sau publicate reclame pentru audit.
- „Disponibil” în tabel înseamnă că există o cale implementată în cod; nu certifică succesul fiecărui furnizor în producție. Aprobările, rolul, feature flags, conexiunile, tarifele, bugetele și worker-ele pot bloca legitim execuția.
- Dovezile anterioare pentru deploy/voce se află în [VOICE_PRODUCTION.json](./VOICE_PRODUCTION.json). Un deploy reușit și audio funcțional nu dovedesc paritatea tuturor acțiunilor CRM.

## Matrice pe module

| Modul | Ce poate face prin instrumentele actuale | Ce lipsește / ce este parțial |
|---|---|---|
| Lead-uri / clienți | Citire, listare, numărare filtrată; creare de bază; modificare nume, telefon, email, status, prioritate, etichete, buget, oraș, zone, descriere; preferințe; arhivare/dezarhivare; interacțiuni; ofertă înregistrată | Lipsesc modificarea/statusul/ștergerea unei oferte existente, sursa/sourcePropertyId și paritatea cu toate câmpurile formularului. Crearea manuală verifică duplicate și inițializează preferințele din buget; create_contact AI nu reproduce acești pași. Ștergere/merge/import în masă sunt obiective de extindere numai dacă sunt expuse manual. O interacțiune „Apel”/„Email”/„WhatsApp” este o înregistrare, nu o comunicare efectivă. |
| Pipeline | Citire contacte, statistici pe înregistrări identificate, schimbarea statusului contactului | Nu există un contract dedicat pentru fiecare comportament al pipeline-ului, mutări în lot și raportare transversală completă; trebuie verificată paritatea statusurilor și efectelor cu UI. |
| Proprietăți | Căutare, citire, creare de bază ca Inactiv; editare limitată; notă, featured; activare; rezervare/vânzare/status; retragere prin handler; context vânzare, preț, obiective apropiate | Nu poate edita anul construcției, etajul, numărul total de etaje, toate caracteristicile și câmpurile formularului; actualizarea city/zone/location, tipului/tranzacției și coordonatelor nu este în `propertyPatch`. Lipsesc upload, RLV, procesarea imaginilor, OCR acte și unele operații auxiliare. |
| Anunțuri proprietari | Căutare implicit în corpusul proprietarilor; query cu cursor; adăugare/scoatere/retry prospectare; preview import; import în CRM din prospectarea autorizată, cu verificări de eligibilitate și duplicat | Lipsesc comenzile dedicate pentru preluare, status colaborare, rezultat negativ/follow-up și modificările prospectării făcute manual în Favorites. Nu există paritate cu toate comenzile de sync, conexiunea OLX și obținerea telefonului. Nu poate considera o notă de apel drept acord WhatsApp. Fluxul „selectează → contactează → înregistrează răspunsul → importă” nu este complet conectat pentru toate canalele. |
| Matching | Reutilizează algoritmul ImoDeus existent pentru client/proprietate; filtrare a rezultatelor; recomandări în portal | Nu construiește alt algoritm. Recomandarea în portal **nu trimite mesajul**: trimiterea este pas separat. Setul contextual expiră, iar filtrarea lui nu recalculează scorul la fiecare schimbare de preferințe. Eliminarea/gestionarea completă a recomandărilor și feedbackului portalului nu are instrument dedicat. |
| Vizionări | Numărare/listare pe dată, agent, client, proprietate; creare, reprogramare, status, notă, anulare, ștergere; verificare suprapuneri în executor | Nu toate câmpurile/relațiile și schimbarea agentului/clientului/proprietății sunt editabile prin schema AI. Confirmarea prin mesaj/apel este separată. Scrierile manuale nu folosesc toate aceeași blocare de calendar ca AI. |
| Sarcini / follow-up | Creare; modificare descriere, termen și status; finalizare/redeschidere; ștergere; atribuire de către admin | Schema de update nu poate schimba toate relațiile sarcinii. „Follow-up” automat creează o sarcină; nu telefonează și nu trimite implicit mesaj. Lipsesc workflows generale cu condiții, ramuri și escaladări. |
| Inbox / WhatsApp | Conversații și mesaje autorizate; căutare mesaje; listare șabloane; inițiere conversație pentru contact; preview cost/eligibilitate; trimitere prin coadă; note; status/read/assignee/property cu contractul handlerului | Lipsesc upload media, sync explicit și unele operații de legare contact/conversație. Acordul real nu poate fi acordat de model; Există deja OwnerConsentDialog și /api/ai-assistant/owner-consent în Text și Voice, pentru agentul autorizat pe prospect. Fluxul trebuie verificat integral la trimitere și la retragerea acordului. Crearea/administrarea șabloanelor și întregul onboarding nu sunt instrumente AI. Trimiterea în coadă nu este livrare confirmată. |
| Storia Inbox | Conținutul proiectat în conversații poate fi consultat prin instrumentele de Inbox | Operațiile paginii Storia — status/unread și conversie în contact cu sourcePropertyId și metadata — folosesc scrieri directe fără acțiune AI echivalentă completă. Răspunsul se face prin handoff pe Storia în handlerul actual. |
| Portal client / preferințe publice | Citire document portal; recomandările pot crea portal și adăuga proprietăți | Activare fără recomandare, regenerare token/link, dezactivare, eliminare recomandări și citire completă feedback din subcolecții nu au paritate. Linkurile de preferințe publice au de asemenea nevoie de capabilitate dedicată. |
| Email / Gmail | Citire emailuri și audit dintr-un dosar de vânzare; review și înregistrarea dovezii trimiterii; template-uri de agenție prin adaptoarele Sales | Nu există execuție AI completă pentru compunerea mesajului, atașamente, runner Gmail/handoff web și trimitere cu dovadă. Lipsesc personalizări personale de template, configurare forwarding și health. Nu există citire universală a inboxului Gmail doar pentru că există pagina Gmail. |
| Apeluri AI | Listare apeluri prin `outreach_calls`; înregistrarea unei interacțiuni telefonice în CRM | POST de inițiere apel, setări outreach și modificările manuale ale apelurilor nu sunt conectate la AI. Auditul/transcriptul/răspunsurile din subcolecțiile apelurilor nu au citire generică dedicată. |
| Sales management | Citire dosare autorizate; setup; schimbare etapă; cerințe documente, metadata, acțiuni/review/ștergere document; email audit/review/evidence; setări admin și template-uri email | **Crearea dosarului** este încă `setDoc` în UI fără acțiune AI. Upload PUT document, pachet ZIP, export dosar și fluxul complet de email nu sunt conectate. Cerința de document nu este fișierul încărcat. |
| Contracte | Citire template-uri și contracte generate; generare prin handler existent, cu artefact PDF când handlerul îl returnează | CRUD template-uri, editor, ștergere/gestionare contracte generate și OCR CI nu au paritate. Modificarea template-ului are drepturi admin în regulile actuale. |
| Colaborări | Citire catalog/me/cases/leads; acțiunile expuse de handlerul comun `/api/collaboration` | Onboarding și management echipă au rute separate neînregistrate. Disponibilitatea unei acțiuni concrete depinde de schema handlerului; nu toate rutele publice/token trebuie accesibile agentului. |
| Publicare portaluri | Stări Imobiliare/Storia/Romimo; publicare; unpublish Imobiliare/Storia; reconcile Imobiliare; preview/verify Romimo; listare promoții Storia | Lipsesc configurări, legări de anunț, promoții/refresh/retry/sync și administrarea completă a integrărilor. Autorizarea contului extern cere handoff. Unpublish Storia este admin-only în catalogul AI. |
| Video tour | Listare joburi; generare scenariu; creare job de randare | Nu are întregul flux upload material/audio, preview voce, selecție voci și control/retry job individual. Job creat nu înseamnă video finalizat. |
| Facebook / Instagram | Creare postare socială prin handler existent; citire socialPosts pentru admin | Lipsesc comenzile dedicate pentru publicarea unui draft existent, comentarii/replies/like, diagnostic și ștergere destinații/postări din catch-all. Promovarea în grupuri, Facebook Cloud/local runner și management conexiuni/joburi nu au adaptoare AI. Postarea pe pagină nu este promovare în grupuri. |
| Meta Ads | Status; listare campanii; creare draft; publish de către admin; pause | Editare/ștergere draft, readiness, assets, dashboard și upload creative au rute/UI fără adaptoare AI. Necesită conexiune, drepturi Meta și condițiile handlerului. |
| TikTok organic / Studio | Status/dashboard; creare draft postare; publish și schedule | Lipsesc listare/patch draft, anulare schedule, creator info, brief/descrieri/scenariu premium, assets CRUD/upload, proiecte Studio/randări și voci. |
| TikTok Ads | Status; capabilities pentru admin; adaptor generic `tiktok_operations` către capabilitățile din conector | Nu este corect să declarăm toate operațiile Ads absente: adaptorul generic poate delega campanii/adgroups/ads, bugete și rapoarte dacă respectivele capabilități sunt disponibile. Lipsesc însă workspace/manager, drafts/publication, assets/resources, spend authorization, status/recovery operație și alte rute locale ca instrumente dedicate. Unele capabilități sunt unsupported chiar în conector. |
| Agenți / agenție | Citire agenție, agenți, detalii agent; reatribuire contacts/properties/tasks de către admin | Creare/invitare, modificare și eliminare agent; setări agenție/profil; avatar și alte uploaduri. Respectarea drepturilor admin trebuie păstrată. |
| Notificări | Citirea notificărilor proprii; automatizările pot crea notificări | Marcare citit individual/toate, preferințe și abonare push nu au acțiuni AI. Notificările nu sunt un istoric complet al tuturor evenimentelor CRM. |
| Rapoarte / dashboard / hartă / vândute | Datele de bază, query-uri pe 4 resurse, analize deterministe pe ID-uri identificate, insights, pricing snapshots/backtests și evenimente status/ștergere | Nu există paritate demonstrată cu toate metricile, seriile temporale și exporturile paginilor Reports/Dashboard. Geocoding și căutarea globală `/api/search` nu sunt adaptoare AI. Citirea unei liste nu dovedește un total complet al agenției. |
| Billing / domeniu / setări | Summary billing; citire agenție și unele stări integrări | Schimbare plan/seats, checkout/portal billing, custom-domain setup/status, profil/site branding și multe setări nu sunt conectate. Plata/OAuth necesită handoff, nu inventarea succesului. |
| Automatizări | Creare 5 tipuri; pause/resume automatizare proprie eligibilă; worker cu lease, verificarea actorului și oprire la rezultat extern necunoscut | Nu există editor complet al definiției, rule engine general și automatizări pentru orice acțiune. Nu există garanție de execuție imediată: polling, worker, heartbeat și configurația controlează disponibilitatea. |

## Cele 24 de acțiuni validate

`update_property_status`, `add_property_note`, `set_property_featured`, `delete_task`, `delete_viewing`, `create_contact`, `archive_contact`, `assign_record`, `create_property`, `update_contact`, `update_preferences`, `update_property`, `import_owner_listing`, `activate_property`, `record_offer`, `add_interaction`, `create_task`, `update_task`, `schedule_viewing`, `update_viewing`, `recommend_properties`, `create_automation`, `update_automation`, `existing_operation`.

Ultima este o familie generică pentru cele 37 de adaptoare de scriere, nu o singură funcție de business. Acțiunile sunt validate și pregătite în plan; existența schemei nu garantează că plannerul le va selecta pentru orice formulare în română.

### Limite de câmp demonstrate

- `create_contact.contactType`: numai `Cumparator`, `Client`, `Partener`.
- `update_contact`: numai `name`, `phone`, `email`, `status`, `priority`, `tags`, `budget`, `city`, `zones`, `description`.
- `update_preferences`: numai limite preț/suprafață, camere, băi, desiredFeatures și locationPreferences.
- `update_property`: numai `title`, `address`, `images` prin URL existent, `description`, `price`, `notes`, `featured`, `rooms`, `bathrooms`, `squareFootage`. Proprietatea trebuie să fie Activ/Inactiv.
- `update_viewing`: status, dată, durată și note; nu mută agentul, clientul sau proprietatea.
- `update_task`: status, descriere și termen; relațiile se pot da la creare, dar nu la update.
- `assign_record`: numai contacts/properties/tasks și numai admin.
- `update_automation`: numai active/paused; pentru o definiție nouă trebuie creată altă automatizare.
- Transportul adaptoarelor este JSON. Nu există upload multipart/blob generic. Un URL existent nu înlocuiește încărcarea sigură a unui document local.

## Ce înseamnă acum „știe tot ce se întâmplă”

### Acces prezent

Citirea generică are o listă fixă de resurse: contacts, properties, tasks, viewings, ownerListingFavorites, sales, contractTemplates, generatedContracts, conversations, channelConnections, socialPosts, assistantAutomations, pricingAnalysisSnapshots, pricingAnalysisBacktests, propertyStatusEvents, propertyDeletionEvents, metaCampaignDrafts, salesEmailTemplates, salesSettings, salesTemplateAudit, agency, agents, notifications, portals.

Pentru ownerListings și alte domenii există adaptoare separate. Subcolecțiile generice pot fi citite pentru sales (documents/emailMessages/audit) și conversations (messages/notes), nu pentru orice document din CRM. Citirea portalurilor nu include automat toate recommendations/feedback din subcolecții.

Există filtrare de agenție, reguli pentru dosarele de vânzare/conversații, notificări proprii și eliminarea cheilor sensibile. Aceste limite sunt corecte: „tot” înseamnă toate datele **autorizate**, nu parole, tokenuri sau datele altui tenant.

### Lacune de cunoaștere

1. **Nu există o proiecție unificată de evenimente pentru Jarvis.** CRM are deja trigger-e de notificări, căutare mesaje și colaborări; acestea nu constituie un jurnal complet accesibil asistentului pentru toate modulele.
2. **Acces la cerere, nu omnisciență permanentă.** Modelul primește numai rezultatele instrumentelor selectate. Nu are toate colecțiile în context și nici nu ar trebui să le primească integral.
3. **Datele există, dar nu sunt toate interogabile semantic.** Lipsesc citiri dedicate pentru o parte din transcripturi/apeluri, assets, joburi, rapoarte, setări, feedback și audituri de subcolecții.
4. **Istoricul conversațional este comprimat.** Bugetul contextului este 14 KB; textul unui mesaj este limitat la 2.200 caractere în context; cardurile păstrează referințe limitate. Memoria persistentă stochează doar 4 preferințe explicite, nu istoria completă a CRM.
5. **Paginarea este reală, dar există bugete.** Citirea generică scanează cel mult 2.000 documente/apel; căutarea proprietăților 5.000; query_records are limite de scanare/timp. `complete` și cursorul trebuie respectate. `analyze_records` analizează înregistrările identificate, nu pretinde un total global.
6. **Rezultatele vechi nu sunt adevăr curent.** Seturile de matching expiră într-o oră. La filtrare se verifică existența/statusul/prețul proprietăților, dar scorurile păstrate nu se recalculează automat după modificarea preferințelor clientului.
7. **Asincron nu înseamnă succes final.** Mesaj queued, randare pornită, campanie trimisă spre procesare și email pregătit trebuie urmărite până la starea finală potrivită, cu dovadă de la furnizor.

### Indexul Anunțuri proprietari și anunțurile noi

`search_properties` folosește implicit owners, scope-ul agenției, anunțuri `ready` și canonice. Citește Firestore live, independent de paginile UI. Când toate documentele eligibile au versiunea de căutare curentă, poate folosi indexul nativ. În lipsa acoperirii sau a indexului, are fallback la scanare live cu cursor. Câmpurile indexabile sunt scrise împreună cu datele în fluxurile identificate de import/canonicalizare/enrichment.

Acest lucru reduce riscul de a omite documente deja colectate, dar **nu permite promisiunea „zero anunțuri omise”**: colectarea portalurilor are latență, unele anunțuri sunt încă neeligibile, căutarea paginată nu este un snapshot înghețat, iar verificarea inițială a acoperirii nu este atomică cu toate scrierile ulterioare. Un document nou inserat înaintea cursorului poate necesita o căutare reluată de la început.

Pentru o garanție operațională măsurabilă: monitorizare lag import/index, contor/versionare corpus per scope, invalidare și reîmprospătare căutare când corpusul se schimbă, verificare a câmpurilor indexabile pe toate căile de scriere și test concurent create/update/delete. Afișarea `lastVerifiedAt` trebuie să separe „citit acum din CRM” de „verificat acum pe portal”. Butonul „Vezi potrivirile din CRM” trebuie să continue o căutare separată cu aceleași criterii.

## Probleme prioritare de corectat

| Prioritate | Constatare | Efect / corecție |
|---|---|---|
| P0 pentru obiectivul cerut | Nu există un registru de paritate pentru fiecare buton/acțiune/câmp manual | Fără el, mai multe adaptoare nu demonstrează completitudinea. Fiecare comportament montat în UI trebuie legat de un serviciu comun, instrument AI și test de acceptare. |
| P0 pentru prospectare — corecție | Confirmarea umană există deja în Text și Voice prin OwnerConsentDialog și ruta owner-consent, cu ownership pe prospect | Constatarea inițială privind absența butonului era greșită. Rămâne verificarea integrată a trimiterii, dedup și opt-out înainte de send; modelul nu poate acorda acordul. |
| P1 | `update_property_status` poate trece în Activ fără verificările din `activate_property` | Două căi AI cu validări diferite. Unificat serviciul de tranziție și precondițiile; vânzarea/retragerea/statusul trebuie să aibă aceleași efecte pe portaluri și istoric ca fluxul corect manual. |
| P1 | Calendarul AI folosește assistantLocks/calendar, dar UI are și addDoc direct | Lock-ul AI nu serializează toate scrierile manuale. Mutat scheduling într-un serviciu comun, cu aceeași protecție contra suprapunerilor pentru manual și AI. |
| P1 | Selecția instrumentelor native folosește regex-uri de cuvinte cheie, iar discover_tools caută substring în ID | Acțiunea poate exista și totuși să fie greu de descoperit pentru sinonime, referințe contextuale sau comenzi mixte. Catalog semantic cu aliasuri și dependențe, fallback la discovery și evaluări pe limbaj natural. |
| P1 | GET TikTok capabilities acceptă utilizator de agenție, dar registrul AI îl limitează la admin | Restricție suplimentară față de handlerul de citire. Aliniate drepturile de citire; refresh-ul POST poate păstra cerința admin. Audit de diferențe de rol pentru toate adaptoarele. |
| P1 | Inițiere apel, creare dosar, Gmail și fișiere lipsesc | Comenzi esențiale rămân imposibile sau se rezumă la note/drafturi. Conectate la servicii existente; dovezi de execuție și upload autorizat. |
| P1 | Crearea unui contact nu reproduce verificarea duplicatelor și inițializarea preferințelor din formular | Un lead creat prin AI poate avea un rezultat de matching diferit de unul creat manual cu aceleași date. Serviciu comun pentru creare, sursă, atribuire și preferințe. |
| P1 | Istoric transversal și statusuri de job/provider insuficiente | Întrebări „ce s-a întâmplat cu clientul/proprietatea?” nu sunt complete. Proiecție de evenimente + unelte timeline/job/provider status, cu proveniență. |
| P1 | Lots de acțiuni depășesc limitele unui plan | Maximum 12 acțiuni/plan, 24 tool calls și 120 secunde implicit. Prospectare/contactare 50–100 proprietari cere job durabil, progres, pauză/anulare și rezultate individuale; nu mărirea nelimitată a contextului. |
| P1 | Catalog/schema/context pot consuma bugetul înaintea rezolvării unei comenzi | Limitele implicite sunt 70.000 tokens și 0,12 USD/execuție, cu rezervare conservatoare înaintea apelului. Măsurat consumul pentru comenzi simple și multi-modul; rezultate/cataloage compacte, continuation și răspuns explicit parțial. Ridicarea limitei singură nu rezolvă costul și completitudinea. |
| P2 | Rezultate vizuale neuniforme între domenii | Există carduri comune și mod compact Voice; schema matching nu include imageUrl. Definite view-model-uri complete pe domeniu, imagini autorizate, acțiuni contextuale, paginare și stări operaționale reale. |
| P2 | Administrare incompletă automatizări | Adăugat editare definiție, runs/errors/retry autorizat, ștergere/arhivare, ownership și condiții de oprire. |

„P0” desemnează aici un blocaj pentru promisiunea de produs cerută; nu este afirmația că s-a constatat un incident de securitate în producție.

### Automatizări existente și ce nu fac

| Tip | Comportament actual | Limită |
|---|---|---|
| followup_task | Creează sarcina la termen | Nu efectuează apel sau trimitere |
| owner_watch | Caută și notifică anunțuri, cu deduplicare/cursor | Polling; nu ascultă toate evenimentele portalurilor și nu contactează automat proprietarii |
| insight_report | Generează notificări din insights deterministe | Nu reproduce toate rapoartele CRM |
| matching_watch | Matching existent și notificare peste prag | Nu trimite implicit oferta clientului |
| whatsapp_template | Trimite șablon prin infrastructura existentă; stopOnReply | Depinde de acord, șablon, tarife, conexiune, rol și worker; rezultat ambiguu oprește execuția |

Timing: interval minim 30 minute, maximum 365 rulări; heartbeat worker sub 15 minute cerut la creare. Nu există încă motor general „când X, dacă Y, execută Z”.

Automatizări utile de adăugat: răspuns nou → sarcină/prioritate; vizionare → confirmare/reminder/feedback; proprietate nouă sau preț schimbat → matching și ofertă eligibilă; document lipsă → cerere și escaladare; lead fără răspuns → secvență cu stop la răspuns/opt-out; publicare eșuată → diagnostic/retry permis; campanie → alertă de consum și pause autorizat; raport zilnic cu linkuri la surse. Fiecare trebuie să poată fi previzualizată, urmărită și oprită.

## Plan recomandat pentru paritate reală

1. **Registru de capabilități de business.** Inventar pe modul → acțiune manuală → câmpuri → serviciu → tool → rol → precondiții → efecte → rezultat → test. Acoperă și scrierile Firestore/Storage, nu numai API-urile. Stare: disponibil / parțial / handoff / blocat de integrare / absent / nepermis.
2. **Servicii comune manual și AI.** Prioritate contact/property complet, calendar, creare dosar, apeluri și comunicare. Scoaterea scrierilor directe din componente spre aceleași servicii reduce divergența; nu introduce un executor arbitrar de Firestore sau HTTP.
3. **Fișiere și joburi.** Upload autorizat, selecție asset, scanare/OCR, generare/export PDF/ZIP/CSV, job status/cancel/retry, idempotency și rezultate necunoscute. Urmărire până la final, nu doar „request acceptat”.
4. **Citire completă și actuală.** API semantic autorizat pentru toate resursele/subcolecțiile, query-uri agregate eficiente, timeline cu evenimente și snapshot/version, sincronizare/index monitorizate și proveniență în fiecare rezultat. Evenimentele declanșează actualizarea proiecțiilor; modelul citește detaliile la cerere.
5. **Toate integrările și setările permise.** Portaluri, Gmail, AI calls, social/groups, Meta/TikTok, colaborări, contracte, notificări, agenți, billing/domeniu. OAuth/plată/acord devin carduri de handoff cu reluare după finalizare.
6. **Orchestrare pe termen lung.** Planuri condiționale, joburi în lot, reluare, anulare, raport per entitate; reguli de automatizare peste același registru de acțiuni, cu dedup și oprire la retragerea drepturilor/acordului.
7. **Carduri și acceptanță.** Carduri de proprietate/client/vizionare/dosar/campanie/job cu sursă, moment, completitudine, efect și acțiuni contextual permise. Text și Voice folosesc același registru. Verificare end-to-end după deploy pentru operațiile sigure și probe controlate pentru furnizori.

### Criterii de finalizare

- Fiecare operație manuală de business accesibilă utilizatorului este executabilă prin AI sau are un handoff explicit și funcțional. Absențele sunt publicate, nu mascate de răspunsuri generice.
- Aceleași câmpuri, statusuri, validări, drepturi, audituri, notificări și efecte secundare pentru manual și AI.
- Teste pe agent/admin/alt tenant, drepturi revocate, cursor și date concurente, timezone/DST, duble clickuri, timeout după efect extern, opt-out și costuri.
- Fiecare rezultat extern diferențiază pregătit / queued / running / succeeded / failed / unknown și oferă dovezi corespunzătoare.
- Niciun total parțial prezentat ca total complet; nicio notă sau dovadă manuală prezentată ca apel/email efectuat.
- Evaluări de comenzi naturale și mixte, de exemplu „găsește 10 anunțuri → verifică dublurile → prospectează → cere confirmarea acordului → trimite șablonul → urmărește răspunsurile”.
- Acoperirea se raportează per **capabilitate de business verificată**, nu per număr de endpoint-uri sau teste unitare.

## Dovezi în cod

- Catalog și transport: [operations.ts](../../src/lib/ai-assistant/operations.ts:16), [registry.ts](../../src/lib/ai-assistant/registry.ts:13).
- Resurse/câmpuri/acțiuni: [contracts.ts](../../src/lib/ai-assistant/contracts.ts:4), [tool-schemas.ts](../../src/lib/ai-assistant/tool-schemas.ts:7).
- Execuție și diferențe activare/status/calendar: [actions.ts](../../src/lib/ai-assistant/actions.ts:108).
- Citire autorizată/subcolecții: [access.ts](../../src/lib/ai-assistant/access.ts:18).
- Căutare live/index/cursor: [search.ts](../../src/lib/ai-assistant/search.ts:33), [owner index fields](../../src/lib/owner-listings/search-index.ts:23).
- Context și seturi expirabile: [context.ts](../../src/lib/ai-assistant/context.ts:21).
- Selecție instrumente: [planner.ts](../../src/lib/ai-assistant/planner.ts:35).
- Automatizări/buget: [automation-worker.ts](../../src/lib/ai-assistant/automation-worker.ts:57), [budget.ts](../../src/lib/ai-assistant/budget.ts:3).
- Acord WhatsApp admin: [communications route](../../src/app/api/communications/%5B...path%5D/route.ts:18), [InboxWorkspace.tsx](../../src/components/communications/InboxWorkspace.tsx:317); verificarea trimiterii [outbound.ts](../../src/lib/communications/outbound.ts:25).
- Creare dosar manuală: [sales-management page](../../src/app/%28dashboard%29/sales-management/page.tsx:404).
- Inițiere apel manuală: [ai-calls page](../../src/app/%28dashboard%29/ai-calls/page.tsx:521).
- Email manual și runner/handoff: [SalesEmailComposer.tsx](../../src/components/sales/SalesEmailComposer.tsx:611).
- Formular complet proprietate: [add-property-dialog.tsx](../../src/components/properties/add-property-dialog.tsx:364).
- Duplicate/default-uri contact: [AddLeadDialog.tsx](../../src/components/leads/AddLeadDialog.tsx:164); modificare/ștergere oferte: [lead detail](../../src/app/%28dashboard%29/leads/%5BleadId%5D/page.tsx:499).
- Prospectare metadata/status: [Favorites page](../../src/app/%28dashboard%29/owner-listings/favorite/page.tsx:288); ciclul portalului: [ClientPortalManager.tsx](../../src/components/leads/detail/ClientPortalManager.tsx:51).
- Conversie lead Storia: [Storia Inbox page](../../src/app/%28dashboard%29/inbox/storia/page.tsx:106).
- TikTok generic delegă capabilități: [operations route](../../src/app/api/marketing/tiktok-ads/operations/route.ts:15), [capabilities.ts](../../src/lib/tiktok-ads/capabilities.ts:58).
- Diferența de rol la citire capabilities: [capabilities route](../../src/app/api/marketing/tiktok-ads/capabilities/route.ts:5), comparat cu [registry.ts](../../src/lib/ai-assistant/registry.ts:13).
- Trigger-e existente CRM: [functions index](../../functions/src/index.ts:9), [notifications.ts](../../functions/src/notifications.ts:918).

## Anexă: toate cele 67 de adaptoare înregistrate

Acesta este catalogul implementat, nu o certificare a disponibilității curente a fiecărui furnizor. Scrierile cer plan și condițiile handlerului; unele citiri POST sunt marcate readOnly.

| Instrument | Mod | Metodă și cale | Comportament |
|---|---|---|---|
| owner_query | Citire | GET /api/owner-listings/query | Anunțuri proprietari: scopeKey, search, rooms, priceMin/Max, cursor. |
| owner_prospect | Scriere | POST /api/owner-listings/prospecting | Adaugă/scoate anunț din prospectare: listingId, action add/remove/retry. |
| owner_import_preview | Citire | POST /api/owner-listings/import | Pregătește importul: source olx/imoradar24/publi24, url, listingId opțional; nu salvează proprietatea. |
| conversation_list | Citire | GET /api/communications/conversations | Conversații autorizate: contactId, channel, status, cursor. |
| conversation_messages | Citire | GET /api/communications/conversations/{conversationId}/messages | Mesaje cu cursor; conversationId obligatoriu. |
| conversation_search | Citire | GET /api/communications/search | Caută mesaje: q, page; păstrează permisiunile conversației. |
| communications_status | Citire | GET /api/communications/dashboard | Starea conexiunilor și bugetului de comunicare. |
| whatsapp_templates | Citire | GET /api/communications/templates/{connectionId} | Șabloane aprobate și parametri necesari. |
| conversation_start | Scriere | POST /api/communications/conversations | Pornește conversație WhatsApp: contactId, connectionId, propertyId opțional. |
| message_preview | Citire | POST /api/communications/conversations/{conversationId}/preview | Verifică eligibilitate/cost: text sau template {name,language,parameters}, requestId UUID. |
| message_send | Scriere | POST /api/communications/conversations/{conversationId}/messages | Trimite mesaj prin coada existentă. text sau template {name,language,parameters}; requestId injectat de executor. |
| conversation_note | Scriere | POST /api/communications/conversations/{conversationId}/notes | Notă internă: text. |
| conversation_update | Scriere | PATCH /api/communications/conversations/{conversationId} | Modifică status/assigneeId/read/propertyId, version obligatoriu. Reatribuire numai admin. |
| social_create | Scriere | POST /api/communications/posts | Publicare socială prin handler-ul existent, cu buget/rol verificate; consultă conexiunile. |
| collaboration_read | Citire | GET /api/collaboration | Colaborări: view catalog/me/cases/leads; id/cursor. |
| collaboration_action | Scriere | POST /api/collaboration | Acțiune colaborare cu schema handler-ului existent; nu inventa acorduri. |
| property_remove | Scriere | POST /api/properties/remove | Retragere/vânzare prin lifecycle existent, niciodată delete direct. Necesită motiv și detalii complete. |
| property_context | Citire | GET /api/properties/{propertyId}/sales-recommendation-context | Context vânzare pentru propertyId. |
| property_pricing | Citire | GET /api/properties/{propertyId}/pricing-analysis | Analiză de preț cu comparabile reale pentru propertyId. |
| property_nearby | Citire | GET /api/properties/{propertyId}/nearby-objectives | Obiective din apropierea proprietății. |
| video_jobs | Citire | GET /api/properties/{propertyId}/video-tour-jobs | Joburi și rezultate video ale proprietății. |
| video_create | Scriere | POST /api/properties/{propertyId}/video-tour-jobs | Creează job video cu schema existentă. Pentru presenter include aiPresenterScript generat întâi prin video_script; păstrează vocea și randarea existente. Nu pretinde că randarea e finalizată. |
| video_script | Scriere | POST /api/properties/{propertyId}/video-tour-script | Generează scenariul video din datele proprietății. |
| imobiliare_status | Citire | GET /api/imobiliare/status | Starea integrării Imobiliare.ro. |
| imobiliare_publish | Scriere | POST /api/imobiliare/publish | Publică/sincronizează proprietatea: propertyId, cu validările portalului. |
| imobiliare_unpublish | Scriere | POST /api/imobiliare/unpublish | Retrage de pe Imobiliare.ro: propertyId. |
| imobiliare_reconcile | Scriere | POST /api/imobiliare/reconcile | Verifică starea reală a publicării: propertyId. |
| storia_status | Citire | GET /api/storia/status | Starea integrării Storia. |
| storia_publish | Scriere | POST /api/storia/publish | Publică/sincronizează pe Storia: propertyId. |
| storia_unpublish | Scriere | POST /api/storia/unpublish | Retrage proprietatea de pe Storia: propertyId, cu rolul cerut de portal. |
| storia_promotions | Citire | POST /api/storia/property-promotions | Promovări disponibile și starea lor: propertyId. |
| romimo_status | Citire | GET /api/romimo/status | Starea integrării Romimo. |
| romimo_preview | Citire | POST /api/romimo/preview | Previzualizare Romimo: propertyId și setările cerute de portal. |
| romimo_publish | Scriere | POST /api/romimo/publish | Publică pe Romimo după preview: propertyId, previewHash, settings. |
| romimo_verify | Scriere | POST /api/romimo/verify | Verifică publicarea Romimo: propertyId. |
| property_presentation | Citire | GET /api/properties/{propertyId}/presentation | Generează prezentarea PDF. propertyId; fișierul este salvat și poate fi descărcat. |
| sale_stage | Scriere | POST /api/sales/{saleId}/stage | Schimbă etapa tranzacției folosind validările și auditul existent. |
| sale_setup | Scriere | PATCH /api/sales/{saleId}/setup | Actualizează participanți/checklist/configurare tranzacție prin handler. |
| sale_requirement | Scriere | POST /api/sales/{saleId}/documents | Adaugă document necesar: label, participantRole, stages, required. |
| sale_document_edit | Scriere | PATCH /api/sales/{saleId}/documents/{documentId} | Actualizează cerința documentară folosind schema și auditul dosarului. |
| sale_document_action | Scriere | POST /api/sales/{saleId}/documents/{documentId} | Verifică/respinge/restabilește versiunea unui document numai pe baza datelor reale și a unei instrucțiuni explicite. |
| sale_document_remove | Scriere | DELETE /api/sales/{saleId}/documents/{documentId} | Elimină cerința documentară prin handler-ul auditat existent. |
| sale_message_review | Scriere | PATCH /api/sales/{saleId}/messages/{messageId}/review | Revizuiește mesajul/draftul dosarului cu schema existentă. |
| sale_message_evidence | Scriere | PATCH /api/sales/{saleId}/messages/{messageId}/send-evidence | Înregistrează dovada reală a trimiterii; nu inventa livrarea unui email. |
| sales_settings_update | Scriere | PATCH /api/sales/settings | Administrator: actualizează setările de vânzări prin schema existentă. |
| sales_template_create | Scriere | POST /api/sales/templates | Administrator: creează șablon email pentru dosare, folosind schema existentă. |
| sales_template_update | Scriere | PATCH /api/sales/templates/{templateId} | Administrator: editează șablonul email al agenției. |
| sales_template_action | Scriere | POST /api/sales/templates/{templateId} | Administrator: acțiune/versionare șablon email prin validările existente. |
| outreach_calls | Citire | GET /api/ai-outreach/calls | Istoricul și starea apelurilor de prospectare accesibile agentului. |
| contract_generate | Scriere | POST /api/contracts/templates/{templateId}/generate | Generează PDF contract: values {câmp:valoare}, contactId/ownerId/propertyId opționale. templateId în params. |
| agency_agents | Citire | GET /api/agency/agents | Lista agenților autorizați din agenție. |
| agency_agent_detail | Citire | GET /api/agency/agents/{agentId} | Statistici agent: acces propriu sau admin. |
| billing_summary | Citire | GET /api/billing/summary | Plan, funcționalități și locuri disponibile. |
| sales_settings | Citire | GET /api/sales/settings | Setări vânzări accesibile agentului. |
| meta_status | Citire | GET /api/marketing/meta/status | Starea integrării Meta. |
| meta_campaigns | Citire | GET /api/marketing/meta/property-campaigns | Campanii Meta ale agenției. |
| meta_campaign_draft | Scriere | POST /api/marketing/meta/property-campaigns | Creează draft campanie Meta, fără publicare. |
| meta_campaign_publish | Scriere | POST /api/marketing/meta/property-campaigns/{campaignId}/publish | Publică campanie, cu controalele de buget/aprobare ale handler-ului. |
| meta_campaign_pause | Scriere | POST /api/marketing/meta/property-campaigns/{campaignId}/pause | Oprește campania. |
| tiktok_status | Citire | GET /api/marketing/tiktok-ads/status | Starea TikTok Ads. |
| tiktok_organic_status | Citire | GET /api/marketing/tiktok/status | Starea conexiunii TikTok organic. |
| tiktok_dashboard | Citire | GET /api/marketing/tiktok/dashboard | Drafturi și publicări TikTok organic. |
| tiktok_post_draft | Scriere | POST /api/marketing/tiktok/post-drafts | Creează draft TikTok prin schema handler-ului existent. |
| tiktok_post_publish | Scriere | POST /api/marketing/tiktok/post-drafts/{draftId}/publish | Publică draft TikTok cu toate condițiile și aprobările existente. |
| tiktok_post_schedule | Scriere | POST /api/marketing/tiktok/post-drafts/{draftId}/schedule | Programează draft TikTok pentru data cerută. |
| tiktok_capabilities | Citire | GET /api/marketing/tiktok-ads/capabilities | Capabilitățile efectiv disponibile TikTok Ads. |
| tiktok_operations | Scriere | POST /api/marketing/tiktok-ads/operations | Execută operație TikTok prin ledger/aprobările existente. |
