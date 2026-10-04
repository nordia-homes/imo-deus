# Audit complet AI Assistant — Jarvis pentru CRM, prin comenzi scrise

**Actualizare după implementare:** situația inițială descrisă mai jos a fost modificată în cod. Vezi [starea implementării, verificările și planul de activare](./ai-assistant-implementation-status-2026-10-04.md) pentru rezultatele actuale și limitele rămase.

Data: 4 octombrie 2026. Document de referință pentru extinderea AI Assistant la toate modulele CRM. Integrează cerințele confirmate și extinde [auditul operațional anterior](./ai-assistant-actions-audit-2026-10-04.md).

## 1. Obiectiv și definiția completitudinii

AI Assistant devine interfața de consultare, analiză și comandă a CRM-ului. Agentul scrie în română, iar asistentul identifică datele necesare, construiește un plan când este cazul, execută operațiile autorizate și urmărește rezultatele. Interfața este text pentru prima versiune; vocea nu face parte din această livrare.

**Acces complet** înseamnă că orice date și documente de business pe care utilizatorul le poate consulta în CRM pot fi recuperate prin asistent, în limita drepturilor efective ale utilizatorului. Include istorice, subcolecții, documente, atașamente, rezultate ale integrărilor și datele accesibile din colaborări. Nu înseamnă că întregul CRM este trimis modelului la fiecare mesaj.

**Acțiuni complete** înseamnă că operațiile disponibile în produs au echivalent prin comandă scrisă: citire, căutare, analiză, creare, modificare, atribuire, generare, comunicare, publicare, retragere, programare și automatizare. O comandă poate combina mai multe module. Citirea, modificarea și comunicarea au permisiuni distincte.

O comandă are întotdeauna un rezultat precis: răspuns bazat pe date, acțiune executată, operație în curs, date lipsă cerute concis, blocaj explicat sau funcție încă neimplementată identificată. Asistentul nu prezintă un task de apel drept apel realizat, un mesaj în coadă drept mesaj livrat sau un document generat drept document semnat.

„Orice comandă” nu poate fi realizată numai printr-un prompt mai mare. Acoperirea se asigură printr-un catalog complet și extensibil de date și acțiuni. O operație nouă în CRM trebuie să primească și un adaptor pentru asistent. Dacă nu există serviciu, permisiune, date sau conexiune pentru o cerere, asistentul oferă pașii realizabili și identifică exact dependența lipsă.

### Cerințe confirmate care rămân obligatorii

1. Matching-ul existent, în ambele direcții, se reutilizează. Portalul clientului, recomandările și feedbackul se reutilizează.
2. Căutări generale precum „5 proprietăți în Titan sub 130.000 euro” caută implicit în **Anunțuri proprietari**, pe întregul set eligibil, independent de paginile UI.
3. Potrivirile din portofoliul CRM apar separat prin butonul exact **„Vezi potrivirile din CRM”**, numai când există rezultate. Nu completează automat lista externă cu proprietăți CRM.
4. Agentul poate cere explicit portofoliul CRM, colaborări sau altă sursă accesibilă; atunci cererea explicită are prioritate. Cererile de matching pentru un client păstrează logica motorului existent, dacă agentul nu cere extinderea surselor.
5. În Prospectare, agentul apasă **„Confirm acordul WhatsApp”** după acordul telefonic real al proprietarului. Se salvează agentul, data, telefonul, scopul și evidența. AI-ul nu declară că acordul a existat din proprie inițiativă.
6. Acțiunile WhatsApp există în produs și în test; trimiterea respectă starea reală a conexiunii, destinatarii eligibili, șablonul, acordul și bugetul. Aprobarea Meta nu declanșează expedierea automată a drafturilor vechi.
7. Soluția durabilă de căutare exactă folosește câmpuri normalizate și indexuri native Firestore. Indexul urmărește scrierile confirmate; actualitatea anunțului extern depinde și de sincronizare/import.
8. Autorizarea deja dată de agent pentru o acțiune sau un flux nu este cerută repetat fără motiv. Nu există confirmare suplimentară pentru fiecare citire sau operație CRM clară și autorizată.

## 2. Ce a fost auditat și ce nu este încă verificat

Au fost inventariate directoarele dashboard, API-urile aplicației și fluxurile AI; au fost inspectate pagina/flow-ul actual AI Assistant, modulele principale de date, modelele, handler-ele reprezentative, regulile de acces și serviciile de execuție/programare. Referințele sunt în secțiunea 14.

Auditul este static, pe checkout-ul local. Nu certifică fiecare handler, configurarea de producție, conturile externe sau toate combinațiile de permisiuni. Nu au fost trimise mesaje, lansate apeluri, publicate reclame sau modificate date CRM. Nu au fost executate teste de runtime, deoarece această cerere produce un audit, nu implementarea.

`firebase.json` indică `src/firestore.rules`, `firestore.indexes.json` și `src/storage.rules`. Fișierele Firestore rules din rădăcină și `src` au același hash la audit; politica configurată rămâne cea din `src`. Existența unui nume de colecție în reguli nu dovedește existența unui motor funcțional: `automationRules` și `contactChannelIdentities` sunt menționate, dar nu a fost găsit un motor generic de automatizare sau un serviciu complet de identități în fișierele inspectate.

## 3. Verdict asupra paginii actuale

Pagina nu are încă acces general și nu este un executor general CRM.

| Element verificat | Stare actuală | Lipsă pentru Jarvis |
|---|---|---|
| Context | Contacte, proprietăți, vizionări, agenție și profil trimise din browser | Recuperare autorizată la cerere din toate modulele, documente și integrări |
| Portofoliu cunoscut de model | Rezumat limitat la 80 contacte active și 60 proprietăți active | Acces complet paginat, inclusiv arhivate/vândute când cererea le implică |
| Istoric conversație | State React; ultimele 8 mesaje trimise în flow | Persistență, entități/selecții memorate, planuri și reluare |
| Acțiuni | Un bloc textual ACTION pentru creare vizionare | Registru de acțiuni structurate, validate și autorizate |
| Identificarea entităților | Nume contact și titlu proprietate | ID-uri și rezolvarea ambiguităților/referințelor |
| Salvare | Scriere non-blocking și toast înainte de confirmare | Execuție pe server, rezultat confirmat și link către obiect |
| Autentificare în rutele AI inspectate | Handler-ul citește direct JSON; nu verifică tokenul aici | Identitate/context pe server, roluri, limite și controlul costului |
| Căutare globală existentă | Contacte/proprietăți/taskuri, maximum 5 rezultate fiecare | Recuperare completă în toate domeniile și agregări exhaustive |
| Comenzi compuse | Fără plan și execuție urmărită pe pași | Plan persistent, condiții, oprire și continuare |
| Programare | Fără motor al asistentului; există workers specializați | Orchestrare comună și scheduler pentru mesaje viitoare |
| Interfață | Conversație text și sugestii; microfon fără transcriere | Rezultate interactive, progres, operații programate și blocaje |

Regulile de timing din prompt trebuie corectate: există instrucțiuni contradictorii despre follow-up în ziua vizionării. Modulul `bucharest-time.ts` existent poate fi reutilizat; nu se reconstruiește o conversie temporală paralelă și inconsistentă.

## 4. Accesul complet la date: ce trebuie conectat

| Domeniu | Date care trebuie accesibile asistentului | Particularități |
|---|---|---|
| Agenție și utilizator | Profil, rol, setări, date firmă, preferințe și branding | Citire și modificare conform rolului; nu presupune admin |
| Echipă | Agenți, portofoliu, atribuiri și statisticile permise | Endpointul de detaliu statistic diferențiază agentul de admin |
| Contacte și pipeline | Date, preferințe, zone, finanțare, etape, note, interacțiuni, oferte, arhivare | Nu se limitează la leaduri active; păstrează diferența dintre lipsa datelor și refuz |
| Proprietăți CRM | Fișă completă, proprietar, acte, poze, RLV, video, note, preț, status, atribuiri, costuri | Date publice și private au scopuri diferite de afișare/trimitere |
| Istoric proprietăți | Schimbări de status, preț, retragere/ștergere și vânzări | Istoricul și snapshoturile nu sunt înlocuite de statusul curent |
| Anunțuri proprietari | Date publicabile/canonice, sursă, preț, camere, zonă, prospețime și verificare | Universul disponibil în CRM, nu toate anunțurile de pe internet |
| Prospectare | Favorite, rezervare/preluare, telefon autorizat, rezultat, comision, note, follow-up | Telefoanele recuperate sunt în prospectarea agenției; nu se expune telefonul global printr-o cale nouă |
| Matching și recomandări | Rezultate în ambele direcții, scor/motiv, portal, recomandări și feedback | Reutilizarea motorului și a datelor existente |
| Calendar | Vizionări și taskuri, responsabil, dată/oră/durată, status și istoric | Nu pretinde disponibilitate din calendar extern neconectat |
| Inbox | Conversații, mesaje, statusuri, note, atașamente, atribuiri, acorduri | ACL pe conversație și paging complet, nu doar ultima pagină |
| Apeluri AI | Programări, statusuri, rezultate, transcript/rezumat unde există, costuri și blocări | Serviciul inspectat este orientat către proprietari |
| Vânzări | Dosare, participanți, etapă, checklist, termene, finanțare, notar, mesaje, audit | Agent responsabil/colaborator sau admin |
| Documente | Fișiere, text extras/OCR, versiuni, review, asociere și documente lipsă | ACL pe fișier/dosar, versiunea curentă, documente șterse/redactate |
| Contracte | Șabloane, câmpuri, documente generate și asocieri | Editarea șabloanelor și a documentelor generate are reguli distincte |
| Email/Gmail | Conexiune proprie, șabloane agenție/override, mesaje Sales, inbound și dovezi de trimitere | Un browser deschis nu este dovadă de expediere; nu implică acces la toată căsuța Gmail |
| Portaluri imobiliare | Asocieri, statusuri remote, validări, erori, publicare/promovare, agent mapping | Imobiliare.ro, Storia și fluxul Romimo au servicii și permisiuni diferite |
| Site și domeniu | Branding, proprietăți afișate, date publice, domeniu/status și trafic disponibil | Nu presupune CMS universal sau control asupra DNS fără integrare |
| Colaborări | Catalog accesibil, linkuri, leaduri, dosare, mesaje, condiții și statistici | Date externe accesibile prin politica modulului, nu întreaga agenție parteneră |
| Marketing | Campanii/postări, creative, video/assets, bugete, statusuri, rapoarte, leaduri | Meta, TikTok, Facebook groups/local/cloud; limite pe cont și capabilitate |
| Rapoarte și analize | Indicatori, surse leaduri, conversii, activitate, comparabile, trafic, costuri | Calcul determinist și scope/perioadă explicite |
| Notificări | Notificările proprii, categorii, citit/necitit și preferințe | Nu deduce acces la inboxul altui utilizator |
| Billing | Plan, funcții, locuri, abonament și facturare disponibile în CRM | Acțiunile de schimbare plan/seats cer admin și au efect financiar |
| Integrări și joburi | Readiness, conexiuni autorizate, programări, erori și rezultate accesibile | Status util agentului, fără expunerea tokenurilor/parolelor operaționale |

### Principiul de autorizare

Acțiunea verifică **utilizator + agenție + rol + resursă + tip operație + capabilitate canal + autorizare aplicabilă**. Administratorul agenției nu devine administratorul platformei. Comenzile agentului nu moștenesc drepturile administratorului doar pentru că backendul folosește Admin SDK.

Regulile actuale permit membrilor agenției acces larg la contacte și proprietăți. Conversațiile, Sales, colaborările, șabloanele și administrarea au reguli mai specifice. Un filtru UI „ale mele” nu este automat o restricție de securitate; auditul și implementarea trebuie să păstreze politica efectivă, clarificând diferențele, fără a restrânge artificial accesul cerut de utilizator.

Bibliotecile server Firestore ocolesc Security Rules, deci handler-ele trebuie să aplice explicit politica utilizatorului. [Documentație Firebase](https://firebase.google.com/docs/firestore/security/rules-query).

Credențialele tehnice și operațiile interne/platform-admin nu sunt date de business ale agentului. Conectarea prin OAuth, reautentificarea, 2FA sau introducerea credențialelor se rezolvă prin fluxurile existente. Documentele/datele personale pe care utilizatorul are dreptul să le consulte pot fi recuperate la cererea relevantă, fără includerea lor automată în fiecare prompt sau jurnal general.

## 5. Catalogul complet de acțiuni care trebuie disponibile prin text

Legendă: **R** = serviciu/modul existent de reutilizat; **H** = logică existentă în UI, de extras într-un handler comun; **N** = extensie necesară. Toate familiile de mai jos necesită conectare la AI Assistant; R nu înseamnă că sunt deja executabile din chat. Inventarul indică principalele familii, iar catalogul de implementare trebuie să enumere separat operațiile și permisiunile lor.

| Modul | Comenzi/acțiuni de acoperit | Bază și completări |
|---|---|---|
| Consultare generală | Caută o entitate, citește fișa, explică istoricul, compară, găsește lipsuri, răspunde transversal | H/R căutări locale; N recuperare federată completă, surse și agregări |
| Contacte | Creează/actualizează, atribuie, adaugă note/taguri, actualizează preferințe/finanțare, arhivează/reactivează, detectează/comasează duplicate | H modele/CRUD; N serviciu comun, comasare cu remaparea tuturor legăturilor și jurnal |
| Pipeline | Mută etapa, înregistrează rezultat/motiv, setează următorul pas, prioritizează, selectează segmente | H statusuri; N tranziții și efecte coerente asupra taskurilor/vizionărilor/Sales |
| Proprietăți | Creează, importă, editează câmpuri, preț, proprietar, agent, note, status, fotografii/RLV, featured/site | H/R; N handlere tipizate, validări/cataloage și tratarea fișierelor din chat |
| Închidere proprietate | Marchează rezervată/vândută/închiriată/inactivă, retrage, șterge după procedură, păstrează motiv și preț realizat | R lifecycle/removal; nu se înlocuiește cu delete direct; drepturi externe păstrate |
| Anunțuri proprietari | Caută/filtrează, compară, citește detalii, salvează listă, favorite/prospectare, verifică prospețime, pregătește import | R căutare și import; N contract de căutare exactă, indexuri și lista de lucru persistentă |
| Prospectare | Rezervă/preia/eliberează fișa, înregistrează apel/rezultat, comision/condiții, follow-up, retragere acord | H/R; N identitate proprietar și handler cu drepturile/rezervările existente |
| Acord WhatsApp | Agentul înregistrează acordul telefonic prin butonul „Confirm acordul WhatsApp”, verifică/retrage acord | R registru; N buton și API pentru agent. Chatul poate deschide cardul de confirmare; AI-ul nu deduce consimțământul din interesul comercial |
| Matching | Proprietăți pentru client, clienți pentru proprietate, refacere pe criterii noi, explicații/excluderi, alternative | R motor existent; N adaptor și selecții de rezultate cu ID-uri |
| Portal client | Creează/activează/regenerează/dezactivează, adaugă/elimină recomandări, citește feedback, pregătește/trimite link | H/R; N operații atomice și păstrarea feedbackului la retrimitere |
| Vizionări | Propune intervale, creează, atribuie, reprogramează/anulează/finalizează, confirmări/remindere, feedback/no-show | H CRUD; N conflict concurent, confirmări pe participant și oprirea pașilor depășiți |
| Taskuri | Creează, modifică, atribuie, reprogramează/finalizează, grupează/prioritizează și urmărește întârzieri | H CRUD; N handler comun, termen exact și legare la prospect înainte de contact |
| Inbox | Citește/caută/rezumă, marchează status, atribuie, leagă contact/proprietate, adaugă note, pregătește/trimite răspuns și atașament | R Communications; N adaptor și recuperare completă. Storia poate necesita continuare externă |
| Follow-up | Trimite acum, programează, creează secvență, oprește/modifică, urmărește răspunsul | R outbound; N scheduler mesaje și oprire la răspuns/refuz/intervenție manuală |
| Apeluri proprietari | Pregătește task de apel uman, lansează/programează apel AI eligibil, urmărește rezultat/cost, înregistrează blocare | R AI outreach; N adaptor. Apel AI către cumpărători necesită extensie distinctă |
| Ofertare/negociere | Înregistrează ofertă formală, modifică status, pregătește contraofertă, termen, obiecții și taskuri | H oferte; N structurarea contraofertelor/istoricului unde lipsește, fără acceptare inventată |
| Sales | Creează/configurează dosar, participanți/notar/finanțare, etapă, termene, checklist, responsabil, blocaj și export | R/H; N adaptori, date/efecte coerente și acces per dosar |
| Documente | Găsește/deschide/rezumă/compară versiuni, extrage date, asociază, cere acte lipsă, review/approve/reject/archive, generează pachet | R scanner/OCR/versions/Sales; N retrieval în chat, upload/alegere fișier și surse exacte |
| Contracte | Găsește șablon, completează câmpuri din CRM, generează document, consultă/listă documente, editare șablon pentru admin | R generator/H editor; N adaptor și selectarea șablonului/participanților. Semnare electronică: N integrare |
| Email/Gmail | Pregătește mesaj, selectează șablon, personalizează, anexează, lansează runner eligibil, urmărește dovada, rezumă/review răspunsuri | R/H; N adaptor și generalizare dacă se dorește trimitere automată în afara Sales. Nu pretinde acces la emailuri neimportate |
| Publicare portaluri | Preview/validare, publică/actualizează/retrage, verifică asocierea/statusul, retry/reconcile și promovări eligibile | R Imobiliare/Storia/Romimo; N adaptori cu mapping/status/recovery. Autorizări existente păstrate |
| Colaborări agenții | Caută catalog, publică/retrage ofertă proprie, creează link, citește leaduri/dosare, trimite mesaj și urmărește condițiile | R modul Collaboration; N adaptor, căutare completă/paging și acces per caz |
| Analiză de preț/CMA | Generează/citește analiza, comparabile, justificare, snapshot și PDF; propune/aplică preț dacă autorizat | R pricing-analysis/CMA; N adaptor; estimare de piață distinctă de tranzacție confirmată |
| Prezentări și materiale | Generează descriere, prezentare PDF, mesaj/fișă comparativă, citește obiective apropiate | R flows/prezentare/nearby; N adaptor, artefact salvat și legături |
| Media și video | Selectează active existente, generează script/voce/video, urmărește randarea, salvează și pregătește publicare | R video jobs/studio; N joburi independente de pagină și preluarea rezultatului în chat |
| Social media | Draft/generare, programare/publicare, status, comentarii/răspunsuri, retragere și istoric | R Communications/social, Meta/TikTok, Facebook runners; N unificare și raportare corectă per canal |
| Reclame plătite | Citește rezultate, pregătește campanie, buget/target, trimite spre aprobare, publică/pauză/ajustare cu autorizație | R Meta/TikTok Ads; N adaptori care păstrează aprobările și autorizările de spend existente |
| Rapoarte | Calculează segmente, conversii, costuri, portofoliu, activitate, întârzieri, forecast; exportă și explică | H/R rapoarte/briefing; N motor comun de metrici, query exhaustiv și exporturi persistente |
| Echipă | Citește date/statistici permise, atribuie lead/task/proprietate; admin creează/actualizează/gestionează agenți | R/H management; N adaptor cu rol, seats și jurnal; operațiile de cont folosesc fluxul existent |
| Setări/site/domeniu | Citește/modifică profilul propriu, branding/setări agenție pentru admin, proprietăți featured, setup/status domeniu | R/H; N adaptori și păstrarea operațiilor externe interactive necesare |
| Notificări | Rezumă notificări, marchează citite, modifică preferințe proprii, deschide resursa | R/H; N adaptor; nu marchează implicit citite doar pentru că le-a citit AI-ul |
| Billing | Explică plan/capabilități/cost/seats, deschide portal, pregătește/execută schimbare autorizată de admin | R billing; N adaptor și preview exact al efectului financiar, fără credențiale de plată în chat |
| Integrări/joburi | Verifică readiness, explică/reia eroare eligibilă, deschide reconnect, listează/oprește joburi unde modulul permite | R servicii specializate; N health/capabilități comune. Job intern/platform-wide nu este comandă de agent |
| Automatizări | Creează din text, validează, activează, programează, modifică, pause/resume/stop, inspectează execuții | N motor generic peste workers existenți; reguli pe evenimente și coordonare cu acțiunile manuale |

### Operații transversale care lipsesc frecvent dintr-un chatbot CRM

- „Găsește toate…”, „câte…”, „compară…”, „de ce…”: interogări complete și calcul, nu sumarul primelor rânduri.
- „Pentru fiecare…”: lot de entități congelat/identificabil, excluderi și rezultat pe fiecare, cu verificarea datelor înainte de execuție.
- „Fă A, apoi B dacă…”: pași condiționați și oprire la lipsa rezultatului A.
- „Mâine”, „în fiecare luni”, „când apare…”: oră/scheduler/trigger și condiții de oprire, nu o promisiune în text.
- „Continuă”, „schimbă doar ora”, „trimite acelorași clienți”: referințe la selecții și planul anterior, cu permisiuni/date reverificate.
- „Oprește”, „anulează”, „reia”, „ce ai făcut?”: controlul operațiilor persistente, cu limite explicite pentru efecte externe deja produse.
- „Deschide fișa”, „arată documentul”, „exportă selecția”: navigare și artefacte în aplicație, nu doar explicație textuală.
- „Corectează greșeala”: operație compensatorie pentru modificări reversibile; mesajele/apelurile deja realizate nu au rollback fictiv.
- „De ce nu pot publica/trimite?”: diagnoză a resursei, rolului și canalului, fără a divulga credențiale sau date ale altui utilizator.

## 6. Întrebări la care asistentul trebuie să răspundă complet

| Întrebare | Date și calcul necesare |
|---|---|
| „Ce știi despre clientul Popescu?” | Fișă, preferințe, recomandări, feedback, interacțiuni, conversații permise, vizionări, oferte, taskuri și Sales accesibile |
| „Ce s-a întâmplat cu proprietatea X în ultimele 60 de zile?” | Timeline/status/preț, promovări/publicare, costuri/leaduri, trafic, recomandări, vizionări și negocieri |
| „Ce proprietari din Titan au acceptat colaborarea, dar nu am importat proprietatea?” | Prospectare + apeluri/rezultate + condiții + asocieri proprietate; lipsa mappingului este raportată, nu presupusă |
| „Cine a primit această proprietate și ce a răspuns?” | Portal/recomandări + jurnal comunicări + mesaje + feedback; diferență între recomandare salvată și livrare |
| „Care acte lipsesc pentru contractul de vineri?” | Dosarul corect, checklist, versiuni/review, programare notar și termene |
| „Câte leaduri au venit din Meta și câte au ajuns la vizionare?” | Sursă/identitate lead + atribuiri + vizionări + perioadă și definiție metrică; fără dublarea persoanelor |
| „Ce campanii cheltuie fără rezultat?” | Spend actual, interval, currency, evenimente/leaduri și atribuire disponibilă; date stocate vs live explicitate |
| „Ce comision estimăm luna aceasta?” | Tranzacții accesibile, sume/comisioane disponibile, etapă și probabilități configurate; estimat distinct de încasat |
| „Ce s-a schimbat de ieri?” | Evenimente pe date/execuții, nu doar diferența între două rezumate AI |
| „Care clienți nu au fost contactați de 7 zile?” | Ultima comunicare reală din canale/taskuri/interacțiuni, nu doar ultima notiță sau createdAt |

Lipsuri transversale: serviciu de timeline comun, identități/asocieri între module, metrici comune, atribuire surse, compararea în timp și câmpuri de comision/încasare unde nu sunt înregistrate. Nicio analiză nu poate inventa un fapt care nu este salvat sau recuperabil printr-o integrare autorizată.

## 7. Arhitectura recomandată pentru acces general și acțiuni

### 7.1 Catalog de resurse și identități

Un catalog documentează fiecare sursă: schemă, citire, agregare, ACL, legături, paging, freshness, versiune și câmpuri private/publice. Identitățile client/proprietar/contact/prospect/conversație/participant Sales trebuie legate, cu deduplicare controlată. Denumirea nu este cheie; ID-ul și agenția sunt cheia operației.

Un graf de relații logic este suficient inițial; nu este necesară o bază de graf separată. Poate lega Firestore IDs și mappingurile existente. Pentru comasare, referințele din toate modulele trebuie actualizate verificabil; comasarea nu se face prin simpla ștergere a unui contact.

### 7.2 Recuperare federată, indexată și autorizată

- **Date structurate:** filtre/indici Firestore, query-uri pe domeniu, paginare, agregări și citire directă a sursei actuale.
- **Mesaje:** există integrare Typesense și worker de indexare, cu verificarea documentului/conversației actuale înainte de returnare. Reutilizare când serviciul este configurat; nu este presupus activ în producție.
- **Documente:** extragere text/OCR existentă pentru unele fișiere, de conectat într-un registru de documente cu versiune, sursă, pagină/secțiune unde este disponibilă și ACL. Căutarea textuală/semantică poate fi adăugată pentru retrieval, fără a deveni sursa unică de adevăr pentru preț/status/permisiuni.
- **Istorice lungi:** instrumente de paging/filtrare și sumar incremental; modelul primește date relevante și dovezi, nu întreaga colecție în prompt.
- **Analize exhaustive:** calculează pe setul complet autorizat. API-ul global de sugestii limitat la 5 și limitele de 60/100/200 ale modulelor nu pot fundamenta afirmații despre toate datele fără continuare prin cursor sau endpoint de agregare.
- **Freshness:** răspunsul precizează sursa, intervalul și momentul actualizării când contează. Dacă datele live nu sunt disponibile, distinge snapshotul stocat de rezultat actual.

Indexurile native Firestore se actualizează la scriere; citirile normale reflectă scrierile confirmate înainte de începutul citirii. [Consistența Firestore](https://firebase.google.com/docs/firestore/understand-reads-writes-scale). Un index extern de mesaje/documente poate avea întârziere; pentru mesaje foarte recente este necesară și o cale de citire directă. Ștergerea sau revocarea accesului trebuie verificate la returnare, inclusiv pentru snippets, numărători și cache.

### 7.3 Registru de acțiuni și handlere comune

Pentru fiecare operație se definesc: nume, descriere, schemă intrare/ieșire, resurse, roluri/ACL, precondiții, consecințe, cost, dry-run/preview unde ajută, handler, cheie de idempotency, reguli de retry și rezultat verificabil. Exemple de familii: `contacts.*`, `properties.*`, `ownerListings.*`, `prospecting.*`, `matching.*`, `portals.*`, `viewings.*`, `tasks.*`, `communications.*`, `calls.*`, `sales.*`, `documents.*`, `contracts.*`, `publishing.*`, `collaboration.*`, `marketing.*`, `reports.*`, `team.*`, `settings.*`, `billing.*`, `automations.*`.

AI-ul interpretează cererea și alege instrumentele din catalog. Nu primește un instrument generic „scrie orice document Firestore” sau acces la execuție de cod/shell. Limitele nu sunt ale limbajului cererii; ele sunt ale operațiilor tipizate care păstrează integritatea și drepturile produsului.

Operațiile deja existente sunt reutilizate. Logica din UI se mută în servicii comune, apoi UI-ul și asistentul le apelează. Sunt păstrate notificările, validările, auditul Sales, politica de retragere proprietăți și autorizările de publicare/spend. Din perspective de securitate și produs, nu se simulează un click pentru fiecare CRUD dacă există un handler stabil.

### 7.4 Planificare și execuție

Planul include pași, intrări, dependențe, destinații, status, autorizare, costuri/limite și criteriu de finalizare. Se salvează înainte de efectele externe. Un worker preia pașii cu lease, revalidează datele/drepturile și execută operații idempotente.

Statusuri generale: `draft`, `needs_input`, `awaiting_authorization`, `ready`, `scheduled`, `running`, `waiting_external`, `completed`, `partially_completed`, `blocked`, `failed`, `cancelled`. Fiecare pas păstrează statusul specific al furnizorului. De exemplu `completed` pentru punerea în coadă nu poate fi mesajul final „livrat proprietarului”.

Comenzile dependente se execută secvențial; citirile independente se pot paraleliza. Loturile au liste de destinatari/entități identificabile, limite și rezultate pe rând. La schimbarea planului se salvează versiune nouă și se reconfirmă numai ce nu mai este acoperit de intenția/autorizarea precedentă.

### 7.5 Persistență și memorie operațională

Colecții propuse: conversații AI, mesaje AI, selecții, planuri, execuții/pași, evenimente/audit, reguli și execuții de automatizare. Denumirile finale sunt de implementare. Colecțiile AI trebuie server-managed în Security Rules; nu trebuie să cadă sub regula generică de scriere a membrilor agenției. Reguli separate pentru citirea propriilor conversații și eventual partajare explicită.

Memoria păstrează selecția reală și ID-urile: „primele trei”, „apartamentul al doilea”, „același client”. Sumarul conversației ajută contextul, dar nu înlocuiește starea executată sau autorizația. Datele curente și drepturile sunt reverificate; o fișă inaccesibilă ulterior nu rămâne accesibilă prin istoric/cache.

### 7.6 Observabilitate și eficiență

Jurnal: cine a cerut, intenția/parametrii validați, resursele, handlerul, momentul, schimbarea efectuată, rezultat și corelație cu furnizorul. Nu se salvează tokenuri sau toate documentele personale în audit. Se măsoară latența p50/p95, citirile Firestore, cost AI, cost de canal, joburi blocate și recuperări. Cotele pe agenție/utilizator și limitele planului sunt aplicate pe server.

## 8. Lipsuri obligatorii, ordonate după impact

| Prioritate | Lipsă | Motiv |
|---|---|---|
| P0 | Autentificare și politică unificată pe resursă/operație | Accesul general nu poate amplifica drepturile utilizatorului |
| P0 | Catalogul resurselor și query-uri autorizate pentru toate modulele | Rezumatul contactelor/proprietăților nu acoperă CRM-ul |
| P0 | Registru de acțiuni tipizate și servicii comune | Elimină regex ACTION și bypassul validărilor UI |
| P0 | Identități și referințe între module | Client/proprietar/conversație/Sales trebuie să indice aceeași persoană |
| P0 | Planuri, execuții și rezultate persistente | Refresh, reluare, loturi și follow-up nu depind de pagina deschisă |
| P0 | Idempotency, concurență și revalidare | Previene dubluri, suprapuneri și operații pe date schimbate |
| P0 | Date actuale, limite/query coverage și dovezi | Nu confundă prima pagină cu toate rezultatele |
| P0 | Separarea instrucțiunilor de conținutul CRM | Mesajele/anunțurile/fișierele nu pot impune comenzi suplimentare |
| P1 | Adaptori la toate familiile din catalog | Fiecare acțiune UI relevantă are echivalent în chat |
| P1 | Document retrieval și upload/alegere fișier | Agentul poate întreba despre orice document accesibil |
| P1 | Căutare Anunțuri proprietari indexată, câmpuri complete | Exactitate, acoperire și viteză |
| P1 | Acord telefonic în Prospectare și mapping spre conversație | Deblochează fluxul WhatsApp cerut |
| P1 | Recomandări/portal și comunicare cu rezultat separat | Păstrează feedbackul și dovada trimiterii |
| P1 | Scheduler mesaje și motor de automatizare | „Mâine” și „când apare” produc execuții reale |
| P1 | Metrici/rapoarte comune și timeline | Răspunsuri transversale exacte, nu totaluri inventate |
| P1 | UI de rezultate/progres/control și navigare | Agentul poate verifica și continua operația |
| P1 | Capability/readiness comun al integrărilor | Știe ce poate executa acum și de ce un canal e blocat |
| P1 | Autorizare la execuția amânată și schimbarea rolului | Joburile nu rulează cu drepturi revocate |
| P2 | Calendar extern, optimizare trasee, email general, semnare electronică | Extind funcțiile CRM, nu sunt presupuse existente |
| P2 | Căutare semantică avansată și optimizarea relevanței | Ajută întrebări libere, după exactitatea datelor/capabilităților |

P0 + P1 definesc asistentul complet pentru operațiile CRM existente. P2 conține funcții noi care necesită integrare sau infrastructură suplimentară; nu trebuie prezentate ca deja disponibile. Implementarea poate fi incrementală, dar livrarea doar a contactelor/vizionărilor nu satisface obiectivul final.

## 9. Automatizări pe întregul CRM

O automatizare are trigger, scope, condiții, acțiuni, program, autorizare, limite, stop rules, execuții și responsabil. Este editabilă/opribilă din chat și din panoul de automatizări.

| Trigger | Flux posibil | Control/oprire |
|---|---|---|
| Lead nou | Deduplicare, atribuire, task, răspuns eligibil și calificare | Intervenție agent/răspuns, lead duplicat sau canal blocat |
| Anunț nou potrivit căutării salvate | Selectează rezultate noi, notifică agentul, pregătește prospectare | Fără rezultate noi → fără mesaje; nu rezervă în masă dacă nu este autorizat |
| Proprietate CRM nouă/preț redus | Matching invers, portal/recomandări și comunicare eligibilă | Indisponibilitate, feedback negativ relevant, duplicat sau acord retras |
| Acord telefonic înregistrat | Continuă pasul WhatsApp al unui plan autorizat și valabil | Acordul singur nu inițiază o campanie nouă |
| Vizionare apropiată | Confirmare, reminder și task dacă nu răspunde | Reprogramare/anulare/confirmare deja primită |
| Vizionare finalizată | Feedback, alternative, ofertă/task și follow-up | Politică de timing configurată, refuz sau intervenție manuală |
| Client/proprietar fără răspuns | Secvență limitată sau escaladare spre apel | Răspuns/refuz/opt-out/număr maxim de încercări |
| Feedback portal | Actualizare priorități/preferințe propusă, task sau propunere de vizionare | Preferințele nu sunt suprascrise arbitrar dintr-un singur dislike |
| Ofertă acceptată/rezervare | Dosar Sales eligibil, checklist și termene | Nu dublează dosarul și nu pretinde contract încheiat |
| Document primit | Scanner/OCR, asociere, review, checklist și notificare | Informație incertă sau document respins → agent |
| Etapă/termen Sales | Acte lipsă, remindere și escaladare | Etapă schimbată, act primit, tranzacție anulată |
| Publicare eșuată | Diagnoză, corectare propusă, retry eligibil și raport | Fără retrimitere dacă rezultatul remote este necunoscut |
| Campanie depășește plafon/performanță slabă | Alertă și pauză/ajustare dacă autorizate | Nu creează cheltuieli suplimentare fără autorizarea corespunzătoare |
| Integrare expirată | Oprește pașii de canal, notifică și oferă reconnect | Nu substituie un cont/conexiune fără autorizare |
| Dimineața/săptămânal | Brief, priorități și raport cu acțiuni lansabile | Nu contactează automat persoane doar pentru că a generat un raport |
| Agent pleacă/rol revocat | Transfer explicit de responsabilități și oprirea joburilor neautorizate | Fără transfer automat al acordurilor/autorizărilor personale |

Workers/schedulere existente pentru Communications, anunțuri, apeluri AI, video și notificări se reutilizează. Motorul generic coordonează acțiunile; nu creează o a doua secvență care contactează persoana în paralel cu automatizarea existentă.

## 10. Experiența paginii Jarvis

1. **Conversație persistentă:** titlu, istoric, mesaje și reluarea contextului. Numai comenzi scrise în prima versiune.
2. **Rezultate verificate:** carduri/listă pentru anunțuri, proprietăți, clienți, documente și rapoarte, cu sursă și link CRM.
3. **Întrebări scurte pentru date lipsă:** selectează clientul duplicat, proprietatea, ora sau canalul. Nu cere din nou date deja disponibile.
4. **Card de acțiune:** entități, modificări, destinatari, canal, program și cost când există; pentru operații clare și autorizate, cardul poate arăta direct rezultatul.
5. **Plan vizibil pentru comenzi compuse:** pași, condiții, progres și elemente excluse/blocate.
6. **Panou operațional:** în curs, programate, în așteptare, eșuate, finalizate și automatizări active.
7. **Control:** modifică pasul/programul, oprește/continuă, deschide rezultatul, reia operația eligibilă și vezi istoricul.
8. **Starea capabilităților:** disponibil, necesită date, necesită rol/admin, necesită conexiune, în test, indisponibil sau neimplementat. Acestea nu sunt confirmări generale de siguranță, ci explicații operaționale.
9. **Artefacte:** preview/link pentru PDF, contract, raport, comparație și video generate, cu status job și asociere în CRM.
10. **Autorizare proporțională:** instrucțiunea explicită acoperă operația clară; loturi/cheltuieli/ștergeri ambigue primesc preview și clarificarea necesară. Politicile de aprobare existente rămân, de exemplu TikTok Ads și admin pentru anumite integrări.

Interfața nu afișează JSON-uri sau nume interne de tools ca experiență principală. Explică rezultatul în termeni de agent: „3 recomandări adăugate, 2 mesaje livrate, 1 blocat — acord lipsă”.

## 11. Exemple de comenzi compuse și criteriul lor de finalizare

### A. Prospectare Titan/Pipera

„Găsește 10 apartamente cu 2 camere în Pipera sub 160.000 EUR și contactează proprietarii pentru colaborare.”

Anunțuri proprietari → filtre verificate → listă persistentă fără dubluri → prospectare/rezervări → telefoane disponibile → contactare eligibilă → acord telefonic înregistrat de agent unde lipsește → șablon WhatsApp în planul autorizat → răspuns și condiții → următorul pas. Potrivirile CRM sunt oferite separat. Rezultat pe fiecare proprietar, fără promisiunea că 10 mesaje produc 10 colaborări.

### B. Recomandări și vizionare

„Găsește 3 proprietăți pentru Andrei, trimite-i selecția și programează follow-up mâine la 10.”

Client identificat → preferințe și feedback → matching existent → selecție validă → portal/recomandări fără resetarea feedbackului → mesaj eligibil → job pentru follow-up, verificat la scadență. Dacă Andrei răspunde înainte, pasul se oprește sau se transformă în următoarea acțiune relevantă conform regulii.

### C. Analiză, preț și publicare

„Analizează proprietatea X, pregătește prezentarea PDF și actualizează prețul la 125.000 pe site și pe portalurile conectate.”

Fișă/date/analiză → PDF salvat → modificare CRM autorizată → publicare/update pe fiecare canal eligibil → reconciliere și raport. Dacă Storia cere admin, pasul rămâne explicit blocat/delegabil prin fluxul existent; nu se declară toate portalurile actualizate.

### D. Dosar de vânzare

„Pentru contractul de vineri, spune-mi ce acte lipsesc, pregătește solicitările și pune taskuri pentru participanți.”

Dosar accesibil → checklist și documente/versiuni/review → lipsuri reale → solicitări separate pe participant → taskuri/termene. „Pregătește” nu înseamnă „trimite”; dacă se cere trimitere, folosește canalul eligibil și urmărește dovada.

### E. Raport managerial

„Compară rezultatele agenților în septembrie și arată unde pierdem conversia.”

Permisiuni pentru statisticile cerute → perioadă Europe/Bucharest → set complet de date/definiții → calcule comune → raport cu surse, limite și acțiuni propuse. Nu folosește doar ultimii 5 agenți sau primul lot de leaduri și nu schimbă responsabilități implicit.

### F. Oprire și reluare

„Oprește mesajele programate pentru clientul X; păstrează doar vizionarea de joi.”

Rezolvă clientul → identifică pașii/automatizările accesibile → oprește joburile neexpediate → păstrează vizionarea selectată → explică mesajele deja trimise/în curs care nu pot fi retrase. Refresh-ul nu reactivează pașii anulați.

## 12. Plan de implementare pentru acoperire completă

### Etapa 1 — fundație și inventar verificabil

Identitate/ACL/cote, catalog de date și acțiuni, query pe domeniu, entități/ID-uri, conversații/planuri/execuții, audit, worker și UI rezultate/progres. Acoperirea fiecărei familii este urmărită într-o matrice: read/query/aggregate/mutate/schedule/stop/tested. Nicio coloană „complet” doar pentru că tool-ul există.

### Etapa 2 — nucleul comercial complet

Anunțuri proprietari indexate și buton CRM, prospectare/identități/acord telefonic, matching/portal/recomandări, contacte/pipeline, proprietăți, taskuri/vizionări, inbox/apeluri/follow-up. Se închid toate cele cinci cerințe inițiale și variantele de anulare/reprogramare.

### Etapa 3 — tranzacții și documente

Sales, oferte/negociere, contracte, document retrieval/OCR/versiuni, email existent, checklist/notar/termene și pachete/exporturi. Handlerele păstrează auditul și permisiunile dosarului.

### Etapa 4 — distribuție și marketing

Portaluri/site/domeniu, colaborări, analiză de preț/prezentări/media/video, social și reclame. Reutilizarea ledgerelor, approval flows și autorizărilor financiare existente. Stare reală per integrare, job și publicare.

### Etapa 5 — agenție și automatizări transversale

Rapoarte/metrici/timeline, echipă/setări/billing/notificări, motor de reguli, capabilități/diagnoză, oprire/reluare și coordonarea tuturor workerelor. Teste ale accesului complet și comenzilor compuse peste module. Aceste funcții fac parte din obiectivul final chiar dacă sunt livrate ulterior nucleului comercial.

### Etapa 6 — funcții noi opționale

Calendar extern/rutare avansată, email general independent de runner, apeluri AI cumpărători și semnare electronică, dacă sunt cerute. Vocea rămâne în afara scope-ului actual. Nu este necesară construirea unui nou CRM, a unui nou motor de matching sau a unei noi baze de date de adevăr pentru primele cinci etape.

Nu se poate estima credibil un termen fix fără volumul datelor, configurarea integrărilor și rezultatele testelor de acoperire. Aprobarea Meta influențează canalul de trimitere, nu împiedică realizarea fundației și a celorlalte acțiuni.

## 13. Teste și condiții de acceptare pentru „Jarvis complet”

### Acoperire și date

- Pentru fiecare modul din catalog există citire, interogare și toate operațiile de business disponibile utilizatorului, cu status documentat pentru extensiile noi.
- Un contact/proprietate/anunț aflat dincolo de prima pagină sau de rezumatul AI este recuperabil.
- Comenzile „toate/câte” folosesc întregul set autorizat; eșecul unei pagini nu produce un total declarat complet.
- Leaduri arhivate, proprietăți vândute și istorice relevante sunt accesibile când sunt cerute.
- Documentele/atașamentele accesibile pot fi recuperate și interpretate; sursa/versiunea sunt vizibile. OCR incert rămâne incert.
- Un anunț nou salvat complet este găsit prin query indexat; lipsa normalizării este monitorizată și explicată. Nu se confundă prospețimea importului cu actualitatea internetului.
- Căutarea generală respectă Anunțuri proprietari ca sursă implicită și butonul CRM separat.
- Datele live/stocate, estimate/realizate, recomandate/trimise/livrate și generate/semnate sunt distincte.

### Permisiuni

- Agentul vede exact datele permise de politica CRM, inclusiv portofoliul larg unde are drept, fără să acceseze conversații/dosare interzise.
- Administratorul vede scope-ul agenției, nu date private ale altor agenții sau platformei.
- Revocarea accesului/plecarea agentului blochează citirea din cache/istoric și execuțiile viitoare neautorizate.
- Adaptorul server, workerul, indicii externi și artefactele aplică aceeași politică. Referințele către documente nu ocolesc verificarea prin URL.
- Colecțiile AI sunt protejate separat și nu acceptă scriere arbitrară de pași autorizați din browser.
- Acordul telefonic este atribuit agentului care îl confirmă; agent fără drept asupra fișei nu îl înregistrează.
- Schimbarea conexiunii WhatsApp nu ocolește retragerea acordului relevantă pentru destinatarul agenției.

### Execuție și concurență

- Nume duplicate sau referințe ambigue sunt rezolvate înainte de efecte, fără cereri inutile de date cunoscute.
- Aceeași comandă/retry nu dublează vizionarea, taskul, recomandarea, mesajul, apelul sau campania.
- Două operații simultane nu rezervă incompatibil prospectul, slotul sau bugetul.
- Modificarea prețului/statusului/acordului după preview este detectată la execuție.
- O comandă compusă raportează fiecare pas; eșec parțial nu devine succes total.
- Timeout după o cerere externă produce reconciliere/rezultat necunoscut, nu retrimitere automată fără dovadă.
- Publicarea/retragerea proprietății folosește serviciul lifecycle; ștergerea nu lasă anunțuri remote active fără tratare explicită.
- Readăugarea recomandării păstrează feedbackul clientului și nu corupe istoricul.
- O cerere de analiză sau draft nu produce implicit trimitere, publicare sau schimbare comercială.

### Programare și automatizare

- Joburile continuă după închiderea paginii și sunt recuperabile după repornirea workerului.
- „Mâine la 10” respectă Europe/Bucharest și schimbarea orei; se salvează și fusul/intenția locală.
- Mesajul viitor nu intră prematur în coada de expediere imediată.
- Răspunsul clientului, refuzul, opt-out-ul, anularea vizionării sau intervenția relevantă opresc pașii inutili.
- Reprogramarea anulează reminderul vechi și creează doar pașii noi necesari.
- Un trigger livrat de două ori nu execută fluxul de două ori.
- Fluxul activat și autorizat se poate continua fără a cere iar aprobarea acelorași pași; schimbările reale de scop/destinație/cost sunt tratate distinct.
- Integrarea neconfigurată, demo/test, canalul blocat sau plafonul atins au explicație și alternativă concretă.

### Calitate și performanță

- Răspunsul citează/linkează resursele CRM și separă faptele de inferențe.
- Conținutul unui email, anunț sau document nu poate comanda asistentului să ignore regulile sau să exporte date.
- Raportul folosește metrici comune, perioadă/scope și monedă corecte, fără a confunda valoarea portofoliului cu venit/comision.
- Se măsoară căutare cu cache rece/cald, paging, retrieval documente, cost AI, latența execuțiilor și recovery; nu se promite un timp fără măsurare.
- Funcțiile neimplementate sau capabilitățile indisponibile sunt recunoscute, nu simulate în răspuns.

## 14. Referințe de cod și verificări

| Sursă | Ce susține în audit |
|---|---|
| `src/app/(dashboard)/ai-assistant/page.tsx`, `src/ai/flows/chat.ts`, `src/app/api/ai-assistant/{chat,welcome}/route.ts` | Context limitat, state local, ACTION și handler-ele actuale |
| `src/app/api/search/route.ts` | Căutare globală limitată la 3 colecții și 5 rezultate fiecare |
| `src/lib/types.ts` | Contact/Property/Viewing/Task, portal/recomandări, Sales/documents/email, agenție și integrări |
| `firebase.json`, `src/firestore.rules`, `src/storage.rules` | Politica configurată, domenii ACL și reguli server-managed |
| `src/lib/firebase-app-hosting.ts`, `src/lib/sales-server.ts`, `src/lib/communications/model.ts`, `src/lib/collaboration/policy.ts` | Identitate și permisiuni specifice |
| `src/lib/billing/plans.ts`, `src/lib/billing/entitlements.ts`, `src/app/api/billing/*` | Funcții pe plan, seats și acțiuni de billing |
| `src/app/api/owner-listings/query/route.ts`, `src/lib/owner-listings/{search,types,utils}.ts` | Căutare corpus, filtre, cache și câmpuri normalizate existente |
| `src/app/api/owner-listings/{prospecting,import}/route.ts`, `src/app/(dashboard)/owner-listings/favorite/page.tsx` | Prospectare/rezervare/telefoane și importul care pregătește seed |
| `src/lib/matching-engine.ts`, `src/ai/flows/property-matcher.ts`, `src/app/(dashboard)/matching/page.tsx` | Matching existent și acțiuni UI asociate |
| `src/components/leads/detail/MatchedProperties.tsx`, `src/app/(dashboard)/leads/[leadId]/page.tsx`, `src/app/api/client-portal/[portalId]/feedback/route.ts` | Portal/recomandări/feedback și share prin wa.me |
| `src/app/(dashboard)/{viewings,tasks,dashboard}/page.tsx`, `src/components/viewings/*`, `src/lib/bucharest-time.ts` | Calendar/taskuri, durata și conversia de fus orar |
| `src/lib/communications/{server,outbound,search,optout,whatsapp-config,social}.ts`, `src/app/api/communications/[...path]/route.ts` | Mesagerie, consimțământ/admin, statusuri, Typesense și publicare socială |
| `src/app/api/communications-worker/route.ts`, `functions/src/{communications,index,notifications}.ts` | Worker și schedulere existente |
| `src/app/api/ai-outreach/*`, `src/lib/ai-outreach/{server,types}.ts` | Apeluri proprietari, rezultate, programare și limite |
| `src/app/api/sales/*`, `src/lib/sales*.ts`, `src/components/sales/*`, `src/lib/pdf-text.ts` | Dosare, documente/OCR, versiuni, email/runner și audit |
| `src/app/api/contracts/*`, `src/lib/contracts.ts`, `src/components/contracts/DocumentTemplateEditor.tsx` | Generare contracte și șabloane |
| `src/lib/property-removal/*`, `src/app/api/properties/remove/route.ts` | Lifecycle/retragere/ștergere și istoricul proprietății |
| `src/app/api/imobiliare/*`, `src/app/api/storia/*`, `src/app/api/romimo/[action]/route.ts`, serviciile asociate | Publicare/promovare/reconciliere și condiții de canal |
| `src/app/api/collaboration/*`, `src/lib/collaboration/*` | Catalog, linkuri, leaduri, cazuri, mesaje și permisiuni |
| `src/lib/pricing-analysis.ts`, `src/lib/property-sales-context.ts`, `src/lib/property-sales-recommendations.ts`, `src/app/api/properties/[propertyId]/*` | Analize de preț, context comercial, PDF, nearby și video |
| `src/lib/property-presentations/*`, `src/lib/property-video-tours.ts`, `src/lib/tiktok-studio-jobs.ts` | Materiale și joburi media |
| `src/app/api/marketing/*`, `src/lib/meta-marketing.ts`, `src/lib/tiktok-marketing.ts`, `src/lib/tiktok-ads/*` | Campanii, social/studio, capabilități, autorizări spend și approval |
| `src/app/api/agency/agents/*`, `src/app/(dashboard)/{settings,gmail,reports,sold-properties}/page.tsx` | Echipă, setări, template-uri email, rapoarte și vânzări |
| `src/app/api/notifications/*`, `src/lib/notifications/types.ts`, `src/lib/runtime-mode.ts`, `src/lib/demo/guards.ts` | Notificări, preferințe și limitarea demo |

Acest audit stabilește domeniul și lipsurile pentru implementare. Matricea finală de handler-e și testele de runtime trebuie completate pe parcurs; simpla prezență a unui API nu certifică funcționarea lui în producție.
