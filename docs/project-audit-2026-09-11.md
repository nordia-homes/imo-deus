# Audit tehnic ImoDeus

Data auditului: 11 septembrie 2026  
Branch verificat: `main`  
Scop: securitate, calitate, build, testare, configurare si mentenabilitate  
Status: raport de constatare; problemele nu au fost remediate in cadrul auditului

## Rezumat executiv

Aplicatia are un nucleu functional amplu si un build Next.js care se finalizeaza, dar exista diferente importante intre „se poate construi” si „este sigur si validat strict”. Cele mai urgente probleme sunt:

1. escaladarea privilegiilor prin modificarea propriului document de utilizator;
2. o sesiune OLX salvata si versionata in Git;
3. citirea publica prea larga din Firebase Storage si Firestore;
4. endpoint-uri costisitoare expuse fara autentificare sau rate limiting;
5. 183 de erori TypeScript ascunse de configuratia build-ului.

Problemele marcate `P0` trebuie tratate inaintea extinderii produsului sau a cresterii numarului de utilizatori.

## P0 — Probleme critice de securitate

### SEC-001 — Utilizatorul isi poate modifica rolul si agentia

**Dovada**

- `src/firestore.rules`, regula pentru `users/{userId}`, permite utilizatorului autentificat sa scrie intregul document propriu.
- `src/lib/firebase-app-hosting.ts` determina accesul de admin, agentie si platform admin citind `role` si `agencyId` din acelasi document.

**Impact**

Un utilizator poate incerca sa-si seteze singur:

- `role: "admin"` si un `agencyId` tinta;
- `role: "platform_admin"` pentru acces la rutele master admin.

Aceasta este o posibila escaladare completa de privilegii si o incalcare a izolarii multi-tenant.

**Remediere recomandata**

- Interzicerea modificarilor client-side pentru `role`, `agencyId`, `id` si alte campuri controlate de sistem.
- Permiterea actualizarilor proprii numai pentru o lista explicita de campuri de profil, folosind `diff().affectedKeys().hasOnly(...)`.
- Mutarea schimbarilor de rol/agentie intr-un endpoint server-side rezervat administratorilor.
- Preferabil, folosirea custom claims pentru rolurile cu privilegii ridicate sau verificarea unei colectii server-only.
- Auditarea documentelor `users` existente pentru roluri sau asocieri neasteptate.
- Revocarea tokenurilor active dupa aplicarea corectiei.

**Criterii de inchidere**

- Un agent nu-si poate modifica `role` sau `agencyId` din SDK-ul Firebase client.
- Un admin isi poate actualiza doar membrii propriei agentii prin server.
- Un utilizator obisnuit nu poate accesa niciun endpoint `/api/master-admin/*`.
- Exista teste Firestore Rules pentru toate cele trei roluri.

---

### SEC-002 — Sesiune OLX versionata in Git

**Dovada**

- Fisierul `tmp/olx-storage-state.json` este urmarit de Git.
- La momentul auditului continea 51 de cookie-uri si trei origin-uri de browser, inclusiv stare de autentificare si protectie WAF.
- Fisierul a intrat in istoric prin commitul `77a1233b`.

**Impact**

Cookie-urile pot permite reutilizarea unei sesiuni OLX sau pot divulga identificatori de urmarire si informatii despre sesiunea browserului. Chiar daca unele valori sunt expirate, fisierul trebuie tratat ca secret compromis.

**Remediere recomandata**

- Deconectarea/revocarea sesiunii OLX asociate si autentificarea din nou.
- Eliminarea fisierului din tracking.
- Adaugarea explicita in `.gitignore` a fisierelor de tip storage state si, ideal, a directorului `/tmp/`.
- Curatarea fisierului din istoricul Git cu `git filter-repo` sau un instrument echivalent.
- Coordonarea unui eventual force-push cu toti colaboratorii si mediile de deploy.
- Verificarea istoricului si pentru alte fisiere cu cookie-uri, tokenuri sau profile de browser.

**Criterii de inchidere**

- Fisierul nu mai exista in `git ls-files` si nici in istoricul accesibil al branch-urilor active.
- Sesiunea veche este revocata.
- Un scanner de secrete ruleaza in CI si blocheaza fisiere similare.

---

### SEC-003 — Firebase Storage permite citirea publica globala

**Dovada**

- `src/storage.rules` contine o regula generala `match /{allPaths=**}` cu `allow read: if true`.
- In Firebase Rules, o permisiune generala favorabila poate face publice si caile care au reguli mai restrictive in alte blocuri.
- `firebase.json` nu declara in prezent fisierul de Storage Rules, deci nu este clar daca acesta este deployat prin fluxul standard al repository-ului.

**Impact**

Pot deveni publice:

- documente si atasamente din tranzactii;
- contracte generate;
- documente de identitate/OCR;
- fisiere de profil si media care nu au fost proiectate pentru acces anonim.

**Remediere recomandata**

- Separarea explicita a continutului public de continutul privat.
- Permiterea publica doar pentru logo-uri, fotografii de proprietati publicate si alte cai aprobate.
- Restrictionarea documentelor de vanzare/contract la membrii autorizati ai agentiei si, unde este cazul, la agentul responsabil.
- Adaugarea configuratiei `storage.rules` in `firebase.json`.
- Scrierea de teste cu Firebase Emulator pentru `get`, `list`, upload si delete.
- Verificarea regulilor efectiv deployate in proiectul Firebase, nu doar a fisierului local.

**Criterii de inchidere**

- Un utilizator anonim nu poate citi sau lista documente private.
- Media publica necesara website-ului continua sa functioneze.
- Deploy-ul standard include explicit Storage Rules.

---

### SEC-004 — Documente Firestore publice contin campuri interne

**Dovada**

- Documentele `agencies/{agencyId}` pot fi citite public integral.
- Proprietatile cu status `Activ` pot fi citite public integral.
- Tipul `Agency` include informatii de billing, identificatori Stripe, date juridice si configurari interne.
- Tipul `Property` poate include `ownerName`, `ownerPhone`, `notes`, date cadastrale si configurari de publicare.

**Impact**

Firestore Rules nu poate proiecta doar anumite campuri dintr-un document. O citire publica expune intregul document, nu doar informatiile randate in pagina publica.

**Remediere recomandata**

- Crearea unor documente oglinda dedicate: `publicAgencies`, `publicProperties` si `publicAgentProfiles`.
- Copierea server-side doar a campurilor aprobate pentru publicare.
- Eliminarea accesului anonim la documentele operationale originale.
- Auditarea datelor deja stocate pentru PII si identificatori de furnizor.

**Criterii de inchidere**

- Website-ul public citeste exclusiv modele publice sanitizate.
- `agencies/*` si `agencies/*/properties/*` operationale nu mai sunt disponibile anonim.

---

### SEC-005 — Actualizarea publica a preferintelor permite o modificare prea larga

**Dovada**

- `isPublicPreferencesUpdate()` valideaza existenta unui link, dar regula de update pentru contact nu limiteaza campurile modificate.

**Impact**

O persoana care detine un link valid poate incerca sa suprascrie si alte campuri ale contactului, nu doar preferintele declarate public.

**Remediere recomandata**

- Rutarea tuturor actualizarilor printr-un endpoint server-side cu schema Zod si tranzactie.
- Alternativ, limitarea stricta prin `diff().affectedKeys().hasOnly(...)` si validarea tipurilor/cantitatilor in Rules.
- Expirarea, revocarea si rate-limitarea linkurilor publice.

**Criterii de inchidere**

- Linkul public poate modifica numai preferintele aprobate.
- Numele, datele de contact, agentul, statusul si istoricul nu pot fi schimbate anonim.

---

### SEC-006 — Endpoint-uri costisitoare fara autentificare sau rate limit

**Rute identificate**

- `/api/ai-assistant/chat`
- `/api/ai-assistant/welcome`
- `/api/enhance-property-image`
- `/api/geocode`
- `/api/geocode-search`
- `/api/company-lookup`

**Impact**

- consum neautorizat de OpenAI, Google Maps sau InfoCUI;
- costuri necontrolate si epuizarea cotelor;
- upload-uri/request-uri supradimensionate;
- posibilitate de abuz automatizat.

**Remediere recomandata**

- Token Firebase obligatoriu pentru functionalitatile interne.
- Verificarea agentiei si a entitlement-ului pe server.
- App Check unde este potrivit.
- Rate limit per utilizator, agentie, IP si endpoint.
- Limite explicite pentru body, imagine si timeout.
- Bugete si alerte per furnizor.

**Criterii de inchidere**

- Cererile anonime primesc `401` sau `403`.
- Depasirea limitei primeste `429`.
- Costurile pot fi atribuite unei agentii si unui utilizator.

---

### SEC-007 — Provisionarea demo accepta un UID neverificat

**Dovada**

- `/api/demo/provision` preia `uid` direct din body si scrie cu Firebase Admin in proiectul demo.
- Ruta nu verifica un token Firebase demo si nu demonstreaza ca solicitantul detine UID-ul.

**Impact**

Un solicitant poate incerca sa reprovisioneze sau sa suprascrie workspace-ul demo al altui UID, incalcand promisiunea de izolare per vizitator.

**Remediere recomandata**

- Verificarea tokenului emis de proiectul Firebase demo.
- Derivarea UID-ului exclusiv din token, nu din request body.
- Rate limiting si idempotenta per UID.

**Criterii de inchidere**

- Un utilizator demo poate provisiona doar `demo-<propriul uid>`.
- Un token production nu este acceptat de endpointul demo.

---

### SEC-008 — Endpoint de diagnostic disponibil public

**Dovada**

- `/api/request-debug` expune hosturile detectate, maparile de domenii, identificatori de agentie si rezultatul verificarilor Admin/REST.

**Impact**

Ofera informatii interne utile pentru enumerare si diagnostic unui solicitant anonim.

**Remediere recomandata**

- Eliminarea rutei din productie sau protejarea ei cu rol `platform_admin`.
- Returnarea unui raspuns generic atunci cand `NODE_ENV === "production"`.

## P1 — Calitate si fiabilitate

### QA-001 — TypeScript strict nu trece

Rezultatul auditului:

- 183 erori TypeScript totale;
- 127 erori in 30 de fisiere din `src`;
- 56 erori in 9 fisiere din `tmp`.

Zonele cu cele mai multe erori:

- pagina de detaliu agent;
- API-ul de administrare agent;
- wrapperul Recharts;
- dialogul de adaugare proprietate;
- contracte, preferinte publice si tipurile `Property`/`Contact`.

**Remediere recomandata**

- Excluderea explicita a `/tmp/` din `tsconfig.json`.
- Repararea erorilor din `src` pe module, incepand cu API/auth si modelele centrale.
- Eliminarea `typescript.ignoreBuildErrors` dupa atingerea pragului zero.

---

### QA-002 — Build-ul ascunde erorile TypeScript

`next.config.js` foloseste `typescript.ignoreBuildErrors: true`. Build-ul de productie reuseste chiar daca verificarea stricta esueaza.

**Remediere recomandata**

- CI trebuie sa ruleze obligatoriu `npm run typecheck` inainte de build/deploy.
- Dupa remedierea erorilor, eliminarea optiunii `ignoreBuildErrors`.

---

### QA-003 — Scriptul de build nu functioneaza pe Windows

`npm run build` foloseste sintaxa POSIX:

```text
NODE_ENV=production next build
```

Pe Windows aceasta produce eroarea `NODE_ENV is not recognized`.

**Remediere recomandata**

- Folosirea `cross-env NODE_ENV=production next build`; sau
- eliminarea setarii, deoarece `next build` ruleaza deja in mod production.

---

### QA-004 — Scriptul de lint este incompatibil cu Next.js 16

`npm run lint` executa `next lint`, comanda care nu mai este suportata in versiunea curenta.

**Remediere recomandata**

- Configurare ESLint independenta si script `eslint .`.
- Eliminarea optiunii `eslint` nerecunoscute din `next.config.js`.
- Adaugarea lint-ului in CI.

---

### QA-005 — Configuratia Vitest colecteaza suite incompatibile

Rularea globala a gasit:

- 111 teste Vitest trecute;
- 10 teste live omise intentionat;
- sase fisiere raportate drept suite esuate deoarece folosesc `node:test` sau asertiuni standalone.

Testele dedicate serviciilor au trecut separat:

- sales document scanner: 10/10;
- email inbound worker: 8/8;
- servicii de zone: 26/26;
- canonical location scoring: 2/2.

**Remediere recomandata**

- Limitarea `vitest.config.ts` la fisierele Vitest reale.
- Pas CI separat pentru pachetele care folosesc `node --test`.
- Convertirea testelor standalone in Vitest sau mutarea lor intr-un script separat.

---

### QA-006 — Turbopack traseaza accidental proiectul prea larg

Build-ul a emis avertismente `Encountered unexpected file in NFT list` pentru rutele TikTok. Traseul porneste din operatii dinamice de filesystem din rendererul video.

**Impact**

- bundle server mai mare;
- build/deploy mai lent;
- risc de includere accidentala a unor fisiere inutile.

**Remediere recomandata**

- Restrictionarea operatiilor `path.join`, `fs.readFile` si a require-urilor dinamice la directoare explicite.
- Separarea rendererului greu de API-urile TikTok care nu au nevoie de el.
- Verificarea dimensiunii artefactului standalone dupa corectie.

---

### QA-007 — Feature gating-ul de billing nu este aplicat

Helperul `hasBillingFeature()` exista, dar nu este folosit de pagini sau endpoint-uri. In prezent planurile sunt in principal descriptive, cu enforcement partial pentru seats.

**Impact**

Functionalitatile premium pot fi accesibile indiferent de plan daca utilizatorul cunoaste ruta sau endpoint-ul.

**Remediere recomandata**

- Un guard central server-side pentru fiecare functionalitate premium.
- Gating UI doar ca strat secundar, nu ca masura de securitate.
- Matrice documentata `ruta -> feature key -> plan minim`.
- Teste pentru fiecare plan si pentru statusurile `past_due`, `canceled` si `inactive`.

## P2 — Mentenabilitate si igiena repository-ului

### MAINT-001 — Directorul `tmp` si logurile sunt versionate

Repository-ul urmareste fisiere HTML de scraping, loguri, rapoarte si scripturi temporare. `.gitignore` ignora `.tmp/`, dar nu `/tmp/`.

**Remediere recomandata**

- Deciderea explicita a fixture-urilor care merita pastrate.
- Mutarea fixture-urilor stabile in directoarele de test.
- Ignorarea `/tmp/`, `*.storage-state.json` si logurilor generate.
- Eliminarea artefactelor fara valoare istorica.

---

### MAINT-002 — Exista doua fisiere Firestore Rules diferite

- `firestore.rules`
- `src/firestore.rules`

`firebase.json` foloseste doar `src/firestore.rules`.

**Impact**

Este usor ca o corectie sa fie aplicata fisierului gresit sau ca documentatia sa indice o versiune nefolosita.

**Remediere recomandata**

- Pastrarea unei singure surse de adevar.
- Test CI care confirma calea folosita la deploy.

---

### MAINT-003 — README-ul nu descrie produsul real

README-ul este inca textul unui starter Firebase Studio si nu documenteaza arhitectura, mediile, comenzile, serviciile sau procesul de deploy.

**Remediere recomandata**

- Inlocuirea cu un ghid pentru dezvoltare si operare.
- Documentarea topologiei Next.js/Firebase/Functions/Electron/servicii.
- Lista separata de variabile per runtime, fara valori secrete.

---

### MAINT-004 — Fisiere foarte mari si responsabilitati amestecate

Exemple observate:

- `src/app/globals.css`: aproximativ 1,2 MB;
- pagina TikTok Studio: aproximativ 150 KB;
- dialogul de adaugare proprietate: aproximativ 123 KB;
- modulele pricing, video, Imobiliare si Storia depasesc frecvent 80–100 KB.

**Remediere recomandata**

- Separare pe domenii: UI, schema, state, API client, mapper si provider adapter.
- Reducerea importurilor circulare si a dependentelor server/client comune.
- Incarcare dinamica pentru editorul video si modulele grele.

---

### MAINT-005 — Trasabilitate Git slaba

Mai multe commituri recente au mesaje aleatorii, ceea ce ingreuneaza identificarea intentiei, regresiilor si a schimbarilor de schema.

**Remediere recomandata**

- Conventional commits sau un format echivalent.
- PR-uri cu descriere, plan de rollback si dovezi de testare pentru schimbarile sensibile.

## Rezultatele verificarilor

| Verificare | Rezultat | Observatii |
|---|---:|---|
| `npx next build` | Trecut | 174 pagini/rute generate; avertismente NFT/TikTok |
| `npm run build` pe Windows | Esuat | Sintaxa POSIX pentru `NODE_ENV` |
| `npm run typecheck` | Esuat | 183 erori totale |
| `npm run lint` | Esuat | `next lint` nu mai este valid in Next.js 16 |
| Cloud Functions build | Trecut | TypeScript compilat cu succes |
| Teste Vitest reale | 111 trecute | 10 teste live omise |
| Sales document scanner | 10/10 | `node --test` |
| Email inbound worker | 8/8 | `node --test` |
| Zone services | 26/26 | verificare standalone |
| Canonical location scoring | 2/2 | verificare standalone |
| Stare Git dupa audit | Curata | niciun fisier modificat de audit |

## Ordinea recomandata de remediere

### Etapa 1 — Blocare imediata

- [ ] SEC-001: blocarea modificarilor `role` si `agencyId`.
- [ ] SEC-002: revocarea sesiunii OLX si eliminarea storage state-ului.
- [ ] SEC-003: restrictionarea Firebase Storage.
- [ ] SEC-004: separarea datelor publice de modelele operationale.
- [ ] SEC-005: inchiderea actualizarilor anonime largi pe contacte.

### Etapa 2 — Protectie API si costuri

- [ ] SEC-006: autentificare, entitlement si rate limiting.
- [ ] SEC-007: verificarea identitatii demo.
- [ ] SEC-008: eliminarea/protejarea endpointului de debug.
- [ ] Configurarea alertelor de cost si quota pentru furnizorii externi.

### Etapa 3 — Stabilizare tehnica

- [ ] Repararea celor 127 de erori TypeScript din `src`.
- [ ] Excluderea fisierelor temporare din compilare.
- [ ] Repararea build-ului Windows si a lint-ului.
- [ ] Separarea runnerelor de test.
- [ ] Eliminarea `ignoreBuildErrors`.
- [ ] Aplicarea reala a feature gating-ului.

### Etapa 4 — Mentenabilitate

- [ ] Curatarea artefactelor versionate.
- [ ] Unificarea Firestore Rules.
- [ ] Rescrierea README-ului.
- [ ] Modularizarea fisierelor mari.
- [ ] Introducerea unui pipeline CI obligatoriu.

## Pipeline minim recomandat dupa remediere

```powershell
npm run lint
npm run typecheck
npx vitest run
npm --prefix services/sales-document-scanner test
npm --prefix services/email-inbound-worker test
npm --prefix functions run build
npm run build
```

La acestea trebuie adaugate teste Firebase Emulator pentru Firestore si Storage Rules. Testele live de scraping trebuie pastrate intr-un job separat, controlat si cu limite clare.

## Limitele auditului

Auditul a analizat repository-ul local, build-ul si testele disponibile. Nu au fost verificate direct:

- regulile Firebase efectiv deployate;
- continutul bazelor de date production/demo;
- starea secretelor din Secret Manager;
- configuratia reala Stripe, SmartBill, Meta, TikTok, Storia, Imobiliare.ro, Vapi sau Browserbase;
- politicile IAM si logurile infrastructurii externe.

Acestea necesita un audit operational separat, realizat cu acces explicit la mediile live.
