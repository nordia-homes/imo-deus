# Implementare Jarvis CRM — progres verificabil

Actualizat: 5 octombrie 2026. Implementarea completă E0–E7 este în curs. Această pagină separă implementarea din cod de acceptanța pe furnizori și de deploy. Auditul inițial este un baseline, nu o descriere a noilor capabilități.

## Etapa curentă

- Catalog: 169 handler-e existente, 37 tipuri de acțiuni; discovery semantic în română, catalog de date și verificare a disponibilității cu pași provider expliciți.
- Executor comun manual/AI pentru contacte, proprietăți, calendar, prospectare, oferte, portaluri, dosare, contracte și setări. Migrarea UI include dashboard, liste, detalii, dialogs și inbox Storia.
- Câmpuri complete ale formularelor de bază, assignment în aceeași agenție, lifecycle cu motive și istoric, verificare concurentă la editarea proprietăților.
- Normalizare telefon/email și locks de identitate. Migrare producție: 468 contacte, 0 conflicte; verificare ulterioară: 0 modificări restante. Cele 386 identități repetate existente sunt păstrate pentru revizuire, fără merge automat.
- Calendar comun: lock tranzacțional, conflicte vizionare/vizionare, sarcină/sarcină și sarcină/vizionare pentru agent, client sau proprietate. Sarcinile fără oră rămân termene, nu ocupă intervale.
- Fișiere private până la 15 MB: document Sales, media conversație, RLV/imagini, OCR standard/electronic, import text Word în șablon draft. Exporturi PDF/ZIP/CSV/DOCX și preview audio privat.
- Planuri de maximum 100 pași: checkpoints de 10 pași, progres, pauză/reluare și oprire; rezultatele externe incerte nu se retrimit automat.
- Automatizări: creare, editare, pauză/reluare, istoric de execuție, oprire la termen/status client și la răspuns WhatsApp. Matching păstrează motorul existent și avertizează când datele sursă s-au schimbat.
- Timeline autorizat, citiri asociate și proiecții de modificări CRM/agenție/notificări. Evenimentele fără actor verificabil nu inventează autorul schimbării.
- Carduri comune Text/Voice, detalii de plan, continuări, linkuri de handoff și separarea draft/queued/running/succeeded/failed/unknown.

## Urmărirea backlogului

„Implementat” în coloana de cod nu înseamnă că toate probele provider au fost închise. Manifestul static nu certifică paritatea semantică.

| Backlog | Implementare curentă | Criterii încă de închis |
|---|---|---|
| B01–B04 | Catalog, servicii comune, politici, ledger, versiune proprietate, audit | Clasificare semantică finală a tuturor fluxurilor montate; optimistic concurrency pe restul entităților |
| B05–B06 | Lifecycle și calendar comun, lock și validări | Probe concurente integrate pe toate căile de UI și efectele provider lifecycle |
| B07–B13 | Contacte/câmpuri/default-uri/dedup, oferte, proprietăți, task-uri/vizionări, favorites | Autofill istoric de contact și căile manuale secundare rămase; verificare exhaustivă câmp cu câmp |
| B14–B18 | Import/review, portal/preferences links, feedback, Storia dedup, Sales constructor/handlers | Acceptanță completă în UI și provider pentru import/linkuri/dosare |
| B19–B22 | Upload privat, scanner domeniu, assets/RLV, OCR, Word text, artefacte/export | Upload video mare, reproducere completă a formatării DOCX, verificare toate formatele/fișierele |
| B23–B28 | Acord uman existent, template/media/sync, calls, Gmail/forwarding handlers | Probele Meta test mode, opt-out la send, Gmail runner/handoff și evidența pe dispozitiv real |
| B29 | Stări de rezultat explicite și worker/plan separate | Urmărire automată completă până la rezultat final în fiecare domeniu extern |
| B30–B34 | Catalog/citiri/relații/timeline, proiecții, count/query, owner index live, fingerprint matching | Reconciliere/backfill de istoric, lag măsurat, rapoarte complete și revision corpus/cursor |
| B35–B41 | Handler-e Imobiliare/Storia/Romimo/Meta/TikTok/Cloud/Video înregistrate cu contracte | Probe funcționale de provider, job controls și disponibilitate per entitate |
| B42–B45 | Profile/agency/preferences comune, agents/domain/billing/collaboration handlers, handoff links | Avatar/logo prin assets AI; acceptanță OAuth/plată/push pe dispozitiv și onboarding complet |
| B46–B47 | Discovery compact, resolver date, buget, checkpoints/pause/cancel | Probe UI pentru pauză/reluare și loturi mari în producție |
| B48 | Automatizări editabile, istoric și condiții de oprire | Reguli generale declanșate de evenimente, editor complet și dedup la evenimente concurente |
| B49–B50 | Carduri comune, manifest CI, teste unitare/rules/UI/build | Verificare de release, observabilitate și probe end-to-end pentru fiecare modul |

## Validări efectuate

- 236 teste deterministe AI trecute; 3 teste de reguli rulează separat în emulator.
- 18 teste de reguli Firestore trecute în emulator (5 suite).
- 13 verificări UI Text și 14 verificări UI Voice trecute.
- Build Next.js și build Functions trecute. Testele headless Voice folosesc microfon/audio simulate; nu certifică ecoul pe hardware real.
- Deploy-ul etapei și probele live se consemnează separat după verificarea commitului activ și traficului.

Nu este încă îndeplinit criteriul „paritate completă”: elementele restante de mai sus rămân parte din implementarea solicitată, nu sunt închise prin simpla înregistrare a unui endpoint.
