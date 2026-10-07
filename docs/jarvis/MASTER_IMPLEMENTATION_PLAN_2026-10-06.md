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
- Conform deciziei utilizatorului din 7 octombrie, toate agențiile sunt din România: folosește exclusiv Europe/Bucharest, cu schimbările DST, fără alegere de fus per utilizator sau agenție. Păstrează UTC ca reprezentare a instantelor și interpretarea locală originală.

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

## 7 octombrie: recuperarea randărilor fără a confunda versiunile

Continuare E3/E4. Recuperarea unui job de render expirat nu mai folosește doar statusul `ready` al proiectului. Confirmarea cere același autor, agenție, versiune, proiect și asset video ready cu URL HTTPS. Un asset lipsă sau al altei versiuni nu confirmă jobul. Proiectele mai noi, proiectele șterse și cele ready care necesită verificarea assetului nu sunt suprascrise. Un proiect încă nefinalizat poate fi marcat error numai dacă aparține aceleiași versiuni și aceluiași autor.

Aceeași limitare de versiune/autor este aplicată erorii venite de la renderer după ce proiectul a fost modificat. La recuperarea unui job de publicare expirat, jobul rămâne failed și nu este retrimis, dar draftul este păstrat dacă are ID de provider, status processing/published sau a fost modificat față de revizia programată. Rezultatul de business și execuția schedulerului rămân distincte; această recuperare nu certifică publicarea la TikTok.

Suita pe Firestore real adaugă 11 cazuri: rezultat valid, proiect mai nou, asset lipsă, versiune/autor greșit al assetului, proiect șters, render nefinalizat, publicare published/processing, lease încă activ și eroarea unui renderer vechi după actualizarea proiectului. Nu există apeluri externe sau retry automat. Verificarea URL-ului și a metadatelor din CRM nu reprezintă o verificare a octeților ori a disponibilității fișierului video.

Planul integral și probele externe rămân deschise. Lotul nu este publicat în producție.
Validări finale: 106/106 teste pe emulator în 16 fișiere, 157/157 teste TikTok și rezultate ale planului în 17 fișiere, ESLint. Verificarea TypeScript separată a trecut înaintea ultimei restricții de versiune; buildul final verifică și forma finală. Nu au fost rerulate toate cele 979 de teste generale.
Buildul final a trecut, inclusiv TypeScript și 225 pagini. Rămân avertismentele locale cunoscute Jaeger/standalone; nu s-a efectuat deployment.

## 7 octombrie: dovada programării TikTok după pornirea workerului

Continuare E3/E4. Verificarea rezultatului programării nu mai cere exclusiv un job queued. Același draft, autor, agenție, revizie de conținut și moment UTC confirmă programarea și când jobul rulează sau este completed, cu stările corespunzătoare ale draftului. Este acoperit și răspunsul de status TikTok care marchează draftul sent/published înainte ca workerul să închidă jobul. Rezultatul explică separat că programarea confirmată nu reprezintă o confirmare a publicării; nu execută apeluri de publicare și nu declanșează retry.

Verificatorul refuză ore invalide ori diferite, conținut schimbat, alt autor/agenție/draft, revizie lipsă sau diferită și stări incoerente. Joburile failed/canceled nu sunt confirmate prin simpla prezență a unui ID de provider și nu determină o afirmație despre succesul ori eșecul publicării externe. Planurile legacy fără expectedDraftRevision rămân citibile, dar cer în continuare revizia jobului egală cu cea a draftului actual.

Validări: prima rulare a regresiilor TikTok și rezultate ale planului a trecut 187/187 teste în 18 fișiere. După adăugarea celor două cazuri pentru răspunsul providerului înaintea închiderii jobului, suitele modificate au trecut 43/43 teste (32 ale verificatorului și 11 ale citirii rezultatului). ESLint a trecut pe forma finală. Acestea sunt probe deterministe, nu scenarii noi certificate din corpusul original de 1000. Nu au fost rerulate emulatorul sau toate testele generale; nu au fost schimbate tranzacțiile de scriere.

Planul integral, probele externe și restul corpusului rămân deschise. Acest lot nu este publicat în producție.
TypeScript separat și buildul final au trecut pe forma finală, cu 225 de pagini generate. Rămân avertismentele locale cunoscute Jaeger și copierea browserului standalone.

## 7 octombrie: recuperarea verificărilor durabile după întreruperi

Continuare E3. Joburile de verificare foloseau același contor `attempts` pentru verificările periodice normale și recuperarea după un worker întrerupt. După două citiri normale, o întrerupere ulterioară oprea definitiv urmărirea rezultatului, chiar dacă termenul de verificare nu expirase.

Recuperarea recitește tranzacțional jobul și lease-ul curent. Pentru joburile de verificare, limita este acum de două recuperări după întreruperi, prin contorul separat `recoveryAttempts`; pollingul obișnuit nu consumă această limită. Termenul inițial nu se prelungește. Termenul expirat/invalid sau limita epuizată opresc jobul cu rezultatul BLOCKED și un mesaj explicit de verificare manuală, fără a declara succesul ori eșecul efectului extern. Politica planurilor care execută mutații rămâne fără reluare automată după întrerupere. Apartenența și rolul sunt reverificate înaintea noului claim.

Verificatorul de rezultat tratează și termenele nefinite ca expirate, inclusiv dacă o modificare concurentă a planului împiedică salvarea rezultatului. O astfel de valoare nu mai poate produce reprogramări nelimitate.

Probe adăugate: recuperare după 80 de verificări, limită epuizată sau invalidă, termen expirat/invalid, lease reînnoit și job deja încheiat; pe Firestore real emulat, doi workeri concurenți, două recuperări urmate de oprire și acces revocat înainte de claim. Aceste probe nu sunt cazuri noi certificate din corpusul original și nu apelează furnizori externi. Planul integral și acceptanța externă rămân deschise; lotul nu este publicat în producție.

Validări trecute: 109/109 teste pe emulator în 16 fișiere; regresia generală Jarvis, Communications și TikTok, 1026/1026 teste în 103 fișiere; TypeScript separat și ESLint. Suitele de unitate includ 15 cazuri noi, iar emulatorul trei cazuri noi de recuperare a verificărilor. Numărul de teste nu reprezintă numărul scenariilor originale acceptate.
Buildul final a trecut, inclusiv TypeScript și 225 de pagini. Avertismentele Jaeger/standalone sunt cele cunoscute; nu s-a efectuat deployment.

## 7 octombrie: import media verificat înaintea continuării planului

Continuare E3/E4. Verificarea importului TikTok Studio cere acum autorul și agenția corecte, aceeași proprietate, tipul și URL-ul solicitate, un URL HTTPS fără credențiale și status ready. Anterior, existența materialului și proprietatea puteau confirma importul chiar dacă sursa ori starea se schimbaseră. Un material diferit sau nefinalizat blochează continuarea înainte de pregătirea draftului; un import sincron inconsistent nu declanșează polling automat. ID-ul verificat este păstrat separat de răspunsul inițial. Un ID din răspuns care diferă de cel verificat oprește rezolvarea dependenței, fără substituție tacită.

Suita nouă `media-pipeline.integration.test.ts`, inclusă în runnerul emulatorului, folosește planul, sesiunea, approvals, rezultatele și checkpointurile salvate în Firestore real emulat. Verifică așteptarea randării, reluarea fără reexecutarea primilor pași, transferul URL-ului și ID-ului verificate către import și draft, precum și oprirea când URL-ul sau statusul materialului se schimbă după checkpoint. Serviciile de generare/import/draft sunt simulate în această suită; nu certifică transferuri la furnizori, disponibilitatea octeților la URL sau publicarea. Identitatea URL-ului nu reprezintă un hash al conținutului video.

Validări: 33/33 teste țintite; 112/112 teste pe emulator în 17 fișiere; TypeScript separat și ESLint pe forma finală. Au fost adăugate 15 cazuri de unitate și trei probe de integrare; acestea nu reprezintă scenarii originale noi acceptate din corpusul de 1000. Planul integral și validarea externă rămân deschise. Nu s-a efectuat deployment.
Regresia generală Jarvis, Communications și TikTok a trecut 1041/1041 teste în 103 fișiere.
Buildul final a trecut cu TypeScript și 225 de pagini. Avertismentele locale Jaeger/standalone rămân cele cunoscute; nu s-a efectuat deployment.

## 7 octombrie: draft TikTok legat de sursa și conținutul verificat

Continuare E3/E4. Confirmarea pregătirii unui draft TikTok nu mai folosește exclusiv statusul draft/ready. Verificatorul recitește draftul și sursa autorizată, verifică agenția și autorul, ID-ul materialului sau proprietății, URL-ul HTTPS fără credențiale, proprietarul materialului Studio, statusul ready al sursei, descrierea și profilul țintă nenule. Câmpurile explicite de descriere, vizibilitate, opțiuni de publicare și acord sunt confruntate cu cererea. Pentru răspunsurile normale ale handlerului, snapshotul draftului este comparat prin revizia comună a conținutului, astfel încât modificările ulterioare de text, hashtags, profil sau opțiuni să nu fie prezentate drept rezultatul inițial.

Compatibilitate: un receipt legacy fără snapshot poate confirma numai sursa curentă și câmpurile explicite verificate; nu reconstruiește textul generat inițial. Materialele cu proprietar lipsă nu sunt confirmate. O cerere cu assetId opțional gol păstrează ruta existentă prin propertyId. Confirmarea pregătirii nu confirmă programarea sau publicarea și nu execută efecte externe. Verificarea metadatelor/URL-ului nu dovedește imutabilitatea octeților video ori acceptanța furnizorului.

Au fost adăugate 29 de teste de unitate ale verificatorului și trei probe Firestore pentru modificarea descrierii, materialului sau URL-ului după încheierea execuției. Suitele țintite au trecut 56/56 teste, iar emulatorul 115/115 teste în 17 fișiere. Nu sunt scenarii originale noi acceptate din corpusul de 1000. Planul integral și validarea externă rămân deschise; lotul nu este publicat în producție.
Regresia generală a trecut 1070/1070 teste în 104 fișiere; TypeScript separat și ESLint au trecut pe forma finală.
Buildul final a trecut, inclusiv TypeScript și 225 de pagini. Rămân avertismentele locale cunoscute Jaeger/standalone; nu s-a efectuat deployment.

## 7 octombrie: recuperarea planului fără pierderea dovezilor media

Continuare E3/E4. `inspectPlan` reconstruia rezultatele din ledgerul execuției, dar elimina câmpurile `outputs` confirmate ulterior de verificatorul de domeniu. Într-un flux video → import → draft, această pierdere împiedica rezolvarea dependențelor deja executate și putea bloca recitirea rezultatului după recuperare.

Recuperarea păstrează acum URL-urile și ID-urile media numai dacă pasul, tipul acțiunii și întregul rezultat imutabil coincid cu ledgerul recuperat. Dovezile duplicate, invalide ori legate de un rezultat diferit opresc reconcilierea fără rescrierea planului. Dovezile lipsă nu sunt inventate, iar acțiunile nu sunt executate din nou. Salvarea recuperării verifică și revizia Firestore a planului, nu doar statusul și startedAt; o modificare concurentă care lasă statusul neschimbat este păstrată.

Șase cazuri noi de unitate verifică păstrarea dovezii, independența de ordinea cheilor JSON, rezultate lipsă/diferite, pas sau tip diferit, duplicate și URL invalid. Trei probe noi pe Firestore emulat verifică recuperarea întregului flux cu dovezile intacte, refuzul unui ledger diferit și refuzul suprascrierii unei modificări concurente. Acestea folosesc provideri simulați și nu extind numărul scenariilor originale acceptate. Planul integral și acceptanța externă rămân deschise; nu s-a efectuat deployment.
Validări trecute: 30/30 teste țintite, 118/118 teste pe emulator în 17 fișiere, TypeScript separat și ESLint. Prima rulare a tabelului de cazuri negative a identificat o eroare de parametrizare în test; cazurile au fost împachetate explicit pentru a transmite lista completă de receipts, apoi toate aserțiunile au trecut.
Regresia generală Jarvis, Communications și TikTok a trecut 1076/1076 teste în 104 fișiere.
Buildul final a trecut cu TypeScript și 225 de pagini. Avertismentele Jaeger/standalone sunt cele cunoscute; nu s-a efectuat deployment.

## 7 octombrie: pauza și anularea opresc verificarea periodică

Continuare E3/E4. Rezultatul unui plan paused/cancelled nu mai solicită polling automat, chiar dacă un job extern deja pornit este încă queued/running. Dovezile externe și numărul pașilor în așteptare rămân vizibile; oprirea urmăririi planului nu pretinde anularea efectului extern. Workerul are aceeași protecție și nu mai înlocuiește PAUSED/CANCELLED cu BLOCKED când termenul de verificare expiră sau este invalid. O reluare concurentă este protejată de verificarea existentă a reviziei, fără salvarea rezultatului vechi de pauză peste planul reluat.

Nouă cazuri noi de unitate verifică oprirea pollingului, păstrarea stării la termene viitoare/expirate/invalide și o reluare intervenită în timpul verificării. Cinci probe noi pe Firestore emulat folosesc comenzile reale de pauză/anulare/reluare: patru combinații stare/termen și reluarea fluxului video fără repetarea primilor doi pași. Providerii sunt simulați; nu sunt noi scenarii originale acceptate. Planul integral și validarea externă rămân deschise; nu s-a efectuat deployment.
Validări trecute: 36/36 teste țintite, 123/123 teste pe emulator în 17 fișiere, TypeScript separat și ESLint.
Regresia generală Jarvis, Communications și TikTok a trecut 1085/1085 teste în 104 fișiere.
Buildul final a trecut, inclusiv TypeScript și generarea celor 225 de pagini. Rămân avertismentele locale cunoscute Jaeger/standalone; nu s-a efectuat deployment.

## 7 octombrie: proiectul Studio verificat înainte de randare

Continuare E3/E4. Confirmarea salvării unui proiect Studio compară acum conținutul curent cu snapshotul întors de handler, în loc să verifice numai proprietatea. Sunt legate versiunea, ordinea materialelor sursă, scenariul, vocea, formatul, storyboardul/timeline-ul, subtitrările, brandingul și celelalte opțiuni creative persistate. Proprietatea, ID-ul explicit al proiectului, versiunea așteptată, lista normalizată de surse și scenariul sunt confruntate și cu cererea rezolvată. Controalele existente de autor și agenție rămân obligatorii.

Statusul de randare, lease-urile, timestamps și ID-urile materialelor produse nu invalidează salvarea conținutului neschimbat. Confirmarea salvării nu confirmă randarea: inclusiv o eroare ulterioară de randare este raportată separat. Un receipt legacy fără snapshot complet nu poate confirma conținutul istoric și cere reconciliere, fără relansarea salvării sau randării. Compararea folosește aceeași filtrare a câmpurilor sensibile ca receipt-ul; nu verifică imutabilitatea octeților fotografiilor externe.

Au trecut 27 de teste noi ale verificatorului și patru probe noi cu plan persistent pe Firestore emulat: continuare validă, fotografii reordonate, scenariu schimbat și versiune schimbată. Pentru cele trei modificări, executorul nu invocă randarea și nu repetă salvarea. Furnizorii sunt simulați; acestea nu măresc numărul scenariilor originale acceptate din corpus.

Validări trecute: 47/47 teste țintite, 127/127 teste pe emulator în 17 fișiere, 1112/1112 teste de regresie în 105 fișiere, TypeScript separat și ESLint. Planul integral și validarea externă rămân deschise; lotul nu este publicat în producție.
Buildul complet a trecut cu 225 de pagini. Avertismentele Jaeger/standalone sunt cele cunoscute; nu s-a efectuat deployment.

## 7 octombrie: revocarea accesului în timpul recuperării

Continuare E3/E4. `inspectPlan` recitește acum apartenența la agenție și rolul înainte de citirea planului, inclusiv pentru răspunsurile fără mutație. La salvarea reconcilierii, tranzacția citește din nou utilizatorul și proprietarul planului, alături de verificarea existentă a reviziei. Schimbarea agenției sau rolului ori ștergerea utilizatorului între citire și salvare produce 403 fără rescrierea rezultatelor și fără repetarea acțiunilor. Modificarea câmpurilor de profil care nu afectează accesul permite recuperarea.

Trei teste noi de unitate verifică refuzul unui context cu apartenență veche pentru planuri running/unknown/completed. Patru probe noi pe Firestore emulat modifică utilizatorul după citirea ledgerelor și înaintea tranzacției finale: agenție, rol, ștergere și nume. Cazurile de revocare compară întregul document al planului înainte/după, iar toate probele verifică absența relansării acțiunilor.

Validări trecute: 24/24 teste țintite, 131/131 teste pe emulator în 17 fișiere, TypeScript și ESLint. Sunt probe cu furnizori simulați, nu scenarii originale noi acceptate. Planul integral și validarea externă rămân deschise; nu s-a efectuat deployment.
Regresia generală a trecut 1115/1115 teste în 105 fișiere. Pentru acest lot de autorizare server nu s-a repetat buildul complet; ultimul build complet validat aparține lotului anterior.

## 7 octombrie: publicarea loturilor validate

La cererea explicită a utilizatorului au fost publicate toate modificările comise până la `7f2da840a9f1b22dbd6219702e69695ac8c17919`, față de vechea producție `3a89e025e902101d7653e508ce355490df8b7855`. Buildul App Hosting `build-2026-10-07-001` este READY și primește 100% din trafic; Cloud Run raportează RoutesReady și ConfigurationsReady. Dovada, verificată la 2026-10-07T05:35:05.553Z, este în `MASTER_PRODUCTION.json`. Jev rămâne shadow, cu secretul legat; valorile secretelor nu au fost afișate.

Înainte de lansare au trecut buildul complet cu 225 de pagini și verificarea manifestului. Cele 21 de probe UI au trecut cu date simulate. Baseline-ul lansat are 1115 de teste de regresie și 131 pe emulator trecute. După lansare, pagina Jarvis a răspuns 200 și cele șase probe API neautentificate au răspuns 401. Două probe GET inițiale au întors 405 deoarece endpointurile acceptă POST; probele au fost corectate la metoda reală și au confirmat refuzul înainte de execuție. Nu au fost trimise mesaje sau publicări externe de test. Metadatele istorice de infrastructură din raportul de paritate păstrează separat data verificării lor anterioare.

## 7 octombrie: versiunea aprobată la pornirea randării Studio

Continuare locală ulterioară lansării de mai sus. Planurile noi pentru proiecte existente fixează versiunea citită autorizat înainte de aprobare. Planurile vechi fără versiune sunt refuzate și cer pregătire nouă. Pentru un proiect creat într-un pas anterior, dependența leagă versiunea numai din snapshotul rezultatului salvării, cu ID identic, fără modificarea payloadului aprobat. Lipsa snapshotului sau conflictul cu o versiune explicită opresc continuarea.

Endpointul de randare transmite acum `expectedVersion` serviciului comun de coadă. Tranzacția verifică versiunea înainte de deduplicare sau scriere: o modificare produce 409 și nu creează job, nu modifică proiectul și nu invocă providerul. Valorile invalide produc 400. Compatibilitatea endpointului manual fără acest câmp este păstrată; noua cerință este obligatorie în aprobările Jarvis. Contractul generat include noul câmp. Validarea versiunii presupune incrementarea acesteia prin serviciul existent de salvare; nu certifică imutabilitatea fotografiilor externe.

Au fost adăugate 24 de teste de unitate pentru legarea versiunii, validarea aprobării, dependențe, coadă și endpoint, plus două probe Firestore pentru aprobare → modificare → refuz și pentru deduplicarea simultană a versiunii aprobate. Cele 72 de teste țintite au trecut. Prima regresie generală a identificat un fixture vechi al adapterului fără versiunea întoarsă de serviciul real; fixture-ul și aserțiunea au fost actualizate, apoi regresia completă a trecut 1139/1139 teste în 106 fișiere. Emulatorul a trecut 133/133 teste în 17 fișiere; TypeScript, ESLint și manifestul au trecut. Acestea nu sunt scenarii originale noi acceptate din corpus. Continuarea de după lansare nu este încă în producție; planul integral rămâne deschis.
Buildul complet al continuării a trecut, inclusiv 225 de pagini; rămân avertismentele cunoscute Jaeger, Tailwind și copiere standalone Playwright. Producția verificată rămâne commitul `7f2da840`, anterior acestei continuări.

## 7 octombrie: dovezi coerente pentru rezultatul randării Studio

Continuare E3/E4. Verificarea rezultatului confruntă versiunea jobului cu `expectedVersion` aprobată, inclusiv când jobul este încă queued/running. Un job pentru altă versiune nu mai poate satisface pasul și nu declanșează polling. Pentru un job completed, materialul trebuie să fie video ready al aceluiași proiect, aceleiași proprietăți și versiuni, cu agenția și autorul corecte. URL-ul este analizat ca URL HTTPS, fără username/parolă; simplul prefix `https://` nu mai constituie dovadă suficientă.

Regula pentru material este comună verificatorului Jarvis și recuperării joburilor întrerupte. Recuperarea nu marchează completed un job cu material pentru altă proprietate sau URL invalid și păstrează proiectul ready pentru investigație. Nu reexecută randarea sau publicarea. Proiectele legacy fără versiune explicită rămân compatibile cu versiunea implicită 1, dar jobul și materialul trebuie să aibă versiune numerică pozitivă. Lipsa proprietății materialului nu poate fi confirmată. Această verificare privește metadatele persistate; nu descarcă și nu certifică octeții ori disponibilitatea de rețea a materialului.

Au fost adăugate 25 de teste ale regulii comune, șase probe ale rezultatului Jarvis și trei cazuri de recuperare pe Firestore emulat. Cele 51 de teste țintite, TypeScript și ESLint au trecut. Prima rulare țintită a identificat un callback de test fără async; corectarea testului a permis executarea tuturor aserțiunilor. Nu sunt scenarii originale noi acceptate din corpus. Lotul nu este publicat în producție; planul integral rămâne deschis.
Regresia generală a trecut 1170/1170 teste în 107 fișiere, iar emulatorul 136/136 în 17 fișiere. Pentru acest lot de verificare server nu s-a repetat buildul complet; ultimul build complet validat este cel al lotului anterior. Producția rămâne `7f2da840`.

## 7 octombrie: confirmarea video-ului proprietății înainte de import

Continuare E3/E4. Pentru `video_create`, starea generică succeeded nu mai este suficientă: jobul recitit trebuie să aibă ID-ul cerut, proprietatea, agenția și autorul execuției, plus starea completed. URL-ul este validat cu aceeași schemă folosită la legarea rezultatului pentru import: HTTPS, fără credențiale și maximum 8000 de caractere. Un rezultat necorespunzător nu expune videoUrl, cere verificarea materialului și nu pornește polling ori o randare nouă. Joburile legacy fără autor nu sunt confirmate automat.

Testul pentru URL-ul `https://` a expus o excepție din rafinarea Zod, care putea transforma un rezultat invalid într-o presupusă eroare temporară de citire. Rafinarea tratează acum explicit eșecul parsării; aceeași regulă se aplică observării și legării rezultatului. Verificarea privește receipt-ul și metadatele jobului, fără descărcarea sau certificarea octeților video.

Au fost adăugate 12 cazuri de rezultat (identitate, autor lipsă, stare nefinală, URL invalid/cu credențiale/prea lung și succes verificat) și patru probe Firestore ale fluxului video → import → draft. Probele verifică oprirea după cei doi pași deja executați, absența materialelor/drafturilor noi și lipsa relansării providerului. Cele 56 de teste țintite, TypeScript și ESLint au trecut. Nu sunt scenarii originale noi acceptate. Lotul nu este publicat; planul integral rămâne deschis.
Regresia generală a trecut 1182/1182 teste în 107 fișiere; emulatorul a trecut 140/140 în 17 fișiere. Buildul complet nu a fost repetat pentru acest lot de validare server. Producția verificată rămâne `7f2da840`.

## 7 octombrie: pauza și anularea în timpul ultimului pas

Închiderea execuției recitește acum planul într-o tranzacție Firestore comună cu scrierea stării, telemetriei și mesajului final. O cerere de pauză sau anulare primită în timpul ultimului pas nu mai este suprascrisă cu completed. Anularea are prioritate dacă sunt prezente ambele cereri. Rezultatele acțiunilor deja executate rămân salvate; oprirea planului nu anulează efectele lor externe. Mesajul de finalizare este creat numai pentru completed. Reluarea explicită după pauză închide planul din rezultatele existente, fără repetarea acțiunilor.

Au fost adăugate trei teste de unitate și trei probe pe Firestore emulat pentru pauză, anulare și ambele cereri în ultimul pas. Fluxul video → import → draft verifică păstrarea tuturor celor patru rezultate, un singur draft, absența mesajului de finalizare la oprire și reluarea fără dublare. Au trecut 18/18 teste țintite, 1185/1185 teste de regresie în 107 fișiere și 143/143 pe emulator în 17 fișiere, plus TypeScript și ESLint. Probele folosesc furnizori simulați și nu adaugă scenarii originale acceptate din corpus. Buildul complet nu a fost repetat pentru această modificare server. Lotul nu este publicat; producția verificată rămâne `7f2da840`, iar planul integral rămâne deschis.

## 7 octombrie: oprirea în timpul verificării dependențelor

Continuare E1/E3/E4. Pornirea fiecărui pas este serializată cu cererile de control printr-o tranzacție care recitește starea și cererile de oprire. Verificarea rezultatului anterior poate dura; o pauză sau anulare acceptată în acest interval oprește acum execuția înaintea următoarei acțiuni. Tranzacția scrie `lastStartedStep` pentru pasul admis. Cererile ulterioare acestui punct opresc după pasul deja pornit și nu promit anularea efectului său extern.

Aceeași regulă se aplică trecerii în așteptare, rezultatului incert și checkpointului de lot. Anularea are prioritate față de pauză; oprirea șterge temporizarea waitUntil. Rezultatele deja salvate sunt păstrate. Nouă teste de unitate și nouă probe Firestore acoperă pauză/anulare/ambele în timpul unei verificări ready/waiting/unknown. Fluxul media demonstrează absența importului și draftului după oprire, apoi continuarea explicită după pauză fără repetarea generării video.

Au trecut 27/27 teste țintite, 1194/1194 teste de regresie în 107 fișiere, 152/152 teste pe emulator în 17 fișiere, TypeScript, ESLint și verificarea manifestului (180 operații, 40 acțiuni native, 46 fișiere UI). Probele sunt sintetice și nu se adaugă corpusului original acceptat. Lotul nu este publicat; planul integral rămâne deschis.
Buildul complet cumulativ a trecut, inclusiv verificarea TypeScript și generarea celor 225 de pagini. Au rămas avertismentele cunoscute pentru exporterul opțional Jaeger și absența folderului standalone Playwright la copiere. Producția verificată rămâne `7f2da840`.

## 7 octombrie: cererile de oprire la recuperarea execuției

Recuperarea unui plan întrerupt respectă acum pauza sau anularea deja cerută atunci când receipt-urile permit stabilirea rezultatului execuției. Nu mai înlocuiește oprirea cu completed ori failed. Anularea are prioritate față de pauză, iar rezultatele confirmate și legăturile media verificate sunt păstrate. O pauză recuperată poate fi reluată explicit fără repetarea pașilor confirmați.

Efectele cu rezultat incert păstrează starea unknown și cer reconciliere, inclusiv în prezența unei cereri de oprire. Aceasta evită transformarea unei acțiuni externe incerte într-un plan paused care ar putea fi reluat. Cererile rămân salvate pentru verificarea ulterioară; oprirea nu certifică anularea unui efect extern. Verificarea reviziei Firestore refuză rezultatul recuperării dacă o cerere nouă apare între citire și tranzacția finală.

Nouă teste de unitate acoperă cererile pause/cancel/ambele cu receipt completed/lipsă/unknown. Nouă probe Firestore verifică păstrarea rezultatelor media, refuzul reluării incerte, continuarea fără duplicare și cererile concurente. Au trecut 36/36 teste țintite, 1203/1203 teste de regresie în 107 fișiere, 161/161 pe emulator în 17 fișiere, TypeScript și ESLint. Probele folosesc date și provideri simulați; nu sunt scenarii originale noi acceptate. Buildul complet nu a fost repetat pentru această modificare server; ultimul build complet validat este `b4215e42`. Lotul nu este publicat, producția verificată rămâne `7f2da840`, iar planul integral rămâne deschis.

## 7 octombrie: cererile de oprire la tratarea erorilor

Tratarea erorilor de execuție recitește planul într-o tranzacție. Pentru eșecurile interne păstrează pauza sau anularea cerută, cu prioritate pentru anulare. Efectele externe incerte păstrează unknown și cer verificare înainte de reluare. Dacă planul nu mai este running, eroarea întârziată returnează starea curentă fără să suprascrie rezultatele ori starea salvată de control/recuperare. Telemetria erorii este scrisă în aceeași tranzacție cu planul.

Nouă teste de unitate verifică oprirea după erori interne/externe și păstrarea stărilor paused/cancelled/completed mai noi. Șase probe Firestore verifică absența pașilor media ulteriori și refuzul reluării unui rezultat extern incert. Au trecut 45/45 teste țintite, 1212/1212 teste de regresie în 107 fișiere, TypeScript și ESLint.

Prima rulare pe emulator a trecut 166/167 probe: testul existent de programări simultane independente a primit un refuz fără motiv în aserțiune. Jurnalul emulatorului conținea expirări de blocări tranzacționale, fără atribuirea certă a acestora acelui refuz. Aserțiunea afișează acum motivul fiecărei respingeri; logica de calendar nu a fost modificată. Repetarea completă a trecut 167/167 probe în 17 fișiere. Eșecul intermitent rămâne documentat, nu este declarat remediat prin simpla repetare. Nu sunt scenarii originale noi acceptate din corpus. Buildul complet nu a fost repetat; ultimul validat rămâne `b4215e42`. Lotul nu este publicat, producția verificată rămâne `7f2da840`, iar planul integral rămâne deschis.

## 7 octombrie: separarea execuțiilor succesive ale aceluiași plan

Fiecare pornire primește un executionId nou, salvat atomic la preluarea planului. Tranzițiile, salvarea rezultatelor și dependențelor verificate, finalizarea și tratarea erorilor verifică identitatea execuției. Un răspuns întârziat dintr-o execuție înlocuită nu poate suprascrie progresul unei reluări running și nu poate porni pasul următor. Salvarea rezultatului final verifică aceeași identitate și starea completed. Rezultatele pasului în curs se păstrează în continuare când aceeași execuție primește o cerere de oprire. Identificatorul nu schimbă cheile de idempotency ale acțiunilor și nu anulează apelurile externe deja pornite; ledgerul existent rămâne sursa recuperării.

Trei teste de unitate acoperă răspunsul, eroarea și verificarea întârziate după preluare. Două probe Firestore suprapun explicit o execuție veche cu recuperarea și reluarea reală a planului: noua execuție rămâne nemodificată la revenirea celei vechi, apoi finalizează un singur draft, cu patru acțiuni totale. Au trecut 48/48 teste țintite, 169/169 teste pe emulator în 17 fișiere, TypeScript și ESLint.

Prima regresie generală a avut șase eșecuri în planner.test.ts, începând cu depășirea limitei de 5000 ms. Fișierul a trecut separat 19/19, apoi întreaga regresie a trecut 1215/1215 în 107 fișiere, fără alte verificări concurente și fără schimbarea codului sau a timeoutului testelor. Episodul intermitent este documentat, fără o cauză declarată certă. Probele nu adaugă scenarii originale acceptate din corpus. Buildul complet nu a fost repetat; ultimul validat rămâne `b4215e42`. Lotul nu este publicat, producția verificată rămâne `7f2da840`, iar planul integral rămâne deschis.

## 7 octombrie: revizia planului la preluare și citirile calendarului

Preluarea unui plan verifică acum în tranzacție că revizia Firestore este aceeași cu cea citită și autorizată inițial. Dacă între citire și preluare sunt salvate rezultate, altă aprobare sau o așteptare nouă, cererea primește 409 înaintea scrierii stării running și înaintea oricărei acțiuni. Se aplică și anulării directe a unui plan pending. Reîncărcarea permite continuarea din rezultatele curente, fără repetarea pasului deja salvat. Au fost adăugate patru teste de unitate și patru probe Firestore, inclusiv un checkpoint creat de o execuție concurentă reală și reluarea ulterioară fără duplicarea draftului.

Eșecul intermitent al programărilor s-a reprodus cu diagnosticul exact `3 INVALID_ARGUMENT: Transaction is invalid or closed.` Citirile lock/tasks/viewings din calendar sunt acum secvențiale în aceeași tranzacție, pentru a nu lăsa interogări concurente în zbor când o citire respinsă închide tranzacția. Lockul și regulile de suprapunere sunt păstrate. Testul existent verifică trei runde de programări concurente, fiecare cu un client comun refuzat și două programări independente acceptate; limita sa totală este 60 secunde pentru cele trei runde, în loc de 20 pentru una. Toate rundele au trecut după schimbare. Acest rezultat validează proba extinsă, fără să certifice absența oricărei erori tranzitorii a emulatorului sau providerului.

Au trecut 52/52 teste țintite și 173/173 probe pe emulator în 17 fișiere după corecția calendarului. Regresia generală a identificat nouă teste cu un fixture Firestore fără updateTime; fixture-ul a fost completat cu metadatele de revizie furnizate de baza reală, apoi au trecut 9/9 probe țintite și 1219/1219 teste generale în 107 fișiere. TypeScript și ESLint au trecut. Nu sunt scenarii originale noi acceptate din corpus. Buildul complet nu a fost repetat; ultimul validat rămâne `b4215e42`. Lotul nu este publicat, producția verificată rămâne `7f2da840`, iar planul integral rămâne deschis.

## 7 octombrie: anularea concurentă cu un checkpoint

O cerere de anulare citită inițial pe un plan running tratează acum starea recitită în tranzacție. Dacă execuția a trecut între timp în pending/failed/paused, planul devine cancelled cu rezultatele păstrate și waitUntil șters. Dacă rămâne running, se salvează cererea de oprire pentru pasul în curs. Pentru unknown se păstrează incertitudinea și cererea de oprire, fără autorizarea unei reluări. Stările completed/cancelled existente sunt returnate fără a pretinde că s-a solicitat o oprire nouă. Apartenența și rolul utilizatorului se verifică în aceeași tranzacție. Oprirea nu anulează efectele externe deja pornite.

Opt teste de unitate și opt probe Firestore acoperă cele șapte stări posibile și revocarea drepturilor între citire și tranzacție. Probele verifică păstrarea rezultatelor, absența acțiunilor și a drafturilor noi și refuzul reluării incerte. Acestea sunt probe sintetice, nu scenarii originale noi acceptate din corpus.

Au trecut 60/60 teste țintite, 181/181 teste pe emulator în 17 fișiere, 1227/1227 teste de regresie în 107 fișiere, TypeScript și ESLint. Testul calendarului cu trei runde concurente a trecut din nou. Emulatorul a emis un avertisment de timeout la căutarea metadatelor de mediu, fără eșecuri ale probelor. Buildul complet nu a fost repetat; ultimul validat rămâne `b4215e42`. Lotul nu este publicat, producția verificată rămâne `7f2da840`, iar planul integral rămâne deschis.

## 7 octombrie: anularea planurilor expirate și autorizarea preluării

Expirarea planului împiedică execuția, dar nu mai împiedică anularea unui plan pending/failed/paused. Anularea nu cere reînnoirea aprobării, păstrează rezultatele și startedAt existent, salvează completedAt/cancelRequestedAt și șterge waitUntil. Răspunsul include aceleași metadate ca documentul salvat. Verificarea reviziei rămâne obligatorie, astfel încât o cerere bazată pe un plan modificat concurent cere reîncărcare.

Tranzacția de preluare recitește acum și utilizatorul, atât pentru pornire cât și pentru anulare: schimbarea agenției, rolului ori ștergerea profilului refuză operația înainte de modificarea planului. Șapte teste de unitate acoperă anularea expirată, refuzul execuției expirate și rolul schimbat. Nouă probe Firestore verifică păstrarea rezultatelor și cele trei modificări concurente de acces pe ambele căi. Probele sunt sintetice și nu se adaugă corpusului original acceptat.

Au trecut 76/76 teste țintite (recuperare și flux asincron), 190/190 teste pe emulator în 17 fișiere, 1234/1234 teste de regresie în 107 fișiere, TypeScript și ESLint. Buildul complet nu a fost repetat; ultimul validat rămâne `b4215e42`. Lotul nu este publicat, producția verificată rămâne `7f2da840`, iar planul integral rămâne deschis.

## 7 octombrie: aprobarea verificată înaintea fiecărui pas nou

Tranzacția care marchează pornirea fiecărui pas verifică acum expirarea planului și aprobarea, atât din snapshotul execuției cât și din documentul curent. Verifică și că acțiunile curente corespund celor aprobate. Expirarea sau modificarea neautorizată oprește planul în failed înaintea următoarei acțiuni, păstrând rezultatele deja salvate și numărul ultimului pas pornit. Cererile de pauză/anulare au prioritate. Expirarea în timpul ultimului pas nu împiedică salvarea rezultatului și finalizarea acestuia; protecția controlează pornirea acțiunilor noi și nu anulează apelurile deja lansate.

Șase teste de unitate acoperă expirarea ceasului, expirarea planului/aprobării, înlocuirea identității aprobării și modificarea acțiunilor. Patru probe Firestore verifică aceleași modificări între scenariu și generarea video: un singur rezultat păstrat, fără apeluri video, assets sau drafturi noi. Acestea sunt probe sintetice, nu scenarii originale noi acceptate din corpus.

Au trecut 82/82 teste țintite, 1240/1240 teste de regresie în 107 fișiere, TypeScript și ESLint. Prima rulare pe emulator a trecut 193/194 probe, inclusiv toate cele 80 ale fluxului media. Testul existent al programărilor independente simultane a reprodus `3 INVALID_ARGUMENT: Transaction is invalid or closed.` Citirile secvențiale din lotul anterior nu au eliminat această intermitență; cauza și remedierea rămân deschise.

Repetarea completă a trecut 194/194 probe pe emulator în 17 fișiere, fără schimbări ale codului sau limitelor testului de calendar. Aceasta nu închide problema intermitentă. Buildul complet nu a fost repetat; ultimul validat rămâne `b4215e42`. Lotul nu este publicat, producția verificată rămâne `7f2da840`, iar planul integral rămâne deschis.

## 7 octombrie: reluarea limitată după invalidarea citirilor de calendar

SDK-ul Firestore instalat reia tranzacțiile cu ABORTED, dar nu recunoaște mesajul emulatorului `3 INVALID_ARGUMENT: Transaction is invalid or closed.` ca eroare tranzitorie. Cele trei citiri de calendar normalizează acum strict combinația cod 3 și acest mesaj exact în ABORTED, păstrând cauza originală. SDK-ul reia întreaga tranzacție cu limita și backofful existente; aplicația nu reia o interogare în tranzacția închisă și nu introduce o buclă suplimentară. Alte erori, commiturile și apelurile externe nu sunt interceptate. Comportamentul folosește mecanismul de [reluare a tranzacțiilor Firestore](https://firebase.google.com/docs/firestore/transaction-data-contention), cu revalidarea tuturor citirilor și a suprapunerilor.

Opt teste de unitate verifică cele trei poziții ale citirii și păstrarea celorlalte erori. Cinci probe pe Firestore injectează invalidarea după o citire reală: fiecare poziție este reluată într-o tranzacție nouă cu o singură rezervare și un singur increment de lock; invalidarea persistentă respectă maxAttempts; o suprapunere recitită este refuzată cu 409. Testele de concurență existente păstrează aceleași limite și cele trei runde. Probele sunt sintetice și nu cresc numărul de scenarii originale acceptate.

Au trecut 15/15 teste țintite, 199/199 probe pe emulator în 17 fișiere, 1248/1248 teste de regresie în 107 fișiere, TypeScript și ESLint. Jurnalul emulatorului a înregistrat din nou invalidări în runQueryStandardEdition în timpul rulării, iar cele 16 teste ale suitei calendarului au trecut. Acest lot tratează eroarea exactă de citire observată; nu pretinde eliminarea tuturor cauzelor de contention ori a erorilor la commit.

Buildul complet a trecut cu 225/225 pagini generate, incluzând toate modificările acumulate după `b4215e42`. Rămân avertismentul cunoscut pentru exportatorul opțional Jaeger și mesajul privind omiterea copierii browserului Playwright în standalone. Lotul nu este publicat; producția verificată rămâne `7f2da840`, iar planul integral rămâne deschis.

## 7 octombrie: politica Daily Brief pentru zile ratate

Workerul transmite acum momentul nextRunAt al execuției preluate către livrarea brief-ului. O execuție restantă dintr-o zi locală anterioară este consemnată cu deferred și reasonCode missed_local_day, inclusiv data programată, data curentă și timezone. Nu recuperează brief-uri vechi prin notificări ori trimiteri WhatsApp. Automatizarea continuă la următorul slot valid după momentul curent, în limita maxRuns existentă; încercarea ratată este numărată ca execuție, nu ca livrare. Zilele intermediare nu sunt parcurse sau retrimise. Rezultatul este salvat în job, copia agenției și audit.

Întârzierea în aceeași zi locală rămâne permisă după ora programată, în afara quiet hours și în zilele configurate. Un moment încă viitor este amânat; o dată fără timezone ori invalidă este refuzată. Comparația folosește timezone-ul brief-ului, nu ziua UTC. Dedupe-ul existent per agenție/utilizator/zi locală rămâne în vigoare. Apelurile fără un slot explicit păstrează comportamentul existent pentru ziua curentă.

Opt teste de livrare noi acoperă cele două canale, traversarea miezului nopții UTC/local, momentul viitor, liniștea și trei date invalide. Un test de worker verifică auditul, avansarea programării și lipsa repetării la următoarea golire a cozii. Două probe Firestore verifică aceleași efecte persistente pentru app și WhatsApp, fără notificări, artefacte sau joburi de trimitere. Probele sunt sintetice, nu scenarii originale noi acceptate din corpus.

Au trecut 28/28 teste țintite, 201/201 probe pe emulator în 17 fișiere, 1257/1257 teste de regresie în 107 fișiere, TypeScript și ESLint. Buildul complet nu a fost repetat pentru acest lot; ultimul validat este `ceaa5b51`. Modificările nu sunt publicate; producția verificată rămâne `7f2da840`. Etapa E8 și planul integral rămân deschise.

## 7 octombrie: dovada livrării Daily Brief în listă și istoric

Brief-ul WhatsApp persistă înaintea apelului cozii requestId, messageId determinist, conversația, revizia destinatarului și template-ul concret cu parametrii rezumatului. Recitirea folosește o tranzacție pentru receipt, membru, conversație, job și mesaj. Verifică actorul, agenția, accesul la conversație, destinatarul și conținutul, apoi reutilizează verificatorul Communications pentru queued/sending/accepted/delivered/read/failed/unknown. Delivered/read necesită identificator extern. Un receipt legacy fără această legătură rămâne neconfirmat; un răspuns pierdut după scrierea cozii poate fi verificat fără retrimitere.

Ruta existentă a automatizărilor adaugă deliveryEvidence la lista și istoricul cerute. Interfața afișează eticheta și explicația livrării, separat de starea automatizării. Citirea nu rescrie auditul original și nu modifică programarea, nu repetă trimiterea și nu afirmă că accepted înseamnă delivered. Pentru app verifică existența notificării actorului, cu explicația „disponibil în notificări”. Starea este recitită la încărcarea listei/istoricului; acest lot nu introduce polling de fundal sau o probă WhatsApp reală. Istoricul afișează și ziua ratată din lotul precedent.

Șaisprezece teste de livrare noi verifică stările, dovezile incompatibile, revocarea și răspunsul pierdut. Două teste ale rutei păstrează separat rezultatul inițial și dovada curentă. Șase probe Firestore verifică identitatea și starea mesajului fără scrierea receiptului ori duplicarea mesajului. Probele sunt sintetice și nu cresc numărul scenariilor originale acceptate.

Workerul păstrează receiptId și în lastResult/audit când răspunsul trimiterii este pierdut, rămânând unknown fără retry. Un test nou verifică păstrarea referinței și absența reluării. Prima rulare pe emulator a trecut 206/207 probe: aserțiunea veche de deduplicare număra orice răspuns delivered drept livrare nouă. A fost ajustată să distingă deduplicated de execuția inițială și păstrează aserțiunile pentru o singură notificare și un singur receipt. Repetarea completă a trecut 207/207 probe în 17 fișiere.

Au trecut 52/52 teste țintite, 1276/1276 teste de regresie în 108 fișiere, cele 22 verificări UI sintetice (inclusiv etichetele de livrare), ESLint și buildul complet cu TypeScript și 225/225 pagini. Captura locală `.tmp/assistant-ui/brief-delivery.png` a fost inspectată. Buildul păstrează avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. Modificările nu sunt publicate; producția verificată rămâne `7f2da840`. Etapa E8 și planul integral rămân deschise.

## 7 octombrie: destinatarul personal verificat până la trimiterea brief-ului

Brief-ul compară acum numărul normalizat din profil cu externalParticipantId, adresa efectiv folosită de provider, fără să accepte câmpul de afișare phone drept dovadă a destinației. Pregătirea leagă rolul, hashul numărului propriu asociat actorului/agenției și revizia conversației într-un personalRecipient persistat în inputul jobului. Coada recitește profilul înainte de estimare și în tranzacția de creare; workerul îl recitește înainte de estimare și din nou înaintea apelului providerului. Schimbarea numărului, rolului ori destinației oprește noua trimitere. Aceasta nu anulează apeluri externe deja pornite.

Câmpul este aditiv și este transmis de noile brief-uri WhatsApp. Mesajele generale și joburile legacy fără acest câmp păstrează controalele lor existente; acest lot nu migrează retroactiv joburi deja create. Verificarea suplimentară nu acordă permisiuni și nu elimină politicile Communications de acces, consimțământ, template, cost sau idempotency.

Opt teste de unitate verifică adresa efectivă, normalizarea, profilul lipsă/modificat și recitirea tranzacțională. Proba existentă de Daily Brief verifică și transmiterea dovezii către coadă. Șapte probe Firestore folosesc coada și workerul reale, cu provider simulat: trei modificări în timpul estimării înaintea cozii, trei modificări după creare/în timpul workerului și o trimitere unică pentru destinatarul neschimbat. Acestea sunt probe sintetice, nu scenarii originale noi acceptate din corpus.

Prima rulare pe emulator a trecut 213/214 probe; fixture-ul WhatsApp pozitiv nu avea cheia sintetică necesară semnării referinței de receipt. După completarea exclusiv a fixture-ului, au trecut 214/214 probe în 17 fișiere. Au trecut și 37/37 teste țintite, 1284/1284 teste de regresie în 109 fișiere, TypeScript și ESLint. Buildul complet nu a fost repetat; ultimul validat rămâne `7e786522`. Lotul nu este publicat, producția verificată rămâne `7f2da840`, iar E8 și planul integral rămân deschise.

## 7 octombrie: starea regulii recitită atomic înaintea notificării

Pentru efectele notify ale regulilor cu statusTo, starea entității este verificată în tranzacția care creează notificarea, după verificarea lease-ului și a accesului. Dacă starea s-a schimbat după citirea inițială, alerta este omisă cu reasonCode state_changed. Decizia se persistă per efect sub receipt, astfel încât o întrerupere înainte de finalizarea evenimentului și revenirea la starea veche să nu reactiveze alerta. Receipt-ul final păstrează rezultatul omiterii. Notificările deja create păstrează deduplicarea; regulile fără condiție de stare își păstrează comportamentul.

Patru teste unitare noi acoperă starea schimbată/lipsă, recuperarea după omitere și regulile fără statusTo. Două probe Firestore schimbă starea între citirea inițială și efect și verifică recuperarea după întrerupere fără alertă. Au trecut 9/9 teste țintite, 1288/1288 teste de regresie în 109 fișiere, 216/216 probe emulator în 17 fișiere, TypeScript, ESLint și git diff --check. Probele sunt sintetice și nu cresc numărul scenariilor originale acceptate.

Limite: lotul nu retrage notificări deja afișate și nu schimbă semantica efectelor create_task. Nu reprezintă închiderea întregii cerințe E8 privind alertele rezolvate. Buildul complet nu a fost repetat; ultimul validat rămâne 7e786522. Lotul nu este publicat; producția verificată rămâne 7f2da840. E8 și planul integral rămân deschise.

## 7 octombrie: retragerea alertelor de regulă devenite nerelevante

Noile notificări event_rule cu statusTo păstrează ruleCondition (resursă, entitate, stare), alături de automationId și sourceEventId. Ruta autentificată POST /api/notifications/reconcile acceptă cel mult 100 ID-uri și citește exclusiv inboxul actorului. Pentru fiecare notificare, tranzacția recitește membrul, notificarea și entitatea. Schimbarea stării, ștergerea entității sau revocarea accesului marchează withdrawnAt/withdrawalReason și isRead. Notificarea și legăturile de audit rămân în baza de date. Retragerile concurente se aplică o singură dată și nu se anulează când entitatea revine la vechea stare.

Pagina de notificări și clopoțelul deschis verifică alertele încărcate la montare/deschidere, la revenirea tabului în prim-plan și la fiecare 60 de secunde cât documentul este vizibil. Cererile sunt împărțite în loturi de maximum 100 și anulate la demontare. Notificările retrase sunt excluse din liste și contoare; listenerul desktop nu le afișează ca notificări noi. Erorile verificării sunt vizibile și permit reîncercarea ulterioară. Notificările legacy, cele fără condiție de stare și celelalte categorii nu sunt retrase prin presupuneri.

Au trecut 30/30 teste țintite, 1309/1309 teste de regresie în 111 fișiere și 219/219 probe emulator în 17 fișiere. Trei probe Firestore creează alerta prin executorul real, apoi schimbă/șterg entitatea sau revocă accesul și rulează două retrageri concurente. Testele API verifică autentificarea, lipsa cache-ului și JSON invalid. Scriptul jarvis-notification-ui-smoke.mjs a trecut 10 verificări de interfață cu auth/API/snapshoturi Firestore simulate, inclusiv eroare, recuperare, listă și contor. TypeScript și ESLint au trecut; avertismentul inițial de setState sincron în effect a fost eliminat. Manifestul de paritate a fost regenerat exclusiv pentru deplasarea liniilor UI și verificat: 180 operații, 40 acțiuni native, 46 fișiere UI.

Limite: reconcilierea privește alertele încărcate în interfață, nu întregul inbox într-un job de fundal. Nu poate retrage push-uri deja livrate de sistemul de operare. Nu migrează alerte legacy și nu acoperă încă toate categoriile insight_report/matching_watch ori brief-uri. Probele sunt sintetice și nu cresc acceptarea scenariilor originale. E8 și planul integral rămân deschise. Modificările nu sunt publicate; producția verificată rămâne 7f2da840.

Buildul complet al acestui lot a trecut cu 226/226 pagini, inclusiv noua rută de reconciliere. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut.

## 7 octombrie: relevanța alertelor insight_report verificată până la afișare

Criteriile pentru lead necontactat, task restant, dosar Sales blocat/restant, conversație fără răspuns, promovare Meta/TikTok cu eroare sau rezultat incert, apel incert și conflict de vizionări sunt comune generării raportului, creării notificării și retragerii ulterioare. Conversațiile resolved, spam și snoozed sunt excluse chiar dacă needsReply a rămas true; compatibilitatea cu vechiul closed este păstrată. Conflictele sunt recitite pe ambele vizionări și necesită în continuare intervale viitoare suprapuse și agent/client/proprietate comună.

Workerul insight_report recitește lease-ul, membrul și sursele în tranzacția de creare a fiecărei notificări. Sursele rezolvate, șterse sau devenite inaccesibile produc un rezultat skipped persistat în insightEffects. O reluare a aceluiași efect nu reactivează alerta omisă. Noile notificări păstrează insightCondition și automationId, iar lastResult/audit păstrează notificationResults separat de snapshotul raportului. ID-urile notificărilor sunt deterministice și de lungime fixă, inclusiv pentru ID-uri CRM lungi.

Reconcilierea existentă și verificarea periodică din interfață recunosc insightCondition și retrag alerta din liste/contoare după schimbarea sursei, păstrând istoricul. Lotul nu introduce retrimitere pentru rezultate externe incerte, nu migrează notificări legacy și nu aplică această verificare alertelor matching_watch/owner_watch sau întregului corp al unui Daily Brief deja trimis. Verificarea înaintea notificării privește insight_report; Daily Brief beneficiază de criteriile corectate la generarea raportului, fără a deveni un snapshot tranzacțional. Cooldown-ul între execuții diferite, feedbackul și reconcilierea întregului inbox în fundal rămân de implementat.

Au fost adăugate 27 teste ale criteriilor și notificărilor, trei probe pentru statusurile reale Inbox, două probe worker pentru stare live și ID-uri lungi și cinci probe Firestore (trei fluxuri concurente create/reconcile și două execuții ale workerului cu task modificat după raport). Prima suită emulator a trecut 223/224 probe: fixture-ul Inbox omitea agencyId, astfel încât accesul a fost refuzat corect. A fost completată doar agenția conversației sintetice, păstrând verificarea de acces. Aceste probe nu cresc numărul scenariilor originale acceptate din corpus.

Repetarea completă a emulatorului a trecut 224/224 probe în 17 fișiere. Regresia generală a trecut 1341/1341 teste în 112 fișiere. Revizia finală a adăugat recunoașterea ID-ului legacy pentru o notificare deja creată înainte de migrarea la ID-ul hash; noul test și cele afectate au trecut 43/43 (28 relevanță, 15 worker). Această ultimă completare nu a necesitat repetarea întregului emulator. Au trecut TypeScript, ESLint, cele 10 verificări UI sintetice (acum inclusiv insightCondition), manifestul de paritate și git diff --check. Buildul complet nu a fost repetat; ultimul validat rămâne ed9deb75. Lotul nu este publicat; producția verificată rămâne 7f2da840. E8 și planul integral rămân deschise.

## 7 octombrie: pauză configurabilă între alertele aceleiași priorități

insight_report include cooldownMinutes, număr întreg între 30 și 43200, implicit 1440 (24 ore). Editorul permite configurarea și păstrează circuitul prepare/confirmare. Previzualizarea denumește explicit setarea, iar istoricul execuțiilor explică omisiunile din perioada de pauză. Versiunea uneltelor a fost incrementată la 31 pentru contractul extins; versiunea promptului rămâne jarvis-30.

Starea ultimei notificări este separată de receiptul per execuție, în assistantNotificationState din agenție, cu identitate derivată din utilizator, tipul priorității și ID-urile surselor. Perechile de vizionări sunt canonizate. Astfel, două rapoarte concurente pentru același utilizator/problemă împart pauza; alte agenții, utilizatori și priorități rămân independente. Citirea/scrierea acestei stări, notificarea și receiptul sunt în aceeași tranzacție cu verificarea lease-ului, membrului și relevanței.

Omisiunea din cauza pauzei păstrează reasonCode cooldown și nextEligibleAt în receipt și în rezultatul/auditul workerului. Nu actualizează ora ultimei notificări și nu prelungește pauza. După expirare, o execuție nouă poate notifica din nou numai dacă sursa este încă relevantă; reluarea unei execuții omise își păstrează rezultatul. Configurația curentă calculează pauza de la ultima livrare, astfel încât o reducere explicită a duratei poate permite notificarea mai devreme. Datele de stare invalide opresc crearea alertei.

Rapoartele legacy fără cooldownMinutes folosesc implicit 24 ore la următoarea execuție. Notificările istorice nu sunt scanate pentru popularea retroactivă a stării; pauza începe odată cu prima notificare creată prin acest mecanism. Recunoașterea ID-urilor legacy pentru aceeași execuție rămâne păstrată. Acest lot privește doar insight_report și nu introduce quiet hours, plafon global sau feedback util/neutil; aceste puncte și celelalte categorii de automatizări rămân deschise în E8.

Au trecut 67/67 teste țintite și 1349/1349 teste de regresie în 112 fișiere. Șase teste noi verifică pauza și izolarea, iar testul contractului verifică limitele/defaultul. Două probe Firestore noi acoperă rapoarte concurente, expirarea/reluarea și două execuții reale cu dovada omiterii în audit; suita completă a trecut 226/226 probe în 17 fișiere. Verificările UI sintetice validează defaultul, transmiterea valorii alese, explicația din istoric și fluxul de confirmare. Captura .tmp/assistant-ui/insight-cooldown.png a fost inspectată. TypeScript, manifestul de paritate și ESLint au trecut, cu avertismentul preexistent useEffect/load în EntityPicker. Probele sintetice nu cresc acceptarea scenariilor originale din corpus.

Revizuirea regulilor Firestore a adăugat assistantNotificationState la colecțiile exclusiv server, atât în src/firestore.rules (fișierul configurat în firebase.json), cât și în copia de la rădăcină. Probele de reguli pentru agent, admin și altă agenție verifică refuzul citirii/scrierii directe. La publicarea acestui lot trebuie publicate regulile Firestore înainte de activarea noului cod, nu doar rolloutul App Hosting.

Buildul complet a trecut cu 226/226 pagini. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. Modificările nu sunt încă publicate, producția verificată rămâne 7f2da840, iar E8 și planul integral rămân deschise.

Repetarea finală după protejarea colecției în regulile Firestore a trecut 226/226 probe în 17 fișiere, inclusiv refuzul accesului direct la assistantNotificationState. git diff --check a trecut.

## 7 octombrie: intervale de liniște pentru rapoartele de priorități

insight_report acceptă quietHours opțional, cu timezone IANA și start/end HH:mm validate. Configurațiile existente fără câmp își păstrează comportamentul. Editorul propune explicit Europe/Bucharest, 22:00–08:00 pentru rapoarte noi; intervalul se poate dezactiva, iar orele egale înseamnă lipsa intervalului. Setările sunt incluse în planul de confirmare cu etichete românești. Contractul uneltelor a fost incrementat la versiunea 32; promptul rămâne jarvis-30.

Workerul amână raportul aflat în intervalul de liniște și păstrează runCount, inclusiv pentru maxRuns=1 și fără interval repetitiv. nextRunAt indică prima minută permisă sau stopAfter dacă acesta este mai devreme. Nu păstrează o listă veche de priorități pentru trimitere: la reluare citește raportul din nou. La începutul liniștii în timpul unui raport, efectele deja create își păstrează receipturile, iar cele rămase sunt amânate sub aceeași execuție logică. O alertă deja creată nu este repetată la reluare.

Executorul notificării verifică ora după verificarea membrului și a idempotency, apoi din nou după citirea surselor și a stării cooldown, înainte de scrieri. O amânare quiet_hours nu creează notificare, receipt definitiv sau stare cooldown. Rezultatul/auditul include deferredUntil și timezone; interfața explică amânarea. Calculul parcurge minute UTC reale până la prima minută în afara intervalului, folosind fusul configurat: la saltul de primăvară nu inventează ora absentă, iar cele două apariții ale unei ore de toamnă sunt evaluate separat.

Opt probe noi verifică limitele, intervalele care trec peste miezul nopții, intervalul diurn, dezactivarea, DST și validarea contractului. Patru probe worker verifică reluarea cu surse actualizate, păstrarea unicei execuții, stopAfter și reluarea după livrare parțială; o probă a executorului traversează limita în timpul citirilor tranzacționale. Prima rulare țintită a trecut 25/26: așteptarea stopAfter nu includea milisecundele normalizate de contract. După corectare și adăugarea probei parțiale au trecut 27/27 teste țintite. Două probe Firestore verifică amânarea și reluarea după dezactivarea intervalului, cu sursă încă relevantă sau rezolvată; suita emulator a trecut 228/228 în 17 fișiere.

Verificările UI sintetice au trecut pentru opțiunea inițială, schimbarea fusului/orelor, transmiterea setărilor în plan, previzualizare și explicația istoricului. Captura .tmp/assistant-ui/insight-cooldown.png a fost inspectată. TypeScript și verificarea de paritate au trecut; ESLint păstrează doar avertismentul preexistent EntityPicker/useEffect. Probele rămân sintetice și nu cresc acceptarea scenariilor originale.

Limite: intervalul privește insight_report; nu retrage notificări sau push-uri deja livrate și nu schimbă politicile celorlalte automatizări. Reluarea depinde de următorul apel al workerului după nextRunAt, fără promisiunea livrării exact la secundă. Plafonul de notificări și feedbackul util/neutil rămân deschise. La publicare rămâne necesară și publicarea regulilor Firestore din lotul precedent pentru assistantNotificationState. Producția verificată rămâne 7f2da840; acest lot nu este publicat, iar E8 și planul integral rămân deschise.

Validarea finală a trecut 1362/1362 teste de regresie în 113 fișiere și buildul complet cu 226/226 pagini. Prima încercare de build în sandbox a fost blocată de EPERM la scanarea unui director temporar Windows; repetarea cu permisiunile necesare a reușit. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Acest lot este validat local, fără publicare în producție.

## 7 octombrie: plafon comun pentru notificările rapoartelor

insight_report aplică un plafon fix de 10 notificări noi în orice fereastră de 24 de ore, comun tuturor rapoartelor aceluiași utilizator din aceeași agenție. Fereastra este glisantă, calculată în milisecunde UTC, fără reset la miezul nopții și fără dependență de DST. Documentul budget din assistantNotificationState păstrează cel mult 10 momente de creare; verificarea și actualizarea lui sunt în aceeași tranzacție cu notificarea, cooldownul și receiptul efectului. Rapoartele concurente concurează pentru aceeași capacitate. Colecția este deja exclusiv server prin regulile din loturile anterioare.

Numai notificările noi create consumă capacitate. Receipturile reexecutate, livrările legacy recunoscute, alertele rezolvate, cooldownul și quiet hours nu consumă locuri suplimentare. Retragerea unei notificări deja create nu eliberează anticipat capacitatea. O stare invalidă sau cu momente viitoare oprește livrarea, în loc să reseteze implicit contorul. La atingerea plafonului se păstrează un receipt skipped/notification_cap cu limita, fereastra și prima dată de eligibilitate; repetarea aceluiași efect păstrează omisiunea. Nu se creează o coadă de alerte vechi și nu se amână automat execuția. O execuție viitoare normală reevaluează prioritățile curente.

Editorul și previzualizarea planului explică plafonul, iar istoricul explică omisiunile. Versiunea uneltelor este 33. Plafonul se aplică și rapoartelor existente de la activarea noului cod; notificările anterioare activării nu sunt numărate retroactiv. Prioritatea din interiorul unui raport păstrează ordinea existentă; între rapoarte concurente câștigă tranzacția care finalizează prima, fără arbitraj global al scorurilor.

Limite: plafonul privește doar insight_report, nu matching_watch, owner_watch, regulile CRM sau Daily Brief. Nu este încă o politică globală pentru toate notificările CRM și nu este configurabil per utilizator. Feedbackul util/neutil și extinderea politicii la celelalte categorii rămân deschise. Probele sunt sintetice și nu cresc acceptarea cererilor originale. La publicare rămâne necesară publicarea src/firestore.rules înaintea codului pentru protecția assistantNotificationState; producția verificată rămâne 7f2da840. E8 și planul integral rămân deschise.

Validări: 69/69 teste țintite, inclusiv șapte probe noi pentru plafon, expirarea exactă, reexecutare, izolare, retragere și stări invalide. Suita de regresie a trecut 1369/1369 în 113 fișiere. Cele două probe Firestore noi verifică ultimul loc disputat de rapoarte concurente și dovada omiterii în auditul workerului; suita emulator a trecut 230/230 în 17 fișiere. Verificările UI sintetice, TypeScript și manifestul de paritate au trecut; ESLint păstrează doar avertismentul preexistent useEffect/load. Captura .tmp/assistant-ui/insight-cooldown.png a fost inspectată și include explicația plafonului și istoricul omiterii.

Buildul complet a trecut cu TypeScript și 226/226 pagini; avertismentele Jaeger/Tailwind și omiterea copierii Playwright în standalone sunt cele cunoscute. git diff --check a trecut. Modificările sunt validate local și nu sunt publicate în producție.

## 7 octombrie: evaluarea utilității alertelor din rapoarte

Alertele insight_report cu identificatori server oferă acum Utilă/Neutilă în pagina Notificări și în clopoțel. Butoanele sunt separate de deschiderea notificării, nu o marchează citită și nu schimbă entitatea CRM. Evaluarea este salvată pe notificare, cu valoare, revizie și dată; se păstrează la retragerea ulterioară a alertei. Interfața arată explicit că evaluarea nu oprește automat alertele. Această etapă colectează feedback pentru revizuire; nu pretinde adaptarea automată a rankingului și nu introduce o politică de mute.

POST /api/notifications/feedback folosește context autentificat, input strict și tranzacție care recitește apartenența/rolul și alerta din inboxul propriu. Agenția, destinatarul, tipul ai_assistant, automationId și insightCondition valid provin din documentul server; nu sunt acceptate din cerere. expectedRevision previne suprascrierea unei evaluări mai noi. Reîncercarea imediată a aceleiași evaluări întoarce rezultatul existent fără creșterea reviziei; cererile vechi contradictorii sau revenite după mai multe schimbări primesc 409. Actualizarea schimbă doar feedback, astfel încât o retragere concurentă rămâne păstrată. Regulile existente permit clientului numai isRead/readAt și refuză scrierea directă a feedbackului; nu a fost necesară modificarea lor în acest lot.

Interfața păstrează evaluarea confirmată la eroare și nu anunță o salvare nouă înaintea răspunsului serverului. Reîncercarea după o eroare de rețea reutilizează revizia observată. Captura mobilă .tmp/notification-ui/feedback-mobile.png acoperă și mesajul de conflict. Tipurile legacy, regulile CRM și celelalte categorii de automatizări nu primesc aceste controale; extensia și folosirea feedbackului în prioritizare rămân deschise. Versiunea uneltelor este 34. E8 și planul integral rămân deschise; probele sintetice nu cresc acceptarea cererilor originale.

Validări: 22/22 teste noi de salvare/API; 1391/1391 teste de regresie în 115 fișiere. Suita emulator a trecut 234/234 probe în 17 fișiere, inclusiv revizii concurente, păstrarea retragerii și refuzul scrierilor directe pentru agent, admin și altă agenție. Verificarea UI sintetică acoperă eroare/reîncercare, schimbarea votului, conflictul de revizie, autentificarea cererii, absența controalelor legacy, restaurarea votului din snapshot în ambele suprafețe și lățimea mobilă fără overflow. Captura mobilă a fost inspectată. TypeScript, ESLint și manifestul de paritate au trecut.

Buildul complet a trecut cu TypeScript și 227/227 pagini, inclusiv noul endpoint de feedback. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul nu este publicat; producția verificată rămâne 7f2da840, iar la publicarea loturilor cumulate este în continuare necesară actualizarea src/firestore.rules înainte de cod pentru assistantNotificationState.

## 7 octombrie: feedback anterior în prioritățile curente

Feedbackul salvat pe o alertă este acum proiectat atomic și în assistantNotificationState, pe cheia utilizator + agenție + tip + identificatorii priorității. Perechile de vizionări sunt canonizate, astfel încât ordinea lor nu pierde evaluarea. Proiecția și notificarea se scriu în aceeași tranzacție; ultima evaluare nouă comisă pentru acea prioritate devine contextul comun rapoartelor. Reîncercarea idempotentă a unei evaluări vechi nu rescrie proiecția unei evaluări mai noi de pe altă alertă.

getInsights adaugă feedbackul numai rezultatelor deja selectate din resurse autorizate, după recitirea apartenenței și rolului în tranzacția de citire a evaluărilor. Scorul, ordinea, numărul priorităților și criteriile de relevanță sunt păstrate. Cardul explică evaluarea anterioară și faptul că problema este încă activă. Datele structurate includ valoarea și data evaluării; nu includ ID-ul notificării vechi sau istoricul altui utilizator. Proiecțiile invalide opresc raportul în loc să inventeze o evaluare.

Limite: această integrare furnizează context explicit și nu este încă învățare automată, schimbare de ranking sau mute. Nu există backfill pentru voturile salvate înainte de acest lot; acestea apar în context după o schimbare nouă a evaluării. Nu este păstrat istoricul complet al tuturor schimbărilor în proiecție, ci ultima evaluare comisă. Persistența se face în colecția exclusiv server deja protejată; la publicarea loturilor cumulate rămâne obligatorie publicarea src/firestore.rules înainte de cod. Versiunea uneltelor este 35. E8 și planul integral rămân deschise.

Au trecut 29/29 teste țintite și 1396/1396 teste de regresie în 116 fișiere. Cele cinci probe noi acoperă anotarea fără schimbarea ordinii/scorului, ultima evaluare comisă și retry, canonizarea perechilor, izolarea utilizatorilor/agențiilor și datele invalide. Suita emulator a trecut 234/234 probe în 17 fișiere, cu proba existentă extinsă până la raportul real. TypeScript, ESLint, manifestul de paritate și verificările UI au trecut. Prima probă UI a păstrat modul background din scenariul anterior și a expirat; resetarea explicită a fixture-ului a corectat testul. Captura .tmp/assistant-ui/insight-feedback.png a fost inspectată pe mobil. Probele sintetice nu cresc acceptarea scenariilor originale.

Buildul complet a trecut cu 227/227 pagini și TypeScript; avertismentele Jaeger/Tailwind și omiterea copierii Playwright în standalone sunt cele cunoscute. git diff --check a trecut. Modificările nu sunt publicate în producție; ultima producție verificată rămâne 7f2da840.

## 7 octombrie: departajare explicabilă după feedback

Rapoartele folosesc acum feedbackul ca departajare între priorități cu același scor de urgență sub 90: utile, neevaluate, neutile. Scorul de bază nu se modifică, o prioritate cu urgență mai mică nu trece înaintea uneia cu urgență mai mare și nicio problemă nu este eliminată din lista de candidați din cauza feedbackului. Scorurile 90/95/100 (rezultate externe incerte sau erori de promovare, Sales, conflicte de vizionări) rămân ordonate fără influența feedbackului. În fiecare grup, ID-ul este criteriul determinist final.

Influența expiră exact după 30 de zile; datele viitoare sau invalide nu constituie dovadă de recență pentru departajare. Cardurile explică evaluarea și aplicarea sau neaplicarea ei. Controlul Utilă/Neutilă anunță acum influența limitată. Scorul numeric este etichetat în română, iar valoarea tehnică de departajare nu este afișată ca indicator de business.

Feedbackul este citit înainte de limita de rezultate, pentru cel mult primii 200 de candidați ordonați după urgență și ID. Raportul expune feedbackRankingComplete și feedbackInspectedPriorities, separat de completitudinea citirii CRM; când există peste 200 de priorități identificate, descrierea declară personalizarea parțială. Un candidat din afara lotului nu poate fi promovat pe baza unui feedback necitit. Această limită evită o scanare necontrolată a istoricului și nu reprezintă o clasare personalizată globală. Testele verifică explicit selecția după departajare și limita de 201 candidați.

Politica rămâne deterministă, fără model de învățare, generalizare între tipuri de probleme sau mute. Rapoartele automate și Daily Brief beneficiază de aceeași selecție getInsights; limitele, cooldownul și verificările de relevanță rămân active. E8 și planul integral rămân deschise. Versiunea uneltelor este 36.

Validări: 19/19 teste țintite; 1404/1404 teste de regresie în 117 fișiere. Cele opt probe noi acoperă departajarea, păstrarea urgenței, scorurile protejate, expirarea/future dates, ordinea deterministă și limita candidaților înaintea selecției. Proba Firestore existentă este extinsă cu selecția efectivă după feedback; suita emulator a trecut 234/234 în 17 fișiere. Ambele suite UI au trecut, iar captura .tmp/assistant-ui/insight-feedback.png a fost inspectată. Prima verificare TypeScript a detectat pierderea semnăturii Record la map; adăugarea tipului explicit a corectat problema, iar repetarea a trecut. ESLint și manifestul de paritate au trecut. Aceste probe sintetice nu cresc acceptarea scenariilor originale.

Buildul complet a trecut cu TypeScript și 227/227 pagini. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul nu este publicat în producție; producția verificată rămâne 7f2da840. La publicarea loturilor cumulate trebuie actualizate regulile src/firestore.rules înaintea codului pentru protecția assistantNotificationState.

## 7 octombrie: verificarea surselor alertelor matching

matching_watch verifică acum în tranzacția notificării lease-ul, apartenența/rolul utilizatorului, clientul și proprietatea. Folosește reviziile matchingRevision/sourceContactRevision produse de calculul existent; o proprietate inactivă, un client arhivat/Câștigat/Pierdut, o ștergere, accesul revocat sau o schimbare a amprentei sursei împiedică notificarea cu scorul vechi. Nu schimbă algoritmul de matching și nu recalculează un scor nou sub pretextul că rezultatul vechi ar mai fi valabil.

Notificarea creată păstrează automationId și matchingCondition, iar reconcilierea existentă recitește aceleași surse pentru retragere. Lista și clopoțelul includ aceste alerte în verificarea periodică a notificărilor încărcate. Dacă prețul, preferințele sau alt câmp din amprentă s-a schimbat, alerta este retrasă și marcată citită; istoricul rămâne. Imaginile și câmpurile de istoric excluse de matchingRevision nu invalidează singure alerta. Workerul păstrează notificationResults și pentru matching, iar istoricul explică omisiunile din cauza surselor neconfirmate.

Limite: revizia este conservatoare; o schimbare de date poate retrage alerta chiar dacă un calcul nou ar depăși pragul. Nu există backfill pentru alertele legacy fără matchingCondition și nu sunt retrase push-uri deja livrate. Se păstrează deduplicarea existentă pe automatizare/proprietate: o alertă retrasă nu este recreată automat sub același ID; o potrivire omisă înaintea primei livrări poate fi reevaluată la următoarea execuție. Plafonul, feedbackul și intervalul de liniște ale insight_report nu sunt extinse la matching în acest lot. Reconcilierea întregului inbox în fundal și politicile owner_watch rămân deschise. Versiunea uneltelor este 37; E8 și planul integral rămân deschise.

Validări: 58/58 teste țintite, incluzând 19 probe noi de creare/retragere și două probe worker cu sursă schimbată după calcul. Regresia completă a trecut 1425/1425 în 118 fișiere. Proba Firestore nouă verifică deduplicarea concurentă, omisiunea scorului vechi și retragerea după modificarea prețului; suita emulator a trecut 235/235 în 17 fișiere. TypeScript, ESLint, manifestul de paritate și ambele suite UI au trecut; UI verifică includerea bindingului matching în reconciliere și explicația omisiunilor din istoric. Probele sunt sintetice și nu cresc acceptarea cererilor originale.

Buildul complet a trecut cu TypeScript și 227/227 pagini; avertismentele Jaeger/Tailwind și omiterea copierii Playwright în standalone rămân cele cunoscute. git diff --check a trecut. Modificările nu sunt publicate în producție, care rămâne verificată la 7f2da840. Pentru publicarea loturilor cumulate rămâne necesară actualizarea src/firestore.rules înaintea codului pentru assistantNotificationState.

## 7 octombrie: reverificarea alertelor owner_watch

owner_watch reverifică în tranzacția de creare lease-ul, apartenența și rolul destinatarului, anunțul curent, scope-ul explicit sau localitatea actuală a agenției și toate criteriile căutării. Dacă excludeImported este activ, verificarea referințelor exacte ownerListingId/ownerListingUrl folosește aceeași tranzacție și numai proprietățile agenției. Titlul notificării provine din documentul recitit. Rezultatele omise apar în notificationResults, inclusiv pentru paginile cu continuare; cursorul existent este păstrat.

Notificările noi persistă ownerWatchCondition cu criteriile, fără cursor și limită. Reconcilierea listei și a clopoțelului verifică aceleași condiții și retrage alertele după ștergere, pierderea publicării canonice, schimbarea criteriilor/localității sau importul CRM exact. Retragerea păstrează istoricul și marchează alerta citită. Identificarea importurilor nu folosește similaritatea textuală și nu expune în rezultat datele proprietății CRM.

Limite: verificarea este a datelor actuale din Firestore, nu o nouă accesare a site-ului sursă. Nu există migrare a alertelor vechi fără criterii persistate, retragere a push-urilor deja livrate sau scanare de fundal a întregului inbox. Deduplicarea automatizare/anunț rămâne: o alertă retrasă nu se recreează sub același ID; o omisiune înaintea livrării poate fi reevaluată la o execuție viitoare. Quiet hours, plafonul și feedbackul pentru owner_watch/matching_watch rămân de implementat. E8 și planul integral rămân deschise. Probele noi sunt sintetice și nu cresc acceptarea scenariilor originale.

Validări: 1451/1451 teste de regresie în 119 fișiere, cu 24 probe noi pentru criterii, creare/retragere, importuri exacte și izolare, plus două probe worker care schimbă anunțul între căutare și creare. Emulatorul a trecut 236/236 în 17 fișiere, inclusiv deduplicarea concurentă și importul CRM verificat prin interogări în tranzacție. TypeScript, ESLint, manifestul de paritate și suita UI pentru notificări au trecut. git diff --check a trecut după eliminarea unei linii goale la finalul scriptului UI. Nu au fost mutate date reale și nu au fost trimise mesaje externe.

Buildul complet a trecut cu TypeScript și 227/227 pagini; rămân avertismentul Jaeger și omiterea cunoscută a copierii Playwright în standalone. Lotul nu este publicat în producție; ultima producție verificată rămâne 7f2da840. La publicarea loturilor cumulate trebuie actualizat src/firestore.rules înaintea codului pentru protecția assistantNotificationState.

## 7 octombrie: publicarea tuturor loturilor validate până la 97ac8248

La cererea explicită a utilizatorului, toate modificările aplicației până la commitul 97ac82486d705a4ebc3edb25064baaae8f5a9409 au fost publicate în producție. Mai întâi au fost compilate și publicate regulile src/firestore.rules; citirea release-ului activ a confirmat identitatea exactă cu sursa locală (SHA-256 ce70a9a3dc0031b25561710ec0ea916560916272f839ee609ac4402d4ce63731). Ruleset: 214e1f71-708f-4945-a28c-d21f5aa8a449.

Firebase App Hosting studio, proiect studio-652232171-42fb6, regiune us-central1: build-2026-10-07-002 READY, rollout SUCCEEDED, trafic stabil 100% pe commitul 97ac8248. Verificarea din 2026-10-07T15:57:39.361Z confirmă Cloud Run RoutesReady și ConfigurationsReady. Cele nouă probe publice au trecut: /ai-assistant răspunde 200, iar cele opt API-uri protejate răspund 401 fără autentificare, inclusiv /api/notifications/feedback și /api/notifications/reconcile. Sunt probe de disponibilitate și de limită de autentificare, nu demonstrarea tuturor fluxurilor autentificate pe date reale.

Dovezile sunt în MASTER_PRODUCTION.json și CRM_PARITY_PRODUCTION.json. Validarea locală aferentă codului publicat: build complet, 1451 teste de regresie, 236 teste emulator și verificarea UI a notificărilor. Jev rămâne în modul shadow, cu secretul legat în configurație; nu s-au afișat valori secrete și nu s-au trimis mesaje externe de test. Această publicare închide restanța de deploy a loturilor validate, nu planul integral și nici acceptarea scenariilor originale rămase.

## 7 octombrie: intervale de liniște pentru owner_watch și matching_watch

Am extins quietHours (fus IANA, început/sfârșit HH:mm) la monitorizările de anunțuri și matching. Workerul amână înainte de citirea rezultatelor, iar fiecare creare de alertă reverifică intervalul înainte și după citirile tranzacționale. Amânarea nu creează notificare sau receipt și nu consumă runCount; următoarea execuție este programată la sfârșitul intervalului, limitată de stopAfter. Orele egale dezactivează intervalul, folosind politica existentă care tratează schimbarea orei prin instanțe reale.

Pentru owner_watch, amânarea în mijlocul unei pagini păstrează cursorul de intrare, nu cursorul paginii următoare. Reluarea recitește pagina și sursele; ID-urile stabile omit alertele deja create. Pentru matching se recalculează raportul prin motorul existent și se reverifică reviziile înaintea alertelor noi. O sursă devenită invalidă între amânare și reluare nu generează notificare.

Editorul permite configurarea ambelor monitorizări și arată intervalul în planul de confirmare. Formularele noi propun Europe/Bucharest, 22:00–08:00; automatizările existente fără quietHours rămân fără această politică până la modificarea explicită. Editarea păstrează filtrele fără controale UI (ani, excluderea importurilor și roomsAny când nu este introdus un număr exact de camere). Istoricul folosește explicația comună «Verificare amânată». Versiunea uneltelor este 38.

Limite: nu există activare retroactivă, plafon comun, cooldown repetabil sau feedback nou pentru aceste două monitorizări; deduplicarea existentă rămâne. Nu se retrag push-uri deja livrate și reconcilierea întregului inbox în fundal rămâne deschisă. Calendarul este verificat înaintea scrierii, fără garanție de timp real asupra latenței commitului sau livrării push. E8, acceptarea scenariilor originale și planul integral rămân deschise. Acest lot nu este publicat; producția verificată rămâne 97ac8248 / build-2026-10-07-002.

Validări: 82 teste țintite de worker, notificări și politică; apoi 1461/1461 teste de regresie în 119 fișiere și 238/238 probe emulator în 17 fișiere. Cele zece probe unitare noi acoperă contractele, păstrarea cursorului, stopAfter, reluarea parțială și granița temporală în citirile tranzacționale; cele două probe Firestore noi verifică amânarea fără efect și deduplicarea concurentă după dezactivarea intervalului. Probele sunt sintetice, fără mesaje către clienți, și nu cresc acceptarea corpusului original.

TypeScript a trecut. ESLint nu are erori; rămâne avertismentul preexistent useEffect/load în EntityPicker. Manifestul de paritate a fost regenerat pentru liniile actuale din checkout și verificarea a trecut. Suita UI a trecut după actualizarea selectorului pentru textul comun, alegerea ultimului preview când sunt mai multe planuri și așteptarea încărcării clientului în fixture; acoperă configurarea celor două monitorizări, editarea legacy fără activare implicită și păstrarea filtrelor fără controale vizibile.

Buildul complet a trecut cu TypeScript și 227/227 pagini; rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul este pregătit pentru revizuire și nu a fost publicat în producție.

## 7 octombrie: plafon comun pentru rapoarte și monitorizări

Am extins plafonul de 10 alerte în fereastra mobilă de 24 de ore la owner_watch și matching_watch. Cele trei fluxuri citesc și actualizează în tranzacție același document de buget, separat pe utilizator și agenție. Bugetul este consumat numai la crearea unei notificări noi; duplicatele, datele devenite nevalide și amânările nu consumă capacitate. Documentul existent al rapoartelor este reutilizat, astfel încât alertele deja numărate din rapoarte rămân în calcul.

La atingerea plafonului, monitorizările returnează deferred/notification_cap, cu momentul primei capacități disponibile. Workerul păstrează runCount și cursorul de intrare pentru owner_watch, apoi recitește rezultatele la reluare. Orele de liniște pot amâna din nou verificarea, iar stopAfter rămâne limita finală. Nu există promisiunea livrării la o oră exactă: o altă automatizare poate consuma capacitatea între timp. Rapoartele își păstrează semantica anterioară skipped/notification_cap și receipt-ul definitiv pentru același efect.

Editorul și preview-ul declară plafonul comun și explică amânarea monitorizărilor. Istoricul distinge monitorizarea amânată de o alertă de raport omisă. Versiunea uneltelor este 39. Limite: bugetul nu este rezervat pe priorități sau tipuri, nu există backfill pentru alertele istorice ale monitorizărilor, iar retragerea/citirea unei alerte nu restituie capacitatea. Brief-urile zilnice, regulile de evenimente și notificările altor module nu intră în acest plafon. Feedbackul și cooldown-ul repetabil pentru cele două monitorizări rămân deschise, împreună cu reconcilierea completă a inboxului și restul E8. Producția nu a fost modificată; ultima verificare rămâne 97ac8248 / build-2026-10-07-002.

Validarea emulator a expus repetabil eroarea exactă 3 INVALID_ARGUMENT: Transaction is invalid or closed la citiri concurente din notificări (matching, apoi și cooldown raport). Primele două rulari nu au trecut integral; proba nouă a plafonului mixt a trecut în ambele. Am adăugat un adaptor limitat la metoda get a tranzacțiilor de creare a notificărilor: normalizează exclusiv această eroare exactă în ABORTED, astfel încât SDK-ul să reia toate citirile în limita sa existentă. Nu sunt învelite commituri, scrieri sau efecte externe și nu se repetă citirea pe aceeași tranzacție închisă. Probele noi verifică păstrarea celorlalte erori și a contextului metodelor native, precum și limita de două încercări impusă explicit în probele Firestore.

Validări finale ale testelor: 1482/1482 teste de regresie în 121 fișiere; 241/241 probe emulator în 17 fișiere după remedierea citirilor invalidate. Au fost adăugate 21 probe unitare și trei probe Firestore (plafon concurent mixt și două probe pentru reluarea limitată). Cele 48 de teste țintite ale workerului, bugetului și normalizării erorii au trecut. TypeScript, ESLint și paritatea au trecut (ESLint păstrează avertismentul preexistent useEffect/load din EntityPicker). Suita UI verifică plafonul din preview și distincția dintre amânare și omitere în istoric. Nu s-au trimis mesaje externe; probele sintetice nu cresc acceptarea scenariilor originale.

Buildul complet a trecut cu TypeScript și 227/227 pagini. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul nu a fost publicat în producție; E8 și planul integral rămân deschise.

## 7 octombrie: feedback pentru alertele owner_watch și matching_watch

Endpointul de feedback acceptă acum alertele celor două monitorizări dacă au exact un binding recunoscut și valid. Tranzacția verifică destinatarul, agenția și rolul curent, păstrează controlul prin expectedRevision și deduplică retry-urile. Bindingurile incomplete sau ambigue sunt respinse înaintea scrierii. Evaluarea rămâne în notificarea destinatarului; nu se scrie în proiecția de ranking a rapoartelor și nu se modifică surse CRM, bugete sau automatizări.

Lista și clopoțelul oferă Utilă/Neutilă pentru ambele monitorizări și restaurează votul din snapshotul serverului. Explicația declară explicit că aceste evaluări nu schimbă încă ordinea rezultatelor sau frecvența alertelor. Feedbackul de raport își păstrează politica existentă de departajare. API-ul poate primi un vot pentru o alertă livrată și ulterior retrasă, fără a o reactiva; alertele retrase rămân ascunse în interfață.

Acest lot implementează colectarea feedbackului pe alertă, nu învățarea preferințelor între alerte sau automatizări. Folosirea evaluărilor în matching/prospectare, cooldown-ul repetabil, reconcilierea întregului inbox și restul E8 rămân deschise. Nu există migrare pentru alertele legacy fără binding valid. Probele sunt sintetice și nu cresc acceptarea corpusului original. Producția nu este modificată; ultima verificare rămâne 97ac8248 / build-2026-10-07-002.

Validări: 1491/1491 teste de regresie în 121 fișiere și 243/243 probe emulator în 17 fișiere. Cele nouă probe unitare noi verifică retry-ul, reviziile, izolarea, păstrarea retragerii și respingerea bindingurilor nevalide; două probe Firestore verifică voturile concurente și retragerea simultană, fără proiecții în ranking. Suita UI verifică salvarea și restaurarea voturilor pentru ambele monitorizări în listă și clopoțel. TypeScript, ESLint și manifestul de paritate au trecut. Nu s-au folosit date reale sau servicii externe pentru aceste probe.

Buildul complet a trecut cu TypeScript și 227/227 pagini; rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul nu este publicat în producție; planul integral rămâne deschis.

## 7 octombrie: reconcilierea notificărilor în fundal

Workerul existent include acum o scanare recurentă a notificărilor, independentă de deschiderea inboxului. Parcurgerea ordonată după calea documentului folosește un cursor persistent în assistantWorkerState/notificationSweep, un lease de 60 de secunde și verificarea tokenului înainte de salvarea progresului. Limita implicită este de 25 de documente pe apel, cu un buget cooperativ de 10 secunde verificat între documente. O citire sau tranzacție în curs poate depăși acest buget; nu există garanție de latență de 10 secunde.

Sunt procesate doar documentele users/{uid}/notifications/{id}, cu destinatar corect, tip ai_assistant și automatizare. Utilizatorul trebuie să aibă în prezent aceeași agenție și rol CRM; tranzacția de reconciliere reverifică apartenența și sursele. Sunt reutilizate regulile pentru rapoarte, matching, anunțuri și evenimente. Se includ și alertele deja citite. Retragerea păstrează documentul și feedbackul, marchează citirea și nu creează mesaje externe.

La sfârșitul colecției cursorul revine la început; documentele create înaintea cursorului și erorile individuale sunt reexaminate în ciclul următor. O eroare de interogare păstrează cursorul precedent și eliberează lease-ul propriu. O eroare la o alertă este contorizată și permite continuarea spre celelalte inboxuri. Un proces care a pierdut lease-ul nu poate suprascrie progresul succesorului; eventualele retrageri deja făcute rămân idempotente și validate separat. Eșecul scanării este raportat în răspunsul workerului și nu blochează joburile sau automatizările. Probele exclusiv audio nu declanșează scanarea.

Limite: o trecere completă necesită mai multe apeluri ale workerului, în funcție de volumul global, inclusiv notificările altor module și cele retrase. Nu există SLA de retragere imediată, index separat al alertelor active sau migrare a notificărilor legacy. Documentele utilizatorilor șterși, cu rol neacceptat ori mutați în altă agenție sunt omise, fără acces la datele fostei agenții. Nu sunt retrase push-uri deja livrate. Activarea efectivă a noului pas necesită publicarea codului; producția nu a fost modificată în acest lot.

Validări: 1495/1495 teste de regresie în 122 fișiere și 253/253 probe emulator în 18 fișiere. Cele zece probe Firestore noi acoperă paginarea, ciclurile repetate, alertele citite, toate cele patru tipuri de binding, izolarea, lease-ul ocupat/pierdut, eșecul interogării și progresul peste un document problematic. Cele patru teste de rută verifică autentificarea workerului, răspunsul fără cache, continuarea joburilor după eșecul scanării și excluderea probelor audio. TypeScript, ESLint și paritatea au trecut. Probele sunt sintetice și nu cresc acceptarea corpusului original; planul integral rămâne deschis.

Buildul complet a trecut cu TypeScript și 227/227 pagini, păstrând avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul este validat local și nu este publicat în producție; ultima producție verificată rămâne 97ac8248 / build-2026-10-07-002.

## 7 octombrie: starea separată a reconcilierii alertelor

Raportul crmHealth include notificationReconciliation, separat de disponibilitatea workerului de automatizări. Stările disting lipsa configurării, lipsa dovezii, o verificare mai veche de 15 minute, erorile unui lot recent, un lot recent fără erori și indisponibilitatea stocării. Indicatorul running este separat: un lease activ nu șterge dovada unei erori anterioare. Datele viitoare sau invalide nu certifică o verificare reușită.

Workerul persistă separat momentul unui eșec al scanării, inclusiv când eroarea apare înainte de rezervarea cursorului. Înregistrarea acestei observații este best effort și nu blochează joburile dacă stocarea ei eșuează. Raportul combină acest moment cu eșecurile și ultima finalizare păstrate de scanare; un lot finalizat ulterior poate înlocui starea de eroare. Nu se expun tokenul lease-ului, cursorul, căile utilizatorilor, volume globale sau conținutul excepțiilor.

Starea current confirmă numai ultimul lot recent fără erori raportate. Nu certifică parcurgerea tuturor inboxurilor, absența erorilor în loturi anterioare ale aceluiași ciclu sau livrarea/retragerea push-urilor externe. Nota explicativă însoțește rezultatul. Nu sunt schimbate criteriile de retragere, filtrele de acces sau politica de automatizare.

Validări: 1510/1510 teste de regresie în 123 de fișiere, cu 15 probe noi pentru clasificarea stărilor, recuperare, date invalide, protejarea metadatelor și raportarea separată față de workerul activ. Testul de rută verifică și înregistrarea momentului eșecului. TypeScript, ESLint și manifestul de paritate au trecut. Nu au fost modificate tranzacțiile de retragere sau regulile Firestore; suita emulator de 253 de probe a fost validată în lotul anterior și nu a fost rerulată pentru acest lot de raportare. Planul integral și acceptarea corpusului original rămân deschise.

Buildul complet a trecut cu TypeScript și 227/227 pagini; rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul nu este publicat în producție; ultima producție verificată rămâne 97ac8248 / build-2026-10-07-002.

## 7 octombrie: pauză comună pentru alertele monitorizărilor

owner_watch și matching_watch verifică acum în tranzacția de creare o pauză de 24 de ore comună monitorizărilor aceluiași utilizator din aceeași agenție. Identitatea este anunțul pentru owner_watch și perechea ordonată client–proprietate pentru matching_watch; tipurile sunt separate. Două automatizări concurente pentru aceeași identitate pot crea cel mult o alertă în fereastră. Starea este server-managed în assistantNotificationState și se actualizează atomic numai la crearea efectivă a notificării.

O alertă repetată întoarce skipped/cooldown și nextEligibleAt, fără notificare nouă, consum de plafon sau prelungirea pauzei. Workerul folosește auditul existent al omisiunilor. După expirare, o execuție normală reverifică sursele înainte de livrare; expirarea nu garantează un nou mesaj. Intervalul de liniște și plafonul comun continuă să se aplice. Starea de cooldown incompatibilă sau din viitor oprește crearea, fără presupuneri despre istoricul lipsă.

Editorul și planul de confirmare explică regula prin nota comună monitorizărilor. Versiunea uneltelor este 40. Pauza este fixă în acest lot; nu există încă un control configurabil. Deduplicarea permanentă pe automatizare/entitate rămâne: lotul previne duplicate între monitorizări diferite, nu reactivează notificările deja retrase și nu introduce alerte repetate în aceeași monitorizare. Nu există backfill al livrărilor istorice; regula se aplică livrărilor înregistrate de noul cod, inclusiv execuțiilor viitoare ale automatizărilor existente.

Validări: 1515/1515 teste de regresie în 123 de fișiere și 255/255 probe emulator în 18 fișiere. Cele cinci probe unitare noi acoperă expirarea exactă, retry-ul, lipsa prelungirii/consumului, izolarea și starea coruptă. Două probe Firestore pornesc monitorizări independente simultan, confirmă o singură alertă și o singură poziție de buget, apoi verifică sursele devenite invalide după expirarea pauzei. Prima rulare țintită a expus o așteptare veche de livrare imediată în testul importurilor; testul verifică acum importul permis după expirarea pauzei și a trecut în regresia completă.

TypeScript, ESLint, paritatea și suita UI au trecut; UI verifică explicația pauzei în preview-urile ambelor monitorizări. Probele sunt sintetice, nu scenarii originale noi acceptate. Cooldown-ul configurabil și repetarea în cadrul aceleiași monitorizări, folosirea feedbackului în recomandări și restul planului rămân deschise.

Buildul complet a trecut cu TypeScript și 227/227 pagini. Rămân avertismentul cunoscut Jaeger și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul nu este publicat în producție; ultima producție verificată rămâne 97ac8248 / build-2026-10-07-002. Planul integral rămâne deschis.

## 7 octombrie: pauză configurabilă pentru monitorizări

owner_watch și matching_watch acceptă cooldownMinutes între 30 și 43200 de minute, implicit 1440. Editorul pregătește această valoare în planul normal de creare/editare; preview-ul o afișează prin câmpul existent. Workerul transmite durata aprobată în tranzacția de livrare. Versiunea uneltelor este 41.

Starea comună memorează și durata ultimei alerte livrate. Înainte de o nouă livrare se respectă maximul dintre durata curentă și cea memorată, calculat de la aceeași ultimă livrare. Astfel, o monitorizare cu pauză mai scurtă nu ocolește pauza deja începută de alta. După expirare, următoarea livrare salvează propria durată. Verificările omise nu prelungesc pauza. Înregistrările și automatizările legacy fără câmp folosesc 1440; o durată memorată nevalidă oprește livrarea.

Configurarea nu reactivează alerte retrase și nu introduce repetarea în aceeași monitorizare: deduplicarea permanentă existentă rămâne. Pentru durate diferite, câștigătorul tranzacției concurente stabilește ultima livrare; o configurație cu pauză mai lungă poate aștepta mai mult decât alta. Nu există negociere globală a configurațiilor tuturor monitorizărilor. Plafonul comun și intervalele de liniște rămân aplicabile.

Validări: 1522/1522 teste de regresie în 124 de fișiere și 255/255 probe emulator în 18 fișiere. Șapte teste noi acoperă contractele ambelor monitorizări, limitele, migrarea implicită, combinațiile de durate, expirarea și starea coruptă. Probele worker verifică persistența valorilor 90/120 minute din configurația automatizării. Cele două probe Firestore de concurență verifică acum o durată explicită de 60 de minute și refuzul scurtării la 30 după 31 de minute.

UI confirmă defaultul de 1440 și transmiterea valorii 90 în plan pentru ambele monitorizări. TypeScript, ESLint și paritatea au trecut; rămâne avertismentul preexistent useEffect/load din editor. Probele sunt sintetice și nu cresc numărul scenariilor originale acceptate. Repetarea în aceeași monitorizare și folosirea feedbackului pentru recomandări rămân deschise, împreună cu restul planului.

Buildul complet a trecut cu TypeScript și 227/227 pagini; rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul nu este publicat în producție; ultima producție verificată rămâne 97ac8248 / build-2026-10-07-002. Planul integral rămâne deschis.

## 7 octombrie: contextul evaluărilor anterioare în rezultatele monitorizărilor

Feedbackul nou pentru owner_watch și matching_watch se salvează atomic și într-o proiecție separată per utilizator/agenție. Identitatea este anunțul, respectiv perechea ordonată client–proprietate; tipurile rămân distincte. Ultima evaluare comisă devine contextul afișat. Retry-ul idempotent al unui vot mai vechi nu rescrie proiecția. Reviziile concurente contradictorii păstrează răspunsul 409, iar retragerea notificării nu este anulată de feedback.

Căutarea de anunțuri din conversație și endpointul de paginare îmbogățesc numai rândurile deja selectate. Matchingul pentru un client primește același context după calculul motorului canonic. Cardul arată valoarea și data evaluării, precizând explicit că aceasta privește alerta de atunci, nu oferta actuală. Nu se filtrează rezultate, nu se schimbă scoruri, motive, ordine, cursor, limite de paginare sau frecvența alertelor. Apartenența și rolul sunt reverificate tranzacțional; o proiecție incompatibilă este respinsă.

Matchingul invers și căutarea simplă în CRM nu primesc evaluări de anunțuri. Automatizările nu citesc aceste proiecții la selectarea sau livrarea alertelor. Proiecția nu intră în rankingul rapoartelor insight. Versiunea uneltelor este 42. Listele de matching salvate păstrează evaluarea din momentul rezultatului, inclusiv la filtrarea acelei liste; o căutare nouă citește contextul actual. Istoricul conversației nu este rescris după voturi ulterioare.

Nu există backfill al voturilor salvate înaintea acestui lot, expirare automată a contextului sau învățare a preferințelor din voturi. Voturile vechi pot fi revizuite explicit prin fluxul existent. Repetarea alertelor în aceeași monitorizare, prioritizarea globală și restul planului rămân deschise. Probele sunt sintetice și nu cresc acceptarea corpusului original. Producția nu este modificată în acest lot; ultima verificare rămâne 97ac8248 / build-2026-10-07-002.

Validări: 1533/1533 teste de regresie în 125 de fișiere și 255/255 probe emulator în 18 fișiere. Cele 11 teste noi verifică izolarea, retry-ul peste o evaluare ulterioară, păstrarea scorurilor și ordinii, respingerea dovezilor invalide și conectarea adaptoarelor. Cele două probe Firestore pentru feedbackul monitorizărilor verifică acum și proiecția atomică, inclusiv după retragere concurentă. TypeScript și ESLint au trecut după corectarea a două incompatibilități de tip. Manifestul de paritate și ambele suite UI au trecut; captura mobilă confirmă nota istorică pe ambele carduri, separat de scorul matching.

Buildul complet a trecut cu TypeScript și 227/227 pagini. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul este validat local; planul integral rămâne deschis și producția nu a fost actualizată.

## 7 octombrie: repetarea explicită a alertelor în aceeași monitorizare

owner_watch și matching_watch au opțiunea repeatAlerts, implicit false inclusiv pentru automatizările existente. Editorul o prezintă separat, iar preview-ul o include în planul de creare/editare supus confirmării existente. Versiunea uneltelor este 43. Activarea nu programează livrări la expirarea pauzei: o execuție ulterioară trebuie să găsească din nou rezultatul relevant, în limitele maxRuns, stopAfter, intervalului de liniște și plafonului comun.

Cu opțiunea activă, identificatorul notificării include automatizarea, numărul execuției și entitatea. O amânare pentru liniște/plafon păstrează runCount și reutilizează identificatorul, inclusiv după expirarea cooldown-ului. O execuție încheiată în timpul pauzei consemnează omisiunea și consumă o execuție normală; o execuție ulterioară poate livra. Pauza comună între monitorizări rămâne aplicabilă și se consumă numai la livrare. O alertă retrasă nu este reactivată: dacă sursa devine eligibilă din nou, o execuție ulterioară poate crea un document nou.

Cu opțiunea dezactivată, workerul păstrează identificatorul legacy și verifică tranzacțional dacă aceeași automatizare a livrat deja pentru acea entitate în agenția utilizatorului. Verificarea include documentele retrase și livrările efectuate anterior cu repetarea activă, astfel încât dezactivarea opțiunii să nu genereze o alertă suplimentară. Nu se șterg sau modifică evaluările și istoricul notificărilor. Dovada deduplicării depinde de păstrarea documentelor de notificare; nu este introdus un registru separat pentru documente șterse administrativ.

Monitorizarea anunțurilor păstrează parcurgerea paginată existentă: entitățile pot fi revizitate după revenirea cursorului la început, nu obligatoriu la fiecare execuție. Nu există garanție de livrare exact la expirarea pauzei sau prioritate globală între monitorizări. Lipsa istoricului cooldown pentru livrările din versiuni vechi nu este remediată prin backfill. Restul planului și acceptarea corpusului original rămân deschise; probele acestui lot sunt sintetice. Producția nu este actualizată în acest lot.

Validări: 1544/1544 teste de regresie în 126 de fișiere și 257/257 probe emulator în 18 fișiere. Cele 11 probe unitare suplimentare acoperă opt-in-ul, compatibilitatea legacy, identitatea execuției, repetarea după pauză, oprirea și reluarea după liniște. Două probe Firestore noi verifică retry-ul după expirare, livrarea concurentă o singură dată, consumul bugetului, istoricul retras, dezactivarea repetării și sursele devenite neeligibile. Suita emulator a fost rerulată după completarea comportamentului de dezactivare și a trecut. UI verifică valoarea implicită, transmiterea în preview și păstrarea atât a configurațiilor legacy, cât și a repetării active la editare. TypeScript, ESLint și paritatea au trecut; rămâne avertismentul preexistent useEffect/load din editor.

Buildul complet a trecut cu TypeScript și 227/227 pagini. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Lotul este validat local; ultima producție verificată rămâne 97ac8248 / build-2026-10-07-002. Planul integral rămâne deschis.

## 7 octombrie: fus unic Europe/Bucharest, conform deciziei utilizatorului

Cerința de prioritate între fusuri din E2 este înlocuită explicit: AI Assistant folosește exclusiv Europe/Bucharest. Extinderea începută pentru fusul agenției a fost eliminată, inclusiv câmpul din setările agenției. Plannerul și preferredTimezone folosesc valoarea fixă; memoria validă nu mai acceptă alte fusuri, iar preferințele legacy incompatibile sunt ignorate la citire.

Contractele de calcul calendaristic, interogări, liniște și Daily Sales Brief resping alte fusuri. Calculul direct resolveDatetime validează și el contractul. Editorul arată București în câmpuri read-only; crearea și editarea trec prin aprobarea existentă. Un document de automatizare legacy cu alt fus este respins la validarea workerului, fără conversia tacită a orei; editarea explicită poate pregăti configurația București pentru confirmare. Nu sunt migrate sau modificate date reale în acest lot.

UTC rămâne formatul de stocare al instantelor; nu este o alternativă de configurare. Europe/Bucharest aplică automat UTC+2 iarna și UTC+3 vara. Orele inexistente sau ambigue la schimbarea sezonieră păstrează verificările existente. Programările salvate și orele ISO cu offset nu sunt rescrise. Versiuni: prompt jarvis-31, tools 44. Producția nu este actualizată în acest lot.

Validări: 257/257 probe emulator au trecut. Regresia generală a trecut 1548 din 1550 probe, identificând două așteptări legacy pentru fusuri americane; după adaptarea lor la cerința nouă, ambele suite afectate au trecut 163/163 probe. Cele șase teste noi acoperă respingerea altor fusuri la intrările asistentului, ignorarea preferințelor incompatibile și diferența vară/iarnă în București. TypeScript, ESLint, UI și paritatea au trecut. Rămâne avertismentul preexistent useEffect/load. Probele sunt sintetice și nu reprezintă acceptarea unor scenarii originale noi; raportul istoric CONTINUATION_ACCEPTANCE nu este rescris ca dovadă a acestui lot.

Buildul complet a trecut cu TypeScript și 227/227 pagini; rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Regula București este implementată și validată local; producția rămâne la ultima versiune verificată 97ac8248 / build-2026-10-07-002.

## 7 octombrie: dovadă separată pentru ciclurile complete de reconciliere

Scanarea notificărilor păstrează acum începutul ciclului, dacă parcurgerea a fost observată de la început și dacă vreun lot a avut erori. La încheiere, checkpointul salvează lastCycle sub același token și lease ca progresul cursorului. O eroare individuală sau de interogare după un lot deja parcurs rămâne în dovada ciclului, chiar dacă ultimul lot reușește. O parcurgere completă ulterioară fără erori poate înlocui această dovadă. Un scanner care pierde lease-ul nu poate publica rezultatul ciclului.

Un cursor legacy fără metadate suficiente nu certifică parcurgerea de la început; prima încheiere este marcată cu acoperire necunoscută. După revenirea la început, ciclul nou poate produce dovada completă. O colecție goală produce o parcurgere validă, fără a pretinde verificarea unor inboxuri. Nu sunt introduse numărători globale în răspunsul public.

notificationReconciliation păstrează starea ultimului lot și adaugă lastCycle separat, cu început, finalizare și starea current/degraded/stale/unknown; datele temporale invalide nu produc dovadă. Nu se expun cursorul, căile utilizatorilor, tokenul sau volumele. Pragul de prospețime rămâne 15 minute. O parcurgere încheiată este o observație pe date live între loturi, nu un snapshot atomic și nici garanția că fiecare alertă este încă relevantă la momentul citirii raportului. Alertele legacy și conturile fără acces CRM rămân omise conform politicii existente.

Versiunea uneltelor este 45. Regula Europe/Bucharest rămâne neschimbată. Nu au fost lansate servicii externe sau mutate date reale. Producția nu este actualizată în acest lot; planul integral și acceptarea corpusului original rămân deschise.

Validări: 259/259 probe în emulator (18 fișiere) și 1558/1558 probe de regresie (127 fișiere) au trecut. Regresia include și corecțiile București din lotul anterior. TypeScript, ESLint pentru fișierele modificate și verificarea parității au trecut. Cele 10 probe noi verifică stările ciclului, timestampurile invalide, reluarea unui cursor legacy și colecția goală; probele existente extinse verifică păstrarea erorilor între loturi și protecția la pierderea lease-ului. Aceste probe sintetice nu măresc numărul scenariilor originale acceptate.

Buildul complet a trecut cu 227/227 pagini. Au rămas avertismentul cunoscut Jaeger și omiterea copierii Playwright în standalone. Nu s-au modificat dovezile ultimei publicări în producție.

## 7 octombrie: păstrarea limitelor rezultatelor în contextul comprimat

În E2, previzualizarea pentru model pierdea calificările unor rezultate mari: scoruri de matching posibil învechite, proveniența calculului, feedback istoric și limitele paginării live. Compresia păstrează acum aceste câmpuri lângă valorile originale, inclusiv poziția selectată și data evaluării unei alerte. Nu recalculează scoruri și nu transformă feedbackul istoric în evaluarea ofertei actuale.

Notele și identificatorii nu sunt scurtați în referințe sau afirmații diferite. Pentru rezultate structurate, dacă un rând și calificările sale depășesc bugetul, rândul este omis integral; dacă nici metadatele rezultatului nu încap, modelul primește o previzualizare goală, explicit incompletă, cu cererea de recitire. Compresia rămâne limitată în bytes, inclusiv pentru text multibyte. Rezultatele mici și continuarea câmpurilor text păstrează comportamentul existent.

Referințele din istoricul conversației sunt marcate historical și complete=false, cu sourceComplete separat. Păstrează avertismentele cardului, feedbackul datat și limitele comparației CRM. Cele maximum șase entități dintr-un card nu sunt prezentate drept o listă completă sau o recitire actuală. Se păstrează filtrarea câmpurilor de credențiale. Selecția și revalidarea accesului folosesc în continuare cititorii existenți; această modificare nu extinde durata seturilor salvate și nu autorizează acțiuni noi.

Versiunea uneltelor este 46. Regula Europe/Bucharest rămâne neschimbată. Lotul nu modifică producția, fluxurile providerilor, regulile Firestore sau stocarea datelor. Planul integral și cele 937 de scenarii originale încă nerevizuite rămân deschise.

Validări: 1571/1571 teste de regresie în 128 de fișiere, TypeScript, ESLint și verificarea parității au trecut. Cele 13 probe noi acoperă calificările matchingului, feedbackul datat, paginarea live, identificatorii integrali, bugete insuficiente sau invalide, rezultatele mici și referințele istorice. Fiind o transformare locală a contextului fără modificări ale tranzacțiilor sau UI, suitele emulator/UI nu au fost relansate pentru acest lot. Probele sintetice nu sunt scenarii originale acceptate suplimentar.

Buildul complet a trecut cu 227/227 pagini. Avertismentul Jaeger și omiterea copierii Playwright în standalone sunt cele cunoscute. Verificarea git diff --check a trecut.

## 7 octombrie: verificarea parametrilor drafturilor Meta

În E3/E5, reconcilierea meta_campaign_draft confirma anterior pregătirea numai din starea draft/ready/ready_to_publish. Verificatorul compară acum draftul recitit cu rezultatul original al handlerului și cu parametrii cererii: ID, agenție, autor, proprietate, obiectiv, tipul și valoarea bugetului, durata și moneda. Pentru opțiunile omise, valorile concrete din receipt rămân referința; verificarea nu inventează retrospectiv alte valori implicite. Numerele transmise ca string sunt comparate conform normalizării rutei existente.

Reconcilierea recitește și proprietatea cu accesul curent. Lipsa receiptului, valorile invalide, identitatea incompatibilă, parametrii modificați sau trecerea la o stare de publicare nu confirmă acest pas de pregătire. Rezultatul cere verificare în modulul dedicat și nu declanșează recreare, publicare sau polling fără rost pentru o neconcordanță constatată. Erorile de acces păstrează rezultatul unavailable; erorile tranzitorii de citire păstrează mecanismul existent de reverificare limitată.

Aceasta este dovada pregătirii cu parametrii ceruți, nu dovada publicării, performanței sau cheltuirii bugetului la Meta. Nu certifică neschimbarea tuturor câmpurilor creative editabile și nu înlocuiește aprobarea concretă înainte de publicare. Versiunea uneltelor este 47. Producția și regula Europe/Bucharest rămân neschimbate; planul integral rămâne deschis.

Validări: 1599/1599 teste de regresie în 129 de fișiere, TypeScript, ESLint și paritatea au trecut. Cele 28 de probe noi acoperă drafturi valide, schimbări de identitate și parametri, valori invalide, lipsa receiptului, opțiuni omise, normalizarea numerelor și integrarea în readPlanOutcomes, inclusiv acces revocat și absența mutațiilor. Nu s-au apelat provideri reali. Emulatorul și UI nu au fost relansate: lotul schimbă numai verificarea pe citire și reducerea rezultatului. Numărul scenariilor originale acceptate nu crește prin aceste teste sintetice.

Buildul complet a trecut cu 227/227 pagini; avertismentul Jaeger și omiterea copierii Playwright în standalone rămân cele cunoscute. git diff --check a trecut. Dovezile publicării în producție nu au fost modificate.

## 7 octombrie: București obligatoriu și în Apeluri AI

Extinderea cerinței E2 a identificat o excepție în modulul manual Apeluri AI: setările permiteau UTC/Chișinău și serviciul utiliza valoarea salvată pentru intervalul permis și plafoane. Acum setările returnate și consumate sunt normalizate la Europe/Bucharest, API-ul respinge explicit alt fus, iar interfața afișează o valoare fixă. Setările legacy sunt normalizate în memorie la citire și persistate la următoarea salvare; nu există o migrare în masă sau rescriere a instantelor ISO deja programate.

Verificarea intervalului orar, zilei și lunii folosește direct București inclusiv când un apel intern primește setări legacy. Lookbackul pentru plafonul zilnic include 25 de ore, apoi filtrează ziua locală, astfel încât prima oră a zilei de toamnă de 25 de ore nu dispare din numărătoare. Afișarea datelor, filtrarea după dată și statisticile paginii folosesc București indiferent de fusul browserului. Schimbările DST sunt aplicate de Intl, fără offset UTC fix.

Contractele generate și manifestul de paritate au fost actualizate. Versiunea uneltelor este 48. Lotul nu lansează apeluri reale și nu actualizează producția. Regula trebuie urmărită în continuare și la granițele providerilor publicitari: fusul tehnic al unui cont extern nu poate fi etichetat fals ca București; conversia prezentării și programării necesită audit separat. Planul integral rămâne deschis.

Validări: 1611/1611 teste de regresie în 130 de fișiere, TypeScript, ESLint și paritatea au trecut. Cele 12 probe noi verifică normalizarea setărilor legacy, respingerea altor fusuri fără scriere, citirea și salvarea setărilor, intervalul permis iarna/vara, plafonul în ziua de 25 de ore și costurile la granița lunii locale. Providerul este simulat; nu se apelează numere reale. Nu s-au relansat emulatorul sau verificarea vizuală în browser; modificarea simplă a controlului UI este verificată prin analiza statică și build. Scenariile originale acceptate rămân 63 din 1000.

Buildul complet a trecut cu 227/227 pagini, cu avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Dovezile producției rămân neschimbate.

## 8 octombrie: programări București în editorul TikTok Ads

Constructorii de reclame și grupuri folosesc Europe/Bucharest ca fus implicit și refuză alt fus de cont înainte de generarea payloadului. Fluxul de aprobare/publicare din workspace reverifică pe server fusul sincronizat al contului atât înainte de emiterea confirmării, cât și la publicare. Un cont incompatibil trebuie înlocuit cu unul configurat Europe/Bucharest; nu se schimbă setarea la provider și nu se reinterpretează orele drafturilor existente. Mesajele editorului explică această limită.

Conversia existentă a orelor locale în timestampurile UTC ale adaptorului păstrează schimbarea vară/iarnă și respinge orele ambigue/inexistente. Utilitarul tehnic de conversie generică rămâne disponibil pentru citirea datelor; nu este o opțiune de configurare în editor. Metadatele istorice ale contului extern rămân adevărate, inclusiv atunci când contul nu poate fi folosit la publicare. Nu se migrează campanii sau programări deja lansate și nu se schimbă operațiile de oprire a livrării.

Acest lot acoperă constructorii editorului și publicarea cu aprobarea workspace. Nu declară închis auditul tuturor operațiilor tehnice directe TikTok, al afișării programelor grupurilor externe sau al tuturor modulelor de marketing. Versiunea uneltelor este 49. Producția rămâne neschimbată; planul integral și acceptarea corpusului original sunt încă deschise.

Validări: 1624/1624 teste în 131 de fișiere, TypeScript, ESLint și paritatea au trecut. Cele 13 probe noi acoperă conturile incompatibile, conversia vară/iarnă, orele DST ambigue/inexistente și schimbarea fusului între preview și publicare fără pornirea scrierilor. Două probe inițiale aveau date de draft incomplete; după corectarea fixturelor, regresia integrală a trecut. Providerii sunt simulați. Emulatorul și verificarea vizuală nu au fost relansate pentru acest lot; mesajele UI sunt verificate static și prin build. Aceste teste nu cresc numărul scenariilor originale acceptate.

Buildul complet a trecut cu 227/227 pagini. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut; dovezile ultimei publicări în producție nu au fost modificate.

## 8 octombrie: dovezi distincte pentru programarea și încheierea apelurilor AI

Reconcilierea outreach_start leagă acum înregistrarea curentă de receiptul inițial, actor, agenție, anunț și telefonul canonic folosit de handler. Compară identitatea providerului când aceasta exista în receipt și păstrează exact instantul programării, inclusiv când două reprezentări ISO cu offset descriu aceeași oră. Telefonul din payloadul liber nu înlocuiește sursa canonică a handlerului.

O programare viitoare salvată și concordantă este confirmată ca programare, cu mențiunea că apelul nu este încă efectuat. O programare întârziată rămâne de urmărit. Un apel pornit sau încheiat înaintea momentului cerut nu confirmă respectarea programării. Pentru încheiere sunt necesare ID-ul providerului, timestampul de finalizare valid și semnalul de încheiere înregistrat de webhook. Starea completed singură nu este suficientă. Un webhook ulterior poate clarifica o lansare inițial incertă fără să relanseze apelul.

Confirmarea încheierii nu confirmă acordul proprietarului, colaborarea sau vânzarea. Eșecul și anularea rămân terminale; neconcordanțele și lipsa dovezii cer verificare în modulul dedicat. Erorile temporare de citire păstrează reverificarea limitată existentă. Datele telefonului și transcrierea nu sunt copiate în noua dovadă. Planurile legacy fără receipt complet nu sunt certificate automat.

Versiunea uneltelor este 50. Nu se modifică mecanismul de lansare, providerul, webhookul sau programările existente. Regula București și producția rămân neschimbate. Verificarea semantică a fiecărui obiectiv de business și restul planului integral rămân deschise.

Validări: regresia finală a trecut 1646/1646 teste în 132 de fișiere. Cele 22 de probe noi acoperă identitatea, telefonul, receiptul, finalizarea prin webhook, programarea și execuția prea devreme, plus integrarea în plan fără mutații. Prima rulare generală a intersectat ultima editare și a avut un eșec; suita țintită a trecut 61/61 și apoi regresia integrală a fost relansată cu succes pe codul final. ESLint și paritatea au trecut. Nu s-au apelat provideri reali, nu s-au relansat emulatorul sau UI și nu s-au adăugat scenarii originale la cele 63 acceptate.

Buildul complet, inclusiv TypeScript și 227/227 pagini, a trecut. Rămân avertismentul cunoscut Jaeger și omiterea copierii Playwright în standalone. git diff --check a trecut. Dovezile producției rămân neschimbate.

## 8 octombrie: dependențe tipizate între pașii planului

Resolverul de dependențe verifică acum că identificatorul din receipt are același tip cu cel cerut de câmpul destinație. Un propertyId nu poate fi legat de contactId și un assetId nu poate fi legat de projectId, chiar dacă valorile lor textuale coincid. Numărul pasului din rezultatul salvat trebuie să corespundă poziției referite, atunci când acel câmp există. Protecția se aplică și URL-ului media verificat și scenariului generat. Rezultatele legacy fără numărul explicit păstrează compatibilitatea pozițională existentă.

ID-urile rezultatului respectă contractul comun de lungime și cale și nu pot rămâne referințe @step nerezolvate. Listele de ID-uri pentru tipurile deja cunoscute sunt rezolvate cu același control, inclusiv propertyIds și sourceAssetIds; ordinea și ID-urile literale sunt păstrate. Aceasta permite folosirea unei proprietăți nou create într-o listă de recomandări fără a permite referințe către clienți în acea listă. Propunerea aprobată nu este modificată în loc, iar revalidările ulterioare ale accesului și reviziilor rămân active.

Versiunea uneltelor este 51. Modificarea întărește E1/E3, fără să certifice toate criteriile semantice de business sau să închidă planul integral. Nu au fost schimbate producția, regula București, providerii sau aprobările domeniilor.

Validări: 1659/1659 teste de regresie în 132 de fișiere, TypeScript, ESLint și paritatea au trecut. Cele 13 probe noi acoperă tipurile incompatibile, numerele de pas invalide, ID-urile prea lungi sau nerezolvate, ordinea listelor și legarea URL-urilor/scenariilor. Fluxurile async-pipeline și verified-outputs au trecut în regresie. Providerii sunt simulați; emulatorul și UI nu au fost relansate pentru această transformare a parametrilor. Nu au fost acceptate scenarii originale suplimentare prin aceste teste sintetice.

Buildul complet a trecut cu 227/227 pagini. Rămân avertismentul cunoscut Jaeger și omiterea copierii Playwright în standalone. Dovezile ultimei publicări în producție nu au fost modificate.

## 8 octombrie: rezultate mixte cu efecte externe încă nesoluționate

Agregarea rezultatului păstrează WAITING_PROVIDER când un pas este nereușit, dar alt pas așteaptă încă furnizorul. Dacă există și un efect incert, starea rămâne BLOCKED, cu numărătorile de așteptare și eșec păstrate. FAILED sau PARTIALLY_COMPLETED sunt stabilite după soluționarea acestor așteptări și incertitudini. O eroare de citire nu devine dovadă de eșec al operației externe și nu declanșează retrimiterea ei.

Mesajul rezultatului mixt precizează separat numărul rezultatelor confirmate, pașilor nereușiți, așteptărilor și incertitudinilor. Pauza și anularea explicită păstrează prioritatea. Acoperirea cererii nu înlocuiește așteptarea activă cu o clarificare sau limitare a altei cerințe. Monitorul existent salvează rezultatul și continuă verificarea în limita termenului deja stabilit; nu se schimbă durata, lease-ul, accesul sau receipts-urile.

Versiunea uneltelor este 52. Validări: 79/79 teste țintite și 1671/1671 teste de regresie în 132 de fișiere, ESLint și paritatea au trecut. Cele 12 probe noi acoperă ordinea rezultatelor, eșec/anulare/inaccesibilitate, incertitudine, pauză, acoperirea cererii, citirea repetată a două joburi video și persistența monitorului până la soluționare. Providerii și persistența sunt simulate; emulatorul și UI nu au fost relansate pentru schimbarea reducerului. Nu cresc cele 63 de scenarii originale acceptate. Regula București și producția rămân neschimbate; E1/E3 și restul planului integral nu sunt declarate închise.

Buildul complet, inclusiv TypeScript și 227/227 pagini, a trecut. Rămân avertismentul cunoscut Jaeger și omiterea copierii Playwright în standalone. git diff --check a trecut; dovezile producției nu au fost modificate.

## 8 octombrie: concordanța dovezilor media înainte de continuare

Legarea materialelor verificate de rezultatele pașilor nu mai selectează prima observație favorabilă ignorând alte observații ale aceluiași pas. Înainte de legare, toate observațiile acelui pas trebuie să confirme finalizarea și să conțină aceleași outputs validate. Duplicate identice sunt acceptate indiferent de ordinea câmpurilor; ID-uri/URL-uri diferite, lipsa outputs într-o observație concurentă, finalizarea neconfirmată sau un output invalid opresc legarea. Nu se combină fragmente provenite din dovezi contradictorii.

Numărul explicit al pasului din receipt trebuie să corespundă poziției pentru care se leagă dovada. Receipts legacy fără număr păstrează compatibilitatea pozițională. Rezultatele originale nu sunt modificate în loc, iar regulile existente care împiedică înlocuirea unui material deja legat rămân active. Protecția completează verificările E3/E4; nu reprezintă acceptanța integrală a fluxurilor externe.

Versiunea uneltelor este 53. Au trecut 50/50 teste țintite și 1681/1681 teste de regresie în 132 de fișiere, ESLint și paritatea. Cele 10 probe noi verifică contradicțiile în ambele ordini, numerele de pas incompatibile, duplicatele identice, separarea pașilor și outputs invalide. Fluxul async video/import/draft a trecut în regresie. Nu s-au folosit provideri reali și nu s-au relansat emulatorul sau UI pentru această verificare pură a dovezilor. Numărul scenariilor originale acceptate rămâne 63. Producția și regula București nu au fost schimbate; planul integral rămâne deschis.

Buildul complet, inclusiv TypeScript și 227/227 pagini, a trecut. Rămân avertismentul cunoscut Jaeger și omiterea copierii Playwright în standalone. Dovezile producției nu au fost modificate.
