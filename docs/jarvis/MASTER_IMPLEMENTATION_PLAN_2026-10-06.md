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
