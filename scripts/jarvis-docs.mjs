import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = process.cwd(), output = path.join(root, 'docs/jarvis');
await fs.mkdir(output, { recursive: true });
const read = file => fs.readFile(path.join(root, file), 'utf8');
const operations = [...(await read('src/lib/ai-assistant/operations.ts')).matchAll(/^  (\w+): \{ method: '([^']+)',.*?path: '([^']+)'.*?description: '([^']+)'/gm)].map(([, name, method, route, description]) => ({ name, method, route, description }));
const core = [...(await read('src/lib/ai-assistant/tool-schemas.ts')).matchAll(/^  (\w+): \[/gm)].map(match => match[1]);
const actionSection = (await read('src/lib/ai-assistant/contracts.ts')).split('export const actionSchema =')[1].split('export type AssistantAction')[0];
const actions = [...actionSection.matchAll(/kind: z.literal\('([^']+)'\)/g)].map(match => match[1]);
const bench = JSON.parse(await read('.tmp/jarvis-evals/live-benchmark.json'));
if (bench.environment !== 'synthetic_fixture_live_openai' || bench.results.length !== 70) throw new Error('A complete 35-case two-model benchmark is required for these docs.');
await fs.writeFile(path.join(output, 'BENCHMARK_RESULTS.json'), JSON.stringify(bench, null, 2) + '\n');
const validation = await read('.tmp/jarvis-evals/validation.json').then(JSON.parse).catch(() => ({ status: 'Final checks pending; consult generated test reports.' }));
const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/).filter(Boolean).map(line => ({ status: line.slice(0, 2), file: line.slice(3).replace(/^"|"$/g, '') })).filter(row => !row.file.startsWith('docs/jarvis/'));
const luna = bench.models['gpt-6-luna'], sol = bench.models['gpt-6.1-sol'];
const pricingSources = '[Pricing](https://developers.openai.com/api/docs/pricing), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [Responses tools](https://developers.openai.com/api/docs/guides/function-calling).';
const link = file => `[${file}](${file})`;
const docs = {
  'ARCHITECTURE.md': `Jarvis este orchestrator server-side peste ImoDeus. Web și Electron folosesc aceleași API-uri autentificate și același nucleu. Nu se instalează Hermes și nu există o bază CRM paralelă.

\`UI → workspace API → durable job/controller → bounded planner → router/provider → registry → permissions → existing services → matching-engine/Firestore/domain queues\`.

Auditul inițial este în ${link('IMPLEMENTATION_AUDIT.md')}. Modulele separă provider, modele/prețuri, bugete, schemă, registry, dispatch, contexte, memorie, approvals, politici, joburi și observabilitate. Registrul are ${core.length} tools core și ${operations.length} adaptoare de handler; ${actions.length} tipuri de acțiuni validate ajung exclusiv în executorul cu ledger.

Firestore păstrează conversațiile, planurile, ledger-ele, memoria proprie, seturile contextualizate, telemetria, politicile și joburile. Datele CRM rămân în colecțiile și serviciile existente. Deploymentul, backfillul și aprobările conturilor externe sunt operații distincte de implementarea locală.`,
  'AGENT_LOOP.md': `planTurn folosește Responses API într-o buclă read/plan/tool/observe, maximum 12 pași și 24 tools, 70.000 tokens cumulați, 0,12 USD, 120 s și 2.200 output tokens per apel. Se rezervă costul/tokens conservator înainte de fiecare apel; provider usage înlocuiește estimarea când există.

Modelele primesc schema funcțiilor disponibile; câmpurile simple au schema strictă nativă, iar payloadurile heterogene au JSON în string, validat apoi de Zod. Răspunsul final are schema text/intentStatus. Schema acțiunii se descoperă la cerere; propose_actions cere obligatoriu lista actions, inclusiv pentru un pas.

O eroare de infrastructură are maximum un retry pe același model. Două răspunsuri provider invalide sau trei apeluri tool invalide justifică Sol dacă există buget. Citirile simple tranzitorii 429/502/503/504 au maximum două încercări în deadline-ul toolului; scrierile și tools compuse nu se repetă automat. Timeouturile, accesul revocat și resursele lipsă nu justifică un model mai scump.

Rezultatele sunt validate înainte să ajungă în cards/context. Repetarea identică peste două apeluri este oprită; limitele globale împiedică buclele cu payloaduri ușor diferite. Datele calendaristice vin din resolve_datetime sau ISO explicit al agentului. Partial/incomplete nu înseamnă succes. Numai executorul confirmat poate produce efecte CRM.

Planurile compuse folosesc numai ID-uri confirmate anterior: campaignId, draftId, templateId și jobId sunt normalizate din răspunsurile reale ale handler-elor. Mesajele externe cer text/șablon concret în previzualizare; textul unui pas viitor nu poate fi aprobat printr-o referință. Excepția aiPresenterScript acceptă scenariul deja confirmat și limitat la 12.000 caractere.`,
  'TOOLS.md': `Registry = contract callable, schemă input/output, versiune, permissions, risc READ/SAFE_WRITE/SENSITIVE/CRITICAL, timeout, retry, idempotency și audit. Handler-ele mutante nu sunt callable direct din model; existing_read acceptă exclusiv operații readOnly. Contractele handler-elor existente sunt generate în handler-contracts.json și validate din nou de handler.

Tools core (${core.length}):

${core.map(name => '- ' + name).join('\n')}

Acțiuni (${actions.length}):

${actions.map(name => '- ' + name).join('\n')}

Adaptoare existente (${operations.length}):

| Tool | HTTP | Handler | Comportament |
| --- | --- | --- | --- |
${operations.map(op => `| ${op.name} | ${op.method} | ${op.route} | ${op.description} |`).join('\n')}

Nu există generic HTTP, filesystem, shell, Firestore write sau tool de acordare a consimțământului. URL-urile de import au surse HTTPS exacte autorizate. Discovery filtrează după rol și flags; storia_unpublish, meta_campaign_publish, tiktok_capabilities și sales_settings_update necesită admin, iar handler-ele păstrează verificările suplimentare proprii.`,
  'MODELS.md': `DEFAULT MODEL = GPT-6 Luna (gpt-6-luna). COMPLEX MODEL = GPT-6.1 Sol (gpt-6.1-sol). Allowlistul are exact două ID-uri; orice alt model, inclusiv GPT-6 Astra și GPT-5.6 Sol, este refuzat chiar dacă vine din env sau prompt.

OPENAI_ASSISTANT_MODEL și JARVIS_SOL_MODEL pot confirma doar mappingul logic obligatoriu, nu îl pot schimba. Luna folosește low, Sol medium la escaladare. Adapterul Responses include encrypted reasoning pentru continuitatea protocolului; chain-of-thought nu se afișează și nu se persistă în istoric/telemetrie. store=false.

Generarea scenariilor video pornită de Jarvis folosește același provider și contabilizează costul auxiliar. Video_create cu presenter cere aiPresenterScript furnizat explicit; jobul nu generează text ulterior printr-un model legacy. Media/voice providers existente sunt integrări de randare, cu propriile configurații și costuri; nu sunt modele de raționament Jarvis.`,
  'ROUTING.md': `Luna-first este politică executabilă, nu o etichetă UI. Semnalele permise: invalidCalls>=3, planningFailures>=2, dependencyDepth>=5 împreună cu estimatedTools>=8, sau prag de calitate documentat din eval. Sol necesită flag activ și minimum 0,015 USD rămas; reserve verifică întregul apel înainte de execuție.

Importanța agentului, prețul proprietății și lungimea promptului nu sunt motive de escaladare. Un singur tool invalid, timeout sau outage nu declanșează Sol. Runtime-ul escaladează pe eșecuri validate repetate; semnalele de complexitate/eval sunt disponibile în router pentru workflowuri care furnizează asemenea dovezi, nu sunt fabricate din text.

Ținta 90–95% taskuri obișnuite pe Luna este un obiectiv de producție, nu un procent introdus în cod. Telemetria calculează proporțiile reale și returnează null pentru zero observații. Benchmarkul fix pe fiecare model nu măsoară proporția de routing în producție.`,
  'COSTS.md': `Tarife Standard USD/1M tokens, versiunea openai-standard-2026-10-04: Luna input 0,10, cached input 0,01, cache write 0,125, output 0,50; Sol input 2,00, cached input 0,10, cache write 2,50, output 10,00. ${pricingSources}

Formula separă input necacheat, cached_tokens, cache_write_tokens și output. Cache writes înlocuiesc inputul necacheat corespunzător, nu se taxează de două ori. Usage indisponibil înseamnă estimare conservatoare în bytes UTF-8 + limita output, niciodată zero. JARVIS_MODEL_PRICING permite tarife configurabile cu versiune; JARVIS_REGIONAL_PROCESSING=true aplică +10%.

Prefixul policy/tools/skills este stabil, iar contextul dinamic este la final. prompt_cache_key este hash agency+user+promptVersion, cache implicit TTL 30m. Tokens cacheați se măsoară din usage; nu se presupune cache hit. Apelurile text din domeniu împart bugetul parent când sunt citiri în loop; execuțiile separate au buget auxiliar de maximum 0,02 USD/apel.

Telemetria auxiliară are sessionId=domain_ai, nu mărește task-success sau Luna-solved. Raportul include costul auxiliar separat și în totalul perioadei. Average cost per task este costul perioadei împărțit la turns observate, nu o factură contractuală și nici atribuirea exactă a fiecărei operații externe.

WhatsApp, reclame, voce, video, OCR și portaluri au costuri externe distincte; o valoare indisponibilă nu înseamnă gratuit. Previzualizarea canalului și bugetele campaniei rămân obligatorii.`,
  'MEMORY.md': `Memoria persistentă este proprie utilizatorului în agenția autentificată. remember_preference acceptă exclusiv preferred_language, preferred_search_zone, preferred_property_source și preferred_response_style, numai după cerere explicită. Nu copiază dosare, prețuri, scoring sau contacte în memorie.

Fiecare intrare are owner, sursă explicită, importanță, versiune, updatedAt și expirare logică la 180 zile. Citirea filtrează expirarea; forget_preference șterge numai preferința proprie cerută explicit. JARVIS_MEMORY=false dezactivează citirea/salvarea, păstrând posibilitatea de ștergere. Curățarea fizică după TTL nu este un serviciu deja activat în Firestore.

Istoricul conversației și sumarul validat sunt separate de preferințe. Reatribuirea conversațiilor/dosarelor revocă și accesul la răspunsuri istorice, cards, plans și artifacts care le conțin.`,
  'CONTEXT.md': `Istoricul activ este limitat la 14 KB, mesajele la 2.200 caractere, cu ID-uri validate și resultSet references. Sumarul serverului reține maximum 20 entități, 8 result sets și 3 planuri; nu rescrie documentele CRM ca memorie permanentă.

Rezultatele toolurilor sunt comprimate la 7 KB în loop, cu complete=false și continuare când sunt trunchiate. read/read_related au cursor; read_field citește bucăți reale din câmpuri și versiuni. Schema/handler contract este cerut numai când trebuie, în locul injectării tuturor schemelor în fiecare apel.

Datele, documentele și rezultatele MCP sunt neîncredere. AI poate sumariza informații autorizate, dar nu poate schimba tenant, tool allowlist, model policy sau approvals pe baza lor. O descriere care cere o mutație nu autorizează executarea autonomă.`,
  'PROPERTY_MATCHING.md': `Property Matching = existing ImoDeus algorithm din src/lib/matching-engine.ts. AI Property Matching = forbidden. Matching score recalculation by LLM = forbidden.

match_contact citește contactul autorizat și proprietățile active și apelează getDeterministicMatchedProperties. match_property apelează getDeterministicMatchedBuyers. Nu există un al doilea scoring semantic/LLM. Ordinea, scorurile și reasoning sunt cele ale motorului ImoDeus.

Setul contextual este salvat server-side pentru propriul actor, TTL logic o oră. Follow-up-ul folosește filter_existing_matches; datele curente ale proprietății sunt recitite pentru existență/status/preț/zonă, dar scorurile nu se recalculează. Ordinea ImoDeus rămâne implicită; sortare numerică score/price numai când agentul o cere. Setul este cel returnat anterior, nu întregul portofoliu dacă limita inițială a fost 30.

Testele adapterului compară efectiv rezultatele cu motorul real, nu cu un scoring mock. Smoke-ul existent: 26 zone services + 2 canonical location. Adaptorul adaugă 4 verificări, inclusiv filtrare fără schimbarea scorurilor și refuzul clientului inaccesibil.`,
  'SKILLS.md': `Skills de produs versionate: Property Search, Existing Property Matching, Client Management, Seller Prospecting, Viewing Management, Communication, Listing Publishing, Meta Marketing, TikTok Marketing, Agency Reporting și Document Analysis.

Fiecare declară tools/categorii și workflow concret în skills.ts. Workflowurile cer date reale, contracte, previzualizare/aprobare și stări finale verificate. Ele sunt instrucțiuni de orchestrare, nu granturi suplimentare de permisiune. Nu există framework extern instalat sau job care ocolește politicile globale.

Exemplu: Seller Prospecting → căutare owners → selecție/prospectare existentă → agentul consemnează acordul real din apel → șablon/eligibilitate/cost → plan confirmat → coada existentă.`,
  'SUBAGENTS.md': `delegate_read pornește o planificare copil pe același provider/context autentificat și același buget global, cu goal<=1.000 caractere, maximum 3 tools permise și schema auxiliară operation_contract. Copilul are maximum 3 pași, 30 s, 16.000 tokens conservator și 0,03 USD în bugetul parent; output<=1.200 tokens.

Nu există recursie, scrieri, creare de consimțământ, apeluri arbitrare de model sau recalculare matching în subagent. Pentru analiza matching primește resultSetId și folosește filtrarea contextuală. Datele/telemetria copilului sunt incluse în parent, fără double billing.

parallel_read folosește maximum 3 citiri independente și Promise.allSettled. Eșecul unui braț nu anulează rezultatele confirmate; complete=false dacă un braț este parțial/eșuat. Fiecare citire consumă buget și are metadate de observabilitate fără payload.`,
  'MCP.md': `MCP este dezactivat implicit. JARVIS_MCP=true și JARVIS_MCP_SERVERS configurează servere server-side cu ID, endpoint HTTPS public port443, agencyIds exact un tenant, tools allowlisted, tokenEnv și timeout<=15 s. Nu se ia niciun URL/token din prompt.

Transport Streamable HTTP, protocol2025-03-26: initialize → notifications/initialized → tools/list → tools/call; session ID și JSON/SSE. Serverul trebuie să declare readOnlyHint=true; inputul este validat local cu subsetul suportat de JSON Schema. Schemele externe cu refs/unions nesuportate sunt refuzate.

Protecții: DNS/IP public verificat și pinning pe conexiune, fără redirects/credentials în URL, SSRF/rebinding, deadline și limită50 KB, decodare Unicode incrementală, secrets excluse. Rezultatul rămâne neîncredere. Scrierile MCP sunt interzise; orice asemenea integrare trebuie să aibă un adaptor intern cu contract/aprobare/ledger.

Nu a fost configurat sau apelat un server MCP real în această rundă. Validarea de configurație/tenant/schema/SSRF este acoperită local. [Specificația](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports).`,
  'SECURITY.md': `Tenantul/actorul/rolul provin din Firebase authentication. Modelul nu poate trimite agencyId sau credentiale în contractele toolurilor. Serverul recitește membership înainte de tools, fiecare pas de execuție și salvarea răspunsului; dosarele, conversațiile și auditul au regulile proprii.

Approval = hash al payloadului canonic + actor + tenant + plan + expirare + versiune policy. Confirmarea claimului este tranzacțională, o singură dată. Ledger-ele fac replay-ul pașilor confirmați fără mutații noi; rezultatul extern unknown blochează retry automat și cere inspecție în domeniu. Rezultatele parțiale reale sunt păstrate în ledger și stoppedStep și pot fi inspectate în UI, inclusiv atunci când handlerul răspunde HTTP 200 cu stare failed/partial/unknown.

AsyncLocalStorage păstrează numai principalul unei cereri interne și bugetul acesteia; un header fals venit din HTTP nu activează principalul. Handler-ele reale își păstrează verificările admin/cost/eligibilitate. Secretele sunt eliminate din date/cards; telemetry conține IDs tehnice/hash, nu nume/telefoane/prompts/payloaduri.

Regulile Firestore root și src interzic clientului citirea/scrierea în colecțiile private Jarvis, inclusiv utilizatorilor admin; acces numai prin API autentificat. Regulile nu înlocuiesc autorizarea Admin SDK: aceasta este implementată în cod și testată separat.

Autonomia este opt-in UI, expiră la30 zile, maximum4 pași low risk, și necesită verb de acțiune explicit în cererea umană. Cererile de preview/analiză și comenzile negate nu produc efecte autonome. Consimțământul WhatsApp se poate consemna doar prin UI explicit cu evidența apelului; modelul nu îl acordă.`,
  'AUTOMATIONS.md': `Automatizări implementate: followup_task, owner_watch, insight_report, matching_watch, whatsapp_template. Contractele cer nextRunAt verificat, interval>=30 minute, maximum365 execuții și rolul actorului. Crearea necesită plan confirmat și heartbeat real al workerului în ultimele15 minute.

Workerul revalidează membership, face claim/lease tranzacțional și persistă rezultat/stare în job și oglinda agenției. Rezultatele externe ambigue devin unknown/blocked și nu se retrimit. WhatsApp trece prin coada existentă, aprobări șablon/acord/limite curente, cu requestId persistat înainte și stopOnReply.

Owner_watch salvează scanCursor și deduplicatează notificările pe listing ID; corpusul mare continuă în următoarele execuții. Matching_watch folosește motorul ImoDeus existent și notifică numai scorurile existente peste prag. Insight-urile deterministe acoperă lead Nou fără follow-up, sarcini întârziate și conflicte de vizionări; sunt bounded și declară analiza parțială.

Scoped autonomy: off implicit pentru fiecare agent; UI autorizează 30 zile numai sarcini, note, import, prospect:add și recomandări portal. Mesaje/publicări/campanii/preț/archive/consimțământ nu se execută prin această politică. După rezultat incert, nu se creează un nou plan cu cheie diferită care ar putea dubla efectul.`,
  'OBSERVABILITY.md': `assistantTelemetry salvează usage/input/output/cached/cache-write tokens, cost estimat sau raportat, pricing version, modelele/reasoning effort/reason de routing, tool name/status/durată/hash și versiuni. Nu salvează prompts, telefon, textul documentului, argumente brute sau erori provider cu secrets.

Telemetria include snapshotul configurației efective: flags, limitele implicite și regional processing, fără valori secrete. Astfel comparațiile între versiuni și costuri pot identifica schimbările de politică.

GET /api/ai-assistant/metrics?from=ISO&to=ISO, interval<=366 zile: agentul vede propriile date, admin vede agenția. Scan<=5.000 documente cu continuation autorizat, complete explicit. Grupează cost/day/month/user, tokens/models, Luna-solved/Sol-escalated, approval required/approved/cancelled, execution states, retry rate și categorii de provider errors.

Luna-solved înseamnă răspuns/plan pregătit cu status success fără Sol, nu livrare WhatsApp sau închidere tranzacție. Delivery/provider/domain queue au stări separate. Pentru lipsa observațiilor, procentele și mediile sunt null. Apelurile text auxiliare nu măresc numărul de turns rezolvate.

Progresul persistat este metadată operațională. Istoricul operational/ledger conține date de business necesare execuției și este privat; nu este un log public de telemetrie.`,
  'TESTING.md': `Comenzi reproductibile: npm run test:ai-assistant; npm run test:ai-assistant:ui; npm run test:jarvis:matching; npm run test:jarvis:rules; npm run test:jarvis:models; npm run typecheck; npm run lint; npx vitest run; npx next build --webpack; npx tsc -p functions/tsconfig.json --noEmit.

UI fixture folosește componenta reală în Chromium desktop/mobil, API interceptat: auth, plan-before-write, risk/cost, owner-first+CRM separat, consimțământ telefonic explicit, opt-in autonomie, SSE/background exec, unknown fără replay, fără erori/overflow. Nu este probă de livrare în conturile reale.

Unit/integration: contracts, provider loop, retries/router/budgets, determinism/DST, tools, execution/ledger, permissions/tenant, matching real, jobs fără browser, worker follow-up/stopOnReply, memories/context, MCP/SSRF, telemetry/cost, rules. Testele Firestore fără emulator sunt skip, nu pass. Scrapingul live este separat și nu a fost executat.

Statusul verificărilor finale:

\`\`\`json
${JSON.stringify(validation, null, 2)}
\`\`\`

Runnerul Vitest exclude .tmp și cele două teste standalone Node pentru zone/canonical; acestea se execută explicit prin smoke-ul matching. Nu se ascund testele de produs care eșuează.`,
  'EVALS.md': `Benchmark real OpenAI pe date sintetice autorizate, 35 scenarii identice/model, maximum8 pași/scenariu și plafon1 USD/rulare. Nu citește/scrie CRM, nu trimite mesaje și nu publică. Contractele Zod actuale și datele deterministe validează tool calls; providerul și function schemas sunt cele reale. Datele fixture sunt puține și nu demonstrează scalabilitatea/fiabilitatea conturilor externe.

| Model | Rezolvate | Cost mediu USD | Latență medie ms | Cached tokens |
| --- | --- | --- | --- | --- |
| Luna | ${luna.passed}/${luna.tasks} (${luna.successPercent.toFixed(2)}%) | ${luna.averageCostUsd.toFixed(9)} | ${luna.averageLatencyMs.toFixed(1)} | ${luna.cachedTokens} |
| Sol | ${sol.passed}/${sol.tasks} (${sol.successPercent.toFixed(2)}%) | ${sol.averageCostUsd.toFixed(9)} | ${sol.averageLatencyMs.toFixed(1)} | ${sol.cachedTokens} |

Cost total final ${bench.totalCostUsd.toFixed(9)} USD. Rezultate/versioning exacte în ${link('BENCHMARK_RESULTS.json')}. Aceste costuri includ cache și tarifele raportate, nu taxele integrărilor externe. Sol a avut variație temporală de latență; nu extrapolăm media ca SLA.

Istoric transparent: primul simulator avea erori de fixture/grader și a fost corectat; o rundă native v3 a avut Luna31/35 și Sol35/35. Un caz Luna era limită corectă129999.99 vs grader130000; trei aveau payload single-action în locul actions[]. Schema/repair instructions au fost clarificate și runda completă repetată, fără mascarea validărilor. Toleranța graderului este doar un cent descendent pentru priceMax.

Routerul este verificat prin teste executabile Luna-first, un singur failure fără Sol, trei invalid calls→Sol, două invalid outputs→Sol, outage fără Sol și insuficiență buget. Benchmarkul compară fixed-model quality, nu este măsurare a procentului real de escaladare în producție. Prompt-injection/tenant/secret/forbidden-model comenzi și autonomia pentru preview/negații sunt testate.`,
  'OPERATIONS.md': `Implementarea locală nu activează automat infrastructura și conturile live. Nicio campanie/publicare/trimitere reală și niciun backfill --apply nu au fost efectuate în această rundă.

Ordinea activării: verifică proiectul vizat; creează AI_ASSISTANT_WORKER_SECRET în Secret Manager și acordă acces App Hosting/Functions; configurează OPENAI_API_KEY/billing și modelele exacte; publică regulile server-managed și indexurile; verifică READY; rulează backfill dry-run și revizuiește înainte de --apply; publică aplicația și schedulerul; verifică heartbeat/readiness și probele proprii agent/admin cu două agenții; conectează OAuth/conturile externe și verifică statusul/costul din module.

Joburile sunt persistate server-side, lease300 s. POST start/execute_background lansează procesarea cu Next after; schedulerul Functions la5 minute recuperează coada. Turnurile întrerupte pot relua maximum o dată cu aceeași requestId și ledger de safe actions; planurile externe întrerupte nu se retrimit automat. SSE reconnect50 s, UI așteaptă până180 s; rezultatul final rămâne în istoric dacă browserul se închide. Nu există garanție de latență imediată fără worker sănătos.

Căutarea owners folosește Firestore live, nu primele100 din UI. Proiecția searchPrice/searchCurrency/searchVersion este scrisă atomic cu ingestia/enrichment/canonicalizare. Numără coverage la început; dacă există documente neindexate sau indexul nu e READY, citește live paginat. Maximum5.000 documente/scan, cursor explicit. Un anunț extern care nu a fost încă ingestat sau nu are publicationStatus=ready/isCanonical=true nu este disponibil pentru căutare; indexarea nu îl poate inventa. Nu există snapshot izolat între pagini, deci o căutare nouă reîmprospătează rezultatele la mutații concurente.

Flags: JARVIS_MEMORY, JARVIS_SUBAGENTS, JARVIS_AUTONOMOUS, JARVIS_INSIGHTS, JARVIS_AUTOMATIONS, JARVIS_SOL_ESCALATION (false dezactivează); JARVIS_MCP (true activează), JARVIS_DISABLED_TOOLS (CSV inclusiv action kinds), JARVIS_MCP_SERVERS/tokenEnv, JARVIS_MODEL_PRICING/version, JARVIS_REGIONAL_PROCESSING. Niciun flag nu poate activa modele în afara allowlistului.

Intervenții manuale: deployment și backfill aprobat; OpenAI billing/rate limits; Meta Business app review/live permissions, WhatsApp număr/WABA și șabloane aprobate, acorduri reale din apel; cont/ad account și autorizări Meta/TikTok, bugete; integrare portal și credențiale; servicii voice/video/OCR/storage; configurație/secret pentru fiecare MCP public. Verificarea pe conturi reale se face cu datele și aprobările operatorului, nu prin fixtures.`,
};
for (const [file, body] of Object.entries(docs)) await fs.writeFile(path.join(output, file), '# ' + file.replace('.md', '').replaceAll('_', ' ') + '\n\n' + body.trim() + '\n');
const created = changes.filter(row => row.status === '??').map(row => row.file), modified = changes.filter(row => row.status !== '??').map(row => row.file);
const points = [
  ['Arhitectura finală', docs['ARCHITECTURE.md']], ['Ce exista înainte', 'Matching-engine, handler-ele CRM/domain, Firestore/auth, comunicare/eligibilitate/coadă, portaluri/media și prima implementare Jarvis cu tools/plans/history/search. Auditul descrie lipsurile găsite înainte de refactor.'], ['Ce s-a schimbat', 'Nucleu agentic separat, provider strict allowlisted, registry modular, date/statistici deterministe, memory/context/result sets, shared budgets, bound approvals, durable jobs/SSE, opt-in scoped autonomy, subagents/read concurrency, MCP securizat, telemetry/cost/router și verificări live sintetice.'], ['Fișiere create', created.map(file => '- ' + file).join('\n')], ['Fișiere modificate', modified.map(file => '- ' + file).join('\n')], ['Agent Loop', link('AGENT_LOOP.md')], ['Lista completă de tools', `${core.length} core + ${operations.length} domain adapters, ${actions.length} action kinds: ${link('TOOLS.md')}.`], ['Property Matching existent', link('PROPERTY_MATCHING.md')], ['AI nu recalculează matching', 'Confirmat prin test cu motorul real: ordinea/scorurile/explicațiile existente se păstrează. AI Property Matching și matching score recalculation by LLM sunt forbidden.'], ['Memory', link('MEMORY.md')], ['Context Management', link('CONTEXT.md')], ['Skills', link('SKILLS.md')], ['Sub-agents', link('SUBAGENTS.md')], ['MCP', link('MCP.md')], ['Automations', link('AUTOMATIONS.md')], ['Proactive capabilities', 'Insight-uri deterministe, owner_watch/matching_watch, notificări deduplicate și follow-up stopOnReply. Scope partial declarat pentru date bounded.'], ['Permissions', link('SECURITY.md')], ['Approval Flow', 'Actor+tenant+payloadhash+plan+expiry+policyversion, claim atomic one-time și ledger per step; resuming nu schimbă payloadul și nu retrimite extern unknown.'], ['Security', link('SECURITY.md')], ['Structured Outputs', 'Schema strictă finală text/intentStatus, Zod input/output tool, cards typed, CONFIRMATION_CARD și ACTION_RESULT reale, stări partial/unknown explicite.'], ['Streaming', 'SSE cu progres operațional persistat și reconectare; fără chain-of-thought. Jobs durabile după închiderea browserului.'], ['Observability', link('OBSERVABILITY.md')], ['Cost Accounting', link('COSTS.md')], ['Model Router', link('ROUTING.md')], ['Procent rezolvat cu Luna', `${luna.successPercent.toFixed(2)}% în cele35 scenarii fixed-model sintetice. Procentul real din producție nu a fost măsurat în această rundă și rămâne necunoscut până există telemetry proprie.`], ['Procent escaladat la Sol', 'Nu poate fi dedus din benchmarkul fixed-model comparativ. Procentul de producție este măsurat de metrics API, nu presetat. Testele verifică escaladarea justificată și absența ei după un singur failure/outage.'], ['Motive principale escaladare', 'Schema/planning failures repetate validate; dependency workflow dovedit sau eval quality threshold; cu flag și buget suficient. Fără importanță/preț/lungime ca motiv.'], ['Average cost per task', `Final fixture: Luna ${luna.averageCostUsd.toFixed(9)} USD, Sol ${sol.averageCostUsd.toFixed(9)} USD. Producția se măsoară separat și include auxiliary cost raportat.`], ['Luna vs Sol benchmark', link('EVALS.md')], ['Matching tests', '4 adapter checks folosesc motorul real +26 zone +2 canonical scoring. Alte teste de context păstrează score/reasons.'], ['Celelalte teste', 'Status final: ' + JSON.stringify(validation)], ['Production build', validation.productionBuild || 'Vezi verificarea finală în TESTING.md'], ['Security results', validation.security || 'Vezi verificarea finală'], ['Tenant isolation results', 'Teste membership/role revoke, shared AsyncLocalStorage isolation, approvals actor+tenant, authorized cursor/history/jobs, private Firestore rules și MCP tenant selection. Nu au fost interogate agenții reale pentru demonstrație.'], ['Performance results', `Benchmark average Luna ${luna.averageLatencyMs.toFixed(1)}ms /Sol ${sol.averageLatencyMs.toFixed(1)}ms; modele/test fixtures și rețea din această rundă, nu SLA. UI no overflow/no errors, context/schema bounded, cache usage raportat. Nu există load test multi-agency de producție.`], ['Limitări tehnice reale', 'Bounded tool/record/context budgets; numai actualele contracte disponibile, nu orice comandă arbitrară; matching contextual limitat la setul deja preluat; index live nu înseamnă crawler instant; MCP read-only/subset schema; worker deployment/heartbeat necesar; rezultate externe nu se simulează ca succes; modele probabilistice și corpus35 nu garantează100% pe toate formulările. TTL este logic, fără cleanup fizic activat automat.'], ['Intervenții manuale', link('OPERATIONS.md')],
];
await fs.writeFile(path.join(output, 'FINAL_REPORT.md'), '# Jarvis — raport final în 37 puncte\n\nImplementare locală, cu măsurători reale OpenAI pe fixtures și activare live separată. Inventarul worktree include și prima rundă Jarvis, pentru trasabilitate; nu atribuie alte schimbări existente acestei runde.\n\n' + points.map(([title, body], index) => `## ${index + 1}. ${title}\n\n${body}\n`).join('\n') + '\nDEFAULT MODEL = GPT-6 Luna. COMPLEX MODEL = GPT-6.1 Sol. GPT-6 Astra = forbidden. GPT-5.6 Sol = forbidden. Property Matching = existing ImoDeus algorithm. AI Property Matching = forbidden. Matching score recalculation by LLM = forbidden.\n');
const productionDoc = await fs.stat(path.join(output, 'PRODUCTION_DEPLOYMENT.md')).then(() => ['PRODUCTION_DEPLOYMENT.md']).catch(() => []);
await fs.writeFile(path.join(output, 'README.md'), '# Jarvis\n\n' + [...productionDoc, 'IMPLEMENTATION_AUDIT.md', 'FINAL_REPORT.md', ...Object.keys(docs)].map(file => '- ' + link(file)).join('\n') + '\n\nRapoartele sunt generate din contractele locale și benchmarkul complet prin npm run jarvis:docs.\n');
console.log(JSON.stringify({ docs: Object.keys(docs).length, coreTools: core.length, handlerAdapters: operations.length, actionKinds: actions.length, benchmarkCasesPerModel: 35, output }));
