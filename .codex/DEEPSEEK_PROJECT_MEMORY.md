# ImoDeus — Persistent Project Memory

Acest fișier este memoria persistentă de proiect pentru DeepSeek/Codex în Imo-Deus.
Conține reguli permanente și o sinteză tehnică confirmată din repository.

## Reguli permanente

1. Imo-Deus este proiectul curent.
2. În mod implicit DeepSeek operează READ-ONLY.
3. Nu modifică nimic fără cerere explicită a utilizatorului.
4. Nu extinde scope-ul unei cereri.
5. Problemele descoperite se raportează, nu se repară automat.
6. Nu face Git commit/push/branch/PR fără cerere explicită.
7. Nu execută modificări destructive de DB.
8. Nu expune secrets.
9. Respectă arhitectura existentă.
10. Înainte de modificări citește și înțelege codul relevant.
11. Păstrează comportamentele existente care nu fac parte din cerere.
12. Dacă există dubii privind autorizarea unei schimbări, întreabă înainte.
13. Nu modifica proiectul doar pentru cleanup, refactoring sau best practices.
14. Orice schimbare viitoare trebuie să fie minimă și limitată la cererea explicită.

Reguli suplimentare:

- Analiza, auditul, explicațiile, propunerile și planurile sunt permise.
- Codul repository-ului este sursa de adevăr; nu presupune că o funcționalitate există doar pentru că este menționată.
- Nu afișa valori sensibile din `.env`; pot fi verificate existența și numele variabilelor.
- Nu modifica AGENTS.md, `.gitignore`, Git, DB, configurări, integrări sau dependențe fără cerere explicită.
- Verifică `git status` înainte de orice modificare viitoare.
- Memoria se actualizează doar cu informații confirmate din proiect sau oferite explicit de utilizator; nu transforma presupunerile în fapte.

## Sinteză tehnică

### Produs

- CRM imobiliar multi-agenție, cu interfață în limba română.
- Adresat agenților imobiliari, cu direcții de publicitate, comunicare, automatizări și integrări.

### Stack identificat

- Frontend: Next.js 16 (App Router), React 18, TypeScript.
- UI: Tailwind CSS, shadcn/ui, Radix UI primitives, Lucide icons, Recharts.
- Formulare/editare: React Hook Form + Zod; drag-and-drop: dnd-kit; editor text: TipTap; PDF: pdf-lib/pdfjs-dist/mammoth; canvas: @napi-rs/canvas.
- Backend: API routes Next.js (aproximativ 166 fișiere `route.ts`), Firebase Admin SDK.
- Baze de date: Firestore + Firebase Storage.
- Auth: Firebase Authentication (password, Google, anonymous), profile stocate în `users`.
- State client: React Context + hooks Firebase (`src/firebase`, `src/context/AgencyContext.tsx`).
- AI: Firebase Genkit, OpenAI, Google GenAI/Gemini, fluxuri în `src/ai/flows`.
- Schedulere/triggere: Cloud Functions for Firebase v2 (`functions/src`).
- Desktop companion: Electron (`desktop/`), cu runner-e locale pentru Facebook și Gmail.
- Servicii separate: Cloudflare Email Worker, runner Facebook Playwright, browser OLX Playwright, scanner documente ClamAV (Cloud Run).
- Build/deploy: Firebase App Hosting (`apphosting.yaml`), Firestore/Storage rules, Firebase Functions, GitHub Actions pentru TikTok Ads.

### Directoare principale

- `src/app`: rute Next.js App Router, inclusiv dashboard-uri, pagini publice și API.
- `src/components`: componente UI pe domenii (`properties`, `leads`, `sales`, `marketing`, `notifications`, etc.).
- `src/lib`: logică de business și integrări (tipuri, sales, imobiliare, storia, tiktok, meta, billing, owner-listings, AI outreach, video tours).
- `src/firebase`: provideri client Firebase, hooks Firestore/Auth, config.
- `functions`: Cloud Functions pentru notificări, schedulere și webhook-uri Storia.
- `desktop`: aplicația Electron și automatizări locale.
- `services`: email-inbound-worker, facebook-cloud-runner, olx-phone-browser, sales-document-scanner.
- `scripts`: scripturi operaționale de migrare, verificare, deploy, scraping.
- `docs`: documentație și planuri tehnice; include audituri și planuri de implementare.

### Module/core

- CRM: agenții, utilizatori/agenți, contacte/lead-uri, proprietăți, task-uri, vizionări, rapoarte.
- Portal public per agenție, pagini publice de proprietăți și profiluri agent.
- Portal client și link de preferințe cumpărător.
- AI: asistent, chat, matching proprietăți, scoring lead-uri, descrieri/imagini proprietăți, CMA, briefings, rapoarte.
- Sales management: dosare de vânzare, etape, participanți, checklist, documente, email templates, OCR, retention.
- Contracte: template-uri și generare PDF.
- Marketing/publicare: Imobiliare.ro, Storia, Meta/Facebook, TikTok, TikTok Ads.
- Owner listings/prospecting: scraping OLX, Publi24, Imoradar24 și rezolvare telefonică OLX.
- Billing: Stripe, SmartBill, planuri Esential/Avansat/Profesional și entitlements.
- Notificări push și in-app prin Cloud Functions.
- Custom domains prin Firebase App Hosting.
- AI outreach/apeluri AI prin Vapi.
- Property video tours (generare videouri).

### DB

- Firestore multi-tenant:
  - `users/{userId}`.
  - `agencies/{agencyId}` și subcolecții `contacts`, `properties`, `tasks`, `viewings`, `sales`, `salesEmailTemplates`, `salesSettings`, `facebookCloudPublishingJobs`, `storiaInboxLeads` etc.
  - `invites/{inviteId}`, `portals/{portalId}`, `buyer-preferences-links/{linkId}`.
  - colecții server-managed pentru TikTok Ads (`tiktokWorkspaceDrafts`, `tiktokStudioProjects`, etc.).
  - colecții server-only pentru owner listings și notificări.
- Rules: `src/firestore.rules` este referit de `firebase.json`; există și `firestore.rules` duplicat la rădăcină (risc de confuzie).
- Storage rules: `src/storage.rules`.

### Auth/autorizare

- Client: Firebase Auth prin `src/firebase/client-provider.tsx` și `provider.tsx`.
- Server: `src/firebase/admin.ts`; `src/lib/firebase-app-hosting.ts` conține helpers pentru agency admin/user/platform admin.
- Mod demo: Firebase project separat și runtime `real`/`demo` stocat în localStorage.
- Atenție: regulile Firestore permit actualizări largi pe `users/{userId}`; auditul 2026-09-11 semnalează risc de escaladare de rol.

### Integrări identificate

- Imobiliare.ro, Storia (OAuth + webhook).
- Meta/Facebook: cloud runner, local runner, property posts/campaigns.
- TikTok și TikTok Ads (MCP, workspace, publish, reporting).
- Stripe (checkout, portal, webhook) și SmartBill.
- InfoCUI (`company-lookup`), Google Maps/Geocoding, Google Vision, Firebase Messaging.
- OpenAI/Genkit/Google GenAI, Vapi, ElevenLabs/D-ID/Hetzner/HCLOUD pentru media/AI.
- Browserbase + Playwright pentru scraping; OLX/Publi24/Imoradar24.
- Cloudflare Email Worker pentru inbound email.
- Electron local runners pentru Facebook și Gmail.

### Deployment/config

- Firebase App Hosting configurat în `apphosting.yaml` (CPU/memory/concurrency și env/secrete declarate).
- Firebase Functions deployabile separat; Firebase Hosting pentru `desktop-downloads`.
- Electron desktop packaging cu electron-builder și auto-update de pe Firebase Hosting.
- GitHub Actions: `tiktok-ads-production.yml`.
- Variabile de mediu importante (nume, fără valori): `FIREBASE_*`, `GOOGLE_MAPS_API_KEY`, `OPENAI_API_KEY`, `STRIPE_*`, `SMARTBILL_*`, `STORIA_*`, `TIKTOK_*`, `META_*`, `VAPI_*`, `BROWSERBASE_*`, `OWNER_LISTINGS_*`, `EMAIL_INBOUND_*`, `SALES_DOCUMENT_SCAN_*`, `PROPERTY_VIDEO_TOUR_*`, `DEMO_FIREBASE_*`.

### Teste

- Vitest config în `vitest.config.ts`; suite notabile: owner-listings, tiktok-ads, sales email/document processing, property sales recommendations, zones.
- Teste Node separate: `services/sales-document-scanner`, `services/email-inbound-worker`.
- GitHub Actions rulează TikTok Ads deterministic + Firestore Rules integration + lint/typecheck/build.

### Convenții

- Alias `@` către `src`.
- Rutarea UI este bazată pe App Router; componente `'use client'` pentru interactivitate.
- Firestore multi-tenant: datele agenției izolate sub `agencies/{agencyId}`.
- Autorizarea server-side se face prin verificarea Bearer token Firebase și documentul `users`.
- Comentariile și UI sunt în principal în română.

### Stadiu funcționalități importante

- Nucleu CRM, proprietăți, contacte, task-uri, vizionări, rapoarte: prezent și extins.
- Portaluri publice/client, custom domains, billing, contracts, sales management: prezent.
- Integrări Imobiliare.ro/Storia/Meta/TikTok/TikTok Ads: prezente, cu API routes și documentație dedicată.
- Owner listings/prospecting: pipeline complex de scraping și rezolvare telefon.
- Notificări: pipeline robust de event → delivery în Cloud Functions.
- Property video tours: prezent, cu servicii de rendering.
- Auditul din `docs/project-audit-2026-09-11.md` semnalează probleme de securitate/calitate care nu au fost remediate în acel audit.

### UNKNOWN / Neconfirmat

- Starea exactă a bazei de date live și a secretelor deployate.
- Dacă toate integrările listate sunt active în producție.
- Rezultatul curent al `typecheck`/`lint` după ultimele modificări.
