# Audit AI Assistant: acțiuni CRM și automatizări

**Actualizare după implementare:** pentru starea codului nou, verificări și activarea în producție, vezi [raportul implementării](./ai-assistant-implementation-status-2026-10-04.md). Constatările de mai jos descriu baza auditului inițial.

Pentru obiectivul extins „Jarvis” cu acces la toate modulele CRM, documentul de referință este [auditul complet Jarvis](./ai-assistant-jarvis-complete-audit-2026-10-04.md). Acest document păstrează detaliile fluxurilor inițiale, acordului telefonic și căutării indexate.

Data: 4 octombrie 2026. Audit revizuit după clarificările utilizatorului: matching-ul existent se reutilizează, agentul confirmă în CRM acordul telefonic al proprietarului pentru WhatsApp, iar căutările generale de proprietăți folosesc implicit Anunțuri proprietari, cu potrivirile din CRM accesibile separat prin buton. Audit static al codului din checkout-ul local, corelat cu cerințele și captura furnizate. Nu reprezintă o verificare a configurării, livrării mesajelor sau serviciilor din producție. Nu au fost trimise mesaje și nu au fost modificate date CRM.

## Concluzie

Transformarea este fezabilă. CRM-ul are deja module pentru vizionări, taskuri, matching în ambele direcții, portalul clientului cu recomandări și feedback, prospectare, mesagerie WhatsApp și apeluri AI către proprietari. AI Assistant trebuie să devină interfața de comandă a acestor module, cu execuție pe server și rezultate verificabile. Nu este necesară reconstruirea matching-ului sau a portalului.

Pagina actuală este conversațională, dar are o singură punte rudimentară către o acțiune: crearea unei vizionări. O schimbare vizuală și prompturi noi nu rezolvă cerințele. Este necesar un motor de acțiuni și fluxuri persistente.

**Definiția unei acțiuni complete:** identifică entitățile corecte, folosește datele actuale, verifică drepturile și condițiile, execută operația, confirmă rezultatul, păstrează istoricul și gestionează pașii următori. Un draft, o fereastră WhatsApp deschisă sau un task de apel nu dovedesc contactarea persoanei. Operațiunile care depind de răspunsul unui om trebuie să rămână explicit în așteptare.

## 1. Ce există și ce lipsește

| Cerință | Bază existentă în cod | Lipsă pentru AI Assistant |
|---|---|---|
| Programează o vizionare pentru clientul X | Colecție și formulare de vizionări; pagina interpretează un bloc textual AI și inițiază o salvare | Identificare prin ID, completarea datelor lipsă, durată, verificarea conflictelor, salvare confirmată, notificarea participanților și confirmarea lor |
| Trimite proprietăți potrivite clientului Y | Matching existent; portal, recomandări și feedback; mesagerie cu coadă și statusuri | Apelarea din chat, actualizare consecventă portal/istoric, trimitere API, istoric de livrare și deduplicare; distribuirea `wa.me` existentă nu confirmă trimiterea |
| Găsește 5 apartamente în Titan sub 130.000 EUR | Portofoliu CRM, catalog de locații, API de căutare a anunțurilor de proprietari | Filtre stricte și căutare implicită în Anunțuri proprietari; verificare separată a portofoliului și buton „Vezi potrivirile din CRM” dacă există rezultate |
| Fă follow-up cu clientul Z | Istoric contacte, taskuri, inbox și mesagerie | Citirea interacțiunilor efective, alegerea următorului pas, trimitere/programare, oprirea secvenței la răspuns sau refuz, actualizarea CRM |
| Caută 10 apartamente cu 2 camere în Pipera sub 160.000 EUR și contactează proprietarii | Anunțuri filtrabile, prospectare, recuperarea unor telefoane, apeluri AI cu limite | Flux comun căutare → verificare → prospectare → contactare eligibilă → urmărire răspuns → colaborare; identitate unică pe proprietar și progres pe fiecare destinatar |
| Confirm acordul telefonic pentru WhatsApp | Registru de consimțăminte și istoric în Communications | Buton pentru agent, verificarea dreptului asupra prospectului, legarea telefonului/prospectului/contactului/conversației, scop și dovadă; ruta actuală cere administrator |
| Adaugă proprietățile în portalul clientului | `portals/{portalId}/recommendations`, `recommendationHistory`, feedback | Handler pe server, activarea portalului dacă lipsește și este autorizată, scriere atomică, păstrarea feedbackului existent |
| Găsește cumpărători pentru proprietatea X | Matching invers existent | Acțiune din chat, filtrarea contactelor eligibile și controlul contactării în masă |
| Creează/modifică/finalizează un task | Colecție și UI taskuri | Handler comun, dată/oră precisă, legare la client/prospect, rezultat confirmat și deduplicare |
| Actualizează preferințele clientului | ContactPreferences, locații canonice, formular public de preferințe | Extragere în câmpuri, diferențe vizibile, validare și urmărirea sursei modificării |
| Înregistrează oferta și mută negocierea | Offer și Sales, etape și audit pentru unele operații | Conectare la asistent, contraofertă/termene unde sunt necesare, drepturi și explicitarea deciziei comerciale |
| Importă proprietatea unui proprietar interesat | API de import care pregătește date pentru formular | Salvare efectivă, prevenirea duplicatelor, asocierea proprietarului și condițiilor colaborării; importul actual nu salvează singur proprietatea |
| Solicită documente / pregătește contract | Sales, checklist și generator de contracte | Acțiuni din chat, selecția participanților/documentelor, validarea datelor și urmărirea cererilor; generarea nu înseamnă semnare |
| Activează o regulă recurentă | Schedulere specializate existente | Reguli persistente, trigger/condiții/pași, scheduler pentru mesaje viitoare, oprire la răspuns și coordonarea cu automatizările existente |

„Oferte potrivite” trebuie să însemne recomandări de proprietăți. În `AddOfferDialog.tsx`, o ofertă este o ofertă formală de preț din partea clientului. Se reutilizează `PortalRecommendation` și `recommendationHistory`, adăugând evidența comunicărilor într-un jurnal asociat. Nu se creează un al doilea sistem de recomandări paralel cu portalul și nu se transformă recomandarea într-o ofertă formală.

## 2. Probleme constatate în implementarea actuală

1. **Execuție din text liber.** Pagina caută `[ACTION:scheduleViewing]` cu regex și parsează JSON din răspuns. Nu există un contract structurat de acțiuni. Datele din CRM și conversații trebuie tratate ca date, nu ca instrucțiuni de executat.
2. **Identificare ambiguă.** Clientul și proprietatea sunt căutate prin egalitate pe nume/titlu. Dublurile pot selecta persoana sau proprietatea greșită; o diferență de formulare poate bloca acțiunea fără explicație specifică.
3. **Succes prematur.** `addDocumentNonBlocking` nu este așteptat înainte de toastul „Vizionare programată!”. Inițierea scrierii nu dovedește salvarea. Asistentul trebuie să primească rezultatul serverului și ID-ul vizionării.
4. **Vizionare incompletă.** Puntea AI nu verifică suprapuneri, nu include durata din formularul normal și nu verifică disponibilitatea reală a proprietarului/clientului. „Înregistrată în calendar” și „confirmată de participanți” sunt rezultate diferite.
5. **Context insuficient.** Modelul primește rezumate pentru maximum 80 contacte și 60 proprietăți active; lipsesc ID-urile și multe criterii. Istoricul este redus la ultimele 8 mesaje. Nu poate efectua o căutare exhaustivă sau un follow-up informat doar din aceste rezumate.
6. **Încărcare excesivă.** Browserul încarcă și trimite listele de contacte/proprietăți/vizionări, chiar dacă modelul folosește doar un rezumat. Sunt necesare interogări pe server, cu câmpuri minime și paginare.
7. **Autentificare absentă în rutele inspectate.** Rutele `chat` și `welcome` citesc direct corpul cererii; nu verifică tokenul și apartenența la agenție în handler. Spre deosebire de API-urile Communications/Owner Listings, nu își construiesc contextul din identitatea verificată. Trebuie adăugate autorizare, validare, limitare de trafic și cote. Protecțiile externe de deployment nu au fost verificate.
8. **Reguli temporale contradictorii.** Promptul interzice follow-up în ziua vizionării, apoi îl recomandă uneori în aceeași zi. Unele calcule de zi/oră folosesc fusul procesului, deși afișarea indică Europe/Bucharest. Politica trebuie să fie configurabilă și executată determinist în fusul agenției.
9. **Fără persistență operațională.** Mesajele paginii sunt în state local React. Nu există în această pagină conversații salvate, planuri, execuții, anulare, reluare sau istoric de acțiuni.
10. **Microfon decorativ.** Iconița nu are aici funcționalitate de transcriere. Interfața trebuie să afișeze capabilități reale.
11. **Recomandare adăugată ≠ mesaj trimis.** Există `window.open(wa.me)` în `MatchedProperties.tsx`. Asistentul trebuie să folosească serviciul Communications pentru trimitere observabilă. Adăugarea în portal și livrarea WhatsApp au statusuri separate.
12. **Recomandările există deja, dar se pot pierde informații.** UI-ul scrie separat recomandarea în portal și istoricul contactului, fără a aștepta confirmările. Readăugarea aceleiași proprietăți setează `clientFeedback: 'none'`. Handlerul comun trebuie să păstreze feedbackul și să actualizeze ambele înregistrări atomic.
13. **Programarea mesajelor lipsește din contractul outbound.** `queueMessage` acceptă text, șablon, atașament și requestId, fără `scheduledAt`. Workerul drenează mesajele aflate în coadă. Pentru „trimite mâine” este necesar un strat de programare care le pune în coadă la scadență, după reverificări; coada actuală nu trebuie folosită ca o programare viitoare.
14. **Identitatea proprietarului nu este unificată.** Prospectarea are anunț, telefon și agent responsabil; pornirea conversației WhatsApp cere `contactId`. Nu se presupune că fiecare prospect are deja contact. Tipurile Contact nu au o categorie explicită Proprietar (`Cumparator`, `Client`, `Partener`); trebuie definită o mapare compatibilă sau un rol suplimentar, fără migrarea arbitrară a datelor existente.
15. **Zona din căutarea externă poate fi doar o mențiune.** Filtrul `search` verifică termeni în titlu, locație, descriere și alte câmpuri. O descriere care menționează Pipera nu dovedește localizarea în Pipera. Căutările stricte necesită locație verificată/canonică și trebuie să marcheze rezultatele cu locație incertă.
16. **Modelul de vizionare nu acoperă toate stările operaționale.** `Viewing` are scheduled/completed/cancelled, fără confirmări separate ale clientului/proprietarului, no-show și feedback structurat. Aceste date trebuie adăugate compatibil, fără a confunda statusul vizionării cu statusul mesajului.
17. **Rezervarea unui prospect trebuie respectată pe server.** UI-ul are rezervare, preluare și rezultat de contactare. AI-ul trebuie să respecte aceeași proprietate a fișei și să prevină concurența între agenți, nu să ocolească regulile printr-un handler nou.
18. **Importul pregătește date, nu finalizează listarea.** API-ul de import returnează un seed, iar UI-ul deschide formularul de adăugare. AI Assistant trebuie să distingă „date preluate”, „proprietate salvată” și „proprietate publicată”.

Surse principale: `src/app/(dashboard)/ai-assistant/page.tsx`, `src/ai/flows/chat.ts`, `src/app/api/ai-assistant/{chat,welcome}/route.ts`, `src/firebase/non-blocking-updates.tsx`.

## 3. Cum trebuie să funcționeze cerințele

### Programarea unei vizionări

Identifică clientul și proprietatea prin ID; cere numai datele lipsă. Transformă „mâine la 17:00” în ora Europe/Bucharest. Verifică durata, programul agentului și eventualele vizionări existente. Creează vizionarea și taskurile aferente, apoi pregătește sau trimite confirmări prin canalul eligibil. Arată legătura spre vizionare și statusul fiecărui participant. Permite reprogramare și anulare, cu oprirea reminderelor vechi.

### Recomandări de proprietăți către client

Citește preferințele, recomandările deja existente și istoricul trimiterilor. Apelează matching-ul existent, cu filtre obligatorii înainte de scor; bugetul și numărul camerelor nu devin aproximative fără acordul agentului. Explică potrivirea și datele lipsă. Reutilizează portalul clientului pentru selecție și feedback, cu linkuri publice autorizate, fotografii și prețuri verificate, fără date private despre proprietari. Înregistrează separat statusul recomandării și al comunicării; programează follow-up care se oprește la răspuns. Feedbackul anterior nu se resetează la retrimitere.

### Căutare din limbaj natural

**Regulă de produs confirmată:** pentru o cerere generală precum „Dă-mi 5 proprietăți în Titan sub 130.000 euro”, sursa principală și implicită este **Anunțuri proprietari**, nu portofoliul CRM. Nu solicită alegerea sursei pentru această comandă obișnuită. Dacă agentul cere explicit portofoliul CRM sau altă sursă accesibilă, respectă acea cerere. Acest comportament privește căutările generale; nu schimbă automat sursele matching-ului existent pentru un client.

Extrage tipul dacă este specificat, zona canonică, tranzacția, moneda, plafonul strict și limita. „Proprietăți” nu devine automat „apartamente”; pentru cererea „5 apartamente” aplică filtrul de apartamente. Caută rezultatele principale în Anunțuri proprietari și verifică separat potrivirile din CRM cu aceleași criterii. Arată sursa și momentul actualizării.

Dacă există potriviri în CRM, afișează sub rezultatele principale butonul exact **„Vezi potrivirile din CRM”**, eventual cu numărul de rezultate într-un indicator separat. La apăsare, deschide o listă/secțiune distinctă cu aceleași filtre și linkuri către proprietățile CRM. Limita cerută de 5 se aplică listei principale din Anunțuri proprietari; lista CRM are paginare sau un control separat de afișare. Verificarea CRM se face fără a întârzia inutil lista principală.

Dacă există numai 3 rezultate valide în Anunțuri proprietari, afișează 3 și explică deficitul; nu completează automat lista până la 5 cu proprietăți CRM. Butonul CRM rămâne disponibil dacă există potriviri, inclusiv când nu există rezultate externe. Dacă nu există potriviri în CRM, nu afișează un buton activ care duce la o listă goală. În caz de eroare la verificarea CRM, marchează verificarea ca nereușită și permite reluarea; nu declară că nu există potriviri. Anunțul și proprietatea CRM aferente se pot corela pentru deduplicare și context, păstrând listele separate.

Alternativele în zone apropiate sau peste buget apar separat și numai ca alternative explicite. Pentru Pipera, folosește catalogul existent și clarifică aria dacă are mai multe interpretări relevante. Verifică TVA/comisionul când informația există; marchează necunoscutele.

### Follow-up

Distinge „creează un task de apel”, „trimite un mesaj acum” și „pornește o secvență”. Folosește ultimul mesaj, oferta/recomandarea, vizionarea, obiecțiile și agentul responsabil. Nu trimite o confirmare pentru o vizionare trecută și nu contactează din nou clientul care a răspuns între timp. Un apel AI către clienți ar fi o extensie separată: modulul inspectat este orientat către proprietarii din prospectare.

### Prospectare și colaborare

Caută anunțuri disponibile în sursele integrate, verifică tipul, prețul, camerele și zona; apoi deduplică pe anunț, proprietate și telefon. Adaugă rezultatele eligibile în prospectare și verifică telefonul, contactările anterioare și blocările. Agentul poate alege apel uman/task, apel AI dacă serviciul este activ și cazul eligibil, sau WhatsApp dacă există acordul necesar. Înregistrează răspunsul, condițiile colaborării și următorul pas. Acceptarea verbală nu trebuie echivalată automat cu un contract semnat sau cu dreptul de publicare.

## 4. WhatsApp: pregătire înainte de aprobarea Meta

Integrarea inspectată are deja conversații asociate contactelor, mesaje cu coadă, preview, șabloane, verificări de consimțământ, bugete, identificatori de cerere și corelarea confirmărilor de livrare. Aceste servicii trebuie reutilizate, păstrând verificările existente.

În cod, readiness pentru producție depinde de configurare, modul `production`, aprobări și billing; modul test limitează accesul și destinatarii. Autorizarea Meta este o dependență de canal, nu motivul amânării motorului CRM.

Politica oficială verificată la audit cere permisiunea destinatarului pentru contactare și respectarea retragerii acordului. Inițierea conversațiilor și mesajele în afara ferestrei de 24 de ore necesită șabloane aprobate. Automatizarea răspunsurilor trebuie să ofere acces clar la un om. Un număr public într-un anunț nu dovedește acordul pentru mesaje WhatsApp din partea agenției.

Sursă: [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy), versiunea afișată: 23 septembrie 2026.

### Cerință confirmată: acord telefonic înregistrat de agent

În Prospectare va exista un buton **„Confirm acordul WhatsApp”**, apăsat de agent după ce proprietarul și-a dat acordul în apelul telefonic. Nu este necesar un buton apăsat de proprietar pentru acest flux. Confirmarea reprezintă înregistrarea acordului efectiv obținut, nu obținerea acordului prin simpla apăsare.

Dialogul va afișa: „Confirm că proprietarul și-a dat acordul în apelul telefonic să primească mesaje WhatsApp de la [agenție] privind colaborarea pentru această proprietate.” Agentul poate indica data apelului și o notiță privind acordul. Identitatea agentului, agenția și data înregistrării se stabilesc pe server. Înregistrarea păstrează proprietarul/contactul, telefonul normalizat, anunțul asociat, scopul, sursa `phone_call`, data acordului și istoricul modificărilor. Acordul pentru colaborare nu este extins automat la campanii fără legătură cu acest scop.

După salvare, fișa afișează **„Acord înregistrat”**, agentul și data. Butonul **„Trimite șablon de colaborare”** devine disponibil dacă și conexiunea, destinatarul, șablonul aprobat, categoria comunicării și bugetul sunt eligibile. În test se păstrează restricțiile destinatarilor. Un acord retras blochează trimiterile, iar AI Assistant nu poate declara sau înregistra singur un acord presupus.

Mecanismul existent de consimțământ din Communications va fi reutilizat. În prezent ruta de înregistrare este rezervată administratorului și cere o conversație existentă; pentru acest flux trebuie permisă înregistrarea de către agentul autorizat pe fișa de prospectare/contact, cu asociere la conversația și conexiunea WhatsApp corespunzătoare. Telefonul comun mai multor anunțuri trebuie tratat ca un singur destinatar pentru prevenirea contactărilor duplicate, păstrând scopul acordului.

Acțiunile trebuie să existe acum în interfață, cu stări exacte: pregătită, în așteptarea agentului, programată, blocată de canal, în coadă, acceptată de furnizor, livrată, citită, eșuată, rezultat necunoscut. Aprobarea ulterioară a Meta nu trebuie să trimită automat drafturi vechi: este necesară o nouă verificare a disponibilității, destinatarului, acordului, costului și intenției salvate.

## 5. Alte acțiuni reale recomandate

| Acțiune | Rezultat concret |
|---|---|
| Creează/actualizează un contact din conversație sau notițe | Contact deduplicat, preferințe structurate, sursa datelor, agent responsabil |
| Califică un client | Buget, finanțare, termen, zone, camere, criterii obligatorii; task pentru informațiile lipsă |
| Pregătește o zi de vizionări | Propuneri de intervale și traseu; salvare în calendar după verificare; rutarea necesită serviciu suplimentar |
| Gestionează reprogramări și absențe | Modificarea vizionării, anularea reminderelor vechi, comunicare și task de recuperare |
| Extrage feedback după vizionare | Feedback salvat, preferințe ajustate, shortlist nou |
| Găsește cumpărători pentru o proprietate nouă | Matching invers cu motorul existent, selecție și recomandări trimise eligibil |
| Înregistrează o ofertă formală și urmărește negocierea | Ofertă de preț, obiecții, termen și task; acceptarea comercială rămâne explicită |
| Pregătește colaborarea cu proprietarul | Fișă de prospectare, condiții, întâlnire, draft document și checklist |
| Cere/urmărește documentele tranzacției | Listă de documente lipsă, comunicare, termene, taskuri; reutilizarea modulului Sales |
| Optimizează o listare | Draft descriere, checklist fotografii, câmpuri lipsă și sugestie de preț; aplicare controlată |
| Pregătește/programază promovarea | Drafturi și publicări prin modulele existente; canal autorizat și buget explicit |
| Repartizează leaduri și sarcini | Atribuire în limitele rolului, notificare, termen și escaladare |
| Curăță datele CRM | Detectare duplicate și date incomplete; propunere de comasare cu istoric și verificare |
| Generează raport operațional | Vizionări, contactări, răspunsuri și acțiuni restante pe baza execuțiilor, fără rezultate inventate |

## 6. Automatizări recomandate

Automatizarea înseamnă eveniment sau program → condiții → acțiune → rezultat urmărit. Nu este doar o sugestie afișată zilnic.

| Declanșator | Automatizare | Condiție de oprire/control |
|---|---|---|
| Lead nou | Deduplicare, atribuire, task de contact; mesaj de primire când canalul permite | Nu dublează contactarea dacă agentul a intervenit |
| Proprietate nouă | Matching invers, selecții pentru clienții relevanți | Exclude clienți închiși/arhivați și recomandări duplicate |
| Reducere de preț | Recalculează potrivirea și pregătește notificări | Revalidare preț/disponibilitate și acord de comunicare |
| Înainte de vizionare | Confirmare și reminder, apoi task dacă nu există răspuns | Vizionare anulată/reprogramată sau confirmare deja primită |
| Vizionare finalizată | Feedback și follow-up la intervalul configurat | Refuz, răspuns, negociere începută sau intervenție manuală |
| Client fără răspuns | Secvență limitată de follow-up cu alternative relevante | Răspuns, opt-out, închidere, număr maxim de încercări |
| Căutare salvată | Monitorizează rezultate noi și notifică agentul/clientul eligibil | Fără mesaje dacă nu apar rezultate noi; fără dubluri |
| Proprietar interesat de colaborare | Task, întâlnire, documente și verificarea condițiilor | Nu publică automat fără drepturi și disponibilitate verificate |
| Mesaj important primit | Extrage intenția, propune/actualizează date și atribuie task | Incertitudine, reclamație sau negociere sensibilă → agent |
| Negociere/document blocat | Reminder și escaladare către responsabil | Termen rezolvat sau etapă schimbată |
| Dimineața | Brief operațional cu acțiuni lansabile | Priorități explicate din date, fără mesaje externe implicite |

În cod există deja schedulere pentru mesagerie, anunțuri, apeluri AI programate și notificări interne. Reminderul intern de vizionare nu dovedește o confirmare WhatsApp trimisă clientului. Motorul propus trebuie să reutilizeze infrastructura și să evite automatizări paralele care contactează aceeași persoană.

## 7. Arhitectură și interfață

Flux recomandat: cerere → identificare intenție și entități → interogări autorizate → plan structurat → validări → execuție → urmărire rezultat → actualizare conversație.

Registru inițial de acțiuni: `searchProperties`, `searchOwnerListings`, `matchClientProperties`, `createViewing`, `rescheduleViewing`, `cancelViewing`, `createTask`, `updateContactPreferences`, `preparePropertyRecommendations`, `sendRecommendations`, `sendFollowUp`, `saveProspectingListings`, `scheduleOwnerCall`, `createAutomation`, `pauseAutomation`.

Fiecare acțiune are schemă de intrare, permisiuni, condiții, preview unde este necesar, handler pe server și rezultat tipizat. AI-ul selectează acțiunile; serverul verifică datele și dreptul de execuție. Identitatea agenției și agentului nu este acceptată ca adevăr din payloadul browserului.

Persistență propusă, separată pe agenție: conversații AI, mesaje AI, planuri, execuții, pași, reguli de automatizare, execuții de automatizare și jurnalul comunicărilor asociat recomandărilor existente. Conversațiile AI sunt distincte de conversațiile WhatsApp din Communications. Un pas păstrează ID, parametri validați, autor, entități, programare, rezultat, motiv de blocare și cheie de deduplicare. Workerul rulează și după închiderea paginii.

Pentru operații multiple, raportează fiecare rezultat. La timeout după o cerere externă, nu retrimite automat până nu reconciliază rezultatul; integrarea Communications are deja un model pentru statusul necunoscut. La anulare, oprește pașii neexecutați; mesajele deja livrate nu pot fi anulate prin rollback.

Noua pagină:

- Conversație cu istoric salvat și comenzi reale.
- Rezultate ca liste/carduri de proprietăți și contacte, cu linkuri spre CRM.
- Card de acțiune cu destinatar, selecție, dată, canal, cost estimat și câmpuri lipsă.
- Panou cu acțiuni în curs, programate, blocate și finalizate, plus automatizări active.
- Butoane de modificare, executare, oprire și acces la rezultatul CRM.
- Sugestii calculate din evenimente reale, de exemplu „3 vizionări fără confirmare”, care deschid o selecție verificabilă.

Niveluri configurabile de autonomie: căutare/analiză directă; modificări CRM directe când instrucțiunea este explicită și datele sunt clare; comunicare externă conform autorizării agentului sau regulii salvate; operații de masă cu destinatari și limite vizibile. Nu este necesară confirmarea repetată a unei acțiuni deja autorizate. Ștergeri, comasări, angajamente comerciale și modificări sensibile au controale distincte.

## 8. Ordinea implementării

1. **Fundație:** autentificare, context pe server, scheme, ID-uri, planuri/execuții persistente, fus orar, jurnal și deduplicare; înlocuirea blocului textual ACTION.
2. **Primul set utilizabil:** căutare internă și externă, matching, taskuri, creare/reprogramare/anulare vizionări, istoric și carduri de rezultate.
3. **Comunicare:** recomandări și follow-up prin Communications, șabloane, acorduri, costuri, statusuri reale; funcționare explicită în test și canal blocat.
4. **Prospectare completă:** salvare liste, telefoane disponibile, apeluri existente, urmărire răspuns și colaborare. Extinderea apelurilor către clienți este un proiect distinct.
5. **Automatizări:** reguli pe evenimente, scheduler, oprire la răspuns, limite de frecvență, coordonare între agenți și indicatori de conversie.
6. **Extensii:** calendar extern, rutare vizionări, voce, documente și promovare mai avansată, după stabilizarea operațiilor de bază.

Nu este necesar să așteptăm aprobarea Meta pentru etapele 1–2 și pregătirea etapelor 3–5. Activarea trimiterilor în producție trebuie bazată pe readiness verificat al fiecărei conexiuni.

## 9. Criterii de acceptare

- „5 proprietăți în Titan sub 130.000 EUR” returnează implicit rezultate validate din Anunțuri proprietari; nu inventează rezultate și nu completează lista cu portofoliul CRM pentru a atinge 5.
- Dacă există potriviri în CRM, butonul „Vezi potrivirile din CRM” deschide o listă distinctă cu aceleași filtre. Nu apare ca buton activ dacă verificarea confirmă zero potriviri.
- Clientul cu nume duplicat este ales explicit înainte de o modificare/contactare.
- Vizionarea apare în CRM cu durata și ora corectă; mesajul de succes vine după salvare.
- Retrimiterea aceleiași cereri nu dublează vizionarea, taskul sau mesajul.
- Utilizatorul nu poate accesa sau modifica date ale altei agenții ori conversații neautorizate.
- „Trimite recomandările” arată exact selecția și destinatarul; statusul de coadă nu este prezentat ca livrare.
- Lipsa acordului, șablonului, telefonului sau canalului produce un motiv concret și o alternativă utilă.
- „Contactează 10 proprietari” urmărește individual rezultatul și nu promite 10 colaborări.
- Răspunsul clientului, refuzul sau anularea vizionării opresc pașii viitori corespunzători.
- Reprogramarea nu lasă reminderul vechi activ.
- Planurile și programările persistă după refresh și închiderea aplicației.
- Teste de execuție acoperă concurența, rezultatul extern necunoscut, izolarea agențiilor și schimbările de oră Europe/Bucharest.

## 10. Lipsuri necesare pentru o pagină operațională completă

Priorități: **P0** = fundament fără de care execuția este nesigură/inexactă; **P1** = necesar pentru toate cerințele de bază ale utilizatorului; **P2** = extindere valoroasă după funcționarea completă a acestora. P0 și P1 formează livrarea completă inițială.

### P0 — fundația tuturor acțiunilor

| Livrabil | Ce trebuie adăugat | Dovada finalizării |
|---|---|---|
| Identitate și acces | Token verificat, context agenție/agent pe server, verificări per contact/prospect/conversație, limite plan și cote AI unde se aplică | Accesul neautorizat este respins înainte de citire, cost sau scriere |
| Contracte de acțiuni | Scheme valide, enum de operații, rezultate tipizate, interdicția executării textului arbitrar | Blocul ACTION și nume/titluri folosite ca chei sunt eliminate |
| Rezolvarea entităților | ID-uri, căutare contacte/proprietăți, selecție pentru nume duplicate și referințe precum „al doilea apartament” | Dialogul păstrează selecțiile și nu schimbă destinatarul între pași |
| Context la cerere | Query-uri complete/paginate, date minime, catalog locații, ultima interacțiune și feedback | Clientul/proprietatea nu sunt excluși doar fiindcă depășesc primele 80/60 înregistrări |
| Servicii comune | Handlere CRM reutilizabile de UI și asistent; păstrarea efectelor și regulilor existente | Același rezultat și aceleași drepturi din formular și chat |
| Execuții persistente | ID de cerere, plan/pași, jurnal, rezultat, deduplicare și control al concurenței | Refresh/retry nu duplică acțiunile și nu pierde starea |
| Revalidare | Disponibilitate, date/versionare, agent responsabil, acord, buget și canal verificate din nou la execuție | O modificare făcută între propunere și execuție este detectată |
| Timp și worker | Ora UTC salvată, timezone explicit, scadențe, lease și reluare pentru operații eligibile | Funcționează după închiderea paginii și la schimbarea orei |
| Rezultate reale | Status intern separat de status furnizor și rezultat comercial | Asistentul nu declară „livrat”, „confirmat” sau „colaborare acceptată” fără dovadă |
| Protejarea datelor | Câmpuri minime către model, excluderea identificatorilor personali fără utilitate, separarea instrucțiunilor de texte CRM | Notițele/anunțurile nu pot cere executarea unor acțiuni suplimentare |

### P1 — închiderea fluxurilor cerute

| Flux | Piese care lipsesc pentru a fi complet |
|---|---|
| Căutare | Filtre structurate din română, Anunțuri proprietari ca sursă implicită principală, verificare CRM separată și buton „Vezi potrivirile din CRM”, locație verificată, moneda și tranzacția, limită exactă, rezultate insuficiente explicate, selecție reutilizabilă în pașii următori |
| Matching | Acțiune care apelează motorul existent și matching-ul invers; păstrează constrângerile agentului, explică excluderile și citește feedbackul/recomandările existente |
| Recomandări | Portal existent sau creare autorizată, selecție salvată atomic, feedback păstrat, link valid, jurnal de comunicare, trimitere și statusuri, evitarea retrimiterii automate a aceleiași selecții |
| Vizionări | Contact/proprietate/agent/dată/durată; disponibilitate cunoscută vs necunoscută, prevenirea suprapunerilor, confirmări pe participant, reprogramare/anulare și curățarea acțiunilor viitoare |
| Taskuri | Creare/editare/finalizare și termen exact; legarea la prospect când nu există contact, agent responsabil, prevenirea taskurilor duble și actualizarea la schimbarea planului |
| Acord telefonic WhatsApp | Butonul agentului în Prospectare, sursa/date/scop/evidență, autorizare pe fișă, maparea spre registrul existent, status retras și istoric; AI-ul nu apasă în locul agentului o declarație de acord |
| Proprietar → contact/conversație | Telefon normalizat, deduplicare între anunțuri și contacte, rol de proprietar compatibil, conexiune de expediere aleasă, acces la conversația existentă și reguli de transfer |
| Contactare proprietari | Liste persistente, telefoane în așteptare, proprietari deja contactați/blocați, rezervări ale altor agenți, canal eligibil, șablon și cost, progres separat pe fiecare destinatar |
| Apeluri | Adaptoare la apelurile AI existente către proprietari; task/apel manual ca rezultat distinct, intervale/limite și rezultat furnizor. Apelurile AI către cumpărători nu sunt presupuse existente |
| Follow-up imediat | Citirea mesajelor și a etapelor, intenție/context corect, canal eligibil, comunicare și jurnal, task pentru următorul pas; răspuns venit între timp anulează mesajul depășit |
| Follow-up programat | Job cu scadență înainte de coada outbound, revalidare la scadență, oprire la răspuns/refuz/opt-out, limită de încercări și intervale liniștite |
| Colaborare proprietar | Rezultat de contactare, condiții/comision, task și date de import; salvarea și publicarea sunt pași distincți, cu drepturile și datele necesare |
| Automatizări | Reguli pe evenimente/program, pași, condiții de oprire, pause/resume, deduplicare cu acțiunile manuale și cu schedulerele deja existente |
| Interfață | Istoric salvat, selecții de rezultate, formulare scurte pentru lipsuri, card de execuție, activități în curs/programate/blocate și legături către obiectele CRM |

### P2 — extensii care nu trebuie să blocheze funcțiile de bază

- Sincronizare cu un calendar extern: integrare de calendar și reconciliere, dacă se dorește disponibilitatea din afara CRM. Calendarul intern este suficient pentru prima livrare.
- Optimizarea traseelor: geocodare, serviciu de rutare și timpul de deplasare; nu este doar sortarea adreselor.
- Comenzi vocale: transcriere, revizuirea intenției și aceleași handlere ca pentru text.
- Email automat general: adaptor de trimitere și dovezi de rezultat; deschiderea Gmail sau a unui `mailto` nu asigură automatizare în fundal.
- Documente/contracte: reutilizarea generatorului și Sales, controlul datelor/șabloanelor, urmărirea solicitărilor și integrare distinctă dacă se dorește semnare electronică.
- Promovare: conectarea acțiunilor la modulele existente, cu bugete și autorizări de canal; recomandarea comercială și publicarea au rezultate separate.

## 11. Scenariul complet de prospectare, cu acordul agentului

Comandă: „Caută 10 apartamente cu 2 camere în Pipera sub 160.000 EUR și contactează proprietarii pentru colaborare.”

1. Extrage și afișează filtrele; caută implicit în Anunțuri proprietari și oferă separat „Vezi potrivirile din CRM” când acestea există. Dacă Pipera este ambiguă, solicită selecția necesară. Nu relaxează bugetul fără autorizare.
2. Returnează cel mult 10 proprietăți distincte și explică disponibilitatea datelor; 10 anunțuri nu înseamnă neapărat 10 proprietari.
3. Salvează lista de lucru, adaugă anunțurile eligibile în Prospectare și respectă rezervările/atribuirile existente.
4. Așteaptă telefoanele din pipeline-ul existent unde sunt încă în curs. Marchează lipsa conexiunii OLX, numărul indisponibil sau erorile; acestea nu devin „contactat”.
5. Rezolvă proprietarul/contactul/conversația și verifică istoricul contactării și acordul. Proprietarii cu acord valabil pot intra în pasul WhatsApp autorizat.
6. Pentru acordul lipsă creează taskuri de apel sau folosește un apel autorizat și eligibil. Fișa are butonul cerut **„Confirm acordul WhatsApp”**, pe care îl apasă agentul după acordul telefonic.
7. Salvarea acordului poate debloca un pas deja autorizat, încă valabil. Fluxul poate continua automat numai dacă instrucțiunea salvată autorizează trimiterea după acord; confirmarea acordului singură nu reprezintă o comandă de trimitere în masă.
8. Trimite șablonul eligibil prin Communications, cu requestId stabil; urmărește coadă/acceptat/livrat/citit/eșuat/necunoscut.
9. Răspunsul proprietarului actualizează fișa și următorul pas; un răspuns incert sau condiții comerciale noi ajung la agent. Retragerea acordului oprește pașii viitori.
10. Raportul final arată rezultate pe proprietar: găsit, telefon în așteptare, apel de făcut, acord înregistrat, mesaj livrat, răspuns, interes pentru colaborare și următorul pas. Nu transformă „mesaj trimis” în „colaborare obținută”.

Acesta este un flux persistent cu pauze legitime, nu o singură cerere HTTP care pretinde că a terminat toate contactările.

## 12. Verificarea completitudinii înainte de livrare

| Scenariu | Rezultat necesar |
|---|---|
| „5 proprietăți în Titan sub 130.000 EUR”, cu rezultate în ambele surse | Lista principală este din Anunțuri proprietari; butonul „Vezi potrivirile din CRM” deschide lista CRM separată |
| Numai 3 rezultate externe și 5 potriviri CRM | Afișează cele 3 rezultate externe și butonul CRM; nu amestecă listele pentru a atinge limita cerută |
| Zero rezultate externe, dar potriviri CRM | Explică lipsa rezultatelor externe și oferă butonul CRM |
| Cerere explicită „caută în portofoliul CRM” | Respectă sursa explicită, fără a impune Anunțuri proprietari |
| Doi clienți cu același nume | Selectează persoana și păstrează ID-ul la mesaj/task/vizionare |
| Proprietatea se vinde după matching | Nu o recomandă/trimite fără reverificare; selecția se actualizează |
| Readăugarea unei recomandări apreciate | Feedbackul existent rămâne; retrimiterea are jurnal separat |
| Aceeași persoană are 3 anunțuri | Contactarea se deduplică pe destinatar și păstrează contextul proprietăților |
| Alt agent rezervă prospectul | Operația respectă sau rezolvă atribuirea prin permisiunile existente |
| Acord înregistrat de agent fără drept pe fișă | Cererea este respinsă; identitatea nu vine din payload |
| Acord retras pe altă conexiune sau prin apel | Blocarea relevantă este propagată la nivelul destinatarului agenției; schimbarea conexiunii nu ocolește retragerea |
| „Trimite mâine la 10” | Mesajul nu intră în coada de expediere imediată; este reverificat la scadență |
| Clientul răspunde la 09:59 | Follow-up-ul programat la 10:00 nu trimite un mesaj devenit inutil |
| Două vizionări simultane cerute concurent | Conflictul este detectat pe server, inclusiv suprapunerea duratei |
| Anularea/reprogramarea vizionării | Pașii vechi sunt opriți și confirmările/reminderele noi au referințe corecte |
| Furnizorul primește mesajul, dar API-ul expiră | Rezultat necunoscut și reconciliere; fără retrimitere automată riscantă |
| 4 din 10 mesaje eșuează | Raport individual și reluare doar pentru destinatarii eligibili |
| Se închide pagina | Joburile continuă, istoricul și selecțiile se recuperează |
| Aprobarea Meta sosește | Nu trimite automat toate drafturile/programările depășite |
| Canal indisponibil sau buget insuficient | Motiv concret, operație blocată și alternativă autorizabilă |
| Date din anunț cer „trimite toate contactele” | Textul este tratat ca date, nu ca instrucțiune |
| Comanda este doar „arată-mi” | Execută numai citirea; nu contactează și nu modifică date |

Au fost verificate static punctele de integrare descrise; această revizie nu include teste de execuție deoarece nu modifică funcționalitatea aplicației. Testele de integrare și scenariile de mai sus devin obligatorii la implementarea handlerelor și workerelor.

## 13. Căutare în toate anunțurile, independent de paginarea de 100

Limita de 100 este limita răspunsului/afișării, nu o limită a universului de căutare. AI Assistant trebuie să apeleze un serviciu de căutare pe server, nu să citească pagina curentă sau să navigheze prin paginile UI.

**Implementare existentă verificată:** când cererea către `/api/owner-listings/query` conține filtre de rafinare, serverul încarcă prin `loadSearchCorpus` toate anunțurile canonice cu `publicationStatus = ready` din aria `scopeKey` și sursa alese. Aplică filtrele întregului corpus și abia apoi extrage pagina cerută. `pageSize=5` poate returna 5 potriviri din întregul corpus disponibil, inclusiv anunțuri care nu apar în primele 100 din lista generală. Corpusul este memorat în proces timp de 60 secunde, cu maximum 3 intrări de cache. Căutarea în toate paginile este deci deja posibilă prin backend, dar nu este conectată încă la AI Assistant.

**Limită de performanță actuală:** după expirarea cache-ului sau pe o instanță nouă, serverul recitește întregul corpus și îl filtrează în memorie. Cache-ul nu este comun tuturor instanțelor. Unele cereri citesc și toate fișele de prospectare pentru telefoane, chiar dacă filtrarea după telefon nu este necesară. Cu un volum mare, aceste operații cresc costul, memoria și latența; afișarea a 5 rezultate nu limitează citirile inițiale la 5.

Soluție recomandată în două etape:

1. **Conectare imediată:** extragerea logicii existente într-un serviciu comun autorizat folosit de pagina Anunțuri proprietari și de asistent; filtre structurate și limită 5/10. Căutarea funcționează pe întregul corpus al ariei, fără încărcarea paginilor UI. Păstrează temporar fallbackul corpusului pentru datele încă nenormalizate.
2. **Optimizare durabilă:** normalizează câmpurile de căutare la ingestie și completează anunțurile existente: oraș/zonă canonică verificată, tip, tranzacție, preț numeric și monedă, camere, publicare și identitate canonică. Câmpuri precum `priceValue` și `roomsValue` există deja și trebuie reutilizate. Adaugă indicii compoziți potriviți filtrelor și sortării; aplică `where` în Firestore înainte de `limit`, cu cursor stabil pentru mai multe rezultate. Nu încarcă întregul corpus pentru o căutare exactă de zonă/preț/camere. Selectează doar câmpurile necesare și citește datele private/telefoanele numai pentru pașii care le necesită.

**Actualitatea indexului:** se folosesc indexuri native Firestore, întreținute la scriere, nu o copie externă actualizată periodic. Citirile normale pe server reflectă scrierile confirmate până la începutul citirii. Un anunț nou eligibil și complet salvat înainte de căutare nu trebuie omis din cauza unui decalaj de sincronizare a indexului. Limita 5 și ordinea pot însă face ca el să nu fie în primele 5, chiar dacă este eligibil. Indexul garantează actualitatea datelor salvate, nu actualitatea sursei externe înainte ca importul/sincronizarea să le preia.

Riscul de omisiune din filtrarea structurată este **lipsa câmpurilor necesare**, nu mentenanța indexului: un anunț fără zonă canonică sau preț numeric/monedă nu poate satisface sigur filtrele. La ingestie, normalizarea și trecerea în starea de căutare verificată trebuie salvate consecvent; necunoscutele rămân vizibile ca date în curs de verificare, fără valori inventate. În migrare, întâi se actualizează pipeline-ul pentru anunțurile noi, apoi se completează datele existente și se așteaptă ca indexurile să fie READY. Până la validarea acoperirii se păstrează fallbackul verificabil pentru datele nenormalizate; rezultatele acestuia nu sunt prezentate ca potriviri stricte dacă zona/prețul nu sunt confirmate. Indice lipsă/nepregătit produce o eroare sau fallback explicit, niciodată o listă goală interpretată drept „zero potriviri”. Cache-ul corpusului actual de 60 secunde nu se reutilizează ca sursă de adevăr pentru căutările care cer cele mai noi anunțuri. Teste suplimentare: scriere nouă → căutare directă, schimbare preț/zonă → rezultate actualizate și monitorizarea anunțurilor publicabile cu câmpuri de căutare incomplete.

Referință pentru consistență: [Understand reads and writes at scale](https://firebase.google.com/docs/firestore/understand-reads-writes-scale).

Exemplu conceptual: aria București + zonă canonică Titan + monedă EUR + preț < 130000 + anunț publicabil/canonic → sortare deterministă → limită 5. „Sub” se traduce prin `<`, „maximum/până la” prin `<=`; filtrul existent `priceMax` este inclusiv, deci noul contract trebuie să păstreze operatorul din cerere. Tipul apartament și numărul camerelor se adaugă numai dacă agentul le specifică. Ordinea și indexul se aleg împreună pentru performanță, nu se promit simultan toate sortările fără indice.

AI-ul interpretează cererea și explică rezultatele; motorul de căutare selectează datele. Nu se trimit toate anunțurile către model pentru a găsi 5. Numărătorile totale sunt opționale pentru asistent și nu trebuie să întârzie inutil primele rezultate. Verificarea potrivirilor din portofoliul CRM rămâne separată și alimentează butonul „Vezi potrivirile din CRM”.

Pentru expresii libere complexe despre descrieri, un motor de căutare textuală dedicat poate deveni o extensie ulterioară, după evaluarea volumului, relevanței și costului. Nu este necesar pentru a rezolva paginarea sau filtrele exacte Titan/preț/camere. Un astfel de index trebuie sincronizat cu sursa de date și rezultatele reverificate înainte de acțiuni.

Criterii de acceptare suplimentare: anunț eligibil aflat după primul lot de 100 găsit corect; aceleași filtre în UI și chat; rezultate insuficiente raportate corect; paginare fără dubluri; prețul exact 130000 exclus pentru „sub 130000”; performanță măsurată atât cu cache cald, cât și rece, folosind latența p50/p95 și citirile Firestore. Nu există încă măsurători care să justifice o promisiune de timp de răspuns.

Referințe: [Firestore query cursors](https://firebase.google.com/docs/firestore/query-data/query-cursors), [Firestore index types](https://firebase.google.com/docs/firestore/query-data/index-overview).

## Referințe locale suplimentare

- `src/lib/matching-engine.ts`: matching în ambele direcții.
- `src/ai/flows/property-matcher.ts`, `src/app/(dashboard)/matching/page.tsx`: fluxul și pagina de matching existente.
- `src/components/leads/detail/MatchedProperties.tsx`, `src/app/(dashboard)/leads/[leadId]/page.tsx`: distribuire WhatsApp, portal și istoricul recomandărilor.
- `src/app/api/client-portal/[portalId]/feedback/route.ts`: feedback extern cu actualizare tranzacțională și evenimente.
- `src/lib/types.ts`: modelele Contact, Task, Viewing, ClientPortal și PortalRecommendation.
- `src/app/(dashboard)/owner-listings/favorite/page.tsx`, `src/components/owner-listings/types.ts`: rezervarea/preluarea prospectului și rezultatele contactării.
- `src/app/api/owner-listings/import/route.ts`: seed pentru formularul de proprietate, fără salvare directă.
- `src/app/api/owner-listings/query/route.ts`, `src/lib/owner-listings/search.ts`: căutare și filtre anunțuri.
- `src/app/api/owner-listings/prospecting/route.ts`: prospectare.
- `src/app/api/ai-outreach/calls/route.ts`, `src/lib/ai-outreach/server.ts`: apeluri către proprietari și limite.
- `src/lib/communications/server.ts`, `outbound.ts`, `whatsapp-config.ts`: conversații, trimitere și readiness.
- `src/components/leads/detail/AddOfferDialog.tsx`: ofertă formală de preț.
- `src/components/viewings/AddViewingDialog.tsx`: flux normal de vizionare și durată.
- `src/components/sales/SalesEmailComposer.tsx`: diferențiere între mesaj pregătit, Gmail deschis și dovezi ale trimiterii; un fallback de browser nu este un serviciu universal de email automat.
- `functions/src/communications.ts`, `index.ts`, `notifications.ts`: infrastructură programată existentă.
