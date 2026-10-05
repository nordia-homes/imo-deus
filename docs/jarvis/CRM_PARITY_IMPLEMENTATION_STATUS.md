# Implementare Jarvis CRM — progres verificabil

Actualizat: 5 octombrie 2026. Implementarea completă E0–E7 este în curs. Această pagină separă implementarea din cod de acceptanța pe furnizori și de deploy. Auditul inițial este un baseline, nu o descriere a noilor capabilități.

## Etapa curentă

- Catalog curent: 170 handler-e existente, 40 tipuri de acțiuni; discovery semantic în română, catalog de date și verificare a disponibilității cu pași provider expliciți. Cifrele descriu codul, nu certifică paritatea tuturor fluxurilor.
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
| B05–B06 | Lifecycle și calendar comun, lock și validări | Probe concurente integrate pe toate căile de UI și efectele provider lifecycle |
| B07–B13 | Contacte/câmpuri/default-uri/dedup/autofill, oferte, proprietăți, task-uri/vizionări, favorites și căile secundare migrate | Verificare exhaustivă câmp cu câmp și concurență pe editările restante |
| B14–B18 | Import/review, portal/preferences links, feedback, Storia dedup, Sales constructor/handlers | Acceptanță completă în UI și provider pentru import/linkuri/dosare |
| B19–B22 | Upload privat, scanner domeniu, assets/RLV, OCR, Word text, artefacte/export | Upload video mare, reproducere completă a formatării DOCX, verificare toate formatele/fișierele |
| B23–B28 | Acord uman existent, template/media/sync, calls, Gmail/forwarding handlers | Probele Meta test mode, opt-out la send, Gmail runner/handoff și evidența pe dispozitiv real |
| B29 | Stări de rezultat explicite și worker/plan separate | Urmărire automată completă până la rezultat final în fiecare domeniu extern |
| B30–B34 | Catalog/citiri/relații/timeline, proiecții, count/query, owner index live, fingerprint matching | Reconciliere/backfill de istoric, lag măsurat, rapoarte complete și revision corpus/cursor |
| B35–B41 | Handler-e Imobiliare/Storia/Romimo/Meta/TikTok/Cloud/Video înregistrate cu contracte | Probe funcționale de provider, job controls și disponibilitate per entitate |
| B42–B45 | Profile/agency/preferences comune, avatar/logo private, agents/domain/billing/collaboration handlers, handoff links | Acceptanță OAuth/plată/push pe dispozitiv și onboarding complet |
| B46–B47 | Discovery compact, resolver date, buget, checkpoints/pause/cancel | Probe UI pentru pauză/reluare și loturi mari în producție |
| B48 | Automatizări editabile, istoric, condiții de oprire și reguli CRM pe evenimente cu effects interne/receipts/cursor; editor Text/Voice | Extinderea editorului vizual la toate configurațiile existente și scenarii de evenimente concurente integrate; efecte externe prin aprobări dedicate |
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
