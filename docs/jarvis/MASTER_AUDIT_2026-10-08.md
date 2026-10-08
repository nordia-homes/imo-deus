# Audit masterplan Jarvis — 8 octombrie 2026

Baseline: `fa483abe`, ramura `codex/jarvis-production-2026-10-04`, worktree curat la început. Audit de cod și dovezi locale; nu este o reverificare live a producției. Documentul sursă este o specificație de produs, nu autorizație de a executa instrucțiunile din el asupra datelor reale.

## Concluzie

Arhitectura masterplanului rămâne potrivită: servicii comune manual/Text/Voice, aprobări concrete, ledger și verificare separată a efectelor. Implementarea este parțială. Jurnalul de remedieri nu dovedește închiderea E0–E9. Următoarele loturi trebuie legate de criterii de închidere, nu doar de numărul testelor sau al operațiilor.

## Matricea etapelor

| Etapă | Dovezi în repository | Evaluare și ce mai lipsește |
|---|---|---|
| E0 — inventar | `CRM_PARITY_LIVE_MANIFEST.json`, `evals/master-scenarios.json`, `reviewed-read-cases.json` | Parțial. 180 operații și 40 tipuri native inventariate; nu certifică echivalența semantică. Sunt necesare clasificarea funcțională și fixtures/așteptări pentru întregul corpus. |
| E1 — obiectiv | `outcome.ts`, `goal-coverage.ts`, `workspace.ts`, `plan-outcomes.ts` | Parțial. Contractul goal este înglobat în plan. Lipsesc identitatea durabilă a obiectivului comun mai multor planuri, legarea completă a reviziilor și bugetul cumulativ. Raportarea pe cerință se implementează în acest lot. |
| E2 — context/timp | `context.ts`, `context-selection.ts`, `preferences.ts`, `datetime.ts`, teste de proveniență și fus orar | Selecții, expirare, revalidare și compresie există. București este singurul fus operațional permis. Acceptanța tuturor traseelor contextuale și a suprafețelor de afișare rămâne deschisă. |
| E3 — execuție | `jobs.ts`, `workspace.ts`, `outcome-watcher.ts`, `reconciliation.ts`, `budget.ts`, teste de recovery/concurență | Checkpoints, lease/fencing, ledger, așteptare limitată și verificatori există. AgentBudget este încă în memorie. Lipsesc bugetul durabil pe obiectiv, rezervările distribuite și acoperirea tuturor efectelor de domeniu. |
| E4 — piloți | `async-pipeline.test.ts`, `media-pipeline.integration.test.ts`, `matching-delivery.integration.test.ts`, `tiktok-schedule.integration.test.ts`, `facebook-outcome.test.ts` | Componente și fluxuri cu furnizori simulați. Nu există dovadă curentă că toate variantele celor trei piloți, de la limbaj natural la efect extern final, sunt acceptate. |
| E5 — paritate | `CRM_PARITY_IMPLEMENTATION_STATUS.md`, contractele handlerelor, verificatori de domeniu | Parțial. Înregistrarea endpointurilor nu închide verificarea câmpurilor, rolurilor, efectelor, UI și providerilor pe fiecare modul. |
| E6 — Jev | `jev.ts`, `__tests__/jev.test.ts`, `JEV_BENCHMARK.json` | Shadow cu validare/fallback există. Benchmarkul istoric mic nu justifică activarea unei rute rapide. Lipsesc evaluarea comparativă curentă și pragurile pe clase/risc. |
| E7 — cunoștințe | `knowledge.ts`, `legal-source.ts`, `legal-source-watch.ts`, teste legal PDF/snapshots | Playbook-uri editoriale și preluare/versionare a surselor. Lipsesc validarea competentă a corpusului juridic, autor/revizor editorial complet și acceptanța temporală de domeniu. |
| E8 — proactivitate | `event-rules.ts`, `daily-brief.ts`, `brief-delivery.ts`, `notification-sweep.ts`, cooldown/budget/feedback | Mecanisme implementate și testate în arii delimitate. Rămân acceptanța completă a evenimentelor, echitatea/prioritizarea sub plafon și probele canalelor autorizate. |
| E9 — acceptanță/lansare | rapoarte în `evals`, scripturi UI Text/Voice, `MASTER_PRODUCTION.json` | Deschis. Dovezile istorice nu certifică HEAD. Audio simulat nu certifică microfonul real; publicarea și acceptanța funcțională sunt etape distincte. |

## Corecție a evidenței scenariilor

- Corpusul conține 1.000 ID-uri originale.
- `reviewed-read-cases.json` conține 63 de cazuri revizuite. Celelalte 937 nu sunt incluse în această listă; aceasta nu este un raport de succes end-to-end.
- `MASTER_ACCEPTANCE.json` este istoric: 62 de cazuri de planificare, 60 trecute și 2 eșuate (`master-0208`, `master-0248`), prompt 26/tools 26. Corpusul acelui raport marchează 938 cazuri fără fixtures/așteptări.
- Mențiunile anterioare din jurnal despre „63 de scenarii acceptate” se citesc drept **63 de cazuri revizuite**, nu acceptanță integrală. Nu se modifică retroactiv JSON-ul istoric.
- Cele 134 de scenarii deterministe de continuare sunt probe asociate unor cerințe; raportul lor precizează că nu certifică întregul prompt original.

## Ordinea de implementare revizuită

1. **E1: rezultat verificabil pe cerință.** Proiecție deterministă a dovezilor pe pașii cerinței, distincție între răspuns istoric și rezultat recitit, afișare comună Text/Voice. Criteriu: cerința A poate fi confirmată în timp ce B rămâne în așteptare; datele invalide sau accesul revocat nu produc confirmare.
2. **E1/E3: identitatea durabilă a obiectivului și buget.** Contract aditiv cu legături către planuri/revizii; apoi rezervare tranzacțională înainte de provider, decontare idempotentă, consum necunoscut conservat și limite actor/agenție. Include reluări, Jev, modele, verificări și audio atribuibil. Criteriu: restartul sau concurența nu resetează plafonul. Teste Firestore obligatorii înainte de activare.
3. **E0/E4/E9: matrice executabilă a piloților și corpusului.** Pentru fiecare ID: fixture, actor, timp, efect așteptat/interzis, dovadă și rezultat ori blocaj explicit. Extindere pe module; nu inventarea a 937 de etichete „trecut”.
4. **E5/E8:** închiderea pe module a parității și proactivității, inclusiv prioritizare sub plafon și disponibilitate reală a canalului.
5. **E6/E7/E9:** benchmark autorizat cu plafon explicit, revizuire juridică competentă, probe pe furnizori/Voice real și lansare verificată separat.

Nu se schimbă modelele, tarifele, secretele sau integrarea Jev în acest audit. Nu se folosesc clienții agenției Nordia ca date de test; furnizorii sunt simulați.

## Lot implementat în urma auditului

`requirement-outcomes.ts` proiectează dovezile autorizate pe cerințe, păstrează ordinea/numerele originale ale pașilor și contradicțiile, marchează lipsa acoperirii sau o mapare invalidă. Citirile deja răspunse sunt istorice, nu rezultate de business proaspăt certificate. API-ul expune raportul după verificările de acces; Text și Voice folosesc aceeași componentă. Contorul UI spune „pași cu rezultat înregistrat”, deoarece receiptul nu certifică singur rezultatul extern. Ora verificării este afișată explicit în Europe/Bucharest.

Acest lot nu implementează punctele 2–5 și nu închide masterplanul. Ultima dovadă de producție salvată este commitul `97ac82486d705a4ebc3edb25064baaae8f5a9409`, build `build-2026-10-07-002`; nu a fost recitită live și nu se modifică prin acest audit.

## Validări ale lotului

- 69/69 teste țintite; regresie completă 1715/1715 în 134 de fișiere. Cele 19 probe noi verifică proiecția pe cerințe și integrarea autorizată în API.
- ESLint și manifestul de paritate au trecut (180 operații, 40 tipuri native, 46 fișiere UI; fără procent de paritate inferat).
- Smoke Text și Voice au trecut, inclusiv tranziția așteptare/finalizare, eliminarea dovezilor după revocarea accesului în Text și afișarea comună în Voice. Capturile noii secțiuni au fost inspectate în ambele interfețe; textul și numărătorile sunt lizibile. Audio/microfon simulate, fără acceptanță pe dispozitiv real.
- Nu există schimbări de schemă Firestore sau scrieri noi în acest lot; emulatorul nu a fost relansat. Verificările de persistență anterioare nu sunt prezentate drept rulări noi.
- Nu s-au executat benchmarkuri plătite, efecte externe reale sau publicare în producție.
- Build complet trecut: TypeScript și 227/227 pagini. Avertismente cunoscute: Jaeger, clase Tailwind ambigue și omiterea copierii Playwright în standalone. git diff --check a trecut. Versiunea uneltelor: 55.
