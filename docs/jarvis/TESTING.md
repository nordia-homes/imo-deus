# TESTING

Comenzi reproductibile: npm run test:ai-assistant; npm run test:ai-assistant:ui; npm run test:jarvis:matching; npm run test:jarvis:rules; npm run test:jarvis:models; npm run typecheck; npm run lint; npx vitest run; npx next build --webpack; npx tsc -p functions/tsconfig.json --noEmit.

UI fixture folosește componenta reală în Chromium desktop/mobil, API interceptat: auth, plan-before-write, risk/cost, owner-first+CRM separat, consimțământ telefonic explicit, opt-in autonomie, SSE/background exec, unknown fără replay, fără erori/overflow. Nu este probă de livrare în conturile reale.

Unit/integration: contracts, provider loop, retries/router/budgets, determinism/DST, tools, execution/ledger, permissions/tenant, matching real, jobs fără browser, worker follow-up/stopOnReply, memories/context, MCP/SSRF, telemetry/cost, rules. Testele Firestore fără emulator sunt skip, nu pass. Scrapingul live este separat și nu a fost executat.

Statusul verificărilor finale:

```json
{
  "status": "passed_local_validation",
  "date": "2026-10-04",
  "vitest": {
    "passed": 595,
    "failed": 0,
    "skipped": 28,
    "assistantPassed": 183,
    "skippedExplanation": "18 Firestore rules tests passed separately in emulator; 10 live scraping tests were not run."
  },
  "security": "18 tests passed in the Firestore emulator, across 5 suites; root and src rules identical.",
  "matching": {
    "realEngineAdapterPassed": 4,
    "standaloneZonePassed": 26,
    "standaloneCanonicalPassed": 2
  },
  "ui": {
    "passed": 13,
    "environment": "Real UI component in Chromium with authenticated synthetic API/SSE fixtures, desktop and mobile."
  },
  "whatsappAuditProbes": {
    "passed": 5,
    "environment": "Offline probes of existing code; no actual messages sent."
  },
  "typecheck": "passed, including a fresh run after the final production build",
  "functionsTypecheck": "passed",
  "targetedLint": {
    "errors": 0,
    "warnings": 0
  },
  "repositoryLint": {
    "errors": 0,
    "existingWarnings": 262
  },
  "productionBuild": "passed: npx next build --webpack; existing Tailwind ambiguity and optional Jaeger dependency warnings remain",
  "gitDiffCheck": "passed",
  "liveModelBenchmark": {
    "passed": 70,
    "total": 70,
    "environment": "synthetic_fixture_live_openai",
    "productionRoutingMeasured": false
  },
  "notPerformed": [
    "production deployment",
    "index backfill --apply",
    "real WhatsApp delivery",
    "real external publishing or campaigns",
    "live MCP connection",
    "production multi-agency load test",
    "live scraping"
  ]
}
```

Runnerul Vitest exclude .tmp și cele două teste standalone Node pentru zone/canonical; acestea se execută explicit prin smoke-ul matching. Nu se ascund testele de produs care eșuează.
