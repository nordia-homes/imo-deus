# Audit și completări obligatorii: Meta organic, WhatsApp, Inbox

Data: 27 septembrie 2026. Audit de proiectare și inspecție statică a codului local; fără teste live, acces la conturile Meta sau verificarea regulilor din producție. Nu au fost schimbate integrările sau regulile aplicației.

Actualizare: [deciziile finale](./meta-whatsapp-unified-inbox-decisions.md) sunt normative pentru sincronizarea nativă, căutare, conectare și costuri. Formulările deschise aferente sunt înlocuite de acest document.

## Verdict

Direcția de produs este bună: Marketing administrează distribuția și conexiunile, Inbox comunicarea, CRM identitatea și oportunitățile. Planul inițial nu era încă suficient de precis pentru lansare. Există dependențe omise în aplicație și lipsesc contracte clare pentru acces, stare, migrare, cost și operare.

P0 = blocaj înainte de acces la mesaje reale / pilot; P1 = necesar pentru prima versiune utilizabilă a funcției; P2 = extensie după validarea pilotului. Aceste priorități se referă la lansarea integrării, nu reprezintă o certificare a gravității în producție.

## Constatări susținute de cod

| Prioritate | Dovadă locală | Problemă și completarea planului |
| --- | --- | --- |
| P0 | `src/firestore.rules`, regula `users/{userId}`; `src/lib/firebase-app-hosting.ts`, `requireAgencyUserFromBearerToken` | Utilizatorul poate scrie propriul profil fără limitarea câmpurilor, iar autorizarea citește `agencyId` și `role` din acel profil. Regulile locale permit astfel alterarea sursei de autorizare. Câmpurile de apartenență/rol trebuie gestionate exclusiv prin operații server validate, inclusiv la creare și ștergere/recreare. Audităm fluxurile de înscriere, invitație și schimbare de agenție; test negativ obligatoriu în emulator. |
| P0 | `src/firestore.rules`, regula generică a subcolecțiilor agenției | Noile colecții propuse ar moșteni citire/scriere pentru membrii agenției. Trebuie excluse explicit din regula generică, apoi definite separat: mesaje, joburi, consimțământ, costuri și audit sunt scrise de server; citirea respectă apartenența și accesul la conversație. Un `allow false` mai specific nu anulează un `allow true` mai larg. |
| P0 | `src/storage.rules`, regula finală `allow read: if true`; `firebase.json` fără configurație Storage | Fișierul local nu oferă confidențialitate pentru atașamente de conversație. Alegem bucket/cale privată, verificăm politica efectivă și metoda de deployment. Nu extrapolăm din acest fișier starea bucketului live. |
| P0 | `functions/src/index.ts`, `storiaWebhookAck`; `src/app/api/storia/webhook/route.ts` | Există persistență directă în Functions și forwarding în Next.js. Functions persistă înainte de verificarea semnăturii din Next; ambele endpointuri pot confirma 200 după erori. Planul trebuie să introducă verificare înainte de orice scriere și recepție durabilă înainte de succes; eșecurile tranzitorii nu sunt confirmate ca persistate. |
| P1 | `functions/src/notifications.ts`, `notificationStoriaMessagesWritten` | Triggerul ascultă `storiaInboxLeads`. Mutarea numai a UI/date ar pierde notificările sau le-ar dubla la dublă scriere. Generalizare și deduplicare pe evenimentul original, cu notificările istorice suprimate la migrare. |
| P1 | `firebase.json`; `firestore.rules` și `src/firestore.rules` | Există două versiuni de reguli. Cea configurată este în `src`. Livrarea trebuie să aibă o sursă canonică și verificarea fișierului publicat. |
| P1 | `src/lib/meta-marketing.ts`, `REQUIRED_SCOPES` și `publishPropertyToFacebookPage` | Conectarea cere și permisiuni Ads, iar publicarea păstrează în proprietate ultima postare. Separăm capabilitățile organic/ads/messaging și istoricul postărilor, păstrând compatibilitatea cu UI existentă. |
| P1 | `docs/gmail-sales-workflow.md` și fluxul email existent | Gmail este pregătire externă de mesaje plus forwarding pentru tranzacții. Includerea lui în Inbox nu trebuie descrisă ca sincronizare generică deja disponibilă. |

## 1. Decizii de integrare care lipseau

- Pornire pe API-uri oficiale pentru pagini Facebook, Instagram profesional și WhatsApp Business Platform. Conturile personale și funcționalitățile modulelor de grupuri nu sunt implicit acoperite.
- Refolosim conectarea Meta unde este adecvată, dar separăm autorizațiile per scop. Pentru Instagram alegem și documentăm un singur flux inițial: Facebook Login, potrivit bazei existente, dacă pagina și contul profesional sunt legate. Instagram Login separat este extensie; nu amestecăm tokenuri, endpointuri și familii de scopes între cele două.
- Inventar obligatoriu per capabilitate: permisiuni, tip token, active administrate, abonamente webhook, versiune API, acces de test/extern, dovezi App Review, data verificării. Nicio bifă «Conectat» nu înseamnă automat «Poate publica și trimite mesaje».
- Pentru WhatsApp: integrare directă Cloud API cu Embedded Signup, cont/număr și plată Meta deținute de agenție; fără BSP în această versiune. Eligibilitatea și accesul necesar sunt criterii de activare. Coexistence este fluxul ales pentru Business App; pentru neeligibilitate oferim explicit număr dedicat, fără migrarea automată a numărului existent.
- Un cont extern poate aparține unei singure agenții în MVP. Conectarea la altă agenție este blocată și rezolvată prin transfer verificat; ștergerea unei conexiuni nu distruge istoricul.
- Stări de conexiune: deconectat, configurare incompletă, activ, acces parțial, token expirat/revocat, suspendat. UI arată exact ce funcție este blocată și acțiunea de recuperare.
- Istoric și mesaje native: implementăm sincronizarea și importul oficial disponibile, cu origine explicită, deduplicare și interval de acoperire vizibil. Coexistence și testul de răspuns din aplicația nativă fac parte din activarea modului mixt; fallbackul operațional și limitele de istoric sunt fixate în documentul deciziilor finale.

## 2. Contractul Inbox și al identității

- Nu orice expeditor este cumpărător: poate fi proprietar, chiriaș, partener, contact existent sau spam. Conversația poate exista fără contact CRM. «Adaugă în CRM» cere tipul contactului; calificarea AI este o sugestie.
- `conversation` reprezintă firul extern; `contact` persoana; o oportunitate comercială/proprietate este legată separat. Nu împărțim arbitrar aceeași conversație WhatsApp în fire externe noi pentru fiecare proprietate.
- Identitate externă cheiată prin provider + cont extern + participant extern; adăugăm un index unic server-side. Reasocierea/îmbinarea contactelor este auditată și reversibilă. Numele și potrivirile de telefon ambigue produc sugestii, nu fuziuni automate.
- Separăm `firstTouchSource`, `latestTouchSource`, canalul curent, post/ad/form și proprietatea asociată. `propertyAssociationMethod` = referință explicită / legătură furnizor / agent / sugestie AI. Asocierea incertă nu intră ca adevăr în rapoarte.
- Stări conversație: nouă, în lucru, așteaptă clientul, amânată până la o dată, rezolvată, spam. Un inbound nou redeschide conversația rezolvată; arhivarea nu înseamnă ștergere.
- «Necitit de mine», «echipa trebuie să răspundă» și «clientul a citit» sunt trei stări diferite. Cursor de citire per agent și stare de lucru comună.
- Stări mesaj: draft local, în coadă, trimite, acceptat de furnizor, livrat, citit, eșuat, rezultat necunoscut. Lipsa confirmării nu este eșec sigur; datele vechi nu suprascriu statusuri mai recente.
- Mesaje și note interne sunt obiecte și endpointuri distincte. Reply-to, autorul agentului, canalul și contul expeditor sunt vizibile înainte de trimitere. Schimbarea canalului nu mută automat draftul fără reconfirmarea destinatarului.
- Atribuirea folosește versiune/compare-and-set; afișăm când alt agent lucrează și prevenim repetarea aceleiași comenzi. Nu promitem că doi agenți nu vor formula separat mesaje similare; definim preluarea și avertizarea de concurență.
- Căutare completă din prima versiune de producție: Typesense Cloud ca index secundar, Firestore ca sursă de adevăr. Căutare după contact, proprietate și text, autorizare exclusiv server-side și reverificare pe datele curente. Paginare: 30 conversații, 50 mesaje, 20 rezultate de căutare; listener numai pentru conversația activă și lista recentă.

## 3. Acces, atașamente și date

Matrice inițială propusă: administratorul vede toate conversațiile și gestionează conexiunile/bugetele; agentul vede și răspunde la conversațiile atribuite sau partajate; coada neatribuită are acces explicit configurat de administrator. Drepturile de publicare/aprobare sunt separate de dreptul de conectare și de mesagerie. Excluderea unui agent revocă accesul și reasignează conversațiile.

Atașamentele folosesc stocare privată, descărcare autorizată și URL-uri temporare. MIME real, limite de dimensiune, verificarea fișierelor și tratarea expirării URL-urilor furnizorului fac parte din ingestie. Workerul media nu descarcă arbitrar URL-uri interne sau redirecturi nesigure. Materialele pentru publicare, care trebuie accesibile platformei, au o cale separată cu disponibilitate controlată pe durata procesării.

Consimțământul are scop, canal, sursă, dată, dovadă și retragere. Importul unui număr din Storia sau prospectare nu creează opt-in. Verificarea se repetă la executarea jobului, nu doar la programare. Retenția, exportul și ștergerea includ mesajele, fișierele, indexul de căutare, logurile și joburile; ștergerea lasă numai markerii minimali necesari pentru a nu reimporta conținutul șters, conform politicii stabilite.

## 4. Operare și migrare

- Recomandare pentru MVP: evenimente/outbox în Firestore și workers Functions cu lease, retry și scheduler, reutilizând modelul notificărilor existente. Alegerea se validează la volumul pilotului. Cloud Tasks poate fi introdus dacă sunt necesare rate limits și scheduling mai fine. Nu folosim timere din browser sau procese desprinse de cererea Next ca infrastructură de livrare.
- Tranzacția de ingestie persistă evenimentul și intenția de procesare. Reconciliatorul recuperează evenimente neprocesate și lease-uri expirate. Evenimentele nerecuperabile ajung într-o coadă de erori cu motiv și reluare controlată.
- Cheia idempotentă include agenția, contul, operația și identificatorul stabil al mesajului. Nu copiem identic algoritmul joburilor TikTok, unde operații recurente pot împărți aceeași cheie.
- La timeout după send: păstrăm «rezultat necunoscut» și reconciliem prin ID/echo/istoric dacă există. Dacă furnizorul nu permite stabilirea rezultatului, cerem verificare manuală; nu retrimitem orbește. Nu promitem exact-once între sisteme externe.
- Monitorizare: vârsta celui mai vechi job, întârzierea webhook–Inbox, rate de eșec pe cont, tokenuri expirate, media indisponibilă, reconnect și rate limits. Loguri fără tokenuri sau corpuri complete de conversație; corelare prin identificatori.
- Notificările extind categoriile și regulile existente; link către conversația exactă, preferințe, evitarea dublurilor. Notificarea internă de vizionare și mesajul extern WhatsApp sunt joburi separate.

Migrare Storia în ordine: (1) inventarierea tuturor writerelor și cheilor; (2) backup și dry-run cu raport; (3) ingestie durabilă plus proiecție în modelul nou, fără schimbarea UI; (4) backfill cu watermark și replay al evenimentelor sosite în timpul lui; (5) comparație ID-uri/număr/ordine/direcție, legături CRM și stări; (6) notificări noi fără notificări pentru istoric; (7) comutare per agenție. Rollback-ul revine la UI veche cu evenimentele Storia proiectate în continuare acolo; noile canale păstrează datele și cozile, chiar dacă sunt temporar ascunse. O singură cale este autoritatea pentru efecte externe.

## 5. Automatizări și marketing organic

- La fiecare send: reverificăm conexiunea, drepturile agentului, canalul/destinatarul, fereastra și consimțământul. Regulile și excepțiile sunt per canal; excepțiile Meta pentru intervenție umană nu devin permisiune pentru AI/campanii.
- Șabloane WhatsApp: nume, limbă, categorie, versiune și parametri validați; status sincronizat. Dacă șablonul e suspendat/reclasificat, jobul se blochează sau recalculează eligibilitatea/costul.
- Ofertarea și reminderele nu primesc automat aceeași categorie. Cost estimat la programare și revalidat la execuție; registru cost estimat/confirmat, dată tarif, țară/categorie/monedă, furnizor și cine plătește. Fereastra de răspuns și eventualele facilități de tarifare sunt concepte distincte.
- Limite pe agenție/număr/zi și campanie; rezervare atomică de buget pentru joburile concurente, expirarea rezervărilor și reconciliere. Estimările nu sunt facturi; întârzierile raportării și schimbările de tarif sunt vizibile.
- Automatizările au fus orar, ore de contact, limită de frecvență, deduplicare per eveniment, anulare la răspuns/dezabonare și oprire manuală globală. Reprogramarea vizionării invalidează reminderul anterior.
- La rezervarea/vânzarea/retragerea proprietății, oprim promovările viitoare și ofertele programate; notificăm agentul pentru postările deja publicate. Schimbarea prețului invalidează aprobarea unui draft ce conține prețul vechi. Nu ștergem automat postările publicate.
- Editorul păstrează snapshotul aprobat și versiunea proprietății; orice modificare materială cere reaprobarea conform rolurilor stabilite. Validează formatele, dimensiunile și durata; urmărește procesarea video asincronă înainte de publicare.
- Comentariile publice rămân distincte; un răspuns privat la comentariu este disponibil numai dacă API-ul, condițiile și permisiunile exacte sunt confirmate. Nu promitem comentariu → DM automat universal.
- AI pornește cu drafturi: date actuale din proprietate, fără inventarea disponibilității/prețului, citarea internă a sursei și posibilitate de preluare umană. Textul primit de la lead nu poate modifica instrucțiunile sistemului sau declanșa instrumente arbitrare.

## 6. Surse de leaduri și măsurare omise

Formularele Meta Lead Ads sunt un conector distinct, de evaluat alături de Meta Advertising: evenimentul formularului creează o solicitare CRM, nu un mesaj Messenger și nu automat consimțământ WhatsApp. Aceeași distincție se aplică formularelor site-ului și feedbackului din portalul cumpărătorului. Verificăm accesul API înainte de includerea în livrare.

Funnel propus: postare → interacțiune/conversație identificabilă → lead calificat → vizionare → tranzacție. Raportarea păstrează metoda atribuirii și categoria «necunoscut». Nu atribuim toate mesajele Instagram ultimei postări și nu deducem persoana din reach. Definim distinct primul răspuns uman și răspunsul automat, timpul în programul de lucru și conversiile confirmate. KPI-urile reflectă numai datele disponibile de la furnizor și CRM.

## 7. Ordinea revizuită și criterii de lansare

| Livrare | Conținut | Condiție de acceptare |
| --- | --- | --- |
| 0 — eliminarea blocajelor | Autorizare, reguli canonice, atașamente private, traseu Storia, inventar conturi/permisiuni | Testele negative de acces trec; niciun eveniment invalid nu produce scrieri; sursele de deployment sunt clare |
| 1 — fundație și pilot Inbox | Model comun, migrare Storia, notificări, cozi, UI; pregătirea review-ului Meta începe aici | Backfill/replay fără duplicate și pierderi în test; rollback demonstrat; agenția pilot vede istoricul corect |
| 2 — WhatsApp funcțional | Onboarding validat, inbound/outbound, șabloane, atașamente, reguli și cost | Conversație reală de test cap-coadă; expirare, retry, opt-out și token revocat testate |
| 3 — Meta organic de bază | Noua pagină, Facebook existent, Instagram foto/carusel, draft/preview/publicare și istoric | Rezultat independent pe destinații și prevenirea republicării părții reușite |
| 4 — mesagerie Meta | Messenger și Instagram DM, cu activare separată după accesul necesar | Rutare corectă per cont, răspuns eligibil, mesaje native/istoric afișate cu limitele reale |
| 5 — extinderi | Calendar complet, Reels/Stories eligibile, comentarii, automatizări, surse suplimentare și rapoarte | Teste per funcție și măsurare pilot; campaniile bulk și AI autonom rămân opționale |

Livrările 2–4 nu se blochează reciproc dacă o aprobare externă întârzie: flag separat pe capabilitate/agenție și statut onest în UI. Nu lansăm butoane care mimează succesul pentru conectori neactivați. Publicarea organică are un prim increment înainte de finalizarea tuturor canalelor de mesagerie.

Propuneri de ținte pentru pilot, de validat pe volumul real: zero acces cross-agency în teste; 100% conservarea ID-urilor mesajelor Storia din eșantion și raport complet pe migrare; replay repetat fără mesaje/notificări duplicate; percentila 95 sub 5 secunde de la recepția webhookului până la apariția în Inbox în condiții normale; încărcare inițială sub 2 secunde pentru prima pagină pe mediul de test convenit. Nu includem în ținta de ingestie întârzierea din platforma externă.

Matrice de teste: două agenții, admin/agent/revocat, mai multe conturi externe, doi agenți simultan, telefon ambiguu, webhook duplicat/neordonat, echo outbound, timeout după acceptare, media expirată, șablon suspendat, buget concurent, ofertă retrasă, reminder reprogramat, schimbare DST, acces mobil și read state pe două dispozitive.

Estimarea calendaristică se face după livrarea 0 și prototipul unui canal: separăm efortul de dezvoltare de timpul extern App Review și de remedierea dependențelor aplicației. Nu există încă suficiente date pentru un termen fix credibil.

## Surse primare consultate

- Firebase, semantica regulilor suprapuse: https://firebase.google.com/docs/rules/rules-language
- Meta, Instagram prin Facebook Login: https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login
- Meta, Instagram prin Instagram Login: https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login
- Meta, Instagram Send API și limite de istoric: https://www.postman.com/meta/instagram/folder/uxudqu0/send-api
- WhatsApp, tarifare oficială: https://whatsappbusiness.com/products/platform-pricing/
- WhatsApp, politica de mesagerie: https://business.whatsapp.com/policy

Documentația publică nu înlocuiește verificarea capabilităților contului real. Conversația Meta AI nu a devenit accesibilă în acest audit.
