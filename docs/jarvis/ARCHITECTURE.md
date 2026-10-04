# ARCHITECTURE

Jarvis este orchestrator server-side peste ImoDeus. Web și Electron folosesc aceleași API-uri autentificate și același nucleu. Nu se instalează Hermes și nu există o bază CRM paralelă.

`UI → workspace API → durable job/controller → bounded planner → router/provider → registry → permissions → existing services → matching-engine/Firestore/domain queues`.

Auditul inițial este în [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md). Modulele separă provider, modele/prețuri, bugete, schemă, registry, dispatch, contexte, memorie, approvals, politici, joburi și observabilitate. Registrul are 20 tools core și 67 adaptoare de handler; 19 tipuri de acțiuni validate ajung exclusiv în executorul cu ledger.

Firestore păstrează conversațiile, planurile, ledger-ele, memoria proprie, seturile contextualizate, telemetria, politicile și joburile. Datele CRM rămân în colecțiile și serviciile existente. Deploymentul, backfillul și aprobările conturilor externe sunt operații distincte de implementarea locală.
