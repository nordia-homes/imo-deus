# Plan complet de implementare WhatsApp Meta pentru IMO Deus

Data: 29 septembrie 2026. Acest document este un plan, nu confirmarea unei activări. Este limitat la WhatsApp Business Platform și la fluxurile IMO Deus care trimit sau primesc mesaje WhatsApp. Deciziile de produs deja adoptate în `meta-whatsapp-unified-inbox-decisions.md` rămân valabile: API oficial, WABA și număr ale agenției, Coexistence numai când Meta îl permite, număr Cloud API dedicat ca alternativă, Inbox comun și facturare directă către agenție numai dacă modelul este efectiv disponibil și validat.

## 0. Ce trebuie făcut de titularul contului Meta

Aceste acțiuni necesită drepturi de administrator, identitatea sau decizia comercială a titularului. Codul IMO Deus nu le poate substitui. Echipa de implementare poate pregăti instrucțiuni, materiale App Review, capturi, URL-uri și poate asista în sesiune dacă titularul acordă acces; nu poate garanta aprobarea Meta.

1. **Stabilește portofoliul și aplicația Meta de producție.** Confirmă cine deține Meta Business Portfolio, Meta App și WABA, cine este administrator și dacă agențiile externe vor conecta propriile WABA. Păstrează separat mediul pilot de producție. Nu comunica parole sau coduri 2FA în repository.
2. **Verifică eligibilitatea și accesul.** În Meta for Developers/Business Manager, confirmă tipul de integrare Embedded Signup aplicabil IMO Deus, permisiunile și nivelurile de acces cerute pentru onboardingul agențiilor externe, inclusiv `whatsapp_business_management`, `whatsapp_business_messaging` și dependențele reale ale configurației. Inițiază App Review/Advanced Access și verificarea afacerii dacă Meta le cere; răspunde cererilor de informații Meta. Colecția oficială Embedded Signup menționează expres App Review și Advanced Access pentru lansarea către clienți.
3. **Alege numărul pilot.** Decide dacă folosești un număr existent din WhatsApp Business App pentru Coexistence sau un număr dedicat Cloud API. Pentru Coexistence verifică eligibilitatea numărului și acceptă limitele de istoric/dispozitive stabilite de Meta. Pentru Cloud API asigură accesul la verificarea numărului și la PIN-ul de înregistrare. Nu migra sau dezînregistra numărul existent fără o decizie separată.
4. **Confirmă modelul de plată.** În WABA-ul fiecărei agenții pilot, verifică metoda de plată, moneda, titularul facturii și dacă Embedded Signup permite efectiv facturarea directă către agenție în configurația IMO Deus. Documentația Meta include și fluxuri de partajare a liniei de credit a furnizorului; acestea nu sunt echivalente cu modelul decis pentru IMO Deus. Dacă plata directă nu este disponibilă, oprește activarea comercială și cere o decizie de produs înainte de schimbarea modelului.
5. **Configurează produsul Webhooks în Meta App.** După publicarea endpointului HTTPS, introdu URL-ul și tokenul de verificare furnizate de IMO Deus, abonează câmpurile WhatsApp necesare și verifică abonarea aplicației la fiecare WABA pilot. Confirmă în Meta ce evenimente Coexistence/history sunt disponibile efectiv. Nu include secretul de verificare în capturi sau documente publice.
6. **Configurează Embedded Signup.** Creează/verifică configurația Login for Business, domeniile permise, URL-urile necesare și ID-ul configurației; furnizează ID-ul pentru mediul potrivit. Completează URL-urile de politică de confidențialitate și ștergere de date și eventualele materiale cerute la review.
7. **Pregătește testele reale.** Pune la dispoziție contul de agenție pilot, administratorul, numărul business, cel puțin două numere de test cu acordul participanților și acces la Business App pentru proba Coexistence. Autorizează explicit mesajele de probă, inclusiv un șablon aprobat, fără a folosi clienți reali involuntar.
8. **Stabilește regulile de business pentru comunicare.** Decide scopurile de opt-in, formularea acordului, orele de contact, frecvența ofertelor, durata de retenție și responsabilul pentru cererile de ștergere. IMO Deus poate implementa aceste reguli după ce sunt stabilite; nu poate determina singur baza legală sau acordul unei persoane.

**Dovezi de finalizare Meta:** ID de aplicație/configurație și WABA/număr pilot; capturi sau status pentru permisiuni și App Review; webhook verificat și WABA abonat; stare număr; plată/monedă/titular confirmate; șablon de probă aprobat. Nu se păstrează tokenuri sau secrete în documentul de proiect.

## 1. Ce poate face echipa de implementare IMO Deus

- Modifică backendul, interfața, regulile Firestore/Storage, workerii, indexarea, documentația și instrumentele de operare.
- Pregătește configurația și procedura de deployment; aplică secrete, TTL, indecși și deploy numai cu acces la mediul țintă și autorizarea corespunzătoare.
- Pregătește descrieri, capturi, pași și probe pentru App Review; verifică tehnic tokenuri, permisiuni, webhookuri, numere și rezultate de mesaje prin API, în limitele accesului acordat.
- Rulează teste locale și un pilot cu numere aprobate. Nu poate genera aprobarea Meta, eligibilitatea Coexistence, un opt-in al unui client sau confirmarea plății printr-o schimbare de cod.

## 2. Etape de implementare

Etapele 2.1–2.5 pot avansa în cod cât timp rulează App Review. Activarea trimiterilor externe depinde de etapa 0 și de verificarea unui număr real.

### 2.1. Contractul de activare și diagnostic

- Inventariază configurația Meta actuală fără a expune secrete: App ID, Graph API version, Embedded Signup config, webhook subscriptions, tip și expirare token, scopes/granular scopes, WABA, numere, status număr, metodă de plată, șabloane și permisiunile contului.
- Corectează schimbul codului Embedded Signup conform fluxului Meta verificat; adaugă sesiune server-side, expirare, anti-replay și legare de agenție/admin/configurația curentă. Verifică tokenul emis, aplicația, WABA acordat și apartenența numărului. Păstrează tokenurile criptate; adaugă rotație/reconectare și diagnostic periodic.
- Marchează `send`, `receive`, `templates`, `nativeSync` și `history` separat. `connected` nu activează automat trimiterea. Confirmă configurarea WABA/webhook și un schimb real de mesaje înainte de `active`.
- Adaugă verificarea sănătății conexiunii, schimbarea permisiunilor, expirarea/revocarea tokenului, starea numărului și motivul concret în UI. Deconectarea oprește joburile viitoare și permite transferul verificat al unui număr între agenții fără pierderea istoricului.
- Completează configurația App Hosting/Functions pe medii pentru `META_WHATSAPP_CONFIG_ID`, versiunea Graph, secrete, worker, scaner și Typesense. Flagul `WHATSAPP_DIRECT_BILLING_READY` se setează numai după proba reală a facturării; nu este proba însăși.

**Acceptare:** un admin conectează numărul pilot, vede WABA/numărul și capabilitățile reale; un cod expirat, WABA străin, token revocat sau permisiune lipsă nu creează conexiune activă; reconectarea recuperează funcțiile eligibile.

### 2.2. Recepție, statusuri și livrare sigură

- Corectează mașina de stări: `accepted` înseamnă numai acceptarea cererii de Meta; `failed` este un rezultat real de livrare care nu poate fi ignorat. Păstrează timestampul, codul și mesajul de eroare Meta. Statusurile vechi nu suprascriu un rezultat mai nou; `read` nu este retrogradat de un webhook întârziat.
- Normalizează payloaduri reale pentru text, imagine, document, video/audio/sticker dacă sunt eligibile, interactive replies, context/reply-to, erori, statusuri, native echoes și history. Pentru tipuri nesuportate păstrează un placeholder explicit fără a inventa conținut.
- Păstrează deduplicarea pe cont/mesaj și procesarea tranzacțională. Adaugă jurnal de eșec cu replay controlat pentru webhookuri `failed`, evenimente parțiale și conturi încă neasociate. Alertează dacă webhookul sau workerul întârzie.
- Reconciliere pentru mesaje `unknown`, statusuri lipsă și echo-uri sosite în ordine diferită. Nu retrimite automat o cerere care ar fi putut ajunge la Meta.
- Pentru Coexistence, măsoară separat inbound, răspuns din Business App, răspuns din Inbox, echo, statusuri și istoricul oferit oficial. Arată intervalul importat și limita de acoperire. Nu atribui unui agent un mesaj trimis din aplicația nativă dacă furnizorul nu identifică autorul.

**Acceptare:** mesajul și statusurile apar o singură dată; `failed` după `accepted` devine eșec vizibil; evenimentele duplicate/neordonate nu schimbă incorect firul; un webhook eșuat poate fi reluat fără dubluri; Coexistence este activată numai după proba în ambele direcții.

### 2.3. Reguli de trimitere, consimțământ și șabloane

- Creează o singură politică server-side aplicată la previzualizare, rezervare și execuție: apartenență agent, drept de acces, stare număr, destinatar, 24 de ore, tip mesaj, șablon aprobat, opt-in potrivit scopului și orice opt-out/blocare. Un inbound inițiat de client poate permite răspunsul în contextul lui; asta nu acordă automat opt-in pentru oferte viitoare.
- Extinde evidența acordului cu scop, canal, număr business, sursă, moment, formularea acordului, dovadă, cine a înregistrat-o și retragere. O cerere de oprire pe WhatsApp sau alt canal devine blocaj imediat pentru trimiterile viitoare. Importul unui telefon din CRM, Storia sau prospectare nu creează acord.
- Sincronizează toate paginile șabloanelor și componentele lor. Editorul validează limba, categoria, statusul, numărul și tipul parametrilor pentru body/header/butoane; previzualizarea arată textul final. Revalidare înainte de send dacă șablonul a fost pausat, respins sau reclasificat.
- Pentru oferte imobiliare, verifică în momentul expedierii prețul, disponibilitatea, referința, linkul public și aprobarea conținutului; modificarea materială invalidează draftul. Pentru documente/media: MIME și dimensiune reale, URL temporar, descărcare autorizată, scanare și tratarea expirării.
- Păstrează cheia idempotentă per comandă și arată clar `queued`, `sending`, `accepted`, `delivered`, `read`, `failed`, `unknown` și ce poate face agentul la fiecare stare.

**Acceptare:** mesajele neeligibile sunt respinse înainte de Meta; opt-out blochează și un job deja programat; șablonul cu parametri greșiți sau suspendat nu ajunge la API; oferta retrasă nu se expediază.

### 2.4. Tarife, buget și reconciliere

- Versionează tarifele oficiale după piața destinatarului, categorie, monedă, perioadă și sursă. Include regulile actuale pentru service/utility și puncte de intrare gratuite numai când pot fi dovedite din evenimente. Tarif necunoscut sau expirat blochează doar trimiterile potențial taxabile.
- Model de ledger: estimare la preview, rezervare atomică la queue, acceptare API, livrare/eșec, cost reconciliat. Acceptarea nu este debit facturat. `unknown` păstrează rezervarea până la rezoluție verificată. Eliberează suma pentru mesajele eșuate; evită contabilizarea dublă la statusuri repetate.
- Plafon lunar și alerte la 80%, 95%, 100%, limite per număr/zi și per campanie; numai adminul schimbă plafonul. Afișează moneda, data tarifului, valoarea estimată, rezervată și reconciliată. Factura Meta rămâne referința financiară finală, inclusiv trafic trimis din alte aplicații.
- Pregătește importul tarifelor cu verificare și aprobare operațională; compară un eșantion de livrări cu rapoartele/factura contului pilot.

**Acceptare:** două joburi concurente nu depășesc plafonul; `accepted` nu mărește consumul confirmat; `failed` eliberează suma; `unknown` nu o eliberează automat; diferențele față de Meta sunt vizibile.

### 2.5. Inbox, CRM, căutare și securitatea datelor

- Definește coada de conversații neatribuite și accesul agenților, repartizarea automată/manuală, programul de lucru, SLA, escaladare și avertizarea când doi agenți lucrează același fir. Adminul vede toate; agentul vede numai ce i-a fost atribuit sau partajat.
- Leagă firul de contact și de una sau mai multe proprietăți fără fuziune automată pe telefon ambiguu. Separă sursa leadului, proprietatea asociată și metoda atribuirii. Fluxuri pentru ofertă, confirmare/reprogramare vizionare și urmărirea răspunsului.
- Inventariază toate butoanele `wa.me`. Pentru numere conectate oferă acțiunea prin API cu estimare/istoric; când se deschide WhatsApp extern, explică faptul că expedierea și sincronizarea depind de aplicația externă/Coexistence. Nu înregistra un link deschis ca mesaj livrat.
- Completează căutarea Typesense: titlu/referință proprietate, filtre, actualizări la contact/reasignare/ștergere, note separate cu autorizare, reconstrucție și indisponibilitate graceful. Nu indexa tokenuri, payloaduri brute sau URL-uri private.
- Aplică retenția decisă pentru webhookuri, mesaje, media, joburi, loguri, backupuri și index. Activează TTL efectiv. Închide cererile de export/ștergere, inclusiv datele derivate, cu dovadă și stare finală; previne reimportul accidental după ștergere.

**Acceptare:** leadul nou ajunge în coada responsabilă; un agent revocat nu mai poate citi mesajele prin API sau căutare; butoanele externe sunt explicite; exportul/ștergerea acoperă toate copiile gestionate de IMO Deus.

### 2.6. Automatizări, campanii și raportare imobiliară

- Automatizări inițiale: confirmare și reprogramare vizionare, remindere, follow-up după vizionare și ofertă pregătită pentru aprobare. Fiecare are fus orar, ore permise, frecvență maximă, deduplicare, anulare la răspuns/opt-out și oprire globală. Reprogramarea invalidează reminderul vechi.
- Campanii segmentate numai după stabilizarea mesageriei individuale: selecție audiență cu opt-in demonstrat, șablon aprobat, excluderi, estimare cost, plafon, dry-run, aprobare admin, throttling, oprire și raport pe destinatar. Nu trimite către întreaga bază CRM implicit.
- Drafturi AI doar cu confirmare umană, date curente de proprietate și limită clară a automatizării. Mesajele primite nu pot declanșa comenzi arbitrare. Predare rapidă la agent uman.
- Raportează primul răspuns uman, întârzierea răspunsului în orele de lucru, livrări/eșecuri, opt-out, lead → vizionare → tranzacție și metoda de atribuire. Separă traficul IMO Deus de mesajele native/externe și datele necunoscute.

**Acceptare:** o vizionare reprogramată nu primește vechiul reminder; opt-out oprește campania; o proprietate retrasă nu mai apare în oferte programate; raportul nu atribuie o conversie fără legătură verificată.

### 2.7. Pilot, lansare și operare

- Mediu pilot izolat, reguli și indecși publicați, secrete configurate, scaner PDF, Typesense, TTL, worker și monitorizare. Procedură de rollback per agenție/capabilitate fără ștergerea istoricului.
- Matrice reală: Cloud API și Coexistence, două agenții, admin/agent/revocat, două numere business, inbound/outbound, status `failed` după `accepted`, duplicat/neordonat, timeout după send, token revocat, webhook neabonat, șablon suspendat, media expirată, opt-out, buget concurent, DST, preț schimbat și număr neeligibil.
- Pentru fiecare probă păstrează ID-ul mesajului, statusurile și timestampurile fără conținut sensibil în logul de audit. Dashboard operațional pentru joburi vechi/failed/unknown, webhook întârziat, token, calitatea numărului și variația costurilor.
- Lansare graduală: un număr de test, o agenție pilot, apoi mai multe agenții. Dezactivează capabilitatea afectată la eșec fără a opri recepția celorlalte. Nu declara Coexistence/history complet când testul arată acoperire parțială.

**Acceptare finală:** o conversație reală autorizată trece cap-coadă prin conectare, webhook, Inbox, răspuns, livrare, cost, CRM, căutare și ștergere; mesajele eșuate sunt vizibile; limitele Coexistence sunt documentate; titularul confirmă aprobările și facturarea Meta.

## 3. Dependențe și ordine practică

| Etapă | Poate începe fără Meta live? | Depinde de titularul contului? |
| --- | --- | --- |
| Corecții statusuri, consimțământ, cozi, cost, Inbox și politici de date | Da | Doar pentru deciziile de business privind acordul și retenția |
| Implementarea schimbului Embedded Signup și verificările server-side | Da | Proba finală cere configurația și WABA pilot |
| App Review/Advanced Access, WABA, plată, număr, webhook în Meta | Nu | Da |
| Pilotul Cloud API/Coexistence și reconcilierea facturii | Nu | Da, plus destinatari de test autorizați |
| Campanii și automatizări cu trimitere reală | Codul da, activarea nu | Da, după pilot și regulile comerciale aprobate |

Nu se promite termenul de aprobare Meta. Estimarea de implementare se fixează după inventarul accesului, alegerea numărului pilot și validarea fluxului de plată.

## Surse primare

- Meta, Embedded Signup: https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup
- Meta, Cloud API și abonarea WABA la webhook: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api
- WhatsApp Business Messaging Policy: https://business.whatsapp.com/policy
- WhatsApp Business Platform Pricing: https://business.whatsapp.com/products/platform-pricing
