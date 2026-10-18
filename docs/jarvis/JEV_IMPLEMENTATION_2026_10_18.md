# Jev — implementare modulară și revenire — 18 octombrie 2026

## Stare și limite

Implementare izolată pe ramura codex/jev-modular-20261018. Nu este publicată. Nu au fost efectuate apeluri Jev/OpenAI cu plată sau mesaje/postări externe pentru această validare. JARVIS_JEV_MODE rămâne shadow în configurația de producție existentă.

Moduri: off dezactivează apelul Jev, păstrând catalogul modular; shadow înregistrează propunerea fără a o aplica; active adaugă domeniile candidate la selecția locală. O valoare necunoscută dezactivează selecția externă. Modul active nu a fost calibrat pe Jev real și nu este recomandat pentru activare globală înaintea comparației live autorizate.

## Implementare

- capability-catalog.ts definește domeniile, dependențele, termenii de selecție locală, asocierea uneltelor și activarea regulilor pe operații. Schemele și drepturile rămân în registrul și serviciile existente.
- policy.ts păstrează toate cele 77 de expresii originale în blocuri identificate. JEV_POLICY_BASELINE.json și testul AST verifică păstrarea textelor și clasificării. Regulile comune rămân prezente; fluxurile focalizate existente își păstrează politicile.
- Plannerul păstrează traseele deterministe existente. Numai fluxul general utilizează noua selecție. Setul autorizat este separat de setul afișat. load_capabilities poate solicita domenii și până la șase unelte concrete autorizate.
- Un apel neașteptat care necesită alte instrucțiuni încarcă domeniul înainte de pregătirea acțiunilor și cere repetarea acelui apel. Nu execută și nu pregătește acțiuni în acel pas. Încărcarea capabilităților nu este dovadă de rezultat CRM.
- Încărcarea are un plafon pentru instrucțiuni și scheme. Dacă acumularea depășește plafonul, se încearcă domeniile solicitate pentru pasul curent; rezultatele și acțiunile deja pregătite rămân în starea plannerului. Cererile imposibil de încadrat sunt raportate explicit. Nu există promisiune de context nelimitat.
- Adaptorul Jev folosește jev-1.13.0 și întrebări noul pentru fiecare domeniu într-un singur apel. Pragul 0,35 favorizează includerea domeniilor incerte; este un prag inițial necalibrat. Selecția activă este aditivă: nu poate elimina un domeniu identificat local.
- Adaptorul este injectabil separat de modelul principal. Timeout, circuit breaker, răspuns limitat, schemă validată, lipsă cheie și context prea mare au fallback local. Cererea Jev nu este tăiată; dacă nu încape, nu este trimisă.
- Rezervările disting plafonul unui apel de consumul cumulat, fără creșterea plafonului existent de 70.000. Schimbarea instrucțiunilor/schemelor invalidează estimarea bazată pe consumul anterior. Numărarea conservatoare a octeților rămâne fallback, nu tokenizer exact.
- Telemetria include modul, modulele propuse/încărcate, extinderile, latența și costul Jev. Consumurile estimate sunt marcate incomplete. Nu sunt logate cereri, istorice sau chei în această telemetrie.

## Istoric și scop

Nu au fost șterse mesaje și nu a fost introdusă comprimarea conversației pentru această remediere. Limitele existente din sessionHistory/contextMessages rămân: până la 40 de mesaje citite și context recent limitat. Nu s-a implementat în acest lot recuperarea arbitrară a întregului istoric de către model. Datele originale rămân în stocare, supuse verificărilor de acces existente.

Scopul original al comenzii rămâne în planner; Jev nu îl înlocuiește. goal_coverage și verificările executorului rămân active. Acestea nu constituie o demonstrație semantică automată pentru toate formulările naturale.

## Validare și interpretarea rezultatelor

- Corpusul de 1000 de cereri: JEV_CORPUS_SELECTION.json măsoară selecția euristică locală și dimensiunea contextului. Nu este benchmark de precizie Jev și nu certifică execuția celor 1000 de scenarii.
- JEV_CONTEXT_COMPARISON.json compară contextul serializat complet cu asamblarea modulară pentru aceleași intrări sintetice. Reducerea octeților nu reprezintă economie de tokenuri facturabile sau latență măsurată la furnizor.
- Jev real nu a fost apelat pentru testare, conform interdicției de cheltuieli externe. Avantajul suplimentar Jev față de selecția locală rămâne neconfirmat. În forma aditivă, poate evita descoperiri ulterioare, dar poate și adăuga context și latență.
- Testul de vizionare folosește plannerul, citirile și executorul real cu Firestore local, cu furnizori AI sintetici. Verifică normalizarea Cișmigiu/Cismigiu, crearea cumpărătorului, salvarea vizionării la 07:30 București, confirmarea și reluarea fără duplicate. Nu certifică interpretarea unui model live sau livrarea WhatsApp.

## Revenire rapidă: păstrează arhitectura modulară

Setează JARVIS_JEV_MODE=off în mediul serverului și repornește procesul local. Nu modifica cheia și nu o pune în NEXT_PUBLIC_. Pentru producție, modificarea configurației și lansarea sunt acțiuni separate, neautorizate de această implementare. Nu schimba direct traficul Cloud Run în afara mecanismului App Hosting.

## Revenire completă locală

Checkpoint: 8dcee44c9f7b34f06e6fcdac3487a6a15817bb96, ramura codex/jev-safety-20261018. Include cele nouă fișiere cu modificări de cod/documentație necomise la început. Directorul original D:/imo-deus a rămas pe această ramură; implementarea este în worktree separat.

1. Oprește serverul local care rulează worktree-ul Jev, dacă există.
2. Rulează node scripts/jarvis-jev-checkpoint.mjs --local-backups din worktree-ul implementării pentru verificarea obiectelor Git și a copiilor private.
3. Pornește aplicația din D:/imo-deus, după verificarea că HEAD este checkpoint-ul de mai sus. Nu folosi git reset --hard.
4. Dacă directorul original a primit ulterior alte modificări, păstrează-le și creează un worktree nou din commitul checkpoint; nu le suprascrie.
5. Copiile locale excluse din Git sunt în D:/imo-deus/.tmp/jev-checkpoint-20261018: .env.local, hosting.cache și production-runtime.private.json. Restaurează .env.local numai dacă trebuie revenită și configurația locală; verifică înainte dacă au fost rotite cheile. Nu copia configurația privată în Git sau în mesaje.

## Revenire completă producție, numai după autorizare ulterioară

Producția verificată: proiect studio-652232171-42fb6, backend studio, regiune us-central1, build build-20261017-jarvis-140, commit c06958bc203423f29634de06743221374ce7c4d3, READY, trafic 100%, Jev shadow. Este diferită de checkpoint-ul local. Metadatele sunt în JEV_ROLLBACK_CHECKPOINT.json.

Dacă o lansare viitoare trebuie anulată:
1. Recitește traficul și verifică faptul că buildul vechi este încă disponibil și READY, cu SHA-ul de mai sus.
2. Pregătește un rollout App Hosting către acel build, nu un rebuild al codului vechi cu dependențe/configurații actualizate. Contractul folosit de helperul existent: POST /v1beta/projects/studio-652232171-42fb6/locations/us-central1/backends/studio/rollouts?rolloutId=ID_UNIC, body {"build":"projects/studio-652232171-42fb6/locations/us-central1/backends/studio/builds/build-20261017-jarvis-140"}.
3. După autorizare și aplicare, așteaptă încheierea operației și verifică traficul 100%, lipsa reconcilierii, buildul și probele funcționale autentificate.
4. Compară configurația cu copia privată; nu restaura mecanic secrete rotite. Dacă buildul nu mai există, reconstruirea commitului vechi este o procedură distinctă, care necesită validare.

Nu există migrări de schemă Firestore, ștergeri de date, modificări de indexuri, workere sau schimbări de chei de idempotency în acest lot. Revenirea codului nu anulează acțiunile reale deja efectuate și nu trebuie să le retrimită. Observarea și verificarea metadatelor sunt realizate; un rollback real de producție nu a fost executat.

## Surse de contract

https://docs.typesafe.ai/api
https://docs.typesafe.ai/models
https://docs.typesafe.ai/confidence

## Rezultate finale locale

Compilare completă trecută (exit 0), pe o copie cu surse runtime identice de pe D:, cu NODE_OPTIONS=--max-old-space-size=8192. Worktree-ul de pe C: reutilizează dependențe de pe D:, ceea ce a necesitat această copie pentru Webpack. Nu sunt modificări de produs pentru remedierea mediului.

Regresii: 2543 teste unitare / 196 fișiere și 74 teste în emulator; verificări țintite suplimentare după ultimele corecții. Numerele rundelor țintite se suprapun cu suita generală și nu se însumează. Inventar: 181 operații, 41 acțiuni native, 46 fișiere UI; contorul existent rămâne 263 dovezi locale / 1000 și 0 certificări E2E integrale.

Comparație pe același fixture al plannerului, cu Jev off: cererea de vizionare cu istoric rezerva 69851 pentru intrare + 2200 pentru răspuns și era oprită înaintea modelului în checkpoint. Versiunea modulară rezervă 34545 + 2200 și ajunge la model. Aceste valori sunt estimările de rezervare, nu tokenuri facturate. Consultați JEV_PLANNER_COMPARISON.json.

Detalii: [raport de validare](evals/JEV_IMPLEMENTATION_VALIDATION.json). Nu s-a publicat și nu s-a schimbat configurația producției.

## Publicare autorizată — 18 octombrie 2026

Implementarea a fost publicată ulterior la cererea explicită a utilizatorului, împreună cu toate modificările de aplicație din ramura de lucru: 34 de commituri după producția anterioară. Build build-20261018-jarvis-171, commit 0182bc7eeed3dcb20f322584b6a966cde2b7c5e0, trafic 100%, Jev off. Verificările infrastructurii, probelor HTTP și rulării automate după activare au trecut. Raport: RELEASE_2026_10_18.json. Checkpointurile de revenire de mai sus rămân păstrate. Validarea publicării nu certifică execuția tuturor celor 1000 de scenarii.

## Jev Facebook workflow routing (jarvis-178)

The selector now asks whether the request includes the Facebook property-publication workflow in the existing Jev API call, alongside independent domain questions. Model stays pinned to jev-1.13.0. A positive or uncertain workflow hint loads marketing and the existing authorized facebook_publication_preflight tool before the main model call. It does not extract CRM identifiers, authorize actions, discard other requested domains, or execute directly. Explicit Facebook context also exposes this preflight locally when Jev is off. Exact account choices and confirmations retain the faster deterministic path and do not incur a selector call.

The existing preflight resolves the property, owned account and eligible groups and prepares the existing publication action; the planner retains full goal coverage and execution uses the cloud job ledger and receipts. All tool authorization remains in the registry. Workflow hints are recorded in capabilityRouting telemetry. There is no additional network round trip beyond the existing selector. Its existing 1200ms HTTP timeout / 1500ms planner ceiling, circuit breaker and local fallback remain in force.

Verified with 38 unit/planner/context checks and 86 Firestore integration checks. Active, shadow, off and unavailable modes all finish with one saved cloud job and one runner dispatch on replay; each scripted semantic path uses four main-model turns. This is controlled-provider evidence, not a measured live speed or cost advantage. The active hint makes preflight available without discovery when the wording does not locally rank Facebook tools. Actual recognition quality, p50/p95 latency and provider cost require live comparative evaluation. No paid Jev/model calls or real Facebook posts were made. Facebook's own execution time is outside this optimization.

The original policy baseline was stale for prospecting-00 after the user-approved jarvis-175 conversational guidance. Only that block was updated, preserving its previous expression in reviewedUpdates; the full policy preservation test now passes. Logs: D:/imo-deus/.tmp/jev-facebook-tests.log, jev-facebook-regression.log, jev-facebook-policy.log, jev-facebook-integration.log, jev-facebook-lint.log. The first regression log includes the stale-baseline failure; the policy rerun passed.

Official contract checked: https://docs.typesafe.ai/introduction (typed decisions; multiple independent questions in one call). No generation API or arbitrary identifier extraction was added.

Activation: deploy this code, configure server-side TYPESAFE_API_KEY and JARVIS_JEV_MODE=active. Shadow observes but does not apply workflow selection. Off preserves local preflight discovery and semantic execution. Production configuration was not changed in this task. Rollback: turn Jev off, or revert this change set to 0058d5e1; preserve job and execution records. No migration. This lot is not deployed.

Final verification: production build passed, including TypeScript and 227 pages (jev-facebook-build-final.log). Initial build detected an inferred dynamic-schema typing error; the validated domain answer map now has an explicit TypeScript type and the 23 adapter/planner checks passed again. Existing Genkit/OpenTelemetry and local standalone Playwright-copy warnings remain. No production deployment.

Deployment update: build-20261018-jarvis-178 is READY and serves 100% App Hosting and Cloud Run traffic, verified 2026-10-18T15:23:48.483Z. Source 95561964da7735550da6f8d8caf6afdfb73f64db includes account-confirmation corrections and Jev Facebook workflow routing. Jev mode is active and its secret binding is present. Public page 200; protected APIs 401 without credentials. No real publication or paid model test was performed. See RELEASE_2026_10_18_JEV_FACEBOOK.json; this supersedes the pending-release statements for jarvis-177/178.
