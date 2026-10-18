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


## Continuation: discovery, history and scoped intent

Local continuation from a3428e07277f84172b6a7a6f79d18af3d34773ba; no deployment. Policy request-crm-16 / tools 204 invalidate older request checkpoints rather than reinterpret an already prepared plan under changed rules.

- Discovery now uses the actual authorized registry, including real action descriptions, with no duplicate entries. A query with zero lexical matches returns a clearly labelled paginated authorized catalog instead of implying that the capability is absent. Ranking remains lexical/domain based; this does not prove semantic selection accuracy.
- Under module context pressure, loading first drops speculative ranked schemas while retaining requested tools, base discovery and domain instructions. Only then may it narrow the loaded domains. The existing 34 KB module limit is unchanged; prepared actions are retained. This fixes the buyer-then-viewing expansion regression exposed by the enlarged history contract.
- All action families now honor a bound semantic prohibition, preparation-only intent, unresolved condition or binding mismatch before lexical fallback. Semantic execution additionally supports scoped Facebook job control and conversation state/note/link/assignment handlers, and tasks already allowed by the existing optional policy. External send/provider approvals are not bypassed. The model still interprets intent; server bindings do not prove that interpretation correct.
- Original conversation history supports bounded normalized all-term search, including Romanian diacritics, across full message text. Each call scans at most 50 records and returns at most 10 authorized matches. Cursors preserve unreturned matches and advance even across empty/revoked pages. Search is lexical, not semantic; the model can choose alternate terms and retrieve exact full original fragments before interpreting conditions.
- Static manual parity inventory was checked: 181 registered operations, 41 native action kinds, 46 UI files containing mutation references. This is an inventory, not full runtime parity or corpus certification.

Evidence: 44 Firestore emulator integration checks passed, including real job cancellation via semantic authority, unchanged job on preparation-only intent, and replay without another effect. External transport was mocked; no Facebook post, message or paid model evaluation occurred. Detailed final build and regression status is recorded in the turn report. Corpus end-to-end certification counts are unchanged.

Remaining migration: structured named choices for legacy ID selections; checkpoints and continuation inside the planner loop; durable unresolved goal state; remaining lexical external preparation/authorization paths; live-language evaluation and end-to-end manual UI parity. Search improves access to old messages but does not load the entire conversation or remove per-request planner limits. No universal understanding or complete manual parity is claimed.

Rollback for this continuation: inspect a3428e07277f84172b6a7a6f79d18af3d34773ba in a separate worktree or revert the continuation commit. Preserve request/execution ledgers and application data. The original pre-semantic checkpoint remains dfa838e2c6627c70a0c468721849f9cadd033f46.

Final continuation verification: 252 distinct unit/planner checks passed across 12 suites, plus 44 emulator integration checks. The combined unit run had two 5-second timeouts while the production build ran concurrently; both affected suites passed in full (73 checks) when rerun separately with one worker and the unchanged timeout. Full npm run build including TypeScript passed; ESLint passed with zero warnings on changed files; git diff --check passed. The same-drive build still reports the pre-existing standalone playwright-core browser-copy skip, so production browser packaging remains unverified. No live language-model evaluation or production rollout was performed.


## Continuation: named Meta choices

Implemented locally after 5fb9b167771c03b6dbadc6dd561c92f2b3ba98f8, without production deployment. Policy request-crm-17 / tools 205.

- Eleven existing Meta selection types now submit human-readable text plus separate source-message/source/row metadata in Text and Voice, including durable jobs. The browser cannot supply the legacy execution prefix. The server translates only the exact offered row in the latest authorized assistant response, and existing domain handlers still validate current revisions, rights and provider approvals.
- Campaign names appear in card headings. Missing campaign names no longer fall back to IDs. Selection instructions refer to buttons rather than asking agents to copy IDs. Original historical messages and legacy typed commands remain intact; this is a migration of the Meta selection UI, not all Facebook/social selections.
- Replay hashes bind the chosen row, source and original response as well as the request and current record. Queue/reply reuse with changed selection is rejected. Selected-source ACL references are inherited by the saved user message; revoked references cannot produce a selectable card.
- Worker failure persistence no longer overwrites an existing user message, its original timestamp, selection or access references. Newly persisted failures retain the queued selection hash. Voice selections are not mixed with unrelated uploaded-file text.

Verification: 166 unit/component/transport checks passed in 11 suites; 108 Firestore emulator integration checks passed across control, pause, publication and image suites. The new named-choice chat integration confirms the selected campaign is paused, a sibling is unchanged, the visible saved message contains the name, stale revisions are refused, forged rows are rejected before persistence, and replay does not repeat the provider effect. Provider transport was simulated; no real Meta campaign was changed. Standalone TypeScript passed. Final build/lint status is recorded below after completion.

Limits: browser interaction against a signed-in real application and speech recognition were not certified. This does not measure live-model understanding. General Facebook account/group/property choices, other legacy choices, persistent unresolved goals and continuation inside the model/tool planning loop remain outstanding. Existing per-request safeguards remain; there is no new conversation-wide token cap.

Rollback for this lot: revert its commit or inspect 5fb9b167771c03b6dbadc6dd561c92f2b3ba98f8 in another worktree. Keep all request records, execution ledgers and business data; do not replay external effects. No incompatible data migration was introduced.

Final named-choice verification: full npm run build passed, including TypeScript and page generation. ESLint completed with zero errors and the previously recorded React hook warning in ai-assistant/page.tsx:79; strict zero-warning lint is not certified. The staging build still skips copying the nested standalone playwright-core browser folder, so production browser packaging remains unverified. The 166 unit/component checks and 108 emulator checks are distinct checks in this lot, not new corpus completion claims. Production remains unchanged.


## Continuation: named Facebook property and account choices

Local implementation after checkpoint 8305e2ef5f579c0971638ea95cb7bc37c0f26d87. Policy request-crm-18 / tools 206. No deployment.

- Four choice types now use names plus server-validated metadata: immediate-publication property, publication account, property default account and scheduled-publication property. Existing source identifiers and domain handlers are retained. Only actionable clarification cards expose the new buttons; read-only account cards do not.
- Persisted pending Facebook requests and marked choice cards retain complete selection arrays. Previously generic card previews truncated nested arrays to five entries, making later accounts unavailable on continuation despite being displayed. A persisted chat test now selects account thirteen out of thirteen, creates exactly one job, and confirms replay does not duplicate it.
- Property access references are attached to these clarification responses and inherited by selections. Current resource permissions and domain membership are still checked before execution. Original CRM description and photo order are preserved by the automatic publication job. The disabled manual desktop publishing runner is unchanged.
- Verification: 29 unit/component checks and 81 Firestore emulator integration checks passed (50 publication/scheduling, 31 configuration). Tests cover named property/account selection, saved scheduling, default account changes, invalid selections, concurrency and replay. No real Facebook publication, external message or paid model call occurred. ESLint passed with zero warnings on changed source files.

Remaining: group multi-selection, other job/legacy choices, semantic preflight continuation across clarification, durable unresolved goals and checkpoints inside the planning loop. These checks do not certify all 1000 corpus examples, arbitrary language understanding, real browser interaction or speech recognition.

Rollback: revert this lot's commit, or inspect checkpoint 8305e2ef5f579c0971638ea95cb7bc37c0f26d87 in a separate worktree. Preserve application data, request records and execution ledgers; never replay external effects as part of rollback. No incompatible data migration was introduced.

Final verification for Facebook named choices: npm run build passed, including TypeScript and page generation; git diff --check and the static parity manifest check passed. The existing standalone playwright-core browser-copy skip remains, so production browser packaging is not certified. Production is unchanged.
