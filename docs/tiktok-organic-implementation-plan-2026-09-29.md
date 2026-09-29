# Plan de finalizare TikTok Organic — 29 septembrie 2026

## Starea implementării în repository

Codul pentru OAuth, verificarea fișierelor, uploadul pe fragmente, confirmarea publicării, programare și reconcilierea statusului este implementat. Selectorul de afișare pe telefon și marcajele video nu au fost modificate.

**Activarea în producție necesită acces la sistemele externe:**

1. În TikTok for Developers, identificați aplicația aferentă cheii folosite de producție. Verificați că este activă, că Login Kit Web și Content Posting API sunt configurate și că redirectul înregistrat este exact `https://imodeus.ro/auth/tiktok/callback`. Comparați client key și client secret cu valorile din producție, fără a le copia în repository. Mesajul `client_key` din captură nu stabilește singur cauza.
2. În Secret Manager pentru backendul App Hosting, creați sau actualizați `TIKTOK_CLIENT_KEY` cu cheia publică a acelei aplicații și verificați `TIKTOK_CLIENT_SECRET` și `TIKTOK_TOKEN_ENCRYPTION_KEY`. Backendul trebuie să aibă acces la secrete. Deployați `apphosting.yaml` și aplicația numai după această verificare; o referință către un secret inexistent poate opri deployul.
3. Deployați `firestore.indexes.json`. Așteptați ca cele trei indexuri `tiktokPostDrafts` să ajungă în starea Ready înainte de a activa workerul nou.
4. Verificați jobul Cloud Scheduler `tiktok-ads-shared-worker` din `us-central1`, cu endpointul backendului curent `/api/marketing/tiktok-ads/worker`, frecvență de un minut și secretul `TIKTOK_ADS_WORKER_SECRET`. Workerul procesează Ads, randarea Studio și statusul organic independent. Scriptul existent este `scripts/configure-tiktok-ads-scheduler.ps1`; folosiți-l doar cu secretul corect al mediului vizat.
5. Pe un cont TikTok privat de test, executați conectarea prin QR, revenirea în Studio, `creator_info`, un upload real `SELF_ONLY`, statusul `PUBLISH_COMPLETE`, reîmprospătarea tokenului și o programare. Faceți aceeași verificare în browser și desktop. Dacă pagina TikTok continuă să afișeze `client_key`, inspectați aplicația și configurația din portal, împreună cu ID-ul erorii din TikTok.

Nu au fost disponibile în acest mediu accesul la TikTok for Developers, Secret Manager/Cloud Scheduler sau un cont TikTok de test; acești pași nu pot fi marcați ca validați live.

## Scop și limite

Finalizăm conectarea profilului TikTok și publicarea organică din ImoDeus, inclusiv programarea și urmărirea rezultatului. Integrarea TikTok Ads rămâne separată. **Setările actuale pentru afișarea telefonului și marcajele video rămân așa cum sunt.**

## 1. Deblocarea conectării TikTok (P0)

Captura arată pagina TikTok `Something went wrong`, cu indicația `client_key`, după scanarea codului QR. URL-ul din captură folosește `https://imodeus.ro/auth/tiktok/callback`. Eroarea apare pe domeniul TikTok, înainte ca ruta de callback ImoDeus să ruleze. Indicația `client_key` orientează diagnosticul spre aplicația/configurația Login Kit; nu dovedește singură că valoarea cheii este greșită.

1. În TikTok for Developers, verificați aplicația exactă asociată cheii folosite în cererea live: stare activă, tipul/platforma Web, Login Kit activ, Content Posting API și scope-urile `user.info.basic` și `video.publish` aprobate pentru aplicație. Verificați restricțiile de test și conturile autorizate.
2. Comparați **fără a afișa secretul în loguri** cheia din mediul de producție cu Client key din aceeași aplicație TikTok. `apphosting.yaml` declară `TIKTOK_CLIENT_SECRET`, dar nu declară `TIKTOK_CLIENT_KEY`; adăugați cheia publică drept variabilă de runtime și verificați că secretul corespunde aceleiași aplicații.
3. Configurați explicit `TIKTOK_REDIRECT_URI=https://imodeus.ro/auth/tiktok/callback` și înregistrați **exact aceeași valoare** în Login Kit. Eliminați posibilitatea ca `NEXT_PUBLIC_APP_URL`, `APP_BASE_URL` și fallbackul `imodeus.ai` să producă callbackuri diferite între medii. Validați configurația înainte de emiterea URL-ului OAuth și returnați un mesaj diagnostic în ImoDeus dacă lipsește.
4. Verificați URL-ul emis de `/api/marketing/tiktok/connect`: endpointul, `client_key`, `redirect_uri`, `scope`, `response_type`, `state` și PKCE. Fluxul folosește callback web, dar trimite PKCE; verificați compatibilitatea cu aplicația Web din portal și testați schimbul de token. Nu schimbați mecanismul PKCE pe baza capturii, fără confirmarea cauzei.
5. După repararea erorii de autorizare, corectați cererea `/v2/user/info/`: codul solicită `username`, care cere `user.info.profile`, în timp ce scope-urile implicite includ numai `user.info.basic` și `video.publish`. Folosiți câmpurile permise de `user.info.basic` și numele din `creator_info`, sau obțineți aprobarea și acordul pentru `user.info.profile`.
6. Separați deschiderea OAuth organic de fereastra desktop Ads. `openOAuthWindow` din Electron acceptă numai `business-api.tiktok.com` și detectează numai parametrul `tiktokAds`; pentru organic, folosiți browserul extern sau o fereastră distinctă care acceptă `www.tiktok.com` și detectează callbackul `tiktok`.

**Acceptare:** un utilizator de test conectează contul prin QR, revine în `/marketing/tiktok-studio`, profilul corect apare conectat, `creator_info` funcționează, iar reconectarea/refreshul tokenului funcționează. Eșecurile afișează codul/log ID TikTok în diagnosticele serverului, fără tokenuri sau secrete.

## 2. Securizarea materialului și corectarea transferului video (P0)

1. La crearea unui asset, acceptați numai referințe la fișiere deținute de utilizator/agenție în stocarea permisă. La publicare, verificați din nou proprietatea fișierului, schema și destinația URL-ului, inclusiv redirecționările. Impuneți limite pentru mărime, tip MIME și timp de descărcare. Descărcarea actuală a unui URL arbitrar într-un `arrayBuffer` integral trebuie înlocuită cu un flux controlat.
2. Corectați algoritmul `FILE_UPLOAD`: fragment între 5 și 64 MB, excepția fișierului sub 5 MB, număr de fragmente calculat conform TikTok și restul atașat ultimului fragment (maximum 128 MB). Verificați răspunsurile 206 pentru fragmentele intermediare și 201 la final; tratați expirarea URL-ului fără dublarea publicării.
3. Verificați server-side codec, rezoluție, fps, durată, dimensiune și `max_video_post_duration_sec` obținut de la creator. Materialele importate au acum `durationSeconds: null`; extrageți metadatele la import, dar revalidați la publicare.
4. Decideți ulterior trecerea la `PULL_FROM_URL` doar după verificarea în TikTok a domeniului/prefixului URL. Pentru fișierele deja pe server, aceasta este metoda recomandată în ghidul TikTok; implementarea curentă poate rămâne temporar `FILE_UPLOAD` până există infrastructura necesară.

**Acceptare:** teste pentru fișiere sub 5 MB, dimensiuni exacte și cu rest, fișiere peste 64 MB, URL privat/extern, redirect, fișier prea mare și durată nepermisă; o publicare privată reală ajunge la `PUBLISH_COMPLETE`.

## 3. Fluxul de publicare și cerințele UX TikTok (P1)

1. Păstrați previzualizarea, descrierea editabilă și alegerea manuală a vizibilității. Afișați numele creatorului din `creator_info`, opțiunile de vizibilitate și limitele actuale ale profilului. Nu permiteți confirmarea dacă profilul nu mai poate publica.
2. Adăugați controlul de declarare a conținutului comercial: „propria marcă” și „parteneriat plătit”, cu regulile de compatibilitate pentru vizibilitatea privată. Trimiteți `brand_organic_toggle` / `brand_content_toggle` în `post_info`. Aceste controale privesc metadatele TikTok, nu modifică telefonul sau marcajele din video.
3. Cereți acordul explicit pentru trimiterea materialului și confirmați Music Usage Confirmation/Branded Content Policy potrivit selecției. Pentru programare, salvați versiunea materialului, setările și acordul aferent comenzii; confirmați în UI că publicarea va porni la ora aleasă.
4. Verificați lungimea finală a `title` în unitățile UTF-16 cerute de TikTok, inclusiv hashtagurile, înainte de trimitere; nu trunchiați silențios conținutul utilizatorului.

**Acceptare:** ecranul nu permite publicarea fără opțiunile obligatorii, iar payloadul și acordul salvat corespund exact previzualizării aprobate.

## 4. Proprietatea drafturilor, programare și status (P1)

1. Limitați editarea draftului la autor sau la un rol explicit autorizat. Blocați modificarea câmpurilor de publicare după programare, inițierea uploadului ori publicare; pentru modificări creați o versiune nouă și reprogramați explicit.
2. Separați workerul organic de drain-ul Ads sau izolați erorile lor, astfel încât o problemă Ads să nu oprească programările organice. Verificați configurarea Cloud Scheduler în producție, secretul, frecvența, latența și alertele pentru joburi restante/eșuate.
3. Mutați urmărirea statusului într-un worker periodic ori webhook verificat. Păstrați `publish_id`, `publicaly_available_post_id` când există, motivul eșecului și tranzițiile finale; afișați o legătură către postare numai când există un ID public. Reconcilierea unui rezultat necunoscut trebuie să preceadă orice nouă încercare.
4. Tratați revocarea tokenului, ieșirea autorului din agenție și eșecul de moderare ca stări distincte, cu pași clari de remediere. Păstrați istoricul postării chiar dacă profilul este deconectat.

**Acceptare:** programarea se execută o singură dată, la ora aleasă; închiderea browserului nu afectează verificarea statusului; retry-ul nu creează dubluri; istoricul afișează rezultatul final.

## 5. Lansare și validare

1. Rulați verificări de tipuri, lint și teste unitare/integrate pentru OAuth, URL-uri media, fragmentare, drepturi, programare și status. Testele existente pentru TikTok nu înlocuiesc validarea live.
2. Testați pe cont privat și aplicație de test, inclusiv QR, reconectare, expirarea tokenului, anularea programării și upload real. Verificați aceeași experiență în browser și în aplicația desktop.
3. Pregătiți auditul TikTok al aplicației și demonstrația UX. Până la aprobare, păstrați `SELF_ONLY` și comunicați limita în produs. După aprobare, activați vizibilitatea publică numai dacă opțiunile returnate de `creator_info` o permit.

## Surse și locuri de modificat

- OAuth: `src/lib/tiktok-marketing.ts`, `src/app/api/marketing/tiktok/connect/route.ts`, `src/app/auth/tiktok/callback/route.ts`, `apphosting.yaml`, `src/components/marketing/tiktok-ads/TikTokWorkspace.tsx`, `desktop/main.cjs`.
- Publicare: `src/lib/tiktok-marketing.ts`, `src/app/api/marketing/tiktok/studio-assets/route.ts`, `src/components/marketing/tiktok-ads/VideoLibrary.tsx`, `src/app/api/marketing/tiktok/post-drafts/[draftId]/route.ts`.
- Joburi și status: `src/lib/tiktok-studio-jobs.ts`, `src/app/api/marketing/tiktok-ads/worker/route.ts`, configurația Cloud Scheduler și testele asociate.
- Documentație TikTok: [Login Kit Web](https://developers.tiktok.com/docs/en/login-kit-web), [User Info v2](https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info), [Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [Media Transfer](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide), [Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines), [Get Post Status](https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status).
