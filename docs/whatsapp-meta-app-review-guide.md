# ImoSocial — ghid tehnic pentru demonstrație Meta

Acest document pregătește demonstrația. Nu este o confirmare a aprobării Meta și nu autorizează trimiterea dosarului App Review. Nu a fost efectuată o nouă trimitere la review.

## Configurație și condiții înainte de filmare

- Aplicație WhatsApp: ImoSocial, `2339244290179735`; configurație Embedded Signup `1401889672012663`.
- Aplicația generală Meta rămâne separată pentru Facebook/Instagram. Nu înlocui META_APP_ID/META_APP_SECRET.
- App Secret ImoSocial: numai în Secret Manager, `META_WHATSAPP_APP_SECRET`, disponibil la runtime backendului `studio`.
- Pilotul folosește `WHATSAPP_ONBOARDING_MODE=test`, allowlist UID administrator și allowlist destinatar. Un rol CRM nu dovedește automat rolul Meta; contul Facebook folosit trebuie să aibă rol pe aplicație când permisiunile sunt Standard Access.
- Configurația Meta inspectată: System-user access token, Never; numai active WhatsApp; permisiunile `whatsapp_business_management` și `whatsapp_business_messaging`. Expirarea Never nu garantează că tokenul nu poate fi revocat.
- Business Verification era Approved la inspecție; App Review era deja In review; aplicația era Unpublished. Acestea sunt stări diferite.
- Confidențialitate: https://imodeus.ro/confidentialitate ; termeni: https://imodeus.ro/termeni-si-conditii ; instrucțiuni de ștergere: https://imodeus.ro/data-deletion . Toate au răspuns HTTP 200 la 2026-10-01.
- Politica publică existentă descrie în principal website-ul. Înainte de review/producție trebuie verificată acoperirea reală a mesajelor, contactelor, fișierelor, furnizorilor și retenției integrării. Nu pretinde că deautorizarea șterge întregul istoric.

## Webhook

Callback URL: `https://imodeus.ro/api/webhooks/whatsapp`.

Verify token: valoarea secretului existent `META_WEBHOOK_VERIFY_TOKEN`, niciodată în video, Git sau chat. POST trebuie semnat cu noul App Secret WhatsApp. GET folosește verify token, nu App Secret.

Pentru pilotul Cloud dedicat: câmpul `messages` acoperă inbound și statusuri de mesaje. Nu există un câmp separat `statuses` de bifat în locul lui. Pentru Coexistence se verifică disponibilitatea și schema câmpurilor `smb_message_echoes`, `history` și `smb_app_state_sync` în configurația Meta efectivă; implementarea curentă normalizează mesajele/echo/history, nu declară sincronizare completă a tuturor stărilor Business App. Nu activa Coexistence ca și cum ar fi verificată printr-un test Cloud.

După onboarding, backendul trebuie să confirme `subscribed_apps` pentru WABA. Setarea webhookului aplicației și abonarea WABA sunt pași separați.

## Video 1 — conectare și mesagerie

1. Autentificare în ImoDeus cu administratorul pilot. Deschide Marketing → WhatsApp → Numere. Arată bannerul de test.
2. Alege „Număr dedicat Cloud API”. Titularul introduce PIN-ul; acesta nu trebuie filmat. Apasă „Conectează WhatsApp”, apoi „Deschide fereastra Meta”.
3. În Meta, titularul selectează/creează WABA și verifică numărul nou. Orice acord, acces sensibil sau verificare personală se finalizează explicit de titular. Nu migra numărul existent Business App.
4. După întoarcere, arată numărul conectat în CRM. Nu afișa code/token/PIN/App Secret.
5. De pe destinatarul autorizat trimite un mesaj voluntar către numărul pilot. Deschide Inbox și conversația aferentă. Confirmă textul primit și numărul corect.
6. În fereastra de servicii eligibilă, răspunde cu un mesaj scurt cerut de destinatar. Verifică estimarea serverului și trimite o singură dată. Arată mesajul primit în WhatsApp și stările accepted/delivered/read observate în CRM.
7. Nu promite un receipt read dacă destinatarul are confirmările dezactivate. Un test de failed nu trebuie provocat prin spam sau destinatar neautorizat; folosește teste automate pentru cazurile de eroare.

Permisiune demonstrată: `whatsapp_business_messaging`. Filmul trebuie să arate acțiunea în aplicație și efectul real la destinatar, nu doar dashboardul Meta.

## Video 2 — administrarea șabloanelor

1. Marketing → WhatsApp → Șabloane → alege numărul conectat → „Actualizează șabloanele”.
2. „Creează șablon text”: nume unic cu litere mici și underscore, limba ro/en_US, categoria reală și text fără variabile. O ofertă/promovare aparține Marketing, nu Utility.
3. Apasă „Creează șablonul în Meta”. Arată rezultatul PENDING/APPROVED returnat de Meta și șablonul listat. Nu prezenta PENDING ca aprobat.
4. După aprobarea șablonului și cu acordul înregistrat al destinatarului, selectează-l în Inbox, verifică estimarea și trimite către destinatarul pilot autorizat. Arată primirea.

Permisiune demonstrată de creare/listare: `whatsapp_business_management`; trimiterea folosește `whatsapp_business_messaging`. Dashboardul Tech Provider inspectat cere dovadă de creare a template-ului. Listarea singură nu demonstrează acest pas.

Crearea unui template îl trimite spre verificarea template-urilor Meta. Nu este trimiterea aplicației la App Review. Respectă restricția titularului privind dosarul aplicației.

## Text propus pentru dosar — numai după E2E reușit

„ImoDeus este un CRM pentru agenții imobiliare. Administratorii conectează activele WhatsApp ale agenției prin Embedded Signup. whatsapp_business_management este utilizată pentru verificarea contului/numărului, abonarea WABA la webhook și listarea/crearea șabloanelor. whatsapp_business_messaging este utilizată pentru răspunsuri la solicitările primite și mesaje cu șabloane aprobate către persoane care au acordat consimțământ. Accesul este separat per agenție, iar revocarea, opt-out-ul, fereastra de răspuns și plafonul de consum sunt verificate înaintea trimiterii. Videoclipurile atașate demonstrează acțiunile efectiv finalizate în aplicație.”

Elimină orice afirmație care nu este demonstrată de versiunea publicată. Nu declara serviciul disponibil tuturor clienților înainte de permisiunile/aprobările necesare.

## Ce se ascunde din înregistrare

Ascunde App Secret, access/refresh tokens, authorization code, verify token, PIN, OTP, date de plată și informații personale fără legătură cu demonstrația. Folosește contacte de test și mesaje fără date ale clienților reali. Păstrează vizibile butoanele, categoria/limba/statusul template-ului și rezultatul trimiterii.

## Verificări operaționale încă necesare

App Hosting a fost publicat la 2026-10-01 (build-2026-10-01-001), accesul runtime la secrete și validarea webhookului nou au trecut. `messages` este Subscribed v26.0.

Rămân rolul Meta al pilotului, OTP/PIN, tarife active pentru moneda WABA, consimțământ și E2E real. Dashboardul Step 2 avertizează explicit: o aplicație Unpublished primește numai webhookuri de test din dashboard, nu date reale nici de la admin/developer/tester. ImoSocial a fost ulterior publicată cu confirmarea explicită a titularului; dialogul de succes și Published au fost verificate. Nu s-a trimis aplicația la App Review. ImoDeus păstrează gate-ul pilot; publicarea nu înseamnă acces avansat pentru toți clienții.

Testele unitare nu înlocuiesc acești pași. Nu seta artificial billing sau approvals la true.
