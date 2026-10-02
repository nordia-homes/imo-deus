# WhatsApp ImoSocial — stare implementare, 2026-10-01

## Reguli păstrate

Fără commit/push. Fără trimitere la App Review. Facebook/Instagram păstrează configurația generală Meta. Nu migra automat numere existente. Iconul aplicației a fost amânat explicit de titular.

## Implementat local

- Configurație WhatsApp dedicată (app/config/secret), gate test/production și allowlist administrator/destinatar.
- Signup legat de utilizator, agenție, mod, app și config; expirare/anti-replay, preflight criptare, paginare numere, rezervare proprietate înaintea mutațiilor Meta, verificarea register/subscribed_apps, protecție ON_PREMISE/Business App.
- UI cu pregătire, lansare popup la click explicit, timeout, anulare și izolare a răspunsurilor întârziate. Cloud dedicat este alegerea inițială.
- Webhook cu secret dedicat, limită corp, proveniență app, izolare evenimente invalide, callbackuri de revocare/ștergere separate per app.
- Receipts cu corelare HMAC, păstrarea erorilor, recalculare idempotentă a bugetului, recuperare tranzacțională sending, izolare erori per job, paginare scanare expirări.
- Creare minimală de template text și validare strictă a componentelor suportate. Descărcarea inbound media nu depinde de send activ.

## Fișiere

Config: `apphosting.yaml`, `firebase.whatsapp-deploy.json`, `src/lib/communications/whatsapp-config.ts`.

Signup/UI: `src/lib/communications/meta.ts`, `model.ts`, `src/components/communications/MarketingWorkspace.tsx`, `WhatsAppTemplates.tsx`, `src/app/api/communications/[...path]/route.ts`, `templates.ts`.

Recepție și livrare: `webhook-handler.ts`, `normalize.ts`, `server.ts`, `outbound.ts`, `receipt-correlation.ts`, `media.ts`, `sync.ts`, cele două rute webhook și `src/app/api/communications-worker/route.ts`.

Lifecycle: `meta-signed-request.ts`, `src/app/auth/meta/deauthorize/route.ts`, `src/app/data-deletion/route.ts`.

Teste/documente: `whatsapp-signup.test.ts`, `whatsapp-security.test.ts`, `scripts/whatsapp-audit-probes.cjs`, auditul, planul și ghidul App Review din acest director.

## Validări efectuate

- Typecheck communications: trecut după ultimele corecții.
- Communications: 72 teste trecute, 2 teste de reguli omise (emulatorul nu este pornit; Java nu este disponibil în PATH).
- Probe de regresie audit: 5 PASS; date sintetice, fără mesaje reale.
- Build Functions: trecut. Prima încercare a fost blocată de EPERM la scrierea fișierului generat; reluarea autorizată a trecut.
- Build complet Next.js: trecut; avertismente preexistente OpenTelemetry exporter-jaeger, două clase Tailwind și copierea browserului în standalone absent. Ultimele două condiții de protecție au fost apoi reverificate prin typecheck și teste; buildul cloud compilează sursa finală.
- git diff --check: trecut.
- Cele trei funcții communications din us-central1 sunt ACTIVE.
- Paginile publice confidențialitate, termeni și data-deletion: HTTP 200.

## Configurație externă verificată/modificată

- Secret Manager: `META_WHATSAPP_APP_SECRET` preluat din ImoSocial prin browser, creat cu versiunea 1 ENABLED; valoarea nu este în repository/chat.
- `WHATSAPP_TEST_USER_IDS` și `WHATSAPP_TEST_RECIPIENTS` create pentru datele autorizate de titular.
- Acces backend `studio` acordat celor trei secrete prin comanda oficială Firebase App Hosting; secretele vechi nu au fost înlocuite.
- Meta Basic: domeniu imodeus.ro, politica https://imodeus.ro/confidentialitate, termeni https://imodeus.ro/termeni-si-conditii, instrucțiuni ștergere https://imodeus.ro/data-deletion, categoria Business and pages. Persistența a fost verificată după reload. Iconul este încă lipsă, conform deciziei titularului.
- Embedded Signup existent: System-user, Never, WhatsApp assets, exact cele două permisiuni business_management/messaging; nu a fost modificat.
- JavaScript SDK login este deja enabled și permite https://imodeus.ro/. HTTPS/strict redirect rămân enabled. Callbackurile lifecycle au fost salvate și confirmate după reload: deauthorize `https://imodeus.ro/auth/meta/deauthorize`, Data Deletion Requests `https://imodeus.ro/data-deletion`.

## Publicare și E2E

Publicarea din sursa locală a reușit: build `build-2026-10-01-001` READY și trafic 100%, CLI Deploy complete, exit 0. Reper rollback anterior: backend studio, build `build-2026-09-30-003`. Comanda folosește `firebase.whatsapp-deploy.json`, fără modificarea fluxului Git obișnuit și fără commit/push.

Probe publice după rollout: challenge WhatsApp HTTP 200 cu răspuns exact, eveniment gol semnat cu secretul ImoSocial HTTP 200, același eveniment semnat cu vechiul secret HTTP 403, webhookul general Meta semnat cu secretul său HTTP 200. Callbackurile deauth/data-deletion resping semnătura invalidă cu HTTP 403.

Webhook Meta salvat și verificat: `https://imodeus.ro/api/webhooks/whatsapp`, token existent păstrat confidențial; `messages` Subscribed v26.0 confirmat în dashboard. Meta a abonat automat evenimente administrative pentru cont, securitate, număr și template. `calls` a fost dezabonat explicit (nefolosit). Coexistence history/smb_app_state_sync/smb_message_echoes rămân Unsubscribed pentru pilotul Cloud dedicat.

Probă trimisă direct din dashboardul Meta: `message_template_status_update` cu date sintetice (`my_message_template`, id 12345678); a ajuns în Firestore cu sourceAppId ImoSocial și a fost procesată `completed` la 2026-10-01T16:49:05.223Z, fără nicio trimitere la telefon. Această probă verifică transportul, semnătura și procesarea cozii, nu dovedește sincronizarea template-urilor sau conversațiile reale.

Contul autentificat în ImoDeus poate accesa modul pilot și are „Conectează WhatsApp” activ; nu există numere conectate. S-a solicitat titularului să introducă personal PIN-ul nou și să lanseze Embedded Signup.

Pagina Meta Publish inspectată separat afișa „All required app settings are complete” și buton Publish activ; aceasta nu este aceeași condiție cu eligibilitatea pentru dosarul App Review (unde iconul a fost amânat). După confirmarea explicită „Da, publică în Meta pentru pilot”, ImoSocial a fost publicată: dialog „Your app was successfully published”, status Published și buton Unpublish confirmate. Dosarul nu a fost trimis la App Review. Gate-ul din ImoDeus rămâne test, pentru administratorul și destinatarul autorizați.

Nu sunt încă demonstrate: signup live al pilotului, inbound/response pe telefon, template aprobat trimis sau delivery/read reale. Nu s-a trimis niciun mesaj real în această implementare până la acest checkpoint.

## Limite care nu trebuie ascunse

- Dashboardul Meta din Step 2. Production setup avertizează explicit că o aplicație Unpublished primește numai webhookuri de test din dashboard, fără date reale nici de la administratori/developeri/testeri. ImoSocial a fost ulterior publicată cu aprobarea titularului. Publicarea nu echivalează cu acces avansat pentru clienți externi; gate-ul pilot rămâne activ.
- Un backlog webhook queued/failed blochează conservator trimiterile WhatsApp, inclusiv dacă eroarea este într-un alt canal. Necesită remedierea explicită a evenimentelor înainte de reluare; nu ignorăm un posibil opt-out.
- Istoricul Coexistence se izolează per obiect history, nu per mesaj din acel obiect. Nu este validat E2E pe un număr Business App.
- Cererea de ștergere are status pending_review și revocă integrarea; nu pretinde ștergere automată integrală a mesajelor/media/indexului.
- Politica publică existentă este orientată către website; trebuie verificată acoperirea exactă a datelor din integrarea de mesagerie înainte de producție/review.
- Cheia locală Firebase din .env.local a fost respinsă cu Invalid JWT Signature; operațiile autorizate au folosit sesiunea Firebase CLI. Nu s-a modificat cheia locală.
- O comandă anterioară `firebase login:list --json` a inclus neașteptat tokenuri în outputul instrumentului. Nu au fost reproduse în fișiere sau răspunsuri. Se recomandă invalidarea/reautentificarea acelei sesiuni CLI după terminarea operațiilor; nu se revocă automat în timpul publicării.

## Corecții la promptul inițial

Business Verification nu mai este IN REVIEW: dashboardul inspectat o arată Approved. App Review era deja In review, starea nu a fost creată de această implementare. Business Verification singură nu garantează disponibilitatea pentru clienți externi. Rolul de admin CRM nu echivalează cu rolul Meta. Never nu înseamnă token imposibil de revocat. Pentru cerința video observată, listarea template-urilor singură nu este suficientă; s-a adăugat creare minimală. Promptul nu acoperea setările Basic lipsă și URL-urile generice greșite găsite live.
