# Implementare Jarvis CRM — progres verificabil

Actualizat: 6 octombrie 2026. Implementarea completă E0–E7 este în curs. Această pagină separă implementarea din cod de acceptanța pe furnizori și de deploy. Auditul inițial este un baseline, nu o descriere a noilor capabilități.

## Etapa curentă

- Catalog curent: 171 handler-e existente, 40 tipuri de acțiuni; discovery semantic în română, catalog de date și verificare a disponibilității cu pași provider expliciți. Cifrele descriu codul, nu certifică paritatea tuturor fluxurilor.
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
| B19–B22 | Upload privat, scanner domeniu, assets/RLV, OCR, Word text, artefacte/export | Upload video mare, reproducere completă a formatării DOCX, verificare toate formatele/fișierele |
| B23–B28 | Acord uman existent, template/media/sync, calls, Gmail/forwarding handlers | Probele Meta test mode, opt-out la send, Gmail runner/handoff și evidența pe dispozitiv real |
| B29 | Stări de rezultat explicite și worker/plan separate | Urmărire automată completă până la rezultat final în fiecare domeniu extern |
| B30–B34 | Catalog/citiri/relații/timeline, proiecții, count/query, owner index live, fingerprint matching | Reconciliere/backfill de istoric, lag măsurat, rapoarte complete și revision corpus/cursor |
| B35–B41 | Handler-e Imobiliare/Storia/Romimo/Meta/TikTok/Cloud/Video înregistrate cu contracte | Probe funcționale de provider, job controls și disponibilitate per entitate |
| B42–B45 | Profile/agency/preferences comune, avatar/logo private, agents/domain/billing/collaboration handlers, handoff links | Acceptanță OAuth/plată/push pe dispozitiv și onboarding complet |
| B46–B47 | Discovery compact, resolver date, buget, checkpoints/pause/cancel | Probe UI pentru pauză/reluare și loturi mari în producție |
| B48 | Automatizări editabile, istoric, condiții de oprire și reguli CRM pe evenimente cu effects interne/receipts/cursor; editor Text/Voice | Acceptanță integrată a evenimentelor concurente și providerilor; efecte externe prin aprobări dedicate |
| B49–B50 | Carduri comune, manifest CI, teste unitare/rules/UI/build | Verificare de release, observabilitate și probe end-to-end pentru fiecare modul |

## Validări efectuate

- 264 teste deterministe AI trecute, plus o probă ulterioară pentru checkpoint/limita regulilor în worker; 3 teste de reguli rulează separat în emulator.
- 18 teste de reguli Firestore trecute în emulator (5 suite).
- 18 verificări UI Text și 14 verificări UI Voice trecute; editorul pregătește planul, păstrează atribuirile și filtrele neatinse și citește istoricul; Gmail handoff și lipsa dovezii înainte de callback verificate cu bridge simulat.
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
