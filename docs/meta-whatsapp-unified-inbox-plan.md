# Plan: Meta organic, WhatsApp și Inbox unificat

Data: 27 septembrie 2026. Document de proiectare, nu integrare activată.

Revizia 2, după audit: [auditul și specificațiile suplimentare](./meta-whatsapp-unified-inbox-audit.md) fac parte din plan. Ordinea de livrare și criteriile din audit înlocuiesc ordinea inițială de mai jos. Lansarea este condiționată de rezolvarea problemelor de autorizare, ingestie durabilă și migrare identificate în cod; documentul nu certifică producția.

Revizia 3: [deciziile finale pentru sincronizare, căutare, conectare și costuri](./meta-whatsapp-unified-inbox-decisions.md) înlocuiesc variantele deschise din plan și audit pentru aceste patru subiecte. Soluția aleasă: Coexistence pentru numerele WhatsApp Business eligibile, alternativă explicită cu număr dedicat Cloud API, căutare completă prin Typesense Cloud, conectare Meta modulară și facturare WhatsApp direct la agenție. Sunt decizii de implementare; niciun serviciu nu a fost contractat sau activat.

## Baza verificată

- Linkul conversației Meta AI nu a putut fi accesat; conținutul său nu este verificat.
- `src/components/layout/app-shell.tsx` conține meniul Marketing și denumirea Inbox Storia.
- `src/app/(dashboard)/inbox/page.tsx` citește `agencies/{agencyId}/storiaInboxLeads`, afișează mesajele și creează contacte. WhatsApp este un link extern `wa.me`.
- `src/lib/types.ts` definește StoriaInboxLead cu mesaje într-un array. Modelul trebuie adaptat pentru conversații mari și canale multiple.
- `src/lib/meta-marketing.ts` are OAuth, tokenuri criptate și publicare organică Facebook galerie/video; `src/app/api/marketing/meta/property-posts/route.ts` expune publicarea pentru administratori. Existența codului nu confirmă permisiunile sau funcționarea conturilor din producție.
- `SocialMediaCard.tsx` poate deveni punctul de intrare pentru compunerea postărilor din proprietate.
- Modulele Conturi Facebook / Grupuri Facebook rămân distincte de integrarea oficială pentru pagini și Instagram.
- `firebase.json` indică `src/firestore.rules`, diferit de fișierul omonim de la rădăcină. Auditul regulilor trebuie făcut pe sursa configurată și comparat cu producția.
- Storia are și persistență directă în `functions/src/index.ts`, înainte de forwarding către Next.js; notificările din `functions/src/notifications.ts` urmăresc colecția veche. Ambele fac parte din migrare.

## Navigație și pagini

În Marketing: Meta Advertising, Conturi Facebook, Grupuri Facebook, Facebook + Instagram, WhatsApp, TikTok.

- `/marketing/facebook-instagram`: Privire de ansamblu, Conținut, Calendar, Comentarii, Statistici, Conturi.
- `/marketing/whatsapp`: Privire de ansamblu, Numere, Șabloane, Automatizări, Campanii, Consum și calitate.
- `/inbox`: redenumire în Inbox, păstrând ruta. Conversațiile zilnice sunt aici; paginile Marketing trimit către Inbox cu filtre pe canal/cont.

Facebook + Instagram: conectare pagini și conturi profesionale; creare din proprietate sau material general al agenției; text distinct pe platformă; fotografii, carusele, video/Reels și ulterior Stories unde sunt suportate; preview; draft, aprobare, programare și publicare; link și status pentru fiecare destinație; moderare comentarii în limitele permisiunilor; indicatori disponibili și atribuirea leadurilor identificabile.

WhatsApp: conectare WhatsApp Business Platform prin fluxul de onboarding disponibil pentru agenții; număr și agenți responsabili; șabloane și starea aprobării; mesaje cu oferte, documente și programări; consimțământ și dezabonare; fereastră de răspuns; automatizări opționale; campanii segmentate ulterior, cu estimare cost și plafon. Coexistența cu aplicația Business și istoricul importabil se verifică pe contul concret înainte de a fi promise.

## Integrarea în CRM

| Loc | Acțiune propusă |
| --- | --- |
| Proprietate, zona promovare | Publică/programare Facebook și Instagram folosind datele și materialele proprietății |
| Proprietate, zona comunicare | Trimite oferta pe WhatsApp; arată conversații asociate proprietății |
| Cumpărători, fișa contactului | Identități pe canale, istoric comun, preferințe, consimțământ, trimite mesaj |
| AI Matching | Pregătește selecția de proprietăți pentru trimitere, cu verificarea eligibilității destinatarului |
| Vizionări | Confirmare, reminder, reprogramare, feedback; evită dublarea la modificarea programării |
| Site public, pagina proprietății | Buton WhatsApp cu referință de proprietate în mesajul precompletat; vizitatorul trebuie să trimită efectiv mesajul |
| Dashboard / Rapoarte | Conversații fără răspuns, timp de răspuns, leaduri, vizionări și conversii atribuibile |

## Inbox

Desktop: listă și filtre în stânga, conversație în centru, contact/proprietăți/acțiuni în dreapta. Mobil: aceleași funcții în ecrane succesive.

Filtre: canal, cont, agent, necitite, fără răspuns, stare, proprietate. Acțiuni: răspuns, atașamente suportate, atribuire, note interne, etichete, creare/asociere contact, vizionare, task, închidere/redeschidere. Starea citit/livrat apare numai când furnizorul o transmite.

Identitatea CRM este comună, conversația externă rămâne distinctă per canal și cont. Nu unim persoane numai după nume. Identificatorii Meta sunt specifici platformei/contului; asocierea cross-channel necesită identificatori confirmați ori intervenție umană. Telefonul singur poate fi ambiguu; normalizare și confirmare când există conflicte. Sursa inițială a leadului nu se pierde la schimbarea canalului.

Comentariile publice sunt interacțiuni distincte de mesajele private și sunt etichetate vizibil. Un comentariu sau formular poate deveni lead, dar nu autorizează automat un mesaj privat pe orice canal. Mesajele generale pot avea proprietate necunoscută, asociată ulterior.

Ținta primei versiuni complete: Storia, WhatsApp, Messenger, Instagram DM. Livrăm incremental, cu activare independentă per canal: Inbox Storia migrat plus un canal bidirecțional validat formează primul pilot. Email, formulare publice și formulare Meta Lead Ads sunt surse distincte de leaduri, planificate separat. Gmail existent folosește pregătirea mesajelor și forwarding pentru dosare de vânzare; nu este deja un conector generic bidirecțional. TikTok și alte portaluri intră în mesagerie numai după verificarea accesului API. Pentru canale fără trimitere disponibilă, afișăm deschidere în platformă fără a pretinde sincronizare bidirecțională.

## Arhitectură propusă

- `agencies/{agencyId}/channelConnections`: metadate publice despre canal, cont, capabilități, sănătatea conexiunii; secrete separat pe server.
- `conversations/{id}` în agenție: provider, connectionId, externalConversationId, contactId, propertyIds, assigneeId, status, lastMessageAt, read state.
- `conversations/{id}/messages/{id}`: externalMessageId, direction, text, attachments, provider timestamp, delivery status, replyTo și erori. Notele interne sunt distincte de mesajele de trimis.
- `contactChannelIdentities`: identități externe și asocierea lor verificată cu contactele existente.
- `socialPosts` cu destinații și rezultate independente; legături către proprietate și materialele existente. Nu suprascriem istoricul cu ultima postare.
- `outboundJobs`, `webhookEvents`, `communicationConsents`, `automationRules`: coadă, deduplicare, proveniența consimțământului, audit.
- Endpointuri propuse: `/api/inbox/conversations`, `/api/inbox/conversations/[id]/messages`, `/api/webhooks/meta`, `/api/webhooks/whatsapp`, `/api/marketing/meta-organic/*`, `/api/marketing/whatsapp/*`.
- Adaptoare per furnizor și matrice de capabilități: receive, send, attachments, history, receipts, comments, response-window. UI și server verifică ambele eligibilitatea trimiterii.
- Webhook: verificare semnătură pe corpul original, mapare server-side cont–agenție, stocare durabilă și confirmare rapidă, procesare asincronă. Evenimente duplicate și neordonate trebuie suportate.
- Trimitere: outbox cu cheie de idempotency, retry cu backoff, tratarea limitelor API, reconciliere după timeout înainte de retrimitere, prevenirea duplicatelor generate de webhook echo.
- Tokenuri criptate, permisiuni per rol și agenție, audit, retenție/ștergere, deconectare și oprirea joburilor la revocare. Extinderea callbackurilor Meta existente pentru deautorizare și ștergere.
- Migrare Storia idempotentă pe identificatori existenți, import paginat al mesajelor, verificare număr/ordine/direcție, adaptor pentru evenimente noi, activare graduală și posibilitate de revenire. Colecția veche nu se șterge la lansare.
- Legătura contactId se persistă; prevenirea contactelor duplicate se face pe server, nu doar într-un Set în memoria paginii.

## Livrare și criterii de acceptare

1. Audit acces Meta și prototip end-to-end: conectare, webhook, mesaj primit/răspuns pe fiecare canal. Inventar de permisiuni pe fluxul de login ales, versiune API suportată, verificarea afacerii/App Review/Advanced Access unde sunt cerute. Început devreme; termenul de aprobare este extern.
2. Model comun, adaptoare și migrare Storia; redenumire Inbox. Acceptare: istoricul existent păstrat, izolarea între agenții, nicio dublare la replay.
3. WhatsApp și Inbox bidirecțional: text/media suportate, șabloane, fereastră de răspuns, consimțământ, asociere CRM. Acceptare: inbound, outbound, erori și statusuri reconciliate; trimitere neeligibilă blocată pe server.
4. Messenger și Instagram DM: conturi, abonamente webhook, rutare, răspunsuri și istoricul disponibil. Acceptare: conturile aceleiași agenții și ale altor agenții nu se confundă; reguli specifice canalului aplicate.
5. Facebook + Instagram organic: reutilizare publicare existentă, editor, programare, joburi și rezultat per destinație. Acceptare: publicarea parțial reușită nu dublează postările deja publicate; anularea și schimbarea fusului orar sunt tratate.
6. Automatizări, comentarii, analitice și celelalte canale; lansare pilot apoi extindere. AI începe cu drafturi și extragere de preferințe confirmate de agent; preluare umană disponibilă.

MVP funcțional înainte de campanii masive sau AI autonom. Teste: semnături invalide, retry/replay, evenimente neordonate, token revocat, ferestre expirate, dezabonare, izolarea agențiilor, upload/media și migrare Storia; verificare end-to-end cu conturi de test pentru canalele efectiv activate.

## Constrângeri și surse

- WhatsApp necesită opt-in pentru contactare; răspunsul liber este permis în fereastra de 24 ore de la ultimul mesaj al utilizatorului, iar în afara ei sunt necesare șabloane aprobate. Costurile se verifică în cont și se afișează înainte de campanii: https://business.whatsapp.com/policy
- Instagram profesional și capabilități dependente de autentificare/permisiuni: https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00
- Messenger, Send API și condițiile de mesagerie: https://www.postman.com/meta/messenger-platform-api/folder/vilwbh4/send-api
- Conversations API / Advanced Access: https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a
- Embedded Signup / App Review: https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup

Intrări încă neverificate: conversația Meta AI, configurația și permisiunile conturilor Meta, regulile efectiv instalate, volumul de mesaje, modalitatea de facturare și eligibilitatea numerelor WhatsApp. Planul se bazează pe codul local și sursele de mai sus; fiecare intrare este tratată ca verificare explicită înainte de activare, nu ca funcționalitate deja disponibilă.
