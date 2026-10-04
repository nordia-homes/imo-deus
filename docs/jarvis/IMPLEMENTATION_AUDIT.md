# Jarvis: audit și design înaintea refactorizării

Implementarea analizată: `src/lib/ai-assistant`, API-urile autentificate, pagina AI Assistant, schedulerul Functions și testele existente.

Se reutilizează: auth/tenant Firestore, cele 67 de adaptoare de handler, motorul `matching-engine`, căutarea proprietarilor cu proiecție nativă/fallback, coada de comunicare și politicile sale, ledgerul de execuție, portalurile și schedulerul. Nu se instalează Hermes și nu se creează un al doilea CRM.

Deficiențe structurale confirmate: model selectat din env fără allowlist; provider cuplat în planner; context mare și catalog complet în fiecare apel; fără măsurare token/cost; fără buget cumulat; istoric fără result-set contextual durabil; fără metadate complete de tool; fără streaming de progres; fără skills/subagents/MCP cu politici; approval fără hash explicit; automatizări limitate la trei tipuri.

Design: păstrăm contractele și handler-ele existente, introducem provider/router/budget separat, registru central cu metadate și validare, context compact și result-set references, memorie tenant/user, telemetrie redată fără PII, joburi durabile cu leases și evenimente persistente. Citirile independente pot fi paralele; scrierile continuă prin ledger și aprobare. Subagenții moștenesc tenantul și au numai tools permise și bugete proprii în bugetul părinte. MCP folosește configurații server-side explicit allowlisted, fără URL-uri arbitrare din prompt.

Politica obligatorie: LUNA implicit, SOL numai justificat; toate celelalte modele refuzate. Matching-ul și scorurile rămân exclusiv cele ale algoritmului ImoDeus. Benchmark-urile locale cu fixtures nu se prezintă ca măsurători ale modelelor reale.
