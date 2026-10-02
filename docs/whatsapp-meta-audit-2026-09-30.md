# Audit WhatsApp / Embedded Signup — 30 septembrie 2026

**Revizuit printr-un al doilea audit în aceeași zi.** Constatările suplimentare, reproducerile offline și verificarea accesului browser sunt la final. Verdictul inițial rămâne, dar primul audit nu surprindea complet recuperarea trimiterilor incerte și izolarea erorilor din worker.

## Verdict și limite

Integrarea există și merită păstrată. Configurația din repository nu este pregătită pentru noua aplicație ImoSocial și nu dovedește un flux end-to-end funcțional. Cererea curentă este de audit: nu s-au schimbat codul aplicației, configurația de deployment sau conturile externe; nu s-a făcut commit/push.

Au fost inspectate fluxurile din `meta.ts`, MarketingWorkspace, InboxWorkspace, API communications, webhookurile Meta/WhatsApp, workerul și Functions, normalizarea/ingestia, outbound, templates, crypto, sync, regulile Firestore relevante, App Hosting și documentele din 29 septembrie. Nu este un audit al întregului CRM și nici un test de penetrare.

Stările Integrity GREEN, Business Verification IN REVIEW, rolul Tech Provider, apartenența Config ID la App ID, expirarea configurației și restricția vechiului WABA provin din prompt. Nu au fost confirmate în dashboardul Meta. Nu au fost citite valorile secretelor, schimbate numere sau trimise mesaje reale. Configurația efectivă din Firebase poate diferi de YAML.

## Constatări prioritizate

### A1 — P1: noua aplicație nu este separată

`src/lib/communications/meta.ts:14`, `:192`, `:194`, `:195`, `:221`; `MarketingWorkspace.tsx:73`; `apphosting.yaml:82`.

App ID și secretul sunt cele generale, cu fallback FACEBOOK. Acestea sunt folosite pentru SDK, exchange și debug_token. YAML păstrează `1060868529622483`; nu declară META_WHATSAPP_APP_ID, META_WHATSAPP_APP_SECRET sau META_WHATSAPP_CONFIG_ID. Simpla introducere a noului Config ID ar combina configurația nouă cu aplicația veche. Înlocuirea globală a META_APP_ID/META_APP_SECRET afectează și Facebook/Instagram.

Remediere: funcții/configurație WhatsApp distincte, fără fallback la secretul vechi, răspuns dashboard explicit pentru WhatsApp și teste de regresie pentru aplicația generală.

### A2 — P1: webhookul WhatsApp verifică secretul aplicației vechi

`src/app/api/webhooks/whatsapp/route.ts:2` reexportă handlerul Meta; `src/app/api/webhooks/meta/route.ts:14` verifică META_APP_SECRET/FACEBOOK_APP_SECRET. Payloadurile semnate de noua aplicație vor primi 403 cât timp secretul general rămâne cel vechi.

HMAC SHA-256 pe corpul original și comparația constant-time sunt corecte în implementarea inspectată. GET verifică META_WEBHOOK_VERIFY_TOKEN și întoarce challenge. POST doar pune evenimentul în coadă: 200 nu dovedește apariția lui în Inbox. Remediere: endpoint WhatsApp cu secret dedicat și păstrarea secretului general pentru Meta.

### A3 — P1: nu există un mod pilot separat de activarea comercială

`meta.ts:174`, `:221`; `src/app/api/communications/[...path]/route.ts:43`; `MarketingWorkspace.tsx:69`, `:87`.

whatsappReady depinde doar de Config ID și WHATSAPP_DIRECT_BILLING_READY. Nu include App ID/secret în valoarea afișată UI, deși start le verifică separat. Configurația, eligibilitatea testerului și aprobările de producție nu sunt reprezentate separat. Autorizarea API verifică administratorul agenției ImoDeus; acesta nu este același lucru cu un admin/developer/tester Meta.

Eliminarea exclusivă a flagului de billing ar expune inițierea tuturor administratorilor agențiilor, în limitele impuse ulterior de Meta. Recomandare: mod disabled/test/production, allowlist server-side de utilizatori/agenții pilot la start și finish, banner în UI și criterii explicite de activare comercială. Dacă pilotul trebuie limitat și după conectare, politica trebuie aplicată și la trimitere; în prezent flagul de billing controlează onboardingul, nu outbound.

### A4 — P1: callbackurile de revocare/ștergere sunt omise din prompt

`src/app/auth/meta/deauthorize/route.ts:6`, `src/app/data-deletion/route.ts:6`, `src/lib/communications/sync.ts:37`.

Ambele callbackuri verifică numai secretul general. Dacă noua aplicație folosește aceleași URL-uri, data-deletion respinge semnătura, iar deauthorize poate răspunde success fără să deconecteze ceva. Separarea trebuie să includă și aceste callbackuri. În plus, secretele conexiunilor rețin metaUserId, dar nu appId; revocarea caută numai metaUserId. O implementare cu două aplicații trebuie să păstreze proveniența aplicației și să limiteze efectele revocării la ea.

Ștergerea curentă creează o cerere pending_review și revocă conexiunile; nu șterge automat toate mesajele, media și copiile derivate. Nu trebuie prezentată drept ștergere completă deja implementată.

### A5 — P2: înregistrarea Cloud se execută necondiționat

`meta.ts:205–216`.

Orice finalizare cu mode=cloud apelează /register cu PIN, fără să citească starea înregistrării sau tipul efectiv al numărului. Nu îndeplinește cerința „numai când este necesar”. Modul este legat de state, dar provine inițial din alegerea utilizatorului, nu dintr-o verificare a tipului de cont Meta. Pentru coexistence ramura nu apelează /register, ceea ce trebuie păstrat.

Apartenența locală la altă agenție este verificată în registerConnection după /register și /subscribed_apps. Astfel, un conflict local poate fi descoperit după modificări externe. Este necesară verificarea/rezervarea proprietății înaintea efectelor externe, păstrând verificarea tranzacțională finală pentru concurență.

### A6 — P2: fluxul din browser permite sesiuni suprapuse

`MarketingWorkspace.tsx:49–76`.

connectWhatsApp se încheie după lansarea FB.login, iar act eliberează busy înainte de încheierea popupului. Utilizatorul poate relansa conectarea sau modifica mode/PIN în timpul ei. Callbackurile citesc/scriu aceeași referință signup.current și pot amesteca răspunsurile a două încercări; backendul poate respinge state/mode și utilizatorul trebuie să reia.

Listenerul verifică exact cele două origini cerute și tipul WA_EMBEDDED_SIGNUP, dar acceptă orice eveniment necunoscut care are cele două ID-uri, nu doar finalizările suportate. Nu există timeout UI sau legare explicită a callbackului la încercarea activă. FB.login este apelat după încărcarea SDK și un request asincron, ceea ce prezintă și risc de blocare popup; nu a fost reprodus într-un browser în acest audit.

Remediere: sesiune UI imutabilă, blocarea relansării și a schimbării modului până la rezultat/anulare, validare explicită a evenimentelor finale și ignorarea callbackurilor vechi.

### A7 — P2: validarea numerelor verifică numai prima pagină

`meta.ts:205–207` citește /WABA/phone_numbers o singură dată. Un număr autorizat aflat într-o pagină ulterioară este respins ca străin. Paginarea există pentru șabloane, dar lipsește aici. Nu blochează obligatoriu un pilot cu un singur număr, dar afectează conturi mai mari.

### A8 — P2: testele nu probează onboardingul critic

Nu există teste directe pentru startWhatsAppSignup/finishWhatsApp, expirare/replay state, app_id greșit, scopes lipsă, WABA/număr străin, separarea celor două aplicații, register condițional sau rutele de webhook cu secrete distincte. Testul validSignature verifică primitiva HMAC, nu alegerea secretului în rută. Testele outbound curente acoperă în principal retry/idempotency, nu un ciclu Meta real.

### Alte limite relevante pentru pilot

- Outbound solicită tarif valabil inclusiv pentru category=service. Fără înregistrarea ratei, răspunsul liber poate fi blocat chiar în fereastra de 24h. Trimiterile taxabile cer și buget; template-urile cer consimțământ înregistrat. Aceste dependențe lipsesc din traseul simplificat al promptului.
- send/templates devin active imediat după onboarding; receive așteaptă webhook. Active pentru send nu dovedește livrare, stare sănătoasă a numărului sau facturare corectă.
- Workerul este definit și exportat din Functions, dar deploymentul, schedulerul, secretele, indecșii și TTL nu au fost verificate live. El procesează cel mult 10 webhookuri și 3 joburi outbound per execuție; există retry limitat și script de replay.
- Normalizatorul are suport pentru inbound, statusuri, echo și history, nu o implementare completă a tuturor evenimentelor Coexistence. Evenimentele fără phone_number_id sunt ignorate; actualizările de template/account nu produc acțiuni dedicate. Un webhook ignorat poate fi marcat completed.
- Statusurile nu regresează de la read; failed după accepted este suportat. Nu există jurnal cronologic complet al statusurilor. Bugetul folosește estimarea rezervată la livrare, nu costul efectiv reconciliat cu factura Meta.
- bodyParameterCount recunoaște parametri numerici, nu parametri nominali. Un template cu variabile nominale poate fi declarat sendable cu 0 parametri și apoi respins de Meta. Componentele complexe nu sunt acoperite complet; pentru pilot trebuie ales un template simplu, verificat.
- State este legat de uid/agency/mode, dar nu de appId/configId. Consumul este înaintea apelurilor Meta; un eșec tranzitoriu obligă reluarea signupului. Nu este replay vulnerabil, dar lipsește recuperarea etapizată.

## Ce există și trebuie păstrat

FB.login cu response_type=code, override_default_response_type și sessionInfoVersion=3; featureType pentru coexistence; verificarea origin; state aleator de 32 bytes, 10 minute și consum tranzacțional; exchange server-side; is_valid/app_id/scopes; verificarea WABA, monedei și apartenenței numărului; criptare AES-256-GCM; protecție între agenții la salvare; /subscribed_apps; infrastructura Inbox/cozi; deduplicare; statusuri; șabloane paginate și verificare APPROVED; fereastră 24h; opt-out și revalidare înainte de execuție.

Acestea sunt constatări din cod, nu confirmări că noua aplicație le-a executat cu succes.

## Configurația propusă după audit

| Element | Repository actual | Ținta din prompt |
| --- | --- | --- |
| Facebook/Instagram App ID | META_APP_ID=1060868529622483 | Păstrat pentru integrarea existentă |
| Facebook/Instagram secret | META_APP_SECRET, referință secret | Păstrat |
| WhatsApp App ID | Folosește generalul | META_WHATSAPP_APP_ID=2339244290179735 |
| WhatsApp secret | Folosește generalul | META_WHATSAPP_APP_SECRET, secret separat |
| WhatsApp Config ID | Citit din env, nedeclarat în YAML | META_WHATSAPP_CONFIG_ID=1401889672012663 |
| APP_BASE_URL | https://imodeus.ro | Păstrat |
| Verify token | META_WEBHOOK_VERIFY_TOKEN | Poate rămâne comun; nu este App Secret |

Secret nou de creat/setat manual: **META_WHATSAPP_APP_SECRET**, cu App Secret al aplicației ImoSocial, disponibil backendului App Hosting la runtime. Trebuie acordat acces backendului și făcut un rollout după adăugarea configurației. App ID și Config ID nu sunt secrete. META_TOKEN_ENCRYPTION_KEY, META_WEBHOOK_VERIFY_TOKEN și COMMUNICATIONS_WORKER_SECRET rămân necesare; schedulerul folosește și COMMUNICATIONS_APP_BASE_URL. Nu roti cheia de criptare fără strategie pentru tokenurile deja salvate.

Nicio modificare din tabel nu a fost aplicată în acest audit.

## Meta, webhook și probe manuale

Callback URL: **https://imodeus.ro/api/webhooks/whatsapp**.

Pentru pilot Cloud: obiectul WhatsApp Business Account, câmpul **messages**, pentru mesaje și statusurile lor; abonarea aplicației la WABA este o operație separată de verificarea URL-ului. Pentru Coexistence, câmpurile de evaluat în configurația disponibilă sunt smb_message_echoes și history; smb_app_state_sync nu are consumator dedicat în codul actual. Nu prezenta simpla selectare a câmpurilor ca implementare a sincronizării. Actualizările template-urilor sunt citite la cerere; nu există handler dedicat message_template_status_update.

Trebuie confirmate manual: aplicația/configurația corectă, domeniul și allowed origins/redirect URIs în câmpurile corespunzătoare, rolurile Meta și accesul la portofoliu/WABA, nivelul permisiunilor și cerințele curente de review, numărul pilot, eligibilitatea Coexistence, billing, callbackurile de revocare/ștergere și deploymentul workerului.

Ordine pentru demonstrație după remedieri: login admin pilot → Marketing/WhatsApp → alegere număr Cloud separat/PIN → Conectează → Embedded Signup → număr afișat → mesaj din telefonul de test → Inbox → răspuns și delivered/read → Marketing/Șabloane → template aprobat → consimțământ/buget/tarif → Inbox/șablon → Verifică trimiterea → Trimite. Statusul failed trebuie demonstrat printr-o probă controlată distinctă, fără mesaje către persoane neautorizate.

Mesajele demonstrează folosirea whatsapp_business_messaging; listarea template-urilor și administrarea resurselor WABA folosesc whatsapp_business_management. Nu există creare/editare/ștergere de template în UI/API. Nu se poate promite că listarea este suficientă pentru cerința concretă din formularul Meta; aceasta trebuie verificată înainte de a implementa administrare suplimentară.

Text factual pentru review, după proba reală: „ImoDeus permite administratorului agenției să conecteze propriul cont WhatsApp, să consulte șabloanele aprobate și să răspundă clienților din Inbox. Permisiunea de mesagerie este folosită pentru trimitere/primire, iar cea de management pentru resursele WABA și șabloane.” Nu afirma creare/editare de template până când nu există. În filmare se ascund tokenuri, secrete, PIN, OTP, date personale și conversații reale; controalele și rezultatele relevante rămân vizibile.

## Dovezi și verificări

- `npm run typecheck:communications`: PASS, exit 0.
- `npm run test:communications`: 8 fișiere trecute; 40 teste trecute; 1 fișier/2 teste omise. Testele WhatsApp existente sunt în aceeași suită.
- Firestore rules: omise deoarece FIRESTORE_EMULATOR_HOST nu este setat; Java nu a fost găsit în PATH. Nu s-a instalat emulatorul în cadrul auditului.
- `git diff --check`: PASS la verificarea inițială; verificat din nou după redactare.
- Lipsesc: probă E2E live, handshake cu verify token real, POST semnat cu noul secret, deployment verificat, teste directe signup și sesiune UI în browser.
- Accesarea URL-ului public prin instrumentul web nu a reușit. Aceasta NU demonstrează că endpointul este căzut sau funcțional.
- În prima trecere a fost creat numai acest raport. În a doua trecere a fost adăugat și scriptul offline de reproducere descris mai jos. Fără schimbări de implementare, commit sau push.

## Ce trebuie corectat în promptul ChatGPT

1. **Business Verification aprobată nu garantează că tot fluxul devine disponibil.** Rămân permisiuni/niveluri de acces, App Review/Access Verification aplicabile, asset access, eligibilitate număr și configurarea tehnică. Nici rolul de tester nu garantează fiecare variantă Embedded Signup/Coexistence.
2. **whatsappConfigured=true este o condiție locală necesară, nu suficientă pentru succesul Meta.** Bannerul de test nu este control de acces; administratorul CRM nu este implicit tester Meta.
3. **Separarea exclusiv în fișierele enumerate este incompletă.** Include deauthorize/data-deletion, proveniența appId în tokenurile persistate și politica pentru conexiunile vechi. Schimbarea env nu convertește tokenurile emise de aplicația veche.
4. **„Expiration: Never” nu înseamnă token irevocabil/permisii permanente.** Trebuie confirmat exact la ce obiect se referă în dashboard; păstrează verificarea expirării/revocării.
5. **„Allowed domain: https://imodeus.ro” nu identifică precis câmpul Meta.** App Domains și origin/redirect URL au formate și scopuri diferite; nu se copiază aceeași valoare automat peste tot.
6. **„Imediat după Business Verification putem testa A–E” omite dependențe locale.** Worker, webhook, tarife, buget, consimțământ, template aprobat și număr efectiv înregistrat sunt necesare.
7. **Review-ul pentru template management nu trebuie presupus.** Promptul este corect când cere verificarea înaintea implementării, dar nu există dovezi în audit că trebuie construit CRUD complet sau că simpla listare va fi acceptată.
8. **Nu trata vechiul App ID drept cauză demonstrată a restricției și noua aplicație drept remediu garantat.** Restricția descrisă este o informație furnizată, nu un diagnostic confirmat asupra aplicației/portofoliului/WABA/numărului.
9. **Ordinea E2E trebuie să distingă Cloud de Coexistence și să includă /register când este necesar.** Lista de la punctul 8 al promptului omite această etapă, deși punctul 6 o menționează.

Direcția promptului este bună: reutilizare, separarea aplicațiilor, secret server-side și billing netrucat. Problemele sunt condițiile prezentate prea categoric și dependențele omise.

## Surse externe și limitele verificării

- [Colecția oficială Meta Embedded Signup](https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup): rezultatul indexat confirmă App Review/Advanced Access pentru lansare; include și fluxuri de credit ale furnizorilor, deci nu este dovada billingului direct în contul ImoSocial.
- [Meta Webhook Subscriptions](https://www.postman.com/meta/whatsapp-business-platform/folder/ozgs3jn/webhook-subscriptions): abonarea explicită la WABA este necesară.
- [Meta Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api): referință pentru mesagerie, statusuri și operațiile Cloud API.
- Paginile actuale Meta pentru [App Review](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review/), [implementare Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation) și [Coexistence](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users) au returnat HTTP 429 instrumentului web. Nu pretind confirmarea integrală a cerințelor lor actuale. Nu am folosit relatări Reddit sau ghiduri terțe drept autoritate pentru acceptarea reviewului.

## A doua trecere: ce scăpase sau necesita precizare

### B1 — P1: recuperarea `unknown` nu funcționează dacă s-a pierdut ID-ul Meta

**Reprodus offline.** `outbound.ts:127–138`, `server.ts:100–120`.

Dacă Meta acceptă mesajul, dar requestul expiră înainte ca aplicația să primească/salveze `wamid`, jobul local este `unknown`, cu rezervarea păstrată. Un webhook ulterior `delivered` generează un mapping pe ID-ul extern, dar nu poate identifica jobul local cu requestId diferit. Nu actualizează mesajul afișat sau jobul și nu eliberează/reconciliază rezervarea. Testul existent „reconciles an uncertain ImoDeus send” pornește cu mapping deja existent, deci nu acoperă acest caz.

Remediere necesară: corelare durabilă între comanda locală și receipt, inclusiv când răspunsul HTTP se pierde, plus o procedură explicită pentru cazurile care rămân neidentificabile. Nu se rezolvă prin retrimitere automată sau potrivire aproximativă după număr/text. Primul audit trebuia să precizeze această limită când spunea că există reconciliere.

### B2 — P1: un eveniment fără conexiune poate bloca alte mesaje și STOP din același payload

**Confirmat prin control flow, fără probă live.** `communications-worker/route.ts:49–89`.

Bucla pe evenimente se află într-un singur try/catch pentru întregul webhook. Dacă primul eveniment nu are owner, se aruncă eroare; toate evenimentele următoare rămân neprocesate. După cinci încercări, întregul payload devine failed. Dacă include și mesaje valide pentru alte conturi, acestea nu ajung în Inbox până la remediere/replay. Dacă unul este STOP, revocarea nu se aplică, dar drainOutbound poate rula în aceeași execuție cu acordul vechi.

Chiar fără eroare, workerul ia numai 10 payloaduri fără ordonare cronologică, apoi expediază joburile. Un STOP deja în coadă, dar în afara lotului, nu este încă aplicat. „STOP înaintea trimiterii” nu este o garanție cât timp recepția și aplicarea politicii sunt amânate astfel.

Remediere: procesare/retry și stare per eveniment, fără pierderea celor valide; prioritizarea/aplicarea opt-out și o regulă clară pentru outbound când recepția are backlog. Nu este o dovadă că s-au trimis efectiv mesaje după STOP în producție.

### B3 — P2: workerul WhatsApp poate fi oprit de erori din alte fluxuri

**Confirmat prin control flow.** `communications-worker/route.ts:24–48`.

Cleanupul, verificarea tokenurilor, proiecțiile Storia și recuperarea joburilor social rulează înainte de webhookuri, fără izolare individuală. O proiecție Storia care eșuează repetat poate opri recepția și outbound WhatsApp la fiecare execuție. Promise.allSettled izolează numai ultimele trei drainere, nu întregul worker. Este necesară izolarea etapelor și vizibilitatea erorii pe flux.

### B4 — P2: eroarea de livrare se pierde când receipt precede echo

**Reprodus offline.** `server.ts:120`, `:140–145`.

Un receipt failed fără mesaj existent salvează pendingError în mapping. Când apare echo-ul, mesajul primește status failed, dar nu și câmpul error. Inbox poate arăta eșec fără motivul primit de la Meta. Păstrarea erorii afirmată în primul audit nu acoperă toate ordinele de evenimente.

### B5 — P2: statusul și bugetul pot deveni contradictorii

**Reprodus offline pe secvență sintetică; frecvența reală nu este cunoscută.** `model.ts:39`, `outbound.ts:91–105`, `server.ts:112–117`.

Secvența failed → settlement → delivered/read este permisă de advanceStatus. Prima etapă eliberează rezervarea și setează budgetSettled=true. Receiptul următor schimbă jobul în delivered, dar contabilizarea nu mai revine asupra lui. Rezultatul este mesaj delivered și cost rezervat/consumat zero. Trebuie fie definit tratamentul receipturilor contradictorii, fie contabilizare ajustabilă/idempotentă; un flag definitiv nu acoperă toate tranzițiile acceptate de cod.

### B6 — P2: lipsa validării robuste a payloadului poate respinge întregul lot

**Reprodus offline pentru timestamp în afara intervalului Date.** `normalize.ts:8–10`, `:26–44`.

Number.isFinite nu garantează că valoarea încape într-un Date. Un timestamp numeric finit foarte mare produce RangeError în toISOString și oprește normalizarea întregului payload, inclusiv evenimentele valide ulterioare. Unele câmpuri interne, precum messages/statuses/history, sunt iterate fără Array.isArray. Semnătura validează sursa și integritatea, nu schema. Este necesară validare per eveniment și carantinarea celui invalid. Proba nu afirmă că Meta a trimis acel timestamp în producție.

### B7 — P2: scanarea tokenurilor expirate poate rămâne blocată la primele 50

**Confirmat prin citirea codului.** `communications-worker/route.ts:30–40`.

Queryul pentru expirate are limit(50), fără cursor, fără ștergerea/avansarea documentelor procesate și fără filtru pentru verificările deja efectuate. Primele 50 continuă să fie eligibile, chiar după actualizarea capabilităților; conexiunile următoare pot rămâne nemarcate. Verificarea on-demand din connectionToken continuă să blocheze utilizarea unui token expirat, deci nu este bypass de expirare; problema este diagnosticul proactiv incomplet.

### B8 — P2: descărcarea media este legată incorect de capabilitatea de trimitere

**Confirmat prin citirea codului.** `media.ts:55–57`.

Descărcarea unui atașament WhatsApp solicită connectionToken(..., 'send'). Dacă trimiterea este suspendată prin starea capabilității, citirea media inbound este blocată și ea, chiar când un token valid și permisiunile aferente ar permite operația. Separă disponibilitatea tokenului/descărcării de starea trimiterii. Expirarea sau revocarea tokenului trebuie să blocheze în continuare accesul API.

### B9 — P2: eroarea la un job poate opri toate joburile din lotul outbound

**Confirmat prin citirea codului.** `outbound.ts:113`, `:158–159`.

Claimul tranzacțional este în afara try-ului per job. În catch, updateurile Firestore și settlementul pot arunca la rândul lor. O asemenea eroare părăsește drainerul înaintea celorlalte joburi. În plus, vechile joburi sending se recuperează doar cu updateuri succesive, fără tranzacție comună; rezultatele trebuie verificate și recuperate fără a masca deja-confirmatele delivered/read.

### B10 — Validare confirmată a limitării template-urilor nominale

Problema menționată în prima trecere a fost acum reprodusă: bodyParameterCount pentru `Salut {{first_name}}` returnează 0, în loc să semnaleze un template nesuportat. Scriptul nu efectuează apel Meta; concluzia demonstrată este clasificarea locală greșită, nu un anumit cod de eroare extern.

## Corecții și limite ale primului raport

- **TTL webhook este deja declarat în repository**, în `firestore.indexes.json`, prin fieldOverride expiresAt cu ttl=true. Rămâne de verificat aplicarea în Firebase; nu trebuie confundată lipsa confirmării live cu lipsa configurației locale.
- Indexul pentru conversațiile neatribuite există în fișierul de indecși. Nu îl raportez ca lipsă.
- Încărcarea secretelor și ID-urile noi nu sunt singurele condiții pentru pilot: B1–B3 afectează fiabilitatea chiar și după conectare reușită.
- Alegerea exactă a câmpurilor Coexistence și cerința de template management rămân de confirmat în documentația/dashboardul actual. Lista din prima trecere este orientativă pentru evaluare, nu configurație completă validată a noii aplicații.
- Nu am demonstrat o breșă de acces între agenții. Regulile inspectate exclud colecțiile communications din regula generică de scriere, iar căutarea revalidează accesul și conținutul în Firestore înainte de răspuns. Testarea regulilor pe emulator rămâne nefăcută.

## Dovezi suplimentare reproductibile

Comandă la data auditului: `node scripts/whatsapp-audit-probes.cjs`. **Actualizare 2026-10-01:** scriptul a fost transformat ulterior în probe de regresie; outputul REPRODUCED de mai jos este dovadă istorică a versiunii auditate, nu rezultatul versiunii curente. Versiunea curentă produce cinci rezultate PASS pentru corecții.

Scriptul transpilează modulele locale, folosește un Firestore minimal în memorie și blochează Graph, media și autentificarea live. Nu citește tokenuri din Firebase și nu trimite mesaje. Cele cinci linii REPRODUCED confirmă comportamentele problematice B1, B4, B5, B6 și B10; nu reprezintă teste de acceptanță trecute pentru funcționalitate. Store-ul în memorie nu reproduce concurența, regulile sau toate semanticele Firestore.

```text
REPRODUCED: A receipt cannot reconcile an unknown send without a provider-ID mapping
REPRODUCED: Failed receipt before echo loses the error on the displayed message
REPRODUCED: Named template parameter is incorrectly treated as zero parameters
REPRODUCED: A finite out-of-range timestamp aborts normalization of the payload
REPRODUCED: A receipt after failure settlement changes to delivered without restoring budget charge
```

Suita existentă a fost rerulată: **40 trecute, 2 omise**. Typecheck communications a fost rerulat fără diagnostice. Nu s-a modificat codul funcțional și nu s-au adăugat teste care pretind că aceste buguri sunt rezolvate. Scriptul este un instrument de audit separat.

## Accesul browserului — verificat efectiv

La a doua trecere, inventarul instrumentului afișează numai **Codex In-app Browser**, fără Chrome/Edge conectat și fără taburi inițiale accesibile. Am deschis URL-ul exact indicat de utilizator; acesta a redirecționat la **Log into Meta for Developers**. Nu am accesat dashboardul autentificat al aplicației ImoSocial și nu am modificat configurația Meta.

Pot naviga și opera interfața în browserul conectat. Pentru această sesiune este necesară autentificarea utilizatorului în browserul integrat sau conectarea unui browser care oferă tabul autentificat. Nu este suficient ca pagina să fie deschisă într-un browser neconectat instrumentului.

După acces pot verifica stările reale și pregăti/configura pașii tehnici permisi. Nu pot garanta aprobarea Meta și nu pot finaliza de unul singur orice etapă: identitatea/2FA și verificarea telefonului pot cere intervenția titularului; extinderea permisiunilor sensibile, acceptarea termenilor și operațiile financiare se tratează la pasul concret conform regulilor instrumentului. În această cerere s-a executat auditul și verificarea accesului, nu o activare a aplicației.
