# Jarvis — raport final în 37 puncte

Implementare locală, cu măsurători reale OpenAI pe fixtures și activare live separată. Inventarul worktree include și prima rundă Jarvis, pentru trasabilitate; nu atribuie alte schimbări existente acestei runde.

## 1. Arhitectura finală

Jarvis este orchestrator server-side peste ImoDeus. Web și Electron folosesc aceleași API-uri autentificate și același nucleu. Nu se instalează Hermes și nu există o bază CRM paralelă.

`UI → workspace API → durable job/controller → bounded planner → router/provider → registry → permissions → existing services → matching-engine/Firestore/domain queues`.

Auditul inițial este în [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md). Modulele separă provider, modele/prețuri, bugete, schemă, registry, dispatch, contexte, memorie, approvals, politici, joburi și observabilitate. Registrul are 20 tools core și 67 adaptoare de handler; 19 tipuri de acțiuni validate ajung exclusiv în executorul cu ledger.

Firestore păstrează conversațiile, planurile, ledger-ele, memoria proprie, seturile contextualizate, telemetria, politicile și joburile. Datele CRM rămân în colecțiile și serviciile existente. Deploymentul, backfillul și aprobările conturilor externe sunt operații distincte de implementarea locală.

## 2. Ce exista înainte

Matching-engine, handler-ele CRM/domain, Firestore/auth, comunicare/eligibilitate/coadă, portaluri/media și prima implementare Jarvis cu tools/plans/history/search. Auditul descrie lipsurile găsite înainte de refactor.

## 3. Ce s-a schimbat

Nucleu agentic separat, provider strict allowlisted, registry modular, date/statistici deterministe, memory/context/result sets, shared budgets, bound approvals, durable jobs/SSE, opt-in scoped autonomy, subagents/read concurrency, MCP securizat, telemetry/cost/router și verificări live sintetice.

## 4. Fișiere create

- docs/ai-assistant-actions-audit-2026-10-04.md
- docs/ai-assistant-implementation-status-2026-10-04.md
- docs/ai-assistant-jarvis-complete-audit-2026-10-04.md
- scripts/ai-assistant-ui-smoke.mjs
- scripts/backfill-owner-search-index.mjs
- scripts/generate-assistant-contracts.mjs
- scripts/jarvis-benchmark.mjs
- scripts/jarvis-docs.mjs
- scripts/jarvis-matching-smoke.mjs
- scripts/jarvis-rules-test.mjs
- src/app/api/ai-assistant/artifacts/[artifactId]/route.ts
- src/app/api/ai-assistant/metrics/route.ts
- src/app/api/ai-assistant/owner-consent/route.ts
- src/app/api/ai-assistant/worker/route.ts
- src/app/api/ai-assistant/workspace/route.ts
- src/lib/ai-assistant/__tests__/architecture.test.ts
- src/lib/ai-assistant/__tests__/automation-worker.test.ts
- src/lib/ai-assistant/__tests__/autonomy.test.ts
- src/lib/ai-assistant/__tests__/contracts.test.ts
- src/lib/ai-assistant/__tests__/dependencies.test.ts
- src/lib/ai-assistant/__tests__/deterministic.test.ts
- src/lib/ai-assistant/__tests__/domain-ai.test.ts
- src/lib/ai-assistant/__tests__/evaluation.test.ts
- src/lib/ai-assistant/__tests__/execution.test.ts
- src/lib/ai-assistant/__tests__/firestore-rules.test.ts
- src/lib/ai-assistant/__tests__/function-tools.test.ts
- src/lib/ai-assistant/__tests__/jobs.test.ts
- src/lib/ai-assistant/__tests__/matching-adapter.test.ts
- src/lib/ai-assistant/__tests__/metrics.test.ts
- src/lib/ai-assistant/__tests__/operation-result.test.ts
- src/lib/ai-assistant/__tests__/operations.test.ts
- src/lib/ai-assistant/__tests__/planner.test.ts
- src/lib/ai-assistant/__tests__/principal.test.ts
- src/lib/ai-assistant/__tests__/recovery.test.ts
- src/lib/ai-assistant/__tests__/removal-handler.test.ts
- src/lib/ai-assistant/__tests__/retrieval.test.ts
- src/lib/ai-assistant/access.ts
- src/lib/ai-assistant/actions.ts
- src/lib/ai-assistant/approval.ts
- src/lib/ai-assistant/automation-worker.ts
- src/lib/ai-assistant/autonomy.ts
- src/lib/ai-assistant/budget.ts
- src/lib/ai-assistant/context.ts
- src/lib/ai-assistant/contracts.ts
- src/lib/ai-assistant/datetime.ts
- src/lib/ai-assistant/dependencies.ts
- src/lib/ai-assistant/deterministic-contracts.ts
- src/lib/ai-assistant/deterministic.ts
- src/lib/ai-assistant/domain-ai.ts
- src/lib/ai-assistant/evaluation-cases.json
- src/lib/ai-assistant/function-tools.ts
- src/lib/ai-assistant/handler-contracts.json
- src/lib/ai-assistant/http-error.ts
- src/lib/ai-assistant/insights.ts
- src/lib/ai-assistant/jobs.ts
- src/lib/ai-assistant/mcp.ts
- src/lib/ai-assistant/metrics.ts
- src/lib/ai-assistant/model-pricing.json
- src/lib/ai-assistant/models.ts
- src/lib/ai-assistant/operation-error.ts
- src/lib/ai-assistant/operation-result.ts
- src/lib/ai-assistant/operations.ts
- src/lib/ai-assistant/planner.ts
- src/lib/ai-assistant/policy.ts
- src/lib/ai-assistant/principal.ts
- src/lib/ai-assistant/provider.ts
- src/lib/ai-assistant/readiness.ts
- src/lib/ai-assistant/registry.ts
- src/lib/ai-assistant/search.ts
- src/lib/ai-assistant/skills.ts
- src/lib/ai-assistant/telemetry.ts
- src/lib/ai-assistant/temporal-policy.ts
- src/lib/ai-assistant/tool-dispatch.ts
- src/lib/ai-assistant/tool-schemas.ts
- src/lib/ai-assistant/workspace.ts
- src/lib/owner-listings/search-index.ts

## 5. Fișiere modificate

- pphosting.yaml
- firestore.indexes.json
- firestore.rules
- functions/src/index.ts
- package.json
- scripts/whatsapp-audit-probes.cjs
- src/ai/flows/chat.ts
- src/app/(dashboard)/ai-assistant/page.tsx
- src/app/api/ai-assistant/chat/route.ts
- src/app/api/ai-assistant/welcome/route.ts
- src/app/api/owner-listings/query/route.ts
- src/components/ai/AiChat.tsx
- src/firestore.rules
- src/lib/firebase-app-hosting.ts
- src/lib/owner-listings/canonical.ts
- src/lib/owner-listings/enrichment-queue.ts
- src/lib/owner-listings/index.ts
- src/lib/owner-listings/search.ts
- src/lib/owner-listings/types.ts
- src/lib/owner-listings/utils.ts
- src/lib/property-removal/__tests__/route.test.ts
- src/lib/property-video-tours.ts
- vitest.config.ts

## 6. Agent Loop

[AGENT_LOOP.md](AGENT_LOOP.md)

## 7. Lista completă de tools

20 core + 67 domain adapters, 19 action kinds: [TOOLS.md](TOOLS.md).

## 8. Property Matching existent

[PROPERTY_MATCHING.md](PROPERTY_MATCHING.md)

## 9. AI nu recalculează matching

Confirmat prin test cu motorul real: ordinea/scorurile/explicațiile existente se păstrează. AI Property Matching și matching score recalculation by LLM sunt forbidden.

## 10. Memory

[MEMORY.md](MEMORY.md)

## 11. Context Management

[CONTEXT.md](CONTEXT.md)

## 12. Skills

[SKILLS.md](SKILLS.md)

## 13. Sub-agents

[SUBAGENTS.md](SUBAGENTS.md)

## 14. MCP

[MCP.md](MCP.md)

## 15. Automations

[AUTOMATIONS.md](AUTOMATIONS.md)

## 16. Proactive capabilities

Insight-uri deterministe, owner_watch/matching_watch, notificări deduplicate și follow-up stopOnReply. Scope partial declarat pentru date bounded.

## 17. Permissions

[SECURITY.md](SECURITY.md)

## 18. Approval Flow

Actor+tenant+payloadhash+plan+expiry+policyversion, claim atomic one-time și ledger per step; resuming nu schimbă payloadul și nu retrimite extern unknown.

## 19. Security

[SECURITY.md](SECURITY.md)

## 20. Structured Outputs

Schema strictă finală text/intentStatus, Zod input/output tool, cards typed, CONFIRMATION_CARD și ACTION_RESULT reale, stări partial/unknown explicite.

## 21. Streaming

SSE cu progres operațional persistat și reconectare; fără chain-of-thought. Jobs durabile după închiderea browserului.

## 22. Observability

[OBSERVABILITY.md](OBSERVABILITY.md)

## 23. Cost Accounting

[COSTS.md](COSTS.md)

## 24. Model Router

[ROUTING.md](ROUTING.md)

## 25. Procent rezolvat cu Luna

100.00% în cele35 scenarii fixed-model sintetice. Procentul real din producție nu a fost măsurat în această rundă și rămâne necunoscut până există telemetry proprie.

## 26. Procent escaladat la Sol

Nu poate fi dedus din benchmarkul fixed-model comparativ. Procentul de producție este măsurat de metrics API, nu presetat. Testele verifică escaladarea justificată și absența ei după un singur failure/outage.

## 27. Motive principale escaladare

Schema/planning failures repetate validate; dependency workflow dovedit sau eval quality threshold; cu flag și buget suficient. Fără importanță/preț/lungime ca motiv.

## 28. Average cost per task

Final fixture: Luna 0.000171733 USD, Sol 0.002499451 USD. Producția se măsoară separat și include auxiliary cost raportat.

## 29. Luna vs Sol benchmark

[EVALS.md](EVALS.md)

## 30. Matching tests

4 adapter checks folosesc motorul real +26 zone +2 canonical scoring. Alte teste de context păstrează score/reasons.

## 31. Celelalte teste

Status final: {"status":"passed_local_validation","date":"2026-10-04","vitest":{"passed":595,"failed":0,"skipped":28,"assistantPassed":183,"skippedExplanation":"18 Firestore rules tests passed separately in emulator; 10 live scraping tests were not run."},"security":"18 tests passed in the Firestore emulator, across 5 suites; root and src rules identical.","matching":{"realEngineAdapterPassed":4,"standaloneZonePassed":26,"standaloneCanonicalPassed":2},"ui":{"passed":13,"environment":"Real UI component in Chromium with authenticated synthetic API/SSE fixtures, desktop and mobile."},"whatsappAuditProbes":{"passed":5,"environment":"Offline probes of existing code; no actual messages sent."},"typecheck":"passed, including a fresh run after the final production build","functionsTypecheck":"passed","targetedLint":{"errors":0,"warnings":0},"repositoryLint":{"errors":0,"existingWarnings":262},"productionBuild":"passed: npx next build --webpack; existing Tailwind ambiguity and optional Jaeger dependency warnings remain","gitDiffCheck":"passed","liveModelBenchmark":{"passed":70,"total":70,"environment":"synthetic_fixture_live_openai","productionRoutingMeasured":false},"notPerformed":["production deployment","index backfill --apply","real WhatsApp delivery","real external publishing or campaigns","live MCP connection","production multi-agency load test","live scraping"]}

## 32. Production build

passed: npx next build --webpack; existing Tailwind ambiguity and optional Jaeger dependency warnings remain

## 33. Security results

18 tests passed in the Firestore emulator, across 5 suites; root and src rules identical.

## 34. Tenant isolation results

Teste membership/role revoke, shared AsyncLocalStorage isolation, approvals actor+tenant, authorized cursor/history/jobs, private Firestore rules și MCP tenant selection. Nu au fost interogate agenții reale pentru demonstrație.

## 35. Performance results

Benchmark average Luna 4235.2ms /Sol 11712.8ms; modele/test fixtures și rețea din această rundă, nu SLA. UI no overflow/no errors, context/schema bounded, cache usage raportat. Nu există load test multi-agency de producție.

## 36. Limitări tehnice reale

Bounded tool/record/context budgets; numai actualele contracte disponibile, nu orice comandă arbitrară; matching contextual limitat la setul deja preluat; index live nu înseamnă crawler instant; MCP read-only/subset schema; worker deployment/heartbeat necesar; rezultate externe nu se simulează ca succes; modele probabilistice și corpus35 nu garantează100% pe toate formulările. TTL este logic, fără cleanup fizic activat automat.

## 37. Intervenții manuale

[OPERATIONS.md](OPERATIONS.md)

DEFAULT MODEL = GPT-6 Luna. COMPLEX MODEL = GPT-6.1 Sol. GPT-6 Astra = forbidden. GPT-5.6 Sol = forbidden. Property Matching = existing ImoDeus algorithm. AI Property Matching = forbidden. Matching score recalculation by LLM = forbidden.
