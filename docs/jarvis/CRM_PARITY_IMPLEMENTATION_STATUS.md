# Implementare Jarvis CRM — progres verificabil

Actualizat: 6 octombrie 2026. Implementarea completă E0–E7 este în curs. Această pagină separă implementarea din cod de acceptanța pe furnizori și de deploy. Auditul inițial este un baseline, nu o descriere a noilor capabilități.

## Etapa curentă

- Catalog curent: 180 handler-e existente, 40 tipuri de acțiuni; discovery semantic în română, catalog de date și verificare a disponibilității cu pași provider expliciți. Cifrele descriu codul, nu certifică paritatea tuturor fluxurilor.
- Executor comun manual/AI pentru contacte, proprietăți, calendar, prospectare, oferte, portaluri, dosare, contracte și setări. Migrarea UI include dashboard, liste, detalii, dialogs și inbox Storia.
- Câmpuri complete ale formularelor de bază, assignment în aceeași agenție, lifecycle cu motive și istoric, verificare concurentă la editarea proprietăților.
- Normalizare telefon/email și locks de identitate. Migrare producție: 468 contacte, 0 conflicte; verificare ulterioară: 0 modificări restante. Cele 386 identități repetate existente sunt păstrate pentru revizuire, fără merge automat.
- Calendar comun: lock tranzacțional, conflicte vizionare/vizionare, sarcină/sarcină și sarcină/vizionare pentru agent, client sau proprietate. Sarcinile fără oră rămân termene, nu ocupă intervale.
- Fișiere private până la 15 MB: document Sales, media conversație, RLV/imagini, OCR standard/electronic, import text Word în șablon draft. Exporturi PDF/ZIP/CSV/DOCX și preview audio privat.
- Planuri de maximum 100 pași: checkpoints de 10 pași, progres, pauză/reluare și oprire; rezultatele externe incerte nu se retrimit automat.
- Automatizări: creare, editare, pauză/reluare, istoric de execuție, oprire la termen/status client și la răspuns WhatsApp. Matching păstrează motorul existent și avertizează când datele sursă s-au schimbat.
- Timeline autorizat, citiri asociate și proiecții de modificări CRM/agenție/notificări. Evenimentele fără actor verificabil nu inventează autorul schimbării.
- Carduri comune Text/Voice, detalii de plan, continuări, linkuri de handoff și separarea draft/queued/running/succeeded/failed/unknown.
- Prospectare direct din lista generală prin executor comun; autofill contact cu verificare de versiune; Matching și follow-up apeluri folosesc serviciul comun de calendar; fotografie de profil și siglă prin fișiere private, cu validări, roluri și retenție pentru upload-uri nefinalizate.
- Gmail: activare/ascundere, personalizare și resetare șablon pentru agentul propriu, HTML sanitizat și citire paginată. Apeluri AI: anulare înainte de dispatch, rezultat manual/audit și revocare DNC explicită; rezultatul manual nu elimină implicit opt-out. Lansarea provider este rezervată tranzacțional, rezultatele incerte nu se retrimit, iar webhook-ul terminal nu este suprascris de răspunsul de lansare.
- Pregătire email Sales comună manual/AI: destinatari și conținut validate, documente autorizate și snapshot de versiune, card Deschide Gmail în Text/Voice. Modificarea ulterioară a mesajului/atașamentelor invalidează handoff-ul. Callback-ul runner-ului este corelat cu jobul; modelul nu poate declara ui_observed. Notificările read-all sunt permise explicit în adaptorul manual.
- Reguli CRM pe evenimente: contacte, proprietăți, vizionări, dosare și prospectare; filtre de schimbare/status/câmp/entitate, sarcini legate de client/proprietate și notificări proprii. Cursor după recordedAt și ID, revalidare acces/status, receipts și chei deterministe, maxEvents/maxRuns/termen. Editorul Text/Voice pregătește planul, cu pauză/reluare și istoric paginat; nu permite trimitere externă, acorduri sau recursie arbitrară.

## Urmărirea backlogului

„Implementat” în coloana de cod nu înseamnă că toate probele provider au fost închise. Manifestul static nu certifică paritatea semantică.

| Backlog | Implementare curentă | Criterii încă de închis |
|---|---|---|
| B01–B04 | Catalog, servicii comune, politici, ledger, versiune proprietate, audit | Clasificare semantică finală a tuturor fluxurilor montate; optimistic concurrency pe restul entităților |
| B05–B06 | Lifecycle și calendar comun, lock și validări | Concurență Firestore verificată pentru calendar; rămân acceptanța tuturor căilor UI și efectele provider lifecycle |
| B07–B13 | Contacte/câmpuri/default-uri/dedup/autofill, oferte, proprietăți, task-uri/vizionări, favorites și căile secundare migrate | Verificare exhaustivă câmp cu câmp și concurență pe editările restante |
| B14–B18 | Import/review, portal/preferences links, feedback, Storia dedup, Sales constructor/handlers | Acceptanță completă în UI și provider pentru import/linkuri/dosare |
| B19–B22 | Upload privat documente/imagini și video până la 500 MB, validare container, assets/RLV, OCR, DOCX structural comun, artefacte/export | Acceptanță pe toate formatele/fișierele; fonturi, imagini și paginare Word exactă necertificate |
| B23–B28 | Acord uman existent, template/media/sync, calls, Gmail/forwarding handlers | Probele Meta test mode, opt-out la send, Gmail runner/handoff și evidența pe dispozitiv real |
| B29 | Stări de rezultat explicite, worker/plan separate și urmărire read-only pentru planul vizibil în Text/Voice, inclusiv job Studio exact | Urmărire durabilă în fundal și adaptori terminali în toate domeniile externe |
| B30–B34 | Catalog/citiri/relații/timeline, proiecții, reconciliere paginată/checkpoints, count/query, owner index live, fingerprint matching, Reports comun | Revision corpus/cursor global, măsurarea acoperirii evenimentelor încă neproiectate și acceptanță exhaustivă; snapshots nu reconstruiesc actorii/evenimentele istorice lipsă |
| B35–B41 | Handler-e Imobiliare/Storia/Romimo/Meta/TikTok/Cloud/Video înregistrate cu contracte | Probe funcționale de provider, job controls și disponibilitate per entitate |
| B42–B45 | Profile/agency/preferences comune, avatar/logo private, agents/domain/billing/collaboration handlers, handoff links | Acceptanță OAuth/plată/push pe dispozitiv și onboarding complet |
| B46–B47 | Discovery compact, resolver date, buget, checkpoints/pause/cancel | Probe UI pentru pauză/reluare și loturi mari în producție |
| B48 | Automatizări editabile, istoric, condiții de oprire și reguli CRM pe evenimente cu effects interne/receipts/cursor; editor Text/Voice; dedup concurent și recuperare parțială verificate pe Firestore | Acceptanța integrată a lease-urilor worker și providerilor; efecte externe prin aprobări dedicate |
| B49–B50 | Carduri comune, manifest CI, teste unitare/rules/UI/build | Verificare de release, observabilitate și probe end-to-end pentru fiecare modul |

## Validări efectuate

- 297 teste deterministe AI trecute; 8 probe de integrare rulează separat în emulator.
- 23 teste Firestore trecute în emulator (6 suite): reguli de acces, concurență calendar și recuperare/dedup pentru reguli CRM.
- 20 verificări UI Text și 14 verificări UI Voice trecute în etapa editorului extins; editorul pregătește planul, păstrează atribuirile și filtrele neatinse și citește istoricul; Gmail handoff și lipsa dovezii înainte de callback verificate cu bridge simulat.
- Build Next.js și build Functions trecute. Testele headless Voice folosesc microfon/audio simulate; nu certifică ecoul pe hardware real.
- Producție verificată: build `build-2026-10-05-parity-01`, commit `4cc3402fb2f5eb55e2c20aa5272a5a47fb46999c`, READY, trafic 100%; worker ACTIVE, scheduler ENABLED și heartbeat fără eroare. Regulile/indexurile și cele patru funcții de proiecție/retenție sunt publicate. Modificările din etapa următoare se publică separat după validare.
- Etapa a doua activă ulterior: `build-2026-10-05-parity-02`, commit `4a479b5b8a47bf7bdde88f477489967cf908bd73`, READY, trafic 100%; funcția de retenție pentru branding actualizată. Etapa Gmail/apeluri se validează și publică separat.
- Etapa a treia activă: `build-2026-10-05-parity-03`, commit `b1a6433bf3c18e3713b804b06bfcee6be5096ef7`, READY, trafic 100%; preferințele Gmail și controlul apelurilor sunt publicate. Pregătirea emailului și handoff-ul sunt etapa a patra, publicată după verificarea build-ului.
- Etapa a patra activă: `build-2026-10-05-parity-04`, commit `b45c969e1e41c805587087f0390c40d26abfe72c`, READY, trafic 100%. Probe anonime API: 401; pagină: 200; 5 funcții ACTIVE, scheduler ENABLED, heartbeat fără eroare și 72 indexuri READY. Dovadă: CRM_PARITY_PRODUCTION.json. Reguli pe evenimente: etapa a cincea, în curs de validare/publicare.

Nu este încă îndeplinit criteriul „paritate completă”: elementele restante de mai sus rămân parte din implementarea solicitată, nu sunt închise prin simpla înregistrare a unui endpoint.

### Remediere incident răspunsuri — publicată
- Build `build-2026-10-05-parity-06`, commit `2f14e74f3b58eaf0387a874079f2bf2d941b4aec`, READY, trafic 100%. Include și etapa regulilor pe evenimente din commitul anterior.
- Cauza confirmată: referințe de acces moștenite repetat între răspunsuri; un mesaj din conversația afectată avea 6.192 referințe. Verificarea istoricului făcea citiri repetate înainte de planificare.
- Referințele sunt deduplicate la construire și citire; verificările de acces sunt reutilizate doar în aceeași cerere, fără cache între cereri.
- Probă live în conversația afectată: citirea vizionărilor a salvat răspuns/card; pregătirea sarcinii a salvat plan fără execuție. Probă worker producție: job completed, text prezent, 1 card, 5 referințe, fără eroare.
- 267 teste AI trecute, 3 probe de reguli rezervate emulatorului; typecheck și build trecute.

### Etapa Sales — publicată în parity-07
- Configurare dosar cu schemă comună importată de handler, contract AI generat, tranzacție și audit atomic; revalidare membru și acces înaintea scrierii.
- Salvarea manuală din composer și wizard folosește același handler cu expectedUpdatedAt; personalizarea privată email folosește executorul comun.
- Checklist: metadatele fișierelor/scannerului/versiunilor rămân autoritative; configurarea nu poate fabrica documente primite/verificate sau elimina implicit documente încărcate.
- 5 teste Sales de concurență, acces, audit și protecție documente trecute; typecheck și build trecute. Restul backlogului rămâne deschis.

### Observabilitate și erori vizibile — publicată în parity-08
- Erorile neașteptate dintr-o comandă începută sunt salvate ca răspuns ERROR_EVENT în conversația autorizată; lock-urile sunt eliberate, nu se repetă efecte. Revocarea accesului împiedică salvarea unui rezultat pentru actor.
- Worker-ul distinge răspunsul livrat de succesul de business; categoriile fixe de eroare sunt jurnalizate fără conținut CRM/provider.
- Costul necunoscut după o întrerupere este marcat incomplet și nu produce o medie inventată de zero.
- Capabilitate crm_health și API autentificat: heartbeat/model configurat și lag măsurat din eșantionul proiecțiilor autorizate, cu revalidarea accesului la părinții sensibili. Eșantionul nu certifică evenimentele încă neprocesate sau providerii externi.
- 275 teste AI trecute și typecheck trecut. Verificare producție suplimentară: pregătirea unei sarcini a returnat răspuns și plan cu 1 acțiune, fără executarea sarcinii. Planul integral E0–E7 rămâne în curs.

### Editor automatizări — publicat în parity-09
- Formulare de creare/editare pentru followup_task, owner_watch, matching_watch, insight_report și whatsapp_template, în Text și Voice prin componenta comună.
- Selecție clienți/conversații prin citiri autentificate, căutare și paginare; sursa proprietarilor implicită, criterii de preț/camere/tip/tranzacție, prag matching și parametri șablon.
- Programare, limite de execuție și oprire după termen/status/răspuns; configurarea pregătește planul fără a activa automatizarea direct. Orele formularului sunt indicate ca ora dispozitivului; orele originale neatinse sunt păstrate exact.
- 19 verificări UI Text trecute, incluzând pregătirea celor cinci tipuri; 14 verificări Voice trecute. Probele sunt cu date/integrări simulate și nu trimit mesaje.

### Protecție revizii calendar — publicare parity-10
- update/delete pentru sarcini și vizionări verifică expectedUpdatedAt tranzacțional înainte de scrieri; conflictele returnează 409 fără ledger sau ștergere.
- Formularele manuale trimit revizia afișată. Pregătirea planurilor Jarvis fixează revizia curentă dacă lipsește, inclusiv cardurile Text/Voice; o revizie furnizată nu este înlocuită automat. Referințele la pași care creează înregistrări sunt rezolvate la execuție.
- Etapa automatizărilor: build-2026-10-05-parity-09 READY, commit 100eea057f0fafceb78027181be7d85dc333a4e5, trafic 100%, verificat la 6 octombrie. Dovada producției este actualizată.
- Fluxurile cu mai multe editări ale aceleiași înregistrări pot cere replanificare după primul pas; revizia veche nu este ignorată pentru a forța execuția.

### Stări Gmail — în curs de publicare
- Composer-ul nu mai scrie direct statusul emailului pentru deschiderea Gmail sau eroarea runner-ului; PATCH gmail-session revalidează membrul și accesul la dosar în tranzacție și fixează execuția prin handoffJobId.
- Callback-urile repetate sunt no-op; cele întârziate nu retrogradează stări de trimitere/recepție. Modelul nu poate pretinde că a observat dispozitivul. Auditul și statusul sunt atomice.
- 284 teste AI trecute (3 probe de reguli rezervate emulatorului), typecheck trecut. Nu au fost trimise emailuri în teste.
- Handler-ul send-evidence este migrat tranzacțional în etapa următoare; recepțiile providerilor și dispozitivele reale rămân de verificat. Această migrare nu certifică livrarea externă.

### Dovezi Gmail — validată pentru release-ul următor
- send-evidence revalidează actorul/tenantul/dosarul în tranzacție; dovada, comunicarea și auditul sunt atomice. Diagnosticul dispozitivului are schemă strictă și limite.
- Confirmarea repetată nu dublează auditul; agent_confirmed nu înlocuiește ui_observed/reply_confirmed, iar confirmarea întârziată nu retrogradează replied. Corelarea runner-ului cu jobul este obligatorie.
- 286 teste AI trecute; typecheck trecut. Testele sunt simulate și nu trimit mesaje.

### Notificări din navigație — validată local
- Clopoțelul folosește executorul comun pentru citire și read-all; erorile sunt vizibile. Acțiunea comună păstrează readAt la citire și îl golește la unread, numai în colecția utilizatorului autentificat.
- 287 teste AI trecute, 19 verificări Text și 14 Voice trecute; 18 teste de reguli Firestore trecute pe emulator. Voice este verificat cu audio/microfon simulate.
- Build calendar parity-10 READY, trafic 100%. Build Gmail parity-12 include commiturile 98901689 și ce4603c6; compilarea cloud a trecut, activarea este următorul pas.
- Inventarul static încă vede un ClientPortalManager vechi fără importuri montate; acesta nu este un flux manual activ. Rămân de analizat scrierile montate din promovare Facebook, video, custom-domain și contorul de răspunsuri Sales.

### Editor de reguli CRM — extensie validată local
- Prima verificare și oprirea pot fi configurate explicit; timpii existenți neatinși sunt păstrați exact, inclusiv secundele. Limitele trebuie să depășească execuțiile deja efectuate.
- Câmpuri urmărite multiple, agent responsabil și conținutul notificării; toate acțiunile suplimentare existente pot fi editate sau eliminate, cu adăugare până la limita de 5 efecte. Nu se activează direct: se pregătește plan pentru confirmare.
- 20 verificări Text trecute, inclusiv programare și efecte multiple; typecheck trecut. Integrarea concurentă a evenimentelor și acceptanța pe dispozitive/provideri rămân restante.
- Release parity-13 READY, trafic 100%; Gmail, reviziile calendarului și notificările sunt publicate. Probe live de citire pentru health, Anunțuri proprietari și portofoliu: job completed, răspuns cu carduri, fără trimitere externă.

### Tranzacții concurente — verificate pe emulator real
- 21 teste trecute în 6 suite: 18 de reguli de acces și 3 de concurență calendar/executor. Nu sunt teste cu tranzacții simulate.
- Sarcină/vizionare simultane pentru același agent: o singură programare acceptată. Client comun între agenți: o singură programare; agenți și clienți independenți: ambele acceptate. Două editări ale aceleiași sarcini cu revizia inițială: un succes, un 409 și o singură intrare în ledger.
- Typecheck trecut. Testele rulează doar pe un emulator local și pe proiect demo; nu scriu în CRM-ul de producție.

### Reluare la 6 octombrie — verificare și migrare Facebook
- Release `build-2026-10-06-parity-14`, commit `a63290d84504f3342cd199fb9b2f782954431138`: READY, trafic 100%, verificat la 08:51 UTC. Cele 5 funcții sunt ACTIVE, scheduler ENABLED, 72 indexuri READY și heartbeat fără eroare. Gmail, notificările și editorul extins de reguli sunt publicate.
- Contul Facebook implicit al proprietății este salvat prin executorul comun, cu revizia proprietății. Handler-ul verifică existența contului în aceeași agenție și proprietarul contului; conturile altui agent nu pot fi atribuite nici prin model, nici prin formular. Eliminarea selecției rămâne permisă.
- Manifestul v2 arată importurile statice ale paginilor pentru a separa componentele vechi nemontate de fluxurile active. Aceasta nu certifică vizibilitatea în runtime sau paritatea semantică.
- 288 teste AI trecute; cele 6 probe rezervate emulatorului sunt acoperite separat de suitele de reguli și concurență. Eroarea de tip pentru selecția Facebook nullable a fost corectată înainte de publicare.

### Răspunsuri Sales — handler comun și protecție la concurență
- Marcarea ca citite este disponibilă prin sale_replies_read și folosită și de pagina manuală. Revizia și contorul afișat sunt obligatorii; dacă a sosit un răspuns nou, handler-ul returnează 409 fără a goli contorul. UI arată eroarea.
- Membrul, agenția și accesul la dosar sunt revalidate în tranzacție; actualizarea și auditul sunt atomice. Repetarea după marcarea ca citite este no-op, fără audit duplicat. Nu confirmă livrarea unui email.
- 293 teste AI trecute, dintre care 5 noi pentru aceste cazuri; typecheck și manifest trecute. Catalog: 172 handler-e, fără inferență de paritate completă. Versiunea prompt/tool crește la 12 pentru trasabilitatea contractelor noi.

### Reguli CRM concurente — verificare Firestore reală
- 23 teste trecute în 6 suite pe emulator local: 18 de reguli de acces, 3 pentru concurența calendarului și 2 pentru regulile pe evenimente. Cele două execuții simultane au produs exact o sarcină, un ledger, o notificare și un receipt.
- Întreruperea simulată după salvarea sarcinii și înainte de notificare a fost recuperată fără duplicarea sarcinii. Verificarea folosește executorul nativ și tranzacții Firestore, nu un ledger simulat. Lease-urile worker și recepțiile externe rămân verificări distincte.
- Build Next.js pentru handler-ul Sales a trecut. Release parity-16, commit b116bc243282e15540b6ffddd96976a80cf16e76, READY, trafic 100%, verificat la 09:48 UTC; include handler-ul Sales și versiunea de contract 12. Dovada este în CRM_PARITY_PRODUCTION.json.
- Probe reale în conversația afectată: căutarea „5 apartamente în Titan sub 130000 euro” a returnat TEXT, success și un card owners cu 5 rânduri; pregătirea sarcinii a returnat TEXT, success și un plan cu o acțiune. Nu s-au executat planuri sau trimis mesaje în aceste probe.

### Tema și grupurile agenției — etapă de migrare
- Lista grupurilor Facebook poate fi configurată prin update_agency, folosind aceeași schemă ca salvarea manuală. Numele, URL-ul Facebook și scopul sunt validate, inclusiv refuzarea domeniilor care imită Facebook și a URL-urilor cu credențiale.
- Tema din navigația mobilă este aplicată după confirmarea salvării, cu eroare vizibilă la eșec. Ambele fluxuri păstrează drepturile existente: administratori ai agenției. Agentul nu primește drepturi administrative prin Jarvis.
- Revizia agenției este fixată la pregătirea planului și trimisă de formulare; modificările concurente sunt refuzate cu 409 fără ledger. Payload-urile vechi fără marker rămân compatibile; noile planuri îl fixează obligatoriu la pregătire. Mai multe editări ale aceleiași agenții într-un plan pot cere replanificare după primul pas.
- 296 teste AI trecute; 8 probe de integrare rezervate emulatorului, verificate separat în cele 23 teste de acces/concurență. 3 teste noi verifică revizia, rolul revocat și schema grupurilor. Nu au fost lansate publicări Facebook în teste.
- Release `build-2026-10-06-parity-17`, commit `bc087ef75183995233292f69a1a5d9abccfd00ed`: READY, trafic 100%, verificat după activare. Include toate etapele parity-15/16 și migrarea setărilor; prompt/tool 13. Typecheck, build Next.js și build cloud trecute; 20 verificări Text și 14 Voice trecute la această reluare. Voice folosește audio simulat și nu certifică hardware-ul.

### Punct concret de continuare după migrarea setărilor
- Inventarul static găsește încă 8 fișiere montate cu upload/scriere directă: avatarul din lista agenților, imaginea share din custom-domain, stările helper-ului Facebook, assets Meta, biblioteca și selectorul video TikTok Ads, upload-urile din crearea proprietății și generatorul VideoTour din browser.
- Urmează extinderea upload/apply pentru aceste destinații, cu aceeași autorizare și validare a fișierelor; pentru video mare este necesar transfer direct controlat în Storage, fără a crește arbitrar limita request-ului App Hosting. Generatorul browser-canvas trebuie tratat ca handoff pe dispozitiv sau înlocuit cu un serviciu echivalent verificat; un job AI nu poate pretinde că a randat un video în browser.
- După aceste migrări rămân criteriile din matrice: concurență pe restul entităților, reconciliere/corpus/istoric și acceptanța providerilor/dispozitivelor. Acestea nu sunt închise prin existența handler-elor din catalog.

### Imagine de distribuire site — upload comun
- Destinația agency_share_image din file_apply și pagina custom-domain folosesc același serviciu de branding. Upload-ul rămâne privat până la aplicare; PNG/JPEG/WebP sunt validate și recodate; numai administratorul curent poate modifica imaginea agenției. Fotografia profilului și sigla nu sunt înlocuite.
- Idempotency și audit folosesc ledger-ul existent. Revocarea membrului este verificată și la repetare, iar fișierele orfane sunt recunoscute de retenție. Nu se schimbă limita generală de 15 MB a upload-urilor.
- 297 teste AI trecute, inclusiv proba rolului, destinației, protejării avatarului/siglei și repetării; typecheck trecut. Build Functions trecut; deploy-ul retenției și build-ul backend sunt etape distincte.
- Rămân 7 fișiere montate cu scrieri/upload-uri directe. Fotografia agentului din dialog trebuie să păstreze aplicarea după confirmarea editării; simpla selectare a fișierului nu trebuie să modifice profilul.

- Release parity-18, commit 971bc1c88dc5e316a6aee5162476b3f5254d2924: READY, trafic 100%, verificat la 10:42 UTC. Retenția a fost publicată separat și este ACTIVE; heartbeat fără eroare, 72 indexuri READY.

### Fotografia agentului — validată pentru publicare
- Dialogul încarcă imaginea privat și păstrează previzualizarea până la Salvare. Anularea nu modifică profilul. Jarvis poate aplica aceeași imagine prin file_apply/agent_photo cu agentId sau agent_edit cu photoUploadId.
- Numai administratorul curent poate modifica un agent din aceeași agenție. Recodarea imaginii, limitele, retenția și cheia legată de agent protejează aplicarea; profilul privat, proiecția publică, auditul și receipt-ul imaginii se salvează în aceeași tranzacție.
- Revizia profilului previne suprascrierea unei editări concurente. Câmpurile phone/photoUrl omise sunt păstrate. Selectarea unei imagini nu mai scrie direct în Storage din browser; închiderea după salvare este corectată.
- 303 teste AI trecute, 8 probe rezervate emulatorului; typecheck și build Next.js trecute. Probele noi verifică pregătirea fără aplicare, revocarea, apartenența, repetarea și conflictul de revizie. Nu s-au modificat profiluri reale în teste.
- Sincronizarea displayName în Firebase Auth rămâne un efect ulterior tranzacției CRM; reconcilierea unui eșec Auth este încă restantă. Rămân 6 fișiere montate cu scrieri/upload-uri directe și criteriile de acceptanță din matrice. Prompt/tool 15.
- Release parity-19, commit 3c4e4ce52c27ef56da67f706e1da64f608ad8b7d: READY, trafic 100%, verificat la 11:29 UTC; heartbeat fără eroare și funcțiile ACTIVE.

### Import Word structurat și integrare Sales — validată local
- Importul manual și file_apply/contract_template folosesc aceeași conversie server DOCX. Paragrafele, titlurile, listele, tabelele și evidențierile sunt păstrate; linkurile, imaginile și atributele active nu ajung în editor. Imaginile omise și conversiile fără echivalent sunt semnalate. Fonturile, poziționarea exactă și paginarea Word nu sunt certificate ca identice.
- Previzualizarea privată file_docx_preview nu creează șablonul; necesită administrator și upload propriu neexpirat. Upload-urile au limita de 15 MB, decomprimarea incrementală limita cumulată de 32 MB și maximum 1000 intrări. Dialogul nu salvează în timpul importului și ignoră un rezultat sosit după închidere.
- Corectat adaptorul manual /api/crm/actions: permite sale_replies_read, folosit de pagina Sales. Handler-ul exista, dar adaptorul îl respingea. Celelalte operații externe păstrează fluxul dedicat; lista permisă nu devine acces generic.
- 309 teste AI trecute; 8 probe rezervate emulatorului. Teste DOCX reale pentru tabele/evidențieri, hyperlink executabil eliminat și arhivă foarte comprimată refuzată. Testele preview verifică rolul, proprietarul, calea și expirarea; regresia Sales verifică rutarea către executor. Prompt/tool 16; 173 handler-e, fără procent dedus de paritate.
- Release parity-20, commit f32ba784b7022d7307210347cf3c9ef3a2bc9213: READY, trafic 100%, verificat la 11:47 UTC. Typecheck și build local/cloud trecute, heartbeat fără eroare. Nu s-au trimis mesaje sau modificat dosare reale în probe.

### Editare cumpărător atomică și revizii business — validată local
- update_contact acceptă preferințe și agentId în aceeași tranzacție cu celelalte câmpuri. Păstrează cerințele omise, validează intervalele pe rezultatul îmbinat și apartenența agentului; eșecul nu salvează nici câmpuri parțiale, nici ledger. Dialogul manual folosește acest pas unic și așteaptă confirmarea înainte de succes/închidere.
- update_preferences are marker de revizie. Noile planuri fixează o singură dată revizia contactelor, cerințelor și proprietăților; reviziile furnizate sunt păstrate, iar referințele către înregistrări create în plan sunt rezolvate ulterior. Payload-urile vechi fără marker rămân compatibile. Mai multe editări ale aceluiași target pot necesita replanificare după primul pas.
- 313 teste AI trecute, 9 probe rezervate emulatorului; 24 teste pe emulator Firestore real trecute în 6 suite. Noua concurență contact/preferințe are exact un succes, un 409 și un ledger. Prompt/tool 17. Concurența celorlalte entități și acceptanța providerilor rămân în matrice.
- Typecheck și build Next.js final trecute, inclusiv dialogul care așteaptă salvarea; manifest regenerat și verificat după migrarea dialogului.
- Release parity-21, commit 2e7f633bd36b2c91625f5a150003efd28f1220bd: READY, trafic 100%, verificat la 12:04 UTC. Cele 5 funcții ACTIVE, 72 indexuri READY, scheduler ENABLED și heartbeat fără eroare.

### Paginare și totaluri ale căutării — validare în curs
- Fallback-ul cu text păstrează continuarea când limita cardului se atinge înainte de consumarea paginii server, inclusiv când serverul returnează mai puțin de 250 de documente. Ultimul segment nu este confundat cu tot corpusul.
- countScope=query indică agregarea completă sau scanarea completă de la început; countScope=segment indică doar segmentul verificat. Un count după cursor fără agregare nu devine total de agenție, chiar dacă nu mai există continuare. Numerele nu sunt acumulate dintr-un cursor fabricabil.
- Cursorul este legat de rolul actorului și de intervalul calendaristic rezolvat. O comandă „mâine” reluată în altă zi cere o căutare nouă. Contractul tool-ului explică aceste limite modelului; prompt/tool 18.
- Teste pentru căutarea paginată pe 7 contacte, segmentarea unui corpus de 10001 rezultate și invalidarea după schimbarea rolului/zilei. Aceste verificări nu certifică reconcilierea istorică sau agregarea Sales autorizată, încă restante.
- 316 teste AI trecute, 9 probe rezervate emulatorului; typecheck, build Next.js și verificarea manifestului trecute. Publicarea acestei etape urmează după buildul parity-21.

### Erori worker înainte de preluarea conversației — validare în curs
- Un eșec al comenzii de tip turn înainte de lock-ul conversației este salvat ca ERROR_EVENT, cu solicitarea originală, în istoricul propriu. Starea jobului rămâne failed; livrarea erorii nu este succes de business.
- Salvarea verifică tranzacțional claim-ul activ, jobul, actorul, rolul, tenantul, conversația și solicitarea originală. Nu publică pentru un claim vechi, după revocare sau în conversația altuia; nu suprascrie un răspuns existent și nu eliberează lock-ul altei comenzi.
- Nu reexecută acțiuni și nu schimbă politica de reluare a planurilor. Dacă salvarea în istoric eșuează, jobul păstrează eroarea și jurnalul conține doar categoria fixă, fără payload CRM/provider.
- 320 teste AI trecute, 9 probe rezervate emulatorului; 17 teste țintite, cu 4 noi pentru aceste cazuri. Typecheck, build Next.js, contracte și manifest trecute. Prompt/tool 19. Publicarea este în curs; recuperarea worker-elor cu lease expirat și acceptanța providerilor rămân distincte.
- Probă read-only în conversația reală: TEXT, success, card properties, job completed, fără eroare și fără plan executat. Nu s-au trimis mesaje externe.

### Progres worker protejat de claim — validat local
- Publicarea progresului verifică claim-ul și statusul în tranzacție, apoi reînnoiește lease-ul. Un worker înlocuit nu poate suprascrie evenimentele, lease-ul sau rezultatul celui nou. Începerea planului confirmat folosește aceeași verificare.
- 322 teste AI trecute, 9 probe rezervate emulatorului înaintea adăugării suitei worker; două teste worker suplimentare rulează numai pe emulator. Typecheck și build Next.js trecute pentru modificarea runtime.
- 26 teste de acces/concurență trecute în 7 suite pe Firestore local real. Două worker-e simultane invocă o singură dată turn-ul; după expirarea și preluarea lease-ului, progresul vechi este refuzat și rezultatul nou rămâne intact.
- Aceste probe folosesc planificator simulat și tranzacții reale. Nu certifică anularea unui apel provider deja în curs, fencing-ul tuturor efectelor autonome sau heartbeat-ul unei operații fără evenimente timp de peste 5 minute. Planurile întrerupte nu se reexecută automat.
- Release parity-22: READY, trafic 100%, verificat la 12:16 UTC; include paginarea și totalurile. Etapele worker parity-23/24 sunt în publicare.

### Totaluri și carduri Sales autorizate — validare pentru publicare
- query_records include sales, filtrul stage și intervalul createdAt. Agregarea agentului folosește agentId sau collaboratorIds pe server, fără dublarea dosarului în care are ambele roluri; administratorul poate număra agenția. Fallback-ul textual sau pentru index indisponibil filtrează fiecare dosar prin aceeași politică de acces. Nu tratează status/contactId ca filtre Sales valide.
- Cardurile păstrează referințele Sales pentru verificarea accesului la recitire și afișează etapa în română, prețul convenit, codul dosarului, agentul, următoarea acțiune și linkul către dosar. Nu execută modificări din simpla citire.
- Catalogul și schema tool-ului descriu totalurile autorizate. Promptul enumeră numai uneltele disponibile în turn și nu repetă lista în contextul dinamic; instrucțiunile pentru fișiere trimit la contractul destinației. Limitele de tokens/cost și politica de escaladare sunt păstrate; regresia celor două răspunsuri invalide înainte de Sol trece din nou.
- 324 teste AI trecute, 13 probe rezervate emulatorului; 28 teste Firestore reale trecute în 8 suite. Cele două probe Sales verifică agregarea, rolul de colaborator, fallback-ul textual și revocarea accesului. 21 verificări UI Text trecute, inclusiv etapa/prețul/linkul Sales. Typecheck și buildul Next.js final după modificarea cardului au trecut. Prompt/tool 20.
- Release parity-23 (erori vizibile): READY, trafic 100%, verificat la 12:33 UTC. Release parity-24 (progres protejat): READY, trafic 100%, verificat la 12:43 UTC. Nu s-au trimis mesaje externe în probe.

### Lot comun — 6 octombrie, pregătit pentru publicare
- Migrare a celor șase fluxuri montate rămase: media proprietăți/Meta/TikTok, generator video browser și helper Facebook. Inventarul static nu mai găsește scrieri directe nemigrate în fișierele montate identificate; aceasta nu certifică fiecare câmp sau furnizor.
- Video MP4/WebM/MOV până la 500 MB: sesiune privată cu cale exactă, rol și cote, transfer controlat, generație fixată și validare server prin decodarea primului cadru. Materialele pregătite au URL cu token; salvarea formularului rămâne distinctă. Retenția păstrează materialele reutilizate între module și refuză ștergerea după o scanare incompletă.
- Callback video browser autorizat, runId/owner/revizie, salvare atomică și anulare explicită; durata este raportată de browser. Helper Facebook marchează publicarea ca declarație umană, fără a inventa receipt de furnizor.
- Revizii pentru RLV, oferte, arhivare, atribuire, lifecycle, prospectare, portal și șabloane; formularele corespunzătoare trimit revizia observată. Două RLV concurente: un succes, un conflict și un singur ledger.
- Auth are cozi durabile pentru sincronizarea profilului și ștergerea conturilor. Ștergerea CRM/seat/audit este atomică, iar repetarea nu scade din nou locurile. Eșecurile Auth rămân pending pentru recuperare.
- Efectele native ale automatizărilor verifică claim-ul, lease-ul și accesul în tranzacție. Workerul reînnoiește lease-ul și fără evenimente de progres; claim-ul înlocuit nu poate salva progres sau mutații native. Nu se certifică anularea apelurilor externe deja pornite.
- Reconciliere paginată cu checkpoint pe versiunea Firestore exactă; snapshots sunt diferențiate de acțiunile istorice și nu declanșează reguli CRM. Nu se inventează autorul sau evenimentele lipsă.
- Insights parcurge paginile sursă, deduplică suprapunerile și separă limita rezultatelor de analiza incompletă. Reports și Jarvis folosesc același calculator; rapoartele incomplete nu prezintă un segment drept total. Comparația folosește 30 zile; forecasturile rămân estimări.
- Verificarea rezultatelor planului recitește domeniile video/outreach/Meta/TikTok/Ads și mesajul exact, fără repetarea efectului. Domeniile fără adaptor de verificare expun receipt-ul inițial și cer modulul dedicat.
- Căutarea verifică acoperirea indexului și la continuare. Datele sunt live: anunțurile adăugate sau mutate înaintea cursorului apar la o căutare nouă. Cursorul este legat și de actor/rol/scope rezolvat. Nu se pretinde un snapshot imuabil al corpusului.
- Validare lot parity-26: 351 teste AI și 94 comunicare trecute; 37 teste pe emulatoare Firestore/Storage reale; 21 scenarii Text (plus verificarea queued după executor completed), 14 Voice cu audio simulat, typecheck și build Functions/Next.js trecute. Rollout confirmat la 2026-10-06T15:43:07.240Z: parity-26 READY, commit 78c4332a6130da3b10284db199e26f47253852b1, unicul split 100%, 6 funcții ACTIVE, ambele schedulere ENABLED, 72 indexuri READY, heartbeat fără eroare. Dovada este CRM_PARITY_PRODUCTION.json.
- Restante de acceptanță ale planului: verificare semantică exhaustivă câmp cu câmp, providerii și dispozitivele reale, urmărire automată terminală pentru toate domeniile și invalidare globală a corpusului între pagini. Lotul nu reprezintă închiderea globală E0–E7. Publicarea este grupată, la solicitarea utilizatorului.

### Continuare după handoff — 6 octombrie, lot local
- Probele read-only pe parity-26 în conversația incidentului: portofoliu (TEXT, 2 carduri properties), căutare Titan (TEXT, 5 rezultate owners), raport CRM (TEXT, card crm_report). Toate joburile au completed, telemetry success, text prezent și eroare null. Nu s-au executat planuri sau trimis mesaje externe.
- Editările succesive ale contactelor/preferințelor/ofertelor/arhivării/portalurilor, proprietăților/lifecycle, task-urilor/vizionărilor, atribuirii, prospectării și șabloanelor pot continua din receipturi tranzacționale before/after ale aceluiași target. Releveul produce aceeași dovadă; editarea proprietății și înlocuirea RLV se pot înlănțui. Payload-ul aprobat rămâne neschimbat; numai precondiția execuției este derivată din pașii deja confirmați ai planului.
- Nu se recitește versiunea live pentru a aproba implicit schimbările altcuiva. O revizie explicită fără continuitate, o serie ruptă sau o editare manuală intervenită păstrează conflictul. Receipturile sunt salvate cu ledger-ul și pot fi recuperate după checkpoint; repetarea pasului confirmat păstrează idempotency. Activarea unui portal existent nu emite o revizie de mutație fictivă. Handler-ele fără receipt compatibil și planurile create înainte de acest lot pot necesita replanificare.
- Cardul comun Text/Voice urmărește automat rezultatele suportate, cu citiri la minimum 15s, maximum 60 verificări, backoff la erori și suspendare când pagina este ascunsă. Se oprește la dovada terminală sau revocare; 401/403/404 elimină rezultatele anterior afișate. Verificarea manuală rămâne disponibilă. Nu reprezintă încă un watcher durabil când pagina este închisă.
- TikTok Studio urmărește jobul exact returnat la enqueue și verifică uid/agenție/projectId/kind înainte de rezultat; nu confundă starea unui proiect reeditat cu execuția veche. Membership este reverificat și înaintea returnării tuturor rezultatelor. Nicio verificare nu retransmite efectul sau schimbă ledger-ul inițial.
- Probe: concurență Firestore contact/preferințe cu intervenție manuală, receipt RLV, checkpoint/recovery și prefix autonom spre aprobare. Text UI verifică queued → delivered fără replay, oprire la terminal și ascunderea rezultatului după revocare; Voice folosește același control.
- Validare finală: 362 teste AI trecute (23 probe sunt rezervate emulatorului în această rulare), 38 teste Firestore/Storage reale trecute în 12 suite, typecheck, manifest fără drift și build Next.js final trecute. Text: 21 scenarii enumerate plus urmărire automată/opririle/ascunderea la revocare. Voice: 14 scenarii cu audio/microfon simulate; hardware-ul real nu este certificat. Editarea urmată de ștergere a sarcinii păstrează două ledgere confirmate și nu produce o revizie fictivă pentru înregistrarea eliminată.
- Acest lot este încă local, separat de releaseul parity-26 confirmat. Nu s-a pornit un nou rollout; publicarea rămâne grupată. Restantele globale E0–E7 din matrice rămân deschise, în special corpus/cursor, adaptori externi și acceptanță semantică/provider/dispozitive.


## 2026-10-18 — Catalogul fluxurilor de distribuire

Catalog executabil prin instrumentele existente, expus plannerului prin workflow_catalog (index compact, detalii la cerere). Nu este un executor nou și nu certifică execuția externă. Acoperă: pagina Facebook organică; TikTok organic cu verificare/generare video cloud; Imobiliare/Storia/Romimo; WhatsApp către matching cu șablon aprobat și link public propriu; grupuri Facebook cloud; PDF; contact și vizionare; retragere portaluri. Fluxurile se aleg semantic și se pot combina.

property_public_link verifică accesul la proprietate și statusul activ, folosește domeniul public configurat al agenției sau ruta /agencies/{agencyId}/properties/{propertyId}, respinge URL ne-HTTPS. Nu verifică HTTP și nu pretinde disponibilitatea domeniului. Șablonul WhatsApp trebuie să suporte linkul; nicio substituire cu link privat sau șablon de prospectare proprietari.

Limite constatate: publicarea pe pagina Facebook este admin-only în handlerul manual; catalogul nu ridică acest drept. TikTok cere video ready și condițiile providerului. Așteptarea unui job lung și reluarea automată până la publicare nu au fost validate end-to-end în această schimbare. Nicio postare, trimitere WhatsApp sau randare cu cost real nu a fost efectuată. Catalogarea și regresiile locale nu reprezintă certificare că toate fluxurile se execută complet în producție. Modificările nu sunt publicate în producție.


## Audit de închidere a fluxurilor — portalul clientului — 2026-10-18

Verdict: catalogul de opt fluxuri NU certifică executarea completă. Auditul verifică ramura locală; nu publică și nu testează efecte externe reale. Cerința clarificată înlocuiește regula anterioară despre linkul public al proprietății: mesajul pentru cumpărător conține linkul PORTALULUI CLIENTULUI și numai ofertele noi din lotul acelei trimiteri.

### Constatări pe flux

| Flux | Dovezi existente | Lipsuri / limite pentru închidere |
| --- | --- | --- |
| Pagina Facebook organică | Handler comun, galerie cu jurnal și verificare Meta în meta-property-post; fotografii și descriere CRM. | API-ul este admin-only. Registrul nu declară aceeași restricție pentru meta_property_post. Rezultatul este în post; normalizatorul generic nu extrage post.status, iar plan_outcomes nu are recitire dedicată acestei operații. Astfel succesul providerului și răspunsul Jarvis nu sunt uniform legate. Nu certificăm varianta video din verificarea galeriei. |
| TikTok, inclusiv video lipsă | Executorul păstrează checkpoint, verifică videoUrl înainte de import, continuă pașii deja planificați; testele media-pipeline și tiktok-schedule trec cu provideri simulați. | Lanțul testat video -> asset -> draft nu este o dovadă a unei comenzi naturale până la postare reală. Trebuie închis și verificat video -> draft -> publish -> status pentru același job/cont. Verificare limitată la 30 minute, plan valabil o oră. Watcherul verifică starea, nu generează singur pași lipsă din plan. |
| Portaluri conectate | Imobiliare publish/reconcile, Storia publish, Romimo preview/publish/verify sunt în registru. | plan_outcomes nu are reconciliere dedicată pentru aceste publicări. În runPlan, un rezultat pending/failed/unknown oprește pașii următori, inclusiv canale independente într-un plan liniar. Nu există dovadă testată aici că o singură comandă publică pe toate integrările active și închide fiecare destinație. |
| Matching -> portal client -> WhatsApp | Matching și recommend_properties persistă în Firestore; verificarea mesajelor distinge coadă/trimitere/livrare. | recommend_properties cumulează recomandările în același portal. ClientPortalPageContent citește întreaga colecție fără selector de lot. Nu există în acest flux un lot distinct asociat trimiterii și excluderii ofertelor expediate anterior. Testul matching-delivery introduce manual mesajul/jobul simulat: NU exercită cap-coadă handlerul real de trimitere. Conversația nouă trebuie executată înainte de pregătirea mesajului, cu ID real; catalogul singur nu garantează reluarea planificării. |
| Grupuri Facebook cloud | Testele includ cazul Croatian Avadanii -> Cristian Avadanii, selecție și creare unică a jobului, precum și context conversațional. | Crearea jobului nu dovedește postările pe fiecare grup. Providerul/runnerul sunt simulate în verificarea locală. Potrivirea aproximativă este limitată; ambiguitățile nu pot fi rezolvate sigur prin alegerea arbitrară a unui cont. |
| PDF | Handlerul generează PDF cu Playwright; adaptorul salvează răspunsul binar în storage și oferă link. Testele șablonului trec. | Nu s-a generat aici un PDF prin infrastructura de producție. Chromium, fotografiile, fonturile, serviciul de obiective și storage sunt dependențe de verificat; testul HTML nu certifică artefactul final. |
| Contact și vizionare | Tranzacții, prevenirea suprapunerilor, idempotentă, referințe între pași, Europe/Bucharest. | Nu există dovadă universală pentru orice transcriere de nume. Cele două teste de replay descrise mai jos au așteptări neactualizate. Confirmarea participanților WhatsApp este o etapă separată. |
| Retragere portaluri | Imobiliare/Storia au unelte și verificări de domeniu. | Romimo are unpublish în handlerul manual, dar nu are operație romimo_unpublish în registrul Jarvis. Nu se poate declara paritate pentru toate portalurile. |

### Blocaje transversale identificate

- search-text normalizează diacritice, punctuație, ordine de cuvinte și telefoane; nu implementează corecție fonetică generală. facebook-name-match are distanță de editare limitată pentru label/displayName. Nu extinde implicit această garanție la cumpărători, proprietăți, pagini și conturi TikTok.
- Mai multe entități similare, rezultate paginate/incomplete, pronunții care schimbă un nume în altul valid, negări, excluderi, referințe precum «același/celelalte» trebuie validate înainte de scriere. O potrivire unică bine susținută poate fi folosită direct; ambiguitatea reală cere o întrebare cu denumiri.
- Executorul liniar poate opri destinații independente. Timeout după acceptarea externă cere reconciliere, nu reexpediere. Revocarea accesului, modificarea proprietății, cont deconectat, șablon respins, parametru lipsă și media invalidă sunt blocaje reale, nu se rezolvă printr-o instrucțiune de prompt.
- Portalul clientului face un singur query «in» pentru întreaga listă cumulată de proprietăți; loturile mari trebuie fragmentate/paginate pentru a respecta limitele bazei de date.
- «Pregătit», «în coadă», «publicat», «trimis», «livrat» și «citit» nu sunt echivalente. Răspunsul final trebuie construit din dovezi pe canal/destinatar, nu doar din numărul de rezultate.

### Contractul necesar pentru loturile portalului clientului

1. Matching autorizat -> selectarea ofertelor -> excluderea celor deja trimise acelui client, pe baza istoricului real de expediere. Simpla recomandare nu înseamnă trimitere.
2. Persistă atomic un lot stabil cu client, portal, proprietăți, autor și identificatorul cererii. O reluare reutilizează lotul; două cereri concurente nu revendică aceleași oferte pentru două trimiteri accidentale.
3. Linkul portalului clientului selectează lotul respectiv. Nu șterge recomandările sau feedbackul vechi. Linkurile vechi își păstrează sensul; URL-ul nou nu expune istoricul complet.
4. Șablon WhatsApp aprobat pentru recomandări, cu parametrul/butonul linkului de portal real. Verifică identitatea conversației, refuzurile și eligibilitatea. Fără șablon compatibil nu substitui un link de proprietate.
5. Leagă lotul de mesaj/job; păstrează prepared/queued/sent/delivered/failed/unknown. La rezultat incert nu retrimite până la reconciliere. Lotul gol produce «nu sunt oferte noi», fără mesaj gol.
6. Teste necesare: primul lot; al doilea lot fără ofertele primului; overlap; nimic nou; retry înainte/după acceptarea providerului; concurență; refuz; schimbare număr; proprietate retrasă; feedback; lot mare; client/agenție greșite; acces prin domeniu propriu și ruta standard.

### Verificări rulate

- 96/96 teste în șapte fișiere: catalog, planner Jev, conservarea politicilor, alegeri după nume, normalizare CRM, șablon PDF, retragere portaluri.
- Emulator Firestore/Storage: 296/299 trecute în șase fișiere (matching-delivery, media-pipeline, tiktok-schedule, facebook-create, calendar-concurrency, meta-publication-reconcile).
- Două eșecuri calendar sunt comparații de replay care nu includ noul câmp reused:true; diferența afișată nu demonstrează un efect duplicat. Testele nu au fost slăbite/modificate pentru audit.
- Un eșec de concurență: INVALID_ARGUMENT Transaction is invalid or closed. Repetarea izolată a trecut (1 passed, 69 skipped). Nu este dovadă de dispariție definitivă a riscului de concurență.
- Nu sunt teste cu modele/provideri live. Nicio publicare, trimitere WhatsApp sau cheltuială externă reală.

Corecții efectuate în acest audit: workflow_catalog v2 și politica plannerului cer portalul clientului, exclud explicit linkul proprietății și semnalează lipsa loturilor. Instrumentul property_public_link rămâne disponibil pentru alte scopuri; nu este instrumentul de livrare către cumpărător. Implementarea loturilor și închiderea lacunelor de mai sus rămân de făcut. Nu s-a publicat în producție.


## Implementarea după audit — 18 octombrie 2026

Această secțiune actualizează constatările auditului de mai sus, care descriu starea anterioară. Implementarea este locală, pe codex/jarvis-semantic-20261018; nu este un rollout de producție.

| Flux | Implementare și verificare actuală |
| --- | --- |
| Portal client → WhatsApp | Noua acțiune send_client_portal execută recomandarea, crearea/reutilizarea conversației exacte, pregătirea șablonului aprobat și coada reală. URL-ul este portalul CLIENTULUI cu selector de lot. Lotul nou exclude ofertele cu o trimitere deja înregistrată; istoricul și linkurile vechi se păstrează. Reluarea reutilizează aceeași operație. Un lot gol nu trimite mesaj. |
| Protecția loturilor | Revendicarea ofertelor și crearea jobului se fac în aceeași tranzacție. Serviciul reverifică destinatarul, URL-ul exact, accesul și disponibilitatea proprietăților înainte de expediere. Trimiterile incerte nu sunt reluate automat. Reguli Firestore: citirea unui lot exact, fără enumerare și fără modificări din client. Interfața filtrează lotul și fragmentează citirile mari în grupuri de maximum 30. |
| Pagina Facebook organică | Galerie prin serviciul verificat comun, disponibil agenților agenției. Schimbarea rolului/accesului în timpul publicării oprește confirmarea. Jarvis extrage dovada Meta și comunică publicarea, nu numai numărul de rezultate. Dovada de galerie nu certifică separat vechiul traseu video al paginii. |
| TikTok organic | Catalogul cere întregul plan video → asset → draft → publish. Testul executorului verifică așteptarea randării, continuarea până la publicare și reluarea fără a repeta cei cinci pași. Randarea și furnizorul sunt simulate în această probă; nu este certificare live. |
| Publicare/retragere portaluri | property_publication_status citește starea proprietății exacte pentru Imobiliare, Storia și Romimo. plan_outcomes folosește această dovadă. romimo_unpublish este legat de handlerul manual existent. Verificarea Imobiliare/Storia folosește citiri, fără o nouă publicare/retragere. |
| Destinații independente | Cerințele explicit independente, cu un singur pas fără referințe sau condiții, pot continua după eșecul canalului precedent. Canalul eșuat rămâne neconfirmat. Aceasta nu este o planificare generală de graf: un lanț dependent blocat nu este sărit pentru a căuta arbitrar pași ulteriori. |
| Identificare | resolve_crm_name adaugă recuperarea numelor apropiate pentru proprietăți/contacte, cu diacritice și ordine de cuvinte normalizate, paginare și verificarea accesului. Numerele nu sunt aproximative. Mai multe identități plauzibile cer alegere. Se păstrează resolverul existent pentru conturile Facebook. |
| Grupuri, PDF, vizionări | Serviciile existente rămân executorii: grupuri cloud cu fotografiile/descrierea originale, prezentarea PDF și contact/vizionare cu ora București. Sunt incluse în verificarea regresiilor; nu sunt înlocuite cu un executor paralel. |

Politicile de matching și distribuire au fost aliniate: fără text liber/link de proprietate ca substitut pentru livrarea ofertelor în portalul clientului. Detaliile sunt încărcate din catalog la nevoie, pentru a păstra selecția Jev în bugetul existent de context.

Validări confirmate: 109 teste unitare în șapte suite; 184 teste Firestore/Storage în patru suite, cu 33 de teste live neexecutate; încă 4 teste pentru șablonul PDF. Testul nou pentru WhatsApp trece prin serviciul nativ, pregătirea reală, coada și workerul real, cu Meta simulat, apoi verifică dovada de livrare simulată. Typecheck și build Next.js au trecut. Build-ul a necesitat rerulare în afara sandboxului din cauza accesului Windows la un director temporar. Copierea Chromium în standalone a raportat că directorul playwright-core nu există în layout-ul copiei locale; artefactul PDF nu este certificat în producție prin acest build.

Limite de acceptanță: nu s-au folosit modele/providere live, nu s-au trimis mesaje și nu s-au publicat anunțuri reale. Autorizarea Meta/TikTok, configurațiile portalurilor și șablonul de recomandări aprobat sunt condiții reale, nu sunt eliminate prin prompt. Trimiterea automată raportează inițial coada, iar Inbox urmărește starea; nu declară livrare înainte de dovadă. Planurile persistate folosesc plan_outcomes pentru verificare. Nicio afirmație de acoperire universală a formulărilor sau de funcționare 100% în producție nu rezultă din aceste teste.

Validare finală suplimentară: 304/304 teste în șase suite Firestore/Storage (calendar-concurrency 70, facebook-create 90, media-pipeline 83, tiktok-schedule 33, matching-delivery 5, meta-publication-reconcile 23). Cele 5 matching-delivery sunt comune cu rularea de 184 teste; totalul distinct este 483 teste de integrare, plus 113 unitare/șablon PDF. Cele 33 probe live rămân neexecutate. Lint fără erori sau avertismente pentru fișierele verificate; diff-check curat; manifest verificat cu 182 operații și 42 acțiuni native, fără a deduce un procent de paritate. Cele două aserțiuni calendar despre replay au fost aliniate explicit la reused:true și trec, păstrând verificarea efectelor unice.
