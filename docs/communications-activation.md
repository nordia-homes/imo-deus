# Meta organic, WhatsApp și Inbox: implementare și activare

Starea la 27 septembrie 2026: implementare locală pentru pilot; nu a fost publicată și nu este validată end-to-end cu conturi Meta. Planul inițial se livrează incremental. Nu toate funcțiile din fazele ulterioare sunt implementate.

## Disponibil în cod

- Marketing → Facebook + Instagram și WhatsApp, înainte de TikTok; Inbox înlocuiește numele Inbox Storia. Istoricul vechi rămâne la `/inbox/storia`.
- Conexiuni separate pe cont și capabilitate; OAuth organic separat de Ads, criptarea tokenurilor, revocare, identificarea agenției exclusiv pe server.
- Postări din proprietăți: draft, programare, Facebook fotografii/text, Instagram fotografii/carusel, rezultat separat pe destinație, comentarii publice și număr de interacțiuni.
- WhatsApp Embedded Signup: Coexistence pentru Business App sau număr dedicat Cloud API cu PIN de înregistrare. Eligibilitatea reală este stabilită de Meta. Recepția și sincronizarea nativă sunt confirmate prin evenimente, nu doar prin login.
- Inbox Storia, WhatsApp, Messenger și Instagram: mesaje în documente separate, recepție prin webhook, text, șabloane WhatsApp cu parametri de corp, fișiere JPEG/PNG/PDF, atribuire, note, stare, asociere cu proprietăți și contacte CRM, acces din fișa cumpărătorului și proprietății.
- Căutare Typesense pe mesaje, nume, telefon, email, identificatori de proprietate și numele fișierelor; revalidare Firestore pentru fiecare rezultat. Indexul nu este sursă de autorizare.
- Cozi durabile, deduplicare, confirmări neordonate, recuperarea contabilizării, blocarea retrimiterii automate după rezultat incert. Cheia mesajului este păstrată în interfață după eroare de rețea.
- Consimțământ pe scop cu dovadă și audit, tarif versionat, estimare înainte de trimitere, rezervare atomică în plafon lunar. Sumele sunt estimări ale traficului ImoDeus, nu factura Meta.
- Migrare Storia paginată/idempotentă, proiecție pentru evenimente noi și păstrarea notificărilor Storia existente. Agentul proprietății este preluat la prima migrare dacă apartenența lui este validă.
- Apartenența la agenție și rolul sunt modificate prin endpoint autentificat, nu prin propriul profil editabil. Invitațiile necesită email verificat.

## Configurare înainte de pilot

În mediul server Next.js, prin gestionarul de secrete al infrastructurii:

| Variabilă | Scop |
| --- | --- |
| `META_APP_ID`, `META_APP_SECRET` | Aplicația Meta aprobată pentru funcțiile activate; fallback existent `FACEBOOK_APP_*` |
| `META_GRAPH_VERSION` | Versiunea Graph verificată pentru aplicație; implicit v23.0 |
| `APP_BASE_URL` | Originea publică HTTPS a aplicației |
| `META_TOKEN_ENCRYPTION_KEY` | Secret aleator puternic pentru tokenuri; păstrat stabil și protejat |
| `META_WEBHOOK_VERIFY_TOKEN` | Verificarea abonamentului webhook |
| `META_ORGANIC_LOGIN_CONFIG_ID` | Configurația Login for Business, dacă este folosită |
| `META_WHATSAPP_CONFIG_ID` | Configurația Embedded Signup disponibilă aplicației |
| `WHATSAPP_DIRECT_BILLING_READY` | `true` numai după verificarea plății directe; nu configurează plata singură |
| `COMMUNICATIONS_WORKER_SECRET` | Autentificarea apelului programat către worker |
| `TYPESENSE_URL`, `TYPESENSE_API_KEY` | Cluster HTTPS și cheie exclusiv pe server, cu acces la colecția `imodeus_messages` |
| `COMMUNICATIONS_SCAN_URL`, `COMMUNICATIONS_SCAN_TOKEN` | Scanner HTTPS pentru PDF; POST cu bytes, răspuns JSON `{ "safe": true }` |
| `STORIA_WEBHOOK_SECRET` | Semnătura Storia, obligatorie pe ambele căi de recepție |

În Firebase Functions: secretele `COMMUNICATIONS_WORKER_SECRET`, `COMMUNICATIONS_APP_BASE_URL`, `STORIA_WEBHOOK_SECRET`. URL-ul trebuie să fie al aceluiași mediu; secretul worker trebuie să coincidă. Schedulerul pornește la minut. Nu activa schedulerul înainte de endpoint și indecși.

Configurația Meta trebuie să includă callbackul `/auth/communications/callback` și endpointurile `/api/webhooks/meta`, `/api/webhooks/whatsapp`. Configurează explicit evenimentele de mesagerie, statusuri și Coexistence/history disponibile aplicației. Granturile, abonamentele, Advanced Access/App Review și eligibilitatea numerelor se verifică pe conturile reale; codul nu substituie aceste aprobări.

Publică regulile Firestore și Storage configurate în `firebase.json`, indecșii și funcțiile noi în mediul pilot. Folosește Java și emulatorul pentru testarea regulilor înainte de producție. Regulile Storage folosesc [accesul Firestore documentat de Firebase](https://firebase.google.com/docs/reference/security/storage); prima activare poate necesita permisiunea serviciului între produse.

Activează TTL pentru câmpul `expiresAt` al `communicationWebhookEvents` (payloadurile brute sunt marcate pentru expirare după 30 de zile). Politica nu există până când este activată în Firestore. Datele conversațiilor au nevoie de o politică de retenție separată a agenției.

Tarifele nu sunt incluse ca valori presupuse. Importă tarifele aplicabile, verificate la Meta, cu `scripts/communications-rates.mjs`; citește opțiunile scriptului, rulează întâi fără `--write`, apoi importă explicit în proiectul dorit. Configurează și tariful zero pentru mesaje eligibile, dacă este aplicabil. Fără tarif valid, toate trimiterile WhatsApp sunt blocate; recepția continuă. Stabilește plafonul lunar în pagina WhatsApp.

## Verificări reproductibile

```text
npm run typecheck:communications
npm run test:communications
npm run test:communications:rules
npm --prefix functions run build
```

Testele unitare acoperă accesul între agenții, ferestrele de răspuns, bugetele, semnătura webhook, ordinea statusurilor, replay, istoric importat și retry după expirarea ferestrei. Testele regulilor se omit explicit când emulatorul nu rulează. Configurația TypeScript dedicată evită fișierele generate `.next` invalide observate în verificarea inițială.

Pilotul trebuie să verifice: inbound/răspuns/receipt pe fiecare canal, răspuns din WhatsApp Business App, token revocat, cont fără permisiune, tarif/plafon epuizat, semnătură invalidă, fișier și download autorizat, migrare Storia repetată, postare parțial reușită și anulare. Nu folosi conversații sau postări reale pentru aceste probe fără alegerea explicită a destinatarilor/conturilor de test.

Monitorizează joburile `failed`, `blocked`, `unknown` și cererile `communicationDeletionRequests`. Un rezultat `unknown` cere verificarea platformei externe înainte de orice retrimitere. Cererile Meta Data Deletion primesc confirmare persistentă și status `pending_review`, cu revocarea accesului; ștergerea completă a istoricului și a datelor derivate încă necesită intervenție operațională și nu este declarată finalizată automat.

## Limite și faze rămase

- Nu sunt implementate campanii în masă, automatizări de vizionări, AI Matching/AI replies, formulare Lead Ads, email sau TikTok Inbox.
- Editorul nou nu include video/Reels/Stories, material general independent de proprietate, text diferit pe platformă sau flux editorial agent–aprobator. Publicarea video Facebook existentă rămâne distinctă.
- Statisticile sunt interacțiuni de bază; nu există raport complet de atribuție, SLA și conversii. Comentariile sunt distincte de DM.
- Importul Messenger/Instagram este limitat la 250 de mesaje text per sincronizare; istoricul și evenimentele native disponibile depind de API. Editările/revocările de mesaje și toate tipurile media nu sunt încă normalizate.
- Căutarea nu indexează încă note interne sau titlurile proprietăților. Filtrarea după proprietate se aplică în pagina de rezultate Firestore; pot exista pagini fără potriviri înainte de următoarele rezultate.
- Callbackul de ștergere are registru și revocare; procesarea integrală a ștergerii, retenția conversațiilor, panoul de operațiuni/replay și reconcilierea manuală a rezultatului incert rămân necesare înainte de extinderea pilotului.
- Configurarea reală Meta, facturarea, Typesense, scannerul PDF, publicarea și testele end-to-end nu au fost efectuate în această implementare locală.
