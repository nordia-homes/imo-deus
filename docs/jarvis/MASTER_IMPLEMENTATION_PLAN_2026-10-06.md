# Plan de implementare Jarvis pentru imoDeus

Data: 6 octombrie 2026. Stare: plan de implementare; etapele de mai jos nu sunt declarate finalizate.

Obiectivul este ca agentul să poată delega un rezultat în limbaj natural, iar Jarvis să identifice entitățile, să pregătească și să execute pașii autorizați, să urmărească rezultatele și să comunice exact ce s-a realizat. Implementarea extinde nucleul existent din imoDeus, inclusiv memoria, Voice, automatizările și serviciile de domeniu.

## Baza de lucru

- Specificație de produs: documentul utilizatorului `jarvis_master_codex_imodeus_v2.docx`, inclusiv cele 1000 de exemple și fazele 0–15.
- Referință de cod pentru audit: `64553efbf5e6b79761360eaa029abc3f0a1c6142`, ramura `codex/jarvis-production-2026-10-04`. La începerea implementării se reverifică HEAD și modificările locale.
- [Planul CRM existent](CRM_PARITY_IMPLEMENTATION_PLAN_2026-10-05.md) și [starea implementării](CRM_PARITY_IMPLEMENTATION_STATUS.md) rămân sursele backlogului de paritate. Acest plan stabilește ordinea extinderii și criteriile suplimentare; nu redeschide automat lucrările deja demonstrate.
- [Manifestul](CRM_PARITY_LIVE_MANIFEST.json) este inventar static, nu dovadă de paritate semantică. [Dovada producției](CRM_PARITY_PRODUCTION.json) trebuie corelată cu versiunea efectiv lansată.
- Auditul țintit a trecut 31 de teste din suitele planner, dependencies, plan-revisions, plan-outcomes și reference-access. Nu este acceptanță globală, benchmark Jev sau verificare a producției.

Utilizatorul a autorizat ulterior implementarea planului. Pentru validare a delegat alegerea între emulator și agenția Nordia; s-a ales emulatorul pentru mutații și efecte externe simulate. Directivele din documentul sursă nu declanșează prin ele însele publicări sau operații asupra clienților reali.

## Principii obligatorii

1. Manual, Text și Voice folosesc aceleași servicii, politici și verificări. Nu se creează un executor CRM paralel.
2. Property Matching existent rămâne autoritatea pentru scoruri și motive. LLM nu recalculează scoruri și nu inventează explicații în locul celor existente.
3. Pentru Owner Listings se disting filtrele susținute de pipeline, valorile necunoscute și semantica anului, inclusiv `after_1977`. Filtrarea incompletă nu devine afirmație certă.
4. Datele externe, mesajele, documentele și preferințele sunt date, nu instrucțiuni privilegiate. Autorizarea se verifică pe server la citire, execuție și reluare.
5. Acțiunile păstrează aprobările domeniului. Acordul WhatsApp obținut de la o persoană se înregistrează prin fluxul uman existent.
6. Publicarea, cheltuielile, comunicările și alte efecte externe reale nu se folosesc ca teste fără destinatari, conturi și limite autorizate explicit.
7. Modelele și providerii existenți nu se schimbă implicit. Jev este o integrare separată de rutare, cu fallback la plannerul existent.
8. Fiecare etapă include verificările relevante de securitate, cost, Text/Voice și compatibilitate. Testele nu se amână până la final.
9. UI se modifică numai pentru stări, progres, approvals, citări, setări și rezultate necesare. Numele afișat este imoDeus; identificatorii legacy se migrează separat dacă este necesar.

## Arhitectura țintă

Text sau Voice → cerere normalizată și context autorizat → rezolvare de referințe și capabilități → rutare opțională Jev → planner existent → plan persistent → pregătire și approval → executor existent → dovezi și reconciliere → continuare sau rezultat final.

Jev selectează între alternative delimitate. Rezolvarea entităților, validarea parametrilor, permisiunile și decizia de a permite o mutație rămân în serviciile Jarvis. Orice rută rapidă traversează aceleași controale ca plannerul.

## Contractele necesare

### Obiectiv și dovezi

Un obiectiv persistat conține minimum: `schemaVersion`, `goalId`, `agencyId`, `userId`, `sessionId`, cererea originală, rezultatul cerut, entități tipizate, constrângeri, criterii de finalizare, planuri asociate, buget cumulativ, stare, revizie și timestamps.

Un pas conține capabilitate și versiune, input validat, precondiții, dependențe tipizate, starea approvalului, cheia de idempotency, referințe la job/provider, rezultat și dovezi. Dependența precizează dacă așteaptă doar un ID, un asset disponibil sau un rezultat de business.

O dovadă conține sursă, entitate/job, status observat, momentul observației, revizie sau receipt, completitudine și limite. `HTTP 200`, finalizarea workerului și textul modelului nu sunt dovezi suficiente pentru orice rezultat.

Exemple de finalizare:

| Cerere | Dovadă necesară |
|---|---|
| Programează publicarea mâine | Job persistat și recitit, cu proprietate, cont, destinații, oră și timezone corecte |
| Publică acum | Stare de publicare confirmată prin sursa disponibilă, separat pe destinație |
| Generează video | Job finalizat și asset verificat ca disponibil |
| Pregătește mesaj | Destinatar și conținut concret, afișate pentru verificare |
| Trimite mesaj | Statusul exact al trimiterii; accepted, delivered și read nu sunt interschimbabile |

### Stări și tranziții

Se păstrează separat starea obiectivului, starea execuției și statusul domeniului. Nu se înlocuiesc global stringurile legacy fără migrare.

Stări propuse ale obiectivului: `RUNNING`, `WAITING_PROVIDER`, `AWAITING_APPROVAL`, `NEEDS_CLARIFICATION`, `PAUSED`, `BLOCKED`, `COMPLETED`, `PARTIALLY_COMPLETED`, `FAILED`, `CANCELLED`. Blocajul are motiv tipizat: uman, provider, permisiune, buget sau capabilitate indisponibilă.

- `COMPLETED` cere toate criteriile obligatorii satisfăcute prin dovezi.
- `PARTIALLY_COMPLETED` identifică precis rezultatele obținute și cele rămase; nu ascunde o așteptare activă.
- `UNKNOWN` este o incertitudine a efectului/pasului: declanșează reconciliere, nu retry orb.
- Așteptările au termen, următoarea verificare și politică de expirare. Nu se așteaptă nelimitat un receipt pe care providerul nu îl oferă.
- Oprirea nu garantează anularea unui efect deja pornit; UI arată diferența dintre oprirea pașilor viitori și compensarea unui efect.

### Aprobări și replanificare

Ordinea este pregătire → payload concret → preview → approval → execuție → verificare. Un lot poate primi o aprobare comună dacă destinatarii, conținutul, efectele și limitele sunt concrete.

Conținutul generat după aprobarea inițială necesită pregătire și aprobare înainte de trimitere, conform politicii. Identificatorii tehnici rezultați din pași pot fi legați prin dependențe validate, fără a autoriza schimbarea intenției. Replanificarea materială a destinatarilor, sumelor, conținutului sau efectelor invalidează aprobarea relevantă.

Se păstrează `approval.ts`, hashul payloadului, actorul, agenția, expirarea și versiunea politicii. Continuarea reviziilor deja implementată se reutilizează numai pe lanțuri de receipts confirmate.

## Etapele de implementare

### E0 Inventar și baseline

Dependențe: niciuna. Prioritate: P0.

- Inventariază operațiile manuale montate, câmpurile, rolurile, efectele, tool-urile, disponibilitatea runtime și sursa de verificare.
- Corelează fiecare cerință din document și backlogul existent cu implementarea și testele. Clasifică: verificat, parțial, lipsă, nesuportat, necesită pas uman.
- Extrage corpusul 1–1000 cu ID-uri stabile. Separă cererile independente, conversațiile compuse și regulile care devin aserțiuni.
- Stabilește date sintetice pentru două agenții, roluri diferite, omonime, entități șterse/modificate și provideri simulați.
- Măsoară baseline pe citire, planificare, mutații și joburi; separă timpul intern de așteptarea providerului și costul estimat de cel raportat.

Fișiere vizate: `registry.ts`, `contracts.ts`, `operations.ts`, `handler-contracts.json`, `capability-discovery.ts`, manifestul de paritate și `evaluation-cases.json`, sub `src/lib/ai-assistant` unde se aplică.

Închidere: matricea are toate modulele și toate cele 1000 de ID-uri clasificate. Numărul de handlers nu este folosit drept procent de succes.

### E1 Contractul obiectivului și compatibilitatea

Dependențe: E0. Prioritate: P0.

- Introduce schema versionată a obiectivului, dovezilor și stărilor. Extinde contractul capabilității cu verifier, retry, cancel, timeout și condițiile de finalizare.
- Definește tranzițiile permise și verificarea deterministă a criteriilor operaționale. LLM poate propune criterii, dar nu poate inventa dovezi.
- Leagă obiectivul de planurile și joburile existente. Păstrează citirea istoricului și planurilor legacy.
- Definește migrarea și rollbackul înainte de activare: câmpuri aditive, citire compatibilă, flags server și tratamentul joburilor deja în curs.

Fișiere vizate: `contracts.ts`, `planner.ts`, `workspace.ts`, `operation-result.ts`, `plan-outcomes.ts`; module noi mici pentru goal schema și completion numai dacă separarea este necesară.

Închidere: regresii pentru „am găsit proprietatea și m-am oprit”, queued versus completed, succes parțial și lipsa dovezii. Un plan legacy nu este reexecutat la migrare.

### E2 Context memorie și timp

Dependențe: E1. Prioritate: P0 pentru context; P1 pentru preferințe extinse.

- Persistă selecții ordonate, entități tipizate, obiectiv, restricții, planuri în așteptare și proveniența referințelor. Compaction nu elimină aceste informații.
- Revalidează drepturile, existența și revizia înainte de acțiune. Rezultatele expirate se reîncarcă sau cer clarificare, fără substituirea tacită a „celei de-a doua”.
- Extinde memoria existentă cu categorie, proveniență, createdAt, versiune, expirare și reguli de contradicție. Preferințele utilizatorului nu sunt instrucțiuni de securitate.
- Înlocuiește selecția arbitrară a primelor 20 de preferințe cu recuperare relevantă și tratarea corectă a expirării. Testează salvarea, actualizarea și uitarea.
- Definește prioritatea timpului: timezone explicit în cerere, apoi configurarea utilizatorului, apoi agenția; fallback documentat Europe/Bucharest. Păstrează UTC și interpretarea locală originală.

Fișiere vizate: `context.ts`, `workspace.ts`, `datetime.ts`, `temporal-policy.ts`, `access.ts`, contractele sesiunii și integrarea Voice.

Închidere: „trimite-i a doua”, „aceeași oră”, reluare după compaction, rol revocat și schimbare DST sunt testate. Text și Voice folosesc aceleași referințe și preferințe.

### E3 Execuție durabilă și verificare

Dependențe: E1 și partea de context din E2. Prioritate: P0.

- Extinde workerul existent cu suspendare pe dependență și continuare după dovadă. Nu porni următorul pas doar pentru că există jobId.
- Persistă checkpoint, attempt, deadline și nextCheckAt. Reutilizează lease, fencing și ledger; tratează restartul între apelul extern și salvarea receiptului.
- Adaugă verificatori pe domenii, cu webhook autentificat unde există și polling limitat unde este necesar. Dedupe și ordine pentru evenimente duplicate sau întârziate.
- Clasifică safe retry, reconciliere, intervenție umană și eșec nerecuperabil. O citire eșuată nu autorizează repetarea unei trimiteri.
- Aplică buget cumulativ pe obiectiv, incluzând reluări, Jev, LLM, verificări și audio când este atribuibil. Plafoane per actor/agenție și backpressure pentru concurență.
- Replanifică numai pașii rămași și recere approval unde efectele se schimbă. Definește compensări explicite; nu promite rollback atomic între provideri.

Fișiere vizate: `jobs.ts`, `workspace.ts`, `dependencies.ts`, `plan-revisions.ts`, `approval.ts`, `budget.ts`, `plan-outcomes.ts`, `reconciliation.ts`, `worker-failure.ts`, `functions/src/jarvis.ts`.

Închidere: restart, timeout, anulare, revocare, expirarea aprobării, scrieri concurente și provider unknown sunt acoperite. După reluare nu apare un efect extern duplicat în scenariile testate.

### E4 Fluxuri complete pilot

Dependențe: E2 și E3. Prioritate: P0.

| Flux | Verificări obligatorii |
|---|---|
| Cișmigiu mâine la 07 în grupurile Facebook | Entitate neambiguă, conexiune și grupuri eligibile, preview, approval, job recitit cu ora corectă; publicarea ulterioară are rezultat separat |
| Matching pentru Andrei și trimiterea celei de a doua proprietăți | Motorul existent, selecție stabilă, destinatar eligibil, text concret aprobat, dedupe, status exact și follow-up oprit la răspuns |
| Video pentru proprietate și programare TikTok | Render finalizat, asset disponibil, draft corect, approval, programare verificată; fără publicare înainte de finalizarea randării |

Fiecare flux se testează pe ruta normală, cu ambiguitate, timeout, rezultat parțial, browser închis și rol revocat. Providerii se simulează înaintea oricărei probe live autorizate.

Închidere: toate criteriile celor trei fluxuri trec; mesajele finale sunt derivate din dovezi, inclusiv când fluxul rămâne blocat.

### E5 Extinderea parității pe module

Dependențe: E4. Prioritate: P1.

- Închide matricea E0 pentru proprietăți/lifecycle, clienți, matching și portal, vizionări/taskuri, Owner Listings/prospectare, Communications și outreach.
- Continuă cu Facebook, Meta, TikTok organic/Ads/Studio, portaluri imobiliare, Sales/oferte/documente, media, colaborare, agenție/profil, billing și rapoarte.
- Pentru fiecare operație verifică schema, câmpurile, rolurile, precondițiile, efectele secundare, verificarea și echivalența cu UI. Nu duplica serviciul domeniului.
- Rapoartele și căutările declară completitudinea, perioada și prospețimea datelor. Paginarea sub modificări concurente are strategie explicită de snapshot/revizie sau limitare comunicată.
- Capabilitățile indisponibile au motiv runtime și pas concret de recuperare; OAuth, CAPTCHA, semnături și plăți păstrează handoff-ul uman necesar.

Închidere: fiecare rând al matricei are dovadă sau limită explicită. Cazurile nesuportate nu se numără ca funcționalități livrate.

### E6 Jev și performanță

Dependențe: E4 și un set de evaluare stabil; acoperirea se extinde cu E5. Prioritate: P1.

- Verifică documentația oficială TypeSafe și contractul providerului la implementare. Adapter server cu timeout, validarea schemei, circuit breaker și fallback rapid.
- Folosește opțiuni delimitate pentru rutare și alegerea capabilităților candidate. Entitățile și parametrii provin din resolver/context autorizat, nu din presupunerea că Jev este un extractor liber.
- Începe în shadow mode: predicția Jev nu execută acțiuni. Compară atât cu decizia plannerului, cât și cu rezultatul corect din evaluare; plannerul nu este etalon infailibil.
- Calibrează praguri pe risc, limbă și clasă. Prima activare acoperă citiri deterministe; scrierile intră numai prin executorul și aprobările comune.
- Măsoară task success, clarificări, p50/p90/p95/p99 și cost inclusiv fallback. Dacă ruta rapidă nu aduce avantaj, rămâne dezactivată pentru acea clasă.

Configurație: `TYPESAFE_API_KEY` exclusiv server în `.env.local` local și secret runtime în producție. Niciodată `NEXT_PUBLIC_`. Implementarea curentă folosește cheia în shadow mode implicit; `JARVIS_JEV_MODE=off` oprește apelurile. Cheia nu activează execuția pe o rută rapidă.

Fișiere vizate: adapter nou izolat lângă `provider.ts`, `planner.ts`, `capability-discovery.ts`, `telemetry.ts`, `metrics.ts`, `budget.ts` și benchmark separat.

Închidere: schema invalidă, timeout și indisponibilitatea Jev au fallback verificat; activarea nu reduce succesul critic și nu ocolește drepturi sau approvals.

Surse: [TypeSafe introduction](https://docs.typesafe.ai/introduction), [quickstart și autentificare](https://docs.typesafe.ai/introduction/quickstart). Contractul se reverifică înaintea integrării.

### E7 Cunoștințe imobiliare și juridice

Dependențe: E2, retrieval autorizat și E3 pentru acțiunile rezultate. Nu depinde de activarea Jev. Prioritate: P1.

- Creează playbook-uri versionate pentru prospectare, calificare, exclusivitate, poziționare, prezentare, marketing, follow-up, negociere, closing, reactivare și coordonarea tranzacției.
- Recuperare relevantă cu proveniență, autor/revizor și dată. Nu se introduc toate materialele în system prompt. Recomandările comerciale disting fapte, estimări și ipoteze.
- Pentru juridic: surse oficiale allowlisted, act/articol, jurisdicție, versiune, effectiveFrom/effectiveTo unde există, retrievedAt și contentHash. Separă lege, ghid oficial, practică și interpretare.
- Pipeline programat pentru detectarea schimbărilor, extragere, versionare, reindexare, invalidarea cache-ului și regresii. Păstrează citarea versiunii efectiv folosite.
- O sursă inaccesibilă sau ambiguă produce limitare explicită. Documentele utilizatorului și textul extras nu devin instrucțiuni și nu sunt trimise altui provider fără necesitate.
- Deciziile juridice critice includ limitele analizei și ce trebuie verificat profesional. Evals juridice cu răspunsuri de referință revizuite competent; un LLM evaluator nu certifică singur corectitudinea.

Închidere: citări verificabile, versiuni temporale corecte, abținere la dovezi insuficiente și nicio invenție de articol în corpusul critic. Fără revizuirea de domeniu, acceptanța juridică rămâne explicit deschisă.

### E8 Proactivitate și Daily Sales Brief

Dependențe: E2, E3 și capabilitățile relevante din E5. Prioritate: P1.

- Extinde `event-rules.ts`, `insights.ts` și `automation-worker.ts` pentru leaduri, mesaje, matching, vizionări, taskuri, oferte, proprietăți, marketing, Sales și colaborare.
- Evenimentele au proveniență, cursor și lag măsurabil. Procesează deduplicat, verifică starea live înainte de notificare și elimină alertele rezolvate între timp.
- Scor de importanță explicabil, cooldown, quiet hours, plafon de notificări și feedback util/neutil. Recomandarea, draftul și execuția autonomă sunt politici distincte.
- Setări Daily Brief explicite: enabled, timezone, zile, oră, canal, destinație verificată, limbă și maxItems. Preferințele conversaționale pot propune schimbări, dar configurația operațională rămâne validată.
- Livrează 5–10 priorități când există, cu acțiune, motiv și impact estimat marcat. Communications aplică eligibility, templates, opt-out și receipts.
- Cheie de dedupe pe agenție/utilizator/data locală/tip; retry fără al doilea brief. Politică explicită pentru execuție întârziată, zile omise și schimbarea timezone-ului.

Închidere: un brief per interval, zero alertă pentru cazul deja rezolvat în test, stopOnReply și dezactivare funcționale, statusul livrării corect.

### E9 Acceptanță și lansare

Dependențe: E0–E8 pentru funcționalitatea completă; rollouturi parțiale sunt etichetate ca atare.

- Verifică toate cele 1000 de exemple clasificate și minimum trei parafraze pentru scenariile critice. Include typo-uri, diacritice, voice noise, pronume, numere și timp relativ.
- Completează matricea de securitate și failure: două agenții, rol revocat, approval replay, ID/cursor falsificat, prompt injection, webhook fals, concurență, crash, provider unknown și buget epuizat.
- Verifică UI Text/Voice desktop/mobile, aceeași sesiune, progress, approvals, result cards și lipsa expunerii secretelor. Audio simulat și microfon real sunt rezultate distincte.
- Aplică migrarea aditivă, indexurile, worker-ele, scheduler-ele și secretele. Canary pe agenții selectate, monitorizare și rollout gradual; publicări grupate când sunt autorizate.
- Rollbackul oprește pornirea funcționalităților noi, păstrează receipts și reconciliază joburile în curs. Nu resetează ledgerul pentru a forța retry.
- Verifică versiunea lansată, traficul, sănătatea workerelor și probele permise. Raportul final separă implementat, verificat local, verificat în staging și verificat în producție.

Închidere: criteriile de acceptare de mai jos sunt îndeplinite și dovezile corespund versiunii livrate.

## Evaluare și praguri de acceptare

Fiecare caz are ID sursă, conversație, fixtures, actor/rol, timp controlat, provider behavior, efect așteptat, efecte interzise și dovadă. Variantele aceleiași familii rămân în același split pentru a evita contaminarea evaluării.

- Teste deterministe obligatorii: toate trecute; zero încălcări de tenant/rol/aprobare și zero false-success în corpusul respectiv.
- Fluxuri critice E4: toate variantele de acceptare trecute. Un rezultat global bun nu compensează un flux critic eșuat.
- Corpusul 1000: fiecare ID are rezultat și dovadă sau blocaj explicit. „Nesuportat corect” este măsurat separat de „obiectiv realizat”.
- Evaluări probabilistice: rate pe modul, risc și tip de cerere; repetări și intervale de incertitudine. Pragurile numerice se fixează în E0 înaintea calibrării, pe baza baselineului și toleranței produsului.
- Jev: comparație pe aceleași cazuri, cu task success, latență și cost total. Nu se activează o clasă cu regresii critice; scorul confidence singur nu este dovadă de siguranță.
- Latență: măsoară requestReceived, vadEnd, sttFinished, routerFinished, plannerFinished, firstToolStarted, lastToolFinished, verificationFinished, ttsStarted și responseFinished, când se aplică.
- Cost: actor/agenție/obiectiv/turn/provider; valori necunoscute marcate explicit, nu zero fictiv.

## Verificări în dezvoltare

După fiecare schimbare: teste relevante, verificare de tipuri și lint pentru aria modificată; emulator pentru reguli și operații persistente. Buildul complet și regresiile largi se rulează la integrare și înaintea lansării.

Comenzi existente de reutilizat:

```powershell
npm run test:ai-assistant
npm run test:communications
npm run test:jarvis:matching
npm run test:jarvis:rules
npm run jarvis:parity:check
npm run typecheck
npm run test:ai-assistant:ui
node scripts/jarvis-voice-ui-smoke.mjs
npm --prefix functions run build
npm run build
```

Benchmarkurile live cu modele și providerii necesită buget și mediu potrivit; nu sunt substitut pentru testele deterministe. Nu se rulează teste de scriere pe date reale ca efect secundar al verificării.

## Urmărirea progresului

Pentru fiecare etapă se consemnează statusul, criteriile închise, fișierele, testele și rezultatele, commitul, dovada și blocajele. Statusuri: neînceput, în lucru, verificat local, verificat staging, verificat producție, blocat.

Artefacte de creat în implementare: matricea cerințelor, corpusul structurat, raportul baseline, schema obiectivului, tabelul verificatorilor, benchmarkul Jev, registrul surselor juridice, runbookul de rollout/rollback și raportul de acceptanță. Nu se marchează livrate doar pentru că sunt enumerate aici.

Mapare la documentul original: Phase 0 → E0; Phases 1–2 → E1–E4; Phase 3 → E5; Phase 4 → E6; Phase 5 → E2; Phases 6–7 → E7; Phase 8 → E8; Phases 9–10 → transversal și E6/E9; Phases 11–13 → E0 și fiecare etapă, consolidate în E9; Phases 14–15 → E9.

## Primul lot de implementare

1. Reverifică worktree-ul și leagă backlogul existent de matricea E0.
2. Adaugă fixtures și regresii pentru cele trei fluxuri E4 înainte de schimbarea comportamentului.
3. Introduce contractul aditiv al obiectivului și dovezii, fără schimbarea efectelor providerilor.
4. Leagă un singur flux complet de executor, verifier și UI, apoi verifică resume și failure.
5. Extinde mecanismul la celelalte două fluxuri și abia apoi la restul domeniilor.

Acest lot are rezultat verificabil: Jarvis distinge planificarea, execuția și îndeplinirea obiectivului, păstrează starea și continuă corect după așteptare. Jev, proactivitatea și cunoștințele extinse se construiesc peste acest mecanism.

## Implementare locală — 6 octombrie 2026

Status general: implementare parțială verificată local, fără lansare. Acest raport nu certifică finalizarea etapelor E0–E9 și nu modifică raportul de producție existent.

### Modificări implementate

- Contract aditiv `goal`/`outcome`, cu stări distincte pentru execuție, așteptare, rezultat incert, eșec parțial și rezultate confirmate. Planurile istorice păstrează semantica existentă.
- Plannerul poate compune mai multe propuneri înainte să încheie răspunsul. Propunerile rămân supuse aprobării existente.
- Planurile noi verifică rezultatele asincrone înainte de pasul următor. Folosesc coada și checkpointurile existente, cu așteptare limitată și fără repetarea scrierii inițiale. Verificatorul de după ultimul pas poate continua în worker după închiderea paginii.
- Verificatori pentru video, randare TikTok Studio, programare TikTok, drafturi TikTok/Meta, programare Facebook și stările externe deja suportate. Încheierea jobului Facebook de trimitere nu este declarată automat publicare confirmată.
- UI text și voce prezintă rezultatul neconfirmat distinct de execuția încheiată.
- Memorie cu 12 chei de preferințe, expirare și păstrarea datei inițiale; sumar contextual cu ID-uri ordonate ale rezultatelor. Rezolvarea timpului acceptă fusuri IANA și respinge orele inexistente/ambigue fără offset explicit.
- Jev integrat pe server în mod `shadow`, cu model fix, timeout, limită de răspuns, circuit breaker, fallback și contabilizarea utilizării. Decizia sa este observată, fără schimbarea traseului de execuție.
- Daily Brief configurabil în editorul existent: fus orar, oră, zile, interval de liniște, număr de priorități și livrări, notificare în aplicație sau template WhatsApp către propriul număr din profil. Deduplificare pe actor/agenție/zi locală; rezultatul incert nu este retrimis automat. Sunt analizate leadurile necontactate, sarcinile restante și conflictele de vizionare.
- Zece playbook-uri editoriale cu versiune și căutare lexicală; cititor de pagini juridice oficiale cu allowlist, verificare DNS/adrese publice, limită de timp și volum, versiuni hash și stocare privată. Data preluării nu dovedește aplicabilitatea juridică.
- Cele 1000 de exemple din DOCX sunt importate în `evals/master-scenarios.json`, cu ID-uri, categorie și hash al sursei. Fiecare este marcat explicit ca necesitând fixtures și așteptări; importul nu reprezintă 1000 de teste trecute.

### Dovezi locale

| Verificare | Rezultat |
|---|---|
| Vitest asistent, fără integrare/emulator | 54 fișiere, 394 teste trecute |
| Firestore/Storage emulator, proiecte demo | 12 fișiere, 39 teste trecute |
| Concurență Daily Brief în Firestore real emulat | Două execuții simultane produc o singură notificare |
| UI text Chromium | Trecut, inclusiv configurarea Daily Brief și pregătirea planului pentru aprobare |
| UI voce Chromium | Trecut cu audio/microfon simulat; dispozitivul real nu este certificat |
| Build Next.js | Trecut, inclusiv TypeScript și 225 pagini statice |
| Build Firebase Functions | Trecut |
| ESLint arii modificate | Zero erori; un avertisment hook în editorul existent |
| Manifest paritate | Verificat: 180 operații, 40 tipuri de acțiuni; nu reprezintă procent de paritate |
| Jev live, cereri sintetice | 8 apeluri, 6 rute așteptate, p50 265 ms, p95 406 ms, cost raportat 0,000148554 USD |

Detaliile Jev sunt în `JEV_BENCHMARK.json`. Cazurile nu conțin date CRM. Acest eșantion nu justifică activarea unui traseu rapid. Documentația folosită pentru contract și tarif: [Typesafe API](https://docs.typesafe.ai/api), [Typesafe Models](https://docs.typesafe.ai/models).

Build-ul semnalează un exporter Jaeger opțional lipsă și clase Tailwind ambigue. Copierea Chromium în standalone este omisă deoarece pachetul nu apare în locația căutată de script; ambalarea pentru deployment trebuie verificată înaintea lansării fluxurilor de browser.

### Ce rămâne deschis din planul complet

| Etapă | Lucrări rămase |
|---|---|
| E0 / E9 | Fixtures, așteptări, execuții și dovezi individuale pentru corpusul de 1000; praguri probabilistice și evaluare pe parafraze |
| E1 | Verificarea semantică a întregului obiectiv și criterii specifice fiecărui domeniu; schema curentă confirmă pașii propuși, nu garantează că plannerul a acoperit fiecare cerință |
| E2 | Acoperirea tuturor referințelor conversaționale și folosirea consecventă a fusului preferat în toate interogările de domeniu |
| E3 / E4 | Probe complete de flux cu providerii în staging, reconciliere pentru toate tipurile de rezultate și verificări externe ale publicărilor |
| E5 | Audit semantic complet UI/API pe module; manifestul verifică inventarul, nu toate comportamentele |
| E6 | Benchmark comparativ extins și calibrare înaintea activării unui traseu Jev rapid |
| E7 | Ingestie/căutare juridică completă, verificarea intrării/ieșirii din vigoare, actualizare și revizuire; cititorul curent suportă HTML/text fără redirect, nu PDF |
| E8 | Priorități din toate modulele, ranking și explicarea acoperirii; Daily Brief curent citește trei categorii |
| E9 | Teste cu dispozitive audio reale, staging, ambalare browser, canary, deployment și verificarea versiunii în producție |

### Configurare și operare

Cheia locală a fost găsită sub `TYPESAFE_API_KEY` în `.env.local`, iar apelurile sintetice au confirmat autentificarea. Valoarea cheii nu apare în rapoarte. Exemplu cu placeholder, de completat doar local:

```dotenv
TYPESAFE_API_KEY="valoarea_cheii_tale"
JARVIS_JEV_MODE=shadow
```

Ghilimelele duble sunt acceptate de parserul dotenv. Nu se folosește prefixul `NEXT_PUBLIC_`. Fără cheie sau cu `JARVIS_JEV_MODE=off`, plannerul funcționează fără Jev. Repornește serverul local după schimbarea variabilelor. `.env.local` nu este urmărit de Git și este ignorat; lansarea va necesita configurarea separată a secretului în mediul serverului.

Worker-ele existente trebuie să fie active pentru execuție în fundal și Daily Brief. Configurarea unui brief creează mai întâi un plan care trebuie confirmat; simpla memorare a unei ore preferate nu activează automatizarea.

Pentru rollback operațional: dezactivează Jev cu `JARVIS_JEV_MODE=off`, oprește pornirea automatizărilor cu switchul existent `JARVIS_AUTOMATIONS=false` și pune planurile active în pauză. Nu șterge receipts/ledgerele și nu recrea joburile cu ID-uri noi pentru a forța retrimiterea. Înainte de revenirea la o versiune veche, reconciliază joburile de verificare și planurile noi aflate în așteptare.

## Continuarea implementării — 6 octombrie 2026

Această secțiune actualizează situația primului lot; tabelele de mai sus rămân istoricul verificărilor respective. Mediul ales este emulatorul local, cu proiecte demo. Nu s-au făcut trimiteri, publicări sau mutații de test în Nordia și nu s-a lansat această versiune.

### Funcționalitate adăugată

- Acoperirea cererii: plannerul leagă cerințele de citate exacte, pași și ID-uri de citiri reușite. Serverul respinge referințele inventate și invalidează acoperirea când apar pași noi. Cerințele nesuportate sau neclarificate împiedică declararea întregului obiectiv drept finalizat; sunt afișate în UI. Acesta este un control structural, nu o demonstrație semantică a extragerii tuturor cerințelor.
- Referințe conversaționale: `select_context` rezolvă pozițiile din lista ordonată păstrată în context, respinge listele ambigue și recitește accesul la entități. Nu reconstruiește ordinea printr-o nouă căutare.
- Fusul preferat se aplică în rezolvarea datelor și în intervalele interogărilor CRM, inclusiv zilele de 23/25 de ore. Un fus explicit prevalează asupra preferinței.
- Instrumente dedicate pentru statusul integrărilor și căutarea globală. Facebook Groups, Meta Ads, TikTok Ads și TikTok organic au mapări distincte, prin handler-ele existente și verificările de acces. Căutarea globală declară plafonul de cinci rezultate/categorie. Parametrii de rută necunoscuți sunt respinși.
- Studio: ID-urile confirmate pentru materiale/proiecte se transmit către pașii dependenți; proiectul salvat este recitit înainte de randare. Finalizarea randării cere un material video accesibil și legat de versiunea jobului. Această dovadă este starea CRM, nu un test de descărcare/redare a fișierului extern. Erorile tranzitorii de citire continuă verificarea limitată fără repetarea mutației.
- Daily Brief analizează opt surse: contacts, tasks, viewings, sales, conversations, metaCampaignDrafts, tiktokPostDrafts și aiOutreachCalls. Prioritățile au scor determinist, motiv și acoperire explicită; scanările incomplete sunt marcate. Dosarele întârziate, mesajele fără răspuns și erorile de marketing/apeluri sunt incluse.
- Sursele juridice citite sunt căutabile lexical în arhiva privată a agenției; paginarea folosește aceeași versiune hash. Rămâne explicit `temporalValidityVerified: false`.

### Dovezi și limite

- Suita asistentului: **58 fișiere, 414 teste trecute**. Include dependențele Studio, materialul din versiunea greșită, accesul revocat, acoperirea cererii, fusuri orare, selecție contextuală și snapshot-uri juridice.
- Emulator Firestore/Storage: **12 fișiere, 39 teste trecute**, inclusiv concurența Daily Brief. Prima rundă simultană cu build-ul a avut patru timeouturi de inițializare; runnerul limitează acum concurența la două suite și permite 60 s pentru hooks. Rerularea completă a trecut.
- Build Next.js final: **trecut**, inclusiv TypeScript și 225 pagini statice. Avertismentul exporterului Jaeger opțional și lipsa folderului standalone pentru copierea browserului rămân cele documentate anterior. Nu reprezintă verificarea unui deployment.
- Benchmark cu model live și fixtures sintetice: **12/12 scenarii de planificare trecute**, din 12 cazuri revizuite; cost total raportat 0,00753294 USD. Dovadă: [MASTER_ACCEPTANCE.json](evals/MASTER_ACCEPTANCE.json). Celelalte **988** de exemple nu au încă fixtures/așteptări validate. Rezultatul nu certifică efecte CRM sau un procent global de succes.
- Jev live: **21/24 rute așteptate**, p50 254 ms, p95 429 ms, cost 0,000447552 USD. Rămâne în shadow mode. Dovadă: [JEV_BENCHMARK.json](JEV_BENCHMARK.json).
- Manifest verificat: 180 operații, 40 tipuri native de acțiuni, 46 fișiere UI; fără procent de paritate dedus. ESLint: zero erori, avertisment existent pentru dependența `load` în editor.

Rămân deschise acceptanța individuală a corpusului, acoperirea semantică completă UI/API, transferul tuturor rezultatelor asincrone între pași, verificările externe de publicare, ingestia PDF și revizia juridică temporală, proactivitatea pentru toate domeniile, benchmarkul comparativ de rutare și lansarea/canary. Niciuna nu este marcată finalizată prin existența infrastructurii sau a celor 12 probe sintetice.

## Continuare: rezultate asincrone și surse oficiale

Implementate local în aceeași zi:

- `verified-outputs.ts` păstrează separat materialul verificat și răspunsul inițial al furnizorului. Rezultatul se leagă o singură dată; schimbarea lui oprește continuarea. URL-ul video verificat poate fi transmis numai câmpului de import Studio prevăzut, nu textului unui mesaj. Randarea Studio furnizează ID-ul materialului pentru draftul următor.
- Fluxul scenariu → video → import Studio → draft este verificat cu executorul și verificatorul reale ale planului, folosind adaptoare de domeniu simulate. Testul așteaptă providerul, reia planul, verifică parametrii transmiși și dovedește că scenariul/randarea nu sunt repetate. Randarea eșuată oprește importul și draftul. Aceste teste nu trimit materiale unui provider real.
- Citirea surselor oficiale acceptă acum PDF cu text selectabil: maximum 1 MiB, 100 pagini, 200000 caractere și 8 s pentru extragere. Textul conține marcaje de pagină. PDF-urile fără text, false sau prea mari sunt respinse; nu există OCR în acest flux. HTML/text și snapshot-urile continuă să folosească allowlist, verificarea adreselor publice și versiuni hash.
- Automatizarea `legal_source_watch` este disponibilă în editor și prin planul aprobat: 1–3 URL-uri oficiale explicite, interval de minimum o oră, limită de execuții și oprirea comună automatizărilor. Prima citire stabilește referința, fără notificare. O schimbare de conținut produce o singură notificare pentru acea versiune; versiunile anterioară/nouă sunt legate în notificare. Verificarea workerului și a accesului se repetă în tranzacția de notificare. Nu s-a activat nicio monitorizare reală ca efect al implementării.
- Citirea PDF și detectarea schimbării nu certifică aplicabilitatea juridică. Câmpul `temporalValidityVerified` rămâne `false`; revizia de domeniu și actualizarea cunoștințelor juridice validate rămân deschise.

Probe suplimentare: 422 teste ale asistentului au trecut înaintea adăugării celor două probe complete de flux, care au trecut separat. Emulatorul a trecut 40 teste în 12 fișiere, inclusiv notificări concurente pentru surse oficiale și blocarea unei execuții oprite. UI Chromium a trecut cu noua configurare și cu Daily Brief. Manifestul de paritate rămâne verificat; nu reprezintă paritate semantică integrală.

Build-ul final al acestui lot a trecut, inclusiv TypeScript și 225 pagini statice. Rămân avertismentele cunoscute pentru Jaeger/Tailwind și verificarea ambalării browserului la deployment. Modificările sunt locale; nu există un release nou sau efecte de test în Nordia.

Evaluarea cu model live a fost extinsă de la 12 la 20 de cereri revizuite. Prima rundă a trecut 19/20 și a identificat confundarea statusului conexiunii cu lista capabilităților TikTok Ads; descrierea instrumentului și instrucțiunile au fost corectate. Handler-ele fără fixtures definite sunt acum marcate indisponibile în benchmark, nu artificial conectate. Rezultatul ultimei runde este păstrat în `evals/MASTER_ACCEPTANCE.json`.

Rerularea după corecție: **20/20 probe de planificare trecute**, cost raportat 0,012282125 USD, latență medie 12902 ms, fără efecte CRM reale. Celelalte **980** de scenarii rămân fără fixtures/așteptări individuale. Acest set selectat nu măsoară rata globală de succes și nu este un eșantion independent după calibrare.

Configurarea monitorizării: în editorul de automatizări se alege „Schimbări în surse oficiale”, se introduc URL-urile exacte separate prin `;`, prima execuție, intervalul și numărul de verificări. Pentru monitorizare repetată se aleg cel puțin două execuții. Salvarea pregătește planul pentru aprobarea existentă; nu activează direct o monitorizare. Pauza, anularea, expirarea și revocarea accesului folosesc mecanismele comune automatizărilor.

Progresul de mai sus închide părți suplimentare din E3/E4 și E7. Nu închide evaluarea celor 1000 de scenarii, paritatea semantică pe toate modulele, verificările externe de publicare, revizia juridică, proactivitatea completă, calibrarea Jev sau rollout-ul în producție.

## Lot nou: minimum 100 de scenarii și căutarea după anul construcției

Acest lot adaugă **116 scenarii deterministe distincte**, executate pe codul de producție cu date sintetice: 44 pentru căutare, 20 pentru starea obiectivului, 12 pentru acoperirea cererii, 12 pentru rezultate verificate, 8 pentru quiet hours, 12 pentru URL-uri oficiale și 8 pentru preferințe. Sunt variante de comportament și cazuri-limită legate de cerințele documentului; **nu sunt 116 dintre cele 1000 de prompturi certificate integral**. Legătura `source` indică cerința asociată.

Definițiile sunt în [continuation-scenarios.json](evals/continuation-scenarios.json), iar dovezile individuale în [CONTINUATION_ACCEPTANCE.json](evals/CONTINUATION_ACCEPTANCE.json). Comanda reproductibilă este `npm run test:jarvis:scenarios`; runnerul refuză sub 100 de ID-uri unice și nu acceptă rapoarte rămase dintr-o execuție anterioară. Raportul include hashurile suitei și codului evaluat.

Implementare suplimentară:

- Căutarea Jarvis acceptă `yearMin`/`yearMax` inclusive, `roomsAny` și tratarea explicită a anului necunoscut. „După 1977” se exprimă prin `yearMin=1978`; „înainte de 1990” prin `yearMax=1989`. Intervalele textuale și anul renovării nu devin artificial ani exacți de construcție.
- Rezultatele includ anul exact disponibil, eticheta originală limitată și indicatorii `constructionYearKnown`/`yearFilterSatisfied`. Cu `unknownYear=include`, anunțurile fără an exact rămân distincte de cele care îndeplinesc filtrul; cu `only` se caută numai cele necunoscute. Un an cunoscut în afara intervalului rămâne exclus.
- Paginarea păstrează noile criterii în amprenta cursorului. Schimbarea anului sau camerelor invalidează cursorul; filtrele de zonă, preț, monedă, publicare și separarea CRM/proprietari rămân aplicate. Intervalele inversate și combinarea `rooms` cu `roomsAny` sunt respinse înaintea citirilor.
- Memoria fusului orar folosește consecvent cheia salvată `preferred_timezone` atât în calcule, cât și în prompt. Testul de regresie verifică salvare → citire → prompt → uitare, fără a simula cheia greșită.
- Evaluatorul live păstrează acum traseul și răspunsul inclusiv pentru cazurile trecute. Cazul individual selectat nu suprascrie raportul întregului corpus. Fixtures de proprietăți folosesc filtrarea reală și paginare explicită.

Validare locală: **116/116 scenarii**, **137/137 teste în runnerul dedicat**, **543/543 teste în suita completă**, build Next.js/TypeScript trecut, ESLint fără erori și manifestul de paritate verificat. Avertismentele locale Jaeger/standalone rămân cele descrise anterior; nu sunt echivalente cu validarea browserului unui provider real.

Rămân necesare acceptanța completă a corpusului original, verificări externe de publicare/livrare, eliminarea semantică a duplicatelor față de CRM pentru toate cererile compuse și interpretarea verificată a intervalelor textuale de an. Filtrarea numerică nu certifică independent anul real al clădirii.

### Publicarea versiunii anterioare lotului nou

Publicat pe `https://imodeus.ro`: commit **3a89e025e902101d7653e508ce355490df8b7855**, build **build-2026-10-06-master-3**, stare READY și **100% trafic**. Include funcțiile implementate înaintea acestui lot și corecția memoriei fusului orar. Noile filtre și cele 116 scenarii aparțin continuării locale ulterioare și nu trebuie confundate cu acest commit de producție.

Secretul `TYPESAFE_API_KEY` este configurat în Secret Manager și legat în Cloud Run, fără a fi pus în Git sau afișat în rapoarte. `JARVIS_JEV_MODE=shadow`; traseul rapid nu este activat. Prima încercare de build a cerut remedierea permisiunilor prin `firebase apphosting:secrets:grantaccess`. A doua a avut timeout de monitorizare App Hosting, deși compilarea Cloud Build a reușit. Buildul publicat a trecut verificările și a fost lansat prin SHA explicit, fără merge în main.

Dovezi: [CRM_PARITY_PRODUCTION.json](CRM_PARITY_PRODUCTION.json) și [MASTER_PRODUCTION.json](MASTER_PRODUCTION.json). Pagina `/ai-assistant` a răspuns 200; endpointurile private verificate au răspuns 401 fără autentificare. Șase funcții sunt ACTIVE, ambele schedulere sunt ENABLED, 72 de indexuri sunt READY. Nu au fost trimise mesaje externe de test. Aceste probe verifică lansarea și izolarea rutelor, nu finalizarea reală a tuturor fluxurilor cu furnizori.

Verificarea după rollout confirmă o execuție programată reușită a workerului la **2026-10-06T20:02:09.549Z**, cu `lastError=null`.

### Rezultatul evaluării live extinse

**56/56 cereri revizuite din corpus au trecut verificările de planificare**, cost raportat **0,03814776 USD**, folosind exclusiv fixtures sintetice și modelul Luna. Setul include cele 20 de cazuri anterioare și 36 de căutări suplimentare după zonă, preț, camere, an și tratarea anului necunoscut. Pentru cererile 241/242, răspunsurile au separat anunțurile cu an cunoscut de cele fără an și au precizat că necunoscutele nu confirmă filtrul.

[MASTER_ACCEPTANCE.json](evals/MASTER_ACCEPTANCE.json) păstrează fiecare traseu, răspuns și apel invalid recuperat; **944 de cereri** rămân fără fixtures și așteptări individuale. Un caz trecut poate include recuperarea unei erori de argumente, iar alegerea corectă a instrumentelor nu certifică toate afirmațiile din răspuns sau efectele externe. Cele 116 scenarii deterministe și cele 56 de probe live sunt două suite diferite și nu reprezintă 172 de prompturi originale certificate cap-coadă.

## Continuare: importuri CRM, intervale declarate și reconciliere concurentă

Lotul următor extinde E1/E2/E3/E5 și păstrează toate efectele de test în fixtures/emulator:

- `excludeImported` compară anunțurile proprietarilor cu proprietățile agenției curente prin `ownerListingId` și URL sursă exact. Interogările sunt împărțite în loturi de 30; eroarea sau depășirea limitei oprește verificarea. Nu sunt returnate date private CRM. Cursorul avansează și peste importurile excluse, iar schimbarea filtrului invalidează cursorul. Duplicatele introduse manual sau anunțurile de pe alt portal fără referință comună rămân neconfirmate.
- Anul construcției separă valoarea exactă, intervalul declarat și informația necunoscută. Sunt interpretate exclusiv câmpurile dedicate: `YYYY-YYYY`, „după YYYY”/`after_YYYY`, „înainte de YYYY”/`before YYYY`. Un interval confirmă filtrul numai dacă îl satisface integral; suprapunerea parțială nu devine confirmare. `yearLabel=after_1977` caută declarația explicită, fără să o substituie cu un an numeric. Textul despre renovare nu este folosit ca an al construcției. Datele declarate nu certifică independent anul real al imobilului.
- Cardurile afișează anul declarat, intervalul sau anul necunoscut, împreună cu mențiunea că o dovadă insuficientă nu confirmă filtrul. Limitarea comparației CRM este vizibilă. Comprimarea rezultatelor păstrează aceste distincții.
- Selecția contextuală „primul/al treilea” funcționează și pentru anunțurile proprietarilor. Folosește ordinea și orașul listei salvate, recitește exact ID-ul selectat și refuză anunțurile dispărute/nepublicate/necanonice. Nu înlocuiește automat anunțul și nu expune telefonul sau câmpurile interne.
- Cerințele neacoperite nu mai maschează aprobările, așteptările furnizorului, execuția sau erorile existente. Dovezile contradictorii pentru același pas produc incertitudine, indiferent de ordinea lor. Un răspuns final gol al modelului este marcat parțial, nu succes.
- Reconcilierea compară revizia Firestore exactă, nu numai statusul planului, înainte să salveze rezultatul citit. O modificare concurentă declanșează o nouă citire, fără suprascriere; pauza/anularea și termenul maxim opresc verificarea. Identitatea jobului include agenția, utilizatorul și planul, evitând coliziuni între agenții.

Scenariile deterministe sunt acum **134**, inclusiv 18 cazuri noi pentru intervale și declarația `after_1977`. Runnerul dedicat a trecut **155/155 teste**, iar suita completă a trecut **584/584 teste în 65 fișiere**. Emulatorul a trecut **42/42 teste în 12 fișiere**, inclusiv paginarea peste importuri, separarea agențiilor și refuzul unei dovezi bazate pe revizia veche. Proba de interfață Chromium a trecut inclusiv distincțiile anului pe mobil, limita comparației CRM și absența depășirii lățimii ecranului.

Rămân deschise eliminarea semantică a duplicatelor fără referințe, acceptanța întregului corpus original, verificările externe ale furnizorilor, validitatea juridică temporală, proactivitatea pe toate domeniile și calibrarea Jev. Acest lot nu declară planul integral finalizat și nu schimbă versiunea de producție documentată mai sus.

Evaluarea live cu `jarvis-26` a trecut **60/62 cazuri**, cost **0,048233245 USD**. Cazul 208 a parcurs mai multe pagini fără răspuns final, iar 248 a omis comparația exactă disponibilă când comparația semantică era indisponibilă. Raportul complet [MASTER_ACCEPTANCE.json](evals/MASTER_ACCEPTANCE.json) păstrează aceste eșecuri; **938 de cereri** încă necesită fixtures și așteptări revizuite.

Instrucțiunile `jarvis-27` cer o primă pagină explicit parțială pentru o listă simplă și efectuarea comparației exacte disponibile, cu limitele ei. Reverificările țintite au trecut **2/2**, cost **0,00490093 USD**, în [CONTINUATION_LIVE_REGRESSIONS.json](evals/CONTINUATION_LIVE_REGRESSIONS.json). Nu sunt o rerulare completă de 62/62 și nu certifică acoperirea semantică a tuturor clauzelor: de exemplu, statutul `answered` al unei cerințe rămâne o clasificare a modelului, chiar când răspunsul descrie limitările comparației. Verificarea serverului validează referințele, nu o demonstrație semantică integrală.

Build-ul final Next.js a trecut, inclusiv TypeScript și 225 pagini statice. ESLint și verificarea manifestului au trecut. Rămân avertismentele cunoscute Jaeger/Tailwind și copierea omisă a browserului în standalone local. Acestea nu reprezintă validarea unui provider sau a unui nou deployment.

## 7 octombrie: căutare → prospectare → verificarea rezultatului

Continuare în E2/E3/E5:

- Plannerul continuă o cerere compusă de căutare și creare a listei cu acțiuni `owner_prospect:add` pentru ID-urile găsite. Acțiunile folosesc planul confirmabil existent; nu se introduce un executor paralel. O limită de paginare/buget/100 pași trebuie declarată, fără a prezenta lista parțială drept întreaga cerere realizată.
- Verificatorul recitește `ownerListingFavorites` din agenția curentă și cere și receiptul operației. Pentru adăugare confirmă apartenența la listă, nu telefonul, acordul WhatsApp, contactarea sau importul în portofoliu. Eliminarea cere starea inactivă. O modificare concurentă a listei nu este corectată prin reapelarea automată a comenzii.
- Pentru `retry`, stările reale queued/processing/retrying mențin verificarea în așteptare; available cere un telefon valid, fără a-l include în dovada returnată. Failed/unavailable/cancelled sunt finale nereușite, iar conexiunea lipsă produce limitare explicită. Verificarea reutilizează termenul maxim al watcherului existent.
- Emulatorul execută căutarea, selecția ordonată, executorul cu ledger și handlerul real de prospectare, cu serviciul telefonic simulat. Dovedește că repetarea aceleiași execuții nu apelează din nou handlerul, citirile rezultatului nu retrimit cererea, accesul revocat este refuzat și altă agenție nu poate furniza dovada. Cazul „lista s-a salvat, dar înrolarea în coada telefonului a eșuat” rămâne BLOCKED și nu este relansat automat. Testele nu certifică un provider telefonic real sau întregul flux UI de aprobare.
- Memoria este validată la recuperare: cheia trebuie să corespundă documentului solicitat, proprietarul să fie cel curent, expirarea să fie numerică și viitoare, iar valoarea să respecte contractul preferinței. Rândurile invalide sunt ignorate fără ștergere. Plannerul și calculul orei tratează la fel fusurile invalide, expirate sau stocate sub altă cheie; rândurile legacy valide rămân utilizabile.

Cazul original **249** a trecut evaluarea live `jarvis-28`: șapte rezultate sintetice și exact șapte acțiuni pregătite, fără ID-uri inventate/duplicate, cu acoperirea cerințelor validată structural. O eroare inițială de limită la discovery a fost recuperată. Cost: **0,00333353 USD**. Dovadă: [PROSPECTING_WORKFLOW_ACCEPTANCE.json](evals/PROSPECTING_WORKFLOW_ACCEPTANCE.json). Acest harness certifică planificarea pe fixtures; nu certifică bugetele plannerului real sau efecte de producție. Setul revizuit are acum 63 de cazuri, însă nu a fost rerulat integral în această rundă; raportul complet 60/62 anterior rămâne separat, iar 937 de cereri încă necesită fixtures/așteptări individuale.

Prima rulare a suitei unitare a identificat un fixture HTTP fără câmpul `usage`, care ajungea pe calea conservatoare de buget înaintea celui de-al doilea apel. Fixture-ul testului de validare raportează acum consumul explicit; limitele de producție, estimarea conservatoare în lipsa consumului și aserțiunile de refuz al acordului WhatsApp nu au fost relaxate.

Validare: **615/615 teste în 67 fișiere**, **45/45 teste în 13 fișiere pe emulator**, **134/134 scenarii deterministe** și **155/155 teste în runnerul dedicat**. ESLint și manifestul de paritate au trecut. Traseul live înregistrat confirmă că fiecare ID propus a fost returnat de căutare; evaluatorul verifică explicit această proveniență și respinge lipsuri, duplicate sau pași suplimentari.

Build-ul final a trecut cu TypeScript și 225 pagini statice, după corectarea tipului ID-ului validat din verificator. Avertismentele Jaeger/standalone locale rămân cele documentate anterior; nu există validare nouă a unui deployment.

Lotul nu este publicat în producție. Rămân deschise criteriile de închidere ale planului integral, inclusiv verificările externe, validitatea juridică temporală, matricea semantică completă și evaluarea corpusului rămas.

## 7 octombrie: matching → selecție → portal → dovezi de livrare

Continuare în E1/E3/E4/E5, cu date sintetice:

- Selecția ordinală verifică proprietarul, tipul, expirarea numerică și accesul setului de matching salvat. Ordinea rămâne cea afișată; proprietatea este recitită și trebuie să fie activă. Un set expirat sau un rezultat indisponibil oprește selecția, fără substituire automată. Clientul asociat este păstrat în rezultat și în referințele de acces.
- Scorul și explicația originale sunt păstrate. Modificarea proprietății sau a clientului marchează scorul ca posibil învechit; cardul afișează „calcul anterior” și solicită refacerea matchingului. Proba Chromium verifică avertismentul și lățimea pe mobil.
- Recomandarea cere receiptul cu aceleași proprietăți, clientul și portalul autorizat, documentele de recomandare existente și proprietățile active. Recitirea finală respinge un portal realocat în timpul verificării. O recomandare confirmată nu dovedește trimiterea mesajului.
- Livrarea cere legătura dintre mesaj, jobul de trimitere, agenție, autor, conversație, conexiune și conținutul aprobat, inclusiv șablonul și atașamentul. Nu sunt returnate aceste date în dovadă. Acceptarea rămâne în așteptarea furnizorului; delivered/read cer și ID extern, iar livrarea este diferențiată de citire. O identitate neconfirmată nu declanșează retrimiterea. Mesajele istorice fără jobul necesar rămân explicit neconfirmate.
- Testul de integrare folosește motorul real de matching, selecția și executorul tranzacțional real pentru recomandarea în portal; repetarea execuției produce aceeași recomandare. Mesajele și confirmările furnizorului sunt sintetice. Sunt verificate eliminarea recomandării, schimbarea portalului, revocarea accesului, schimbarea conținutului și trecerea accepted → delivered.

Validare: **651/651 teste unitare în 70 fișiere**, **48/48 teste în 14 fișiere pe emulator**, **134/134 scenarii deterministe**, **155/155 teste în runnerul dedicat**, proba Chromium și manifestul de paritate. Nu au fost trimise mesaje reale. Corpusul revizuit și probele live anterioare nu au fost extinse prin aceste teste.

Acest lot nu certifică integral fluxul conversațional de pregătire/aprobare/trimitere la un furnizor real. Un mesaj care include URL-ul creat de recomandare trebuie pregătit cu acel conținut concret și aprobat prin mecanismul existent. Cele 937 de cereri fără fixtures individuale, verificările externe, validitatea juridică temporală și calibrarea Jev rămân deschise. Modificările acestui lot nu sunt publicate în producție.

Build-ul final a trecut cu TypeScript și 225 pagini, după adăugarea explicită a clientului în tipul referințelor de acces. ESLint a trecut; avertismentele cunoscute Jaeger/Tailwind și copierea omisă a browserului standalone local rămân. Aceste rezultate nu constituie probe de deployment sau de livrare la un furnizor real.

## 7 octombrie: destinatar fixat de la pregătire până la trimitere

Continuare E2/E3/E4. Auditul cozii comune a identificat că workerul reconstruia destinatarul din conversația curentă; un ID de conversație singur nu dovedea păstrarea destinatarului aprobat.

- Pregătirea `message_send` citește conversația autorizată și include o revizie deterministă a agenției, conversației, canalului, conexiunii, participantului extern și clientului asociat. Revizia intră în payloadul aprobat; o revizie explicită veche este refuzată, nu înlocuită cu cea nouă. Modificările de nume, status, mesaje primite sau citire nu invalidează identitatea.
- Conversațiile create într-un pas viitor cer un plan separat pentru trimitere, după identificarea destinatarului concret. Instrucțiunea instrumentului explică acest lucru și păstrează cerința de preview pentru eligibilitate/cost. Acest lot nu adaugă un control obligatoriu server al previewului și nu certifică încă toate criteriile fluxului pilot.
- Serviciul comun validează revizia înainte de estimare, apoi din nou în tranzacția care creează mesajul și jobul. Joburile noi, inclusiv cele inițiate manual, păstrează identitatea din acel moment. Workerul o verifică înainte de estimare și de apelarea furnizorului. Un destinatar, client sau o conexiune schimbată oprește expedierea.
- Verificarea rezultatului pentru planurile noi cere aceeași revizie în acțiunea aprobată, job, inputul jobului și conversația curentă. Mesajul deja acceptat nu este retrimis; citirea unui rezultat anterior prin cheia de idempotency rămâne posibilă cu acces autorizat.
- Previewul de produs păstrează textul concret și identificatorul conversației, fără a afișa hashul intern ca un câmp de completat. Proba Chromium verifică textul și absența câmpului tehnic din previewul vizibil, inclusiv pe mobil.

Compatibilitate la lansare: planurile de trimitere încă neexecutate, fără revizia destinatarului, cer pregătire/aprobare nouă. Joburile vechi încă queued, fără identitate verificabilă, se încheie failed înainte de furnizor; rezervarea este decontată ca eșec prin mecanismul existent. Nu se completează automat identitatea lor din datele curente și nu se retrimit mesajele accepted/delivered/read. Webul și workerul trebuie lansate coordonat pentru a evita producerea continuă a joburilor vechi de un proces neactualizat. Acest comportament necesită verificarea cozii înaintea rolloutului.

Validări trecute: **765/765 teste unitare în 82 fișiere** din Jarvis și comunicări; **56/56 teste pe emulator în 15 fișiere**, incluzând opt probe ale cozii/workerului reale cu transport Meta simulat; **134/134 scenarii deterministe**, **155/155 teste în runnerul dedicat**; ESLint, manifestul de paritate și proba Chromium. Testele includ schimbarea identității între estimare și tranzacție, acces revocat, job legacy, reluare fără al doilea apel extern și actualizări inofensive în inbox. Nu s-au folosit destinatari reali.

Corpusul live nu a fost extins în acest lot. Cele 937 de cereri fără fixtures individuale și criteriile rămase ale planului integral sunt în continuare deschise. Modificările nu sunt publicate în producție.

Build-ul final a trecut, inclusiv TypeScript și 225 pagini. Bundle-ul rezultat conține și ascunderea reviziei interne din preview. Avertismentele Jaeger/Tailwind și copierea omisă a browserului standalone local rămân cele documentate anterior.

## 7 octombrie: preview obligatoriu și condiții concrete de trimitere

Continuare E3/E4. Este implementat controlul server al previewului care rămăsese deschis în lotul anterior:

- Pregătirea fiecărui `message_send` apelează modul preview al serviciului comun `queueMessage`. Verifică prin serviciul existent conversația, conexiunea, fereastra de răspuns, șablonul, acordurile și tariful aplicabile. O eroare oprește pregătirea planului. Previewul nu creează mesaj sau job și nu trimite către furnizor.
- Serverul generează condițiile aprobării din răspunsul serviciului: cost maxim în micros, moneda, textul efectiv randat și valabilitate de o oră. Condițiile introduse de model sunt înlocuite cu rezultatul verificat; nu pot deveni autorizație pentru un cost inventat. Condițiile fac parte din payloadul exact al aprobării.
- Coada și workerul recalculează eligibilitatea, costul și textul. Expirarea, schimbarea monedei, creșterea peste plafon sau modificarea textului randat cer pregătire/aprobare nouă. Un cost mai mic pentru același conținut și aceeași monedă este permis, cu păstrarea verificării suplimentare a rezervării din job. Prețul necunoscut/invalid nu este tratat ca zero.
- Confirmarea afișează costul maxim în unitatea monetară, textul efectiv și ora expirării. Verificatorul rezultatului cere concordanța condițiilor aprobate cu inputul jobului. Expirarea ulterioară nu anulează dovada unui mesaj deja livrat și nu produce retrimitere.
- Planurile Jarvis neexecutate fără preview valid cer pregătire nouă. Joburile Jarvis vechi cu destinatar fixat, dar fără condiții de trimitere, sunt oprite înainte de furnizor. Trimiterile manuale fără câmpul de aprobare Jarvis păstrează fluxul lor existent de estimare, buget și revalidare; nu sunt transformate în planuri Jarvis. Lansarea coordonată web/worker și verificarea cozii rămân necesare.

Validări: **773/773 teste unitare în 83 fișiere**, **59/59 teste pe emulator în 15 fișiere**, **134/134 scenarii deterministe** și **155/155 teste în runnerul dedicat**. Cele 11 probe ale cozii reale includ acum fereastra expirată la pregătire și condiții expirate/lipsă atât la coadă, cât și la worker; transportul este simulat. Proba Chromium verifică afișarea costului și textului concret pe mobil. ESLint a trecut. Nu au fost trimise mesaje reale.

Rămân deschise verificarea integrală a celor trei fluxuri pilot, probele furnizorilor reali și criteriile deja enumerate pentru corpus, validitate juridică și Jev. Previzualizarea înainte de aprobare este acum obligatorie pentru pregătirea mesajelor Jarvis, dar această etapă nu certifică întregul plan. Lotul nu este publicat în producție.

Build-ul final a trecut cu TypeScript și 225 pagini; manifestul de paritate a trecut. Avertismentele locale Jaeger/Tailwind și copierea omisă a browserului standalone rămân cele cunoscute.

## 7 octombrie: proprietatea selectată → client → conversație

Continuare E2/E4, cu noul instrument read-only `resolve_matching_recipient`, disponibil în schema nativă și în plannerul comun Text/Voice:

- Rezolvă poziția prin selecția contextuală existentă, păstrând setul, ordinea, scorul și marcajul de învechire. Cere clientul asociat setului; nu deduce destinatarul dintr-un nume sau telefon.
- Reutilizează citirea autorizată a conversațiilor, filtrată după ID-ul clientului și canalul cerut. Parcurge maximum cinci pagini, deduplică ID-urile și recitește accesul și asocierea cu clientul. Dacă paginarea este incompletă sau repetă cursorul, rezultatul rămâne parțial și nu este declarat unic.
- O singură conversație într-o căutare completă este rezolvată; absența sau ambiguitatea cere alegerea utilizatorului. O conversație indicată explicit trebuie să aparțină aceluiași client și canal. Nu schimbă destinatarul când asocierea se modifică. Proiecția conversațiilor nu returnează telefonul extern sau câmpurile secrete.
- Rezolvarea destinatarului nu certifică eligibilitatea de trimitere. Mesajul concret continuă prin pregătirea, previewul, aprobarea, coada și workerul existente. Instrucțiunile disting linkul de portal concret de linkurile CRM private și cer o aprobare separată dacă portalul este creat într-un pas anterior.
- Proba nouă pe emulator folosește motorul real de matching, setul salvat, a doua proprietate, căutarea reală a conversațiilor, condițiile reale de pregătire și verificarea payloadului aprobat, apoi coada și workerul cu transport simulat. Verifică și refuzul conversației reasociate altui client. Nu este o probă live de interpretare a limbajului natural sau de livrare reală.

Validare: **783/783 teste unitare în 84 fișiere**, **60/60 teste în 15 fișiere pe emulator**, **134/134 scenarii deterministe** și **156/156 teste în runnerul dedicat**. ESLint și manifestul de paritate au trecut. Indexurile declarate existente acoperă filtrele contact/canal/acces; nu se deduce din emulator că sunt deja disponibile în producție.

Testul pentru două erori consecutive de infrastructură a fost izolat cu un catalog restrâns de unelte, astfel încât să verifice retry-ul separat de rezervarea conservatoare fără usage. Plafoanele de producție nu au fost mărite. Pe catalogul complet, bugetul poate opri retry-ul; aceasta rămâne limita intenționată, nu o garanție de două apeluri.

Acest lot nu declară închise cele trei fluxuri pilot și nu extinde corpusul live revizuit. Rămân probele complete cu provideri, scenariile individuale restante, verificarea juridică temporală și calibrarea Jev. Modificările nu sunt publicate în producție.

Build-ul final a trecut cu TypeScript și 225 pagini. Avertismentele Jaeger/standalone locale rămân cele documentate anterior.

## 7 octombrie: selecția din matching păstrată până la worker

Continuare E2/E4. Resolverul furnizează acum `matchingSelection`: setul salvat, proprietatea aleasă, clientul și reviziile surselor citite. Instrucțiunile plannerului cer copierea integrală în mesajul pregătit; payloadul intră în aprobarea existentă. Previewul afișează proprietatea/clientul și reverificarea, fără hashurile interne.

Serviciul comun verifică proprietarul și expirarea setului, apartenența proprietății la set, asocierea conversației cu clientul, existența și starea activă a proprietății, reviziile proprietății/clientului și accesul la referințe. Verificarea are loc la pregătire, în tranzacția cozii și din nou înainte de invocarea furnizorului. O schimbare cere pregătire nouă și nu substituie o altă proprietate. Citirea idempotentă a unui job anterior rămâne posibilă fără trimitere nouă. Dovada livrării cere aceeași selecție în acțiune și inputul jobului; expirarea ulterioară a setului nu anulează retroactiv dovada unui mesaj livrat.

Validări trecute: **784/784 teste unitare în 84 fișiere**, **73/73 teste pe emulator în 15 fișiere**, **134/134 scenarii deterministe** și **156/156 teste în runnerul dedicat**, ESLint, paritate și proba Chromium. Cele 13 probe noi pe emulator acoperă schimbarea prețului, inactivarea proprietății, modificarea clientului, expirarea setului, schimbarea proprietarului setului și eliminarea din rezultate, înainte și după queue, plus schimbarea în timpul estimării. Transportul Meta este simulat; nu au fost trimise mesaje reale.

Limite: metadatele sunt obligatorii în instrucțiunea fluxului de matching, dar mesajele generice fără `matchingSelection` păstrează comportamentul existent; nu se deduce semantic pe server că orice text despre o proprietate provine din matching. Controlul înainte de apelul extern nu este o tranzacție distribuită cu providerul. Reviziile folosesc excluderile existente ale matchingului pentru câmpuri operaționale și media; nu certifică identitatea tuturor atașamentelor. Planurile istorice fără aceste metadate nu sunt reinterpretate. Corpusul live revizuit nu este extins de aceste teste. Rămân verificările complete ale celor trei fluxuri pilot, cele 937 de cazuri fără fixtures individuale, probele externe, validitatea juridică temporală și calibrarea Jev. Acest lot nu este publicat în producție.

Build-ul final a trecut cu TypeScript și 225 pagini. Rămân avertismentele cunoscute pentru Jaeger, clasele Tailwind și copierea browserului standalone local; buildul nu constituie dovadă de deployment.

## 7 octombrie: oprirea follow-upului după un răspuns sosit în coadă

Continuare E3/E4. Verificarea anterioară `stopOnReply` avea loc numai în workerul automatizării, înainte de queue; un răspuns sosit ulterior nu oprea expedierea deja pusă în coadă.

Automatizările noi păstrează acum în inputul jobului `stopOnReplySince`, momentul original al creării automatizării. Serviciul comun îl verifică înainte de estimare, în tranzacția cozii și după recitirea autorizată a conversației înainte de apelul furnizorului. Comparația folosește momente UTC, inclusiv offseturi diferite; un răspuns cu același timestamp oprește conservator follow-upul. Datele lipsă/invalide ale activării blochează automatizarea. Dezactivarea explicită a opririi la răspuns rămâne respectată.

Dacă răspunsul este observat după queue, mesajul se încheie `failed` cu motiv explicit prin mecanismul existent, rezervarea este eliberată și jobul nu este retrimis. Rezultatul poate fi consultat idempotent. Workerul recitește și revalidează identitatea destinatarului după estimare, înainte de trimitere. Mesajele accepted/delivered nu sunt anulate retroactiv.

Validări: **797/797 teste unitare în 85 fișiere**, inclusiv cele **134 scenarii deterministe existente**; **78/78 teste pe emulator în 15 fișiere**; ESLint și manifestul de paritate. Cele cinci probe noi ale cozii reale acoperă răspuns înainte de queue, în timpul estimării, după queue, în timpul workerului și calea fără răspuns (o singură invocare simulată). Testele unitare verifică offseturile, egalitatea momentelor și datele invalide. Nu au fost trimise mesaje reale.

Limite de rollout: joburile deja create fără `stopOnReplySince` nu pot fi reinterpretate drept follow-upuri; verificarea cozii și lansarea coordonată a workerelor rămân necesare. Protecția se bazează pe răspunsurile deja persistate în conversație; un webhook întârziat sau un răspuns sosit după ultima verificare nu poate fi oprit atomic împreună cu un apel extern. Aceasta nu închide integral fluxurile pilot, corpusul live, verificările externe, validitatea juridică sau calibrarea Jev. Lotul nu este publicat în producție.

Build-ul final a trecut: TypeScript și 225 pagini. Rămân avertismentele locale cunoscute pentru Jaeger și copierea browserului standalone; acestea nu sunt probe de deployment.

## 7 octombrie: dovezi precise pentru programarea în grupurile Facebook

Continuare E3/E4. Verificarea `facebook_job_create` folosește acum un evaluator separat al rezultatului: ID job, agenție, autor, proprietate, conexiune, lista exactă a grupurilor și momentul programat. Cererea este deduplicată ca în handlerul existent de creare; grupurile duplicate din jobul salvat sunt refuzate. Astfel, o cerere cu două apariții ale aceluiași grup nu mai poate confirma un job care conține și alt grup. Ordinea grupurilor nu schimbă identitatea setului.

Programarea confirmată este raportată explicit separat de publicare. Sunt expuse numai URL-ul și statusul fiecărui grup, fără erorile interne ale runnerului, cu publicarea neconfirmată. `submitted`, `pending_approval` și finalizarea runnerului nu sunt transformate în receipt de publicare. `cooldown` rămâne procesare urmărită pentru o trimitere imediată și este compatibil cu o programare deja înregistrată. Anularea, eroarea și cererea de reautentificare nu confirmă o programare activă. O reprogramare a trimiterii imediate sau o modificare de oră/grupuri este raportată ca neconfirmată fără reluarea mutației.

Validări: **825/825 teste unitare în 86 fișiere**, incluzând **134 de scenarii deterministe existente**; 28 teste noi ale evaluatorului și integrarea în citirea rezultatelor planului. Sunt acoperite identități diferite, duplicate, date malformate, grupuri lipsă, aceeași oră cu offset diferit, stări terminale, procesare parțială și absența divulgării erorilor runnerului. ESLint și manifestul de paritate au trecut. Nu s-au schimbat regulile Firestore ori handlerul de publicare; emulatorul nu a fost rerulat pentru acest evaluator pur.

Limite: confirmarea se referă la programarea din CRM, nu certifică eligibilitatea curentă a conexiunii, disponibilitatea laptopului sau accesul Facebook la grupuri. Acestea rămân verificate de fluxul de execuție existent. Nu există o probă nouă de publicare la furnizor, iar cele trei fluxuri pilot și planul integral rămân deschise. Corpusul live și calibrarea Jev nu au fost extinse. Acest lot nu este publicat în producție.

Build-ul final a trecut cu TypeScript și 225 pagini. Avertismentele locale Jaeger și browser standalone rămân cele cunoscute; buildul nu reprezintă deployment.

## 7 octombrie: draftul TikTok fixat la programare

Continuare E3/E4. Programarea păstra anterior numai ID-ul draftului, iar workerul publica versiunea curentă. Joburile noi păstrează acum o revizie SHA-256 a intrărilor de publicare: autor/agenție, proprietate, URL video și proprietarul video, contul țintă, descriere, hashtaguri, vizibilitate, interacțiuni, marcaje comerciale/AI, acord și copertă. Telemetria și statusurile nu schimbă această revizie.

Workerul validează draftul și revendicarea jobului înainte de publicare. Serviciul comun repetă verificarea în tranzacția care schimbă draftul în `publishing`, înaintea efectelor externe: aceeași revizie, autor, agenție, job, oră scadentă, programare activă, owner de execuție și lease neexpirat. O modificare sau un job vechi fără revizie oprește publicarea și cere programare nouă. Selectarea unui job scadent este reverificată după citirea tranzacțională, pentru a nu porni o programare mutată între timp în viitor.

Starea finală a draftului este actualizată în aceeași tranzacție cu rezultatul jobului, numai de ownerul încă activ. Un worker înlocuit nu poate marca draftul `sent` sau `error`. Verificatorul Jarvis nu mai confirmă programarea dacă draftul nu mai corespunde reviziei stocate. Publicarea manuală păstrează verificările ei existente.

Compatibilitate: joburile programate anterior fără revizie trebuie revizuite și reprogramate explicit; workerul nu completează revizia din conținutul curent. Lansarea coordonată web/worker și inventarierea cozii rămân necesare. Revizia fixează URL-ul video, nu hashul octeților de la acel URL; disponibilitatea și validarea media rămân în serviciul de publicare existent. Legarea conținutului are loc la programare și nu certifică singură că modelul a prezentat acel conținut în toate variantele de aprobare. Probele acestui lot folosesc provideri simulați; fluxul pilot integral, probele externe și corpusul restant rămân deschise. Lotul nu este publicat în producție.

Validări: 970/970 teste în 102 fișiere din Jarvis, comunicări și TikTok, inclusiv cele 134 de scenarii deterministe existente. Lotul adaugă 21 de teste ale reviziei și 8 cazuri în workerul Studio (conținut schimbat, trimitere unică și claim înlocuit). Suitele folosesc stocare simulată pentru aceste tranzacții; emulatorul Firestore nu a fost rerulat. Testul de randare produce un MP4 real folosind voce și imagini sintetice, fără provider plătit. ESLint și manifestul de paritate au trecut. Numărul de teste nu reprezintă numărul de cereri originale validate cap-coadă.

Build-ul final a trecut: TypeScript și 225 pagini. Rămân avertismentele locale cunoscute Jaeger/standalone; nu reprezintă validare de deployment.

## 7 octombrie: aprobarea Jarvis fixează draftul înainte de programarea TikTok

Continuare E3/E4. Pregătirea `tiktok_post_schedule` citește un draft existent, deținut de autor în aceeași agenție, cu text, video și acord deja înregistrat. Revizia sursei intră în payloadul aprobat; o revizie veche explicită este refuzată. Drafturile viitoare `@step` cer întâi executarea creării și apoi o aprobare separată. Previzualizarea este construită din datele serverului și afișează textul, URL-ul video, vizibilitatea și hashtagurile, fără hashul intern.

Validarea aprobării refuză planurile Jarvis neexecutate fără revizia draftului. Ruta existentă transmite revizia serviciului comun, care o verifică în tranzacție înainte de orice scriere a programării. Interfața manuală poate folosi în continuare contractul existent fără acest câmp. Verificarea rezultatului leagă revizia aprobată de job și de draftul curent; nu confirmă o programare înlocuită cu alt conținut. Contractele generate au fost actualizate pentru handlerul existent.

Testele noi acoperă sursa autorizată, citirea comună pentru același draft, previzualizare inventată, revizie învechită, referință viitoare, draft incomplet, alt autor/agenție și refuzul tranzacțional înainte de scriere. Proba Chromium verifică previzualizarea TikTok și absența hashului intern pe mobil. Datele sunt sintetice; nu s-a programat sau publicat o postare reală. Limitele privind URL-ul video, joburile vechi, rolloutul coordonat și probele externe din etapa precedentă rămân aplicabile. Planul integral rămâne deschis, iar lotul nu este publicat în producție.

Validări trecute: 979/979 teste în 102 fișiere (Jarvis, comunicări și TikTok), incluzând cele 134 de scenarii deterministe existente; ESLint, contractele generate, manifestul de paritate și proba Chromium. Sunt 9 cazuri noi în suitele de pregătire și programare. Testele tranzacționale ale acestui lot folosesc stocare simulată; emulatorul nu a fost rerulat.

Build-ul final a trecut cu TypeScript și 225 pagini; rămân avertismentele locale cunoscute Jaeger, Tailwind și standalone. Nu este o dovadă de deployment.

## 7 octombrie: aprobare și programare TikTok pe emulatorul Firestore

Continuare E4, cu noua suită `tiktok-schedule.integration.test.ts`, inclusă în runnerul standard `test:jarvis:rules`. Pregătirea reviziei, previzualizarea și validarea payloadului aprobat folosesc codul real; serviciile de programare/anulare și workerul Studio folosesc tranzacții Firestore reale într-un proiect demo izolat.

Cele nouă probe acoperă două programări simultane și doi workeri simultani (o singură invocare a publisherului simulat), interdicția pornirii înainte de ora programată, modificarea textului/video-ului/contului între aprobare și programare fără scrieri, schimbarea conținutului după queue fără retry, anularea durabilă și refuzul altui autor, revocarea apartenenței și păstrarea rezultatului unui claim înlocuit atât la succes, cât și la eroarea publisherului.

Prima rulare a depășit timeoutul implicit de cinci secunde numai în proba concurentă. Limita acelui test a fost extinsă la 30 de secunde; rerularea a trecut în aproximativ zece secunde, cu aserțiunile de unicitate păstrate. Nu au fost schimbate limitele sau comportamentul runtime.

Limite: publisherul TikTok este simulat în această suită; tranzacția internă a publisherului, transferul media și confirmarea furnizorului nu sunt certificate de aceste probe. Ora este mutată în fixture doar pentru a face jobul scadent, fără a aștepta o oră. Nu s-au trimis postări reale. Etapa consolidează dovezile de integrare și nu declară închis întregul flux pilot, corpusul live sau planul integral. Nu s-a publicat un nou deployment.

Suita completă de emulator a trecut 87/87 teste în 16 fișiere. Verificarea separată TypeScript a identificat și tipări necorespunzătoare în fixtures mai vechi și o parametrizare Vitest Facebook care despacheta lista de grupuri ca argumente. Tabelul de cazuri a fost corectat să transmită lista integrală; toate cele 28 de teste Facebook au trecut după corecție. Ajustările celorlalte fixtures clarifică tipurile și verificarea prezenței statusului, fără schimbarea codului runtime.

Verificarea finală TypeScript (	sc --noEmit --incremental) și ESLint au trecut. Acest lot schimbă exclusiv testele, runnerul și documentația; buildul aplicației din etapa precedentă nu a fost rerulat.

## 7 octombrie: tranzacția publisherului TikTok verificată direct

Continuare E3/E4. Tranzacția care trece draftul în `publishing` a fost extrasă în `claimTikTokPublication`, reutilizată de serviciul real de publicare. Nu există un executor paralel. Pe lângă verificările existente de conținut, acord, programare și claim, tranzacția citește acum utilizatorul și confirmă că autorul încă aparține agenției draftului. ID-ul returnat provine din referința documentului, nu dintr-un câmp modificabil.

Suita Firestore reală testează direct această tranzacție: două încercări simultane au un singur câștigător; schimbarea conținutului, ownerului, expirarea lease-ului, revocarea apartenenței, anularea jobului sau retragerea acordului păstrează draftul în starea inițială. Trimiterea manuală nu poate ocoli programarea activă, iar după anulare poate porni o singură dată. Sunt opt probe noi, adăugate celor nouă ale schedulerului.

Validări trecute: **95/95 teste pe emulator în 16 fișiere**, **157/157 teste în 17 fișiere** din TikTok și verificarea rezultatelor planului, TypeScript separat și ESLint. Ultima suită generală de 979 de teste rămâne dovada etapei precedente, nu o rerulare a acestui lot. Testele directe nu apelează publisherul extern; ele verifică tranzacția reală înaintea solicitărilor de media/provider. Transferul video, confirmarea publicării, webhookurile și schimbările survenite după pornirea autorizată rămân în afara acestei probe.

Compatibilitate: publicarea este refuzată dacă documentul autorului lipsește, acesta a schimbat agenția sau draftul nu mai corespunde agenției; nu se reconstruiesc automat permisiunile din job. Planul integral și acceptanța furnizorilor rămân deschise. Lotul nu este publicat în producție.
Buildul final a trecut cu TypeScript și 225 pagini; avertismentele locale Jaeger/standalone sunt cele cunoscute. Nu s-a efectuat deployment.
