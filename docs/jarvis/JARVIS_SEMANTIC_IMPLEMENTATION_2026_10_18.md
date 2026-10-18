# Jarvis semantic implementation — 18 October 2026

Status: implemented locally in codex/jarvis-semantic-20261018; NOT deployed. This is an incremental migration, not certification of arbitrary language or all 1000 workflows.

## Changes implemented

- Default cumulative token ceiling removed. Token totals remain telemetry. Per-call context, per-request cost, execution time and loop safeguards remain; explicit child caps still work. Actual provider input/output also enforce the per-call context ceiling.
- Source-bound execution intent added to goal coverage: execute, prepare, prohibited; conditional execution requires successful read references. Server binds intent to exact request and action hashes. Internal CRM actions already permitted by application policy, and validated immediate Facebook jobs, can use this intent instead of a command-verb regex. Tenant/resource rights, dates, revision checks and ledgers remain in existing services. A model supplying the schema is not proof that it interpreted every clause correctly.
- Facebook publication preflight is a structured tool, independent of imperative wording. It reuses the existing property/account/device/group checks; rejects ineligible subsets; does not write or publish. Existing job execution preserves exact CRM description/photos. Automatic local runner remains supported; manual desktop Publish runner was not added.
- Progressive tool catalog now exposes internal tools in discovery. Domain selection can discover specialized services. Repeated lists were removed from prompt assembly rather than increasing context limits.
- Original-message retrieval supports owner/resource-authorized paging and exact text fragments. Initial context omits whole messages instead of silently cutting text after 2200 characters; omissions are explicit. Saved originals remain unchanged. This is retrieval capability, not a claim that the model sees the whole conversation at once.
- Plans are persisted before execution under assistantSessions/{sessionId}/requests/{requestId}. Recovery of the same request reuses exact actions and ledger keys rather than replanning. Different payload/version is rejected. Original user messages cannot be overwritten on retry. This checkpoint is after planning, NOT after every individual model/tool call.
- Connection labels/display names now reach result cards. Action previews omit raw IDs/revisions and the raw JSON panel. Property/client buttons use human-readable requests plus server-validated currentRecord metadata in Text and Voice. Meta details hide identifier fields.

## Verification

- 217 focused unit/planner regression checks passed across 18 files, including injected model behavior, accounting, condition references, policy preservation, context and intent bindings.
- 39 checks passed for current-record selection, execution confirmation and request recovery (9 overlap the preceding set).
- 48 Facebook emulator integration checks passed with real application handlers and Firestore. Includes structured semantic-intent consumption, persisted job creation, exact CRM content, group subset, replay deduplication and local runner claim. Facebook/cloud transport and language interpretation are simulated; no real posts/messages or paid model requests.
- Final TypeScript and full npm run build passed. Build used the same-drive staging copy D:/imo-deus/.tmp/jev-build-20261018 because dependencies are a junction on D:. The local browser-copy script skipped the nested standalone playwright-core location; production image/browser packaging is not certified by this build.
- ESLint found zero errors and one pre-existing React hook dependency warning in ai-assistant/page.tsx:79, verified present at checkpoint. Strict max-warnings=0 therefore does not pass.
- Across the targeted runs: 250 unique unit/planner checks and 48 emulator integration checks passed, including the incident consumption sequence and step-bound authority regression. No live language-model evaluation was performed.
- Corpus completion counters are unchanged. These checks are not 1000 end-to-end certifications. The synthetic context comparison measures serialized context sizes, not provider cost or latency.

## Work still required before claiming complete migration

1. Replace remaining legacy exact-command shortcuts and external-operation lexical authorization paths without dropping their business invariants. Current semantic path supplements legacy workflows; it does not remove all regex dispatch.
2. Structured, version-bound named choices for every Meta/Facebook/other selection. Some legacy selection prompts still request IDs; hiding identifier fields is not the complete choice migration.
3. Durable continuation inside the planning loop, with saved call results, shared cost accounting across segments, cancellation, and reconciliation. Current pre-execution checkpoint does not remove the per-request step/time ceilings or automatically resume a budget-partial planner response.
4. Persist unresolved multi-goal/clarification state beyond recent-message windows, and expand history retrieval with bounded search/ranking for very long sessions.
5. Representative live-language evaluation on unseen paraphrases, negations, compound requests and long real conversations; then all relevant workflow effects in controlled environments. Scripted model outputs do not measure actual model comprehension. No universal 100% guarantee is justified.
6. Browser QA for all named-choice flows, production image/browser packaging, and production rollout/verification only after the remaining migration is ready. No live Jev speed/cost advantage is established.

## Recovery

Pre-change source checkpoint: dfa838e2c6627c70a0c468721849f9cadd033f46 (codex/jev-modular-20261018). Current implementation is on a separate branch. Inspect the checkpoint in another detached worktree or revert the implementation commit; do not reset/delete existing work or request/execution records. No incompatible data migration was introduced.

Production was not changed by this implementation. Last verified production remains build-20261018-jarvis-171 / 0182bc7eeed3dcb20f322584b6a966cde2b7c5e0, Jev off. Build172 was not activated. A source rollback is not a rollback of already executed external effects: retain ledgers and do not resend operations.
