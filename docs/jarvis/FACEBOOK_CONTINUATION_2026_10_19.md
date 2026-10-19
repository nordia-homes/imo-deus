# Facebook conversation continuation — 19 October 2026

Production incident: the Corbeanca publication request followed by “Vreau să publici de pe contul Diana Radu” lost the pending account selection and searched channelConnections. A property confirmation could also stop the workflow.

## Changes

- Recognize positive account-selection sentence wrappers as well as isolated names; retain unique fuzzy matching and reject wrappers with extra restrictions or additional tasks.
- Apply the existing validated named-choice contract to property confirmations and title/address selections too. A yes selects only a single currently offered record.
- Once the offered property is explicitly selected, revalidate the selected document and current authorization, without reapplying the original inaccurate address query. Preserve transaction/property-type checks.
- Accept “grupurile de Facebook”; normalize street/number markers, retain addresses and locations in offered properties, and compare numeric address tokens exactly (12 does not match 120).
- Pass validated semantic selections to the planner as structured input and keep Facebook preflight available across Jev capability changes. Preserve the complete original request, restrictions, deferred actions and existing execution ledger. This is routing guidance, not proof of model compliance for every possible utterance.

## Verification

- 87 unit/planner tests passed, including Jev off/active with an incorrect communications-domain selection.
- 175 emulator integration tests passed (92 Facebook, 83 media): real application handlers and Firestore, simulated external providers. Added exact Corbeanca/Diana full-sentence dialogue, duplicate request replay, and confirmation after an inaccurate address suggestion. Verified resulting job and account, not a real Facebook publication.
- TypeScript validation and targeted ESLint passed. Production build status is recorded separately after completion.
- No real external post or message sent. No production deployment performed by this fix.

## Limits

Tests cover the concrete regression and existing flow protections, not every spoken formulation. Free-form semantic planning still depends on the model. Address matching uses stored CRM fields; missing addresses cannot be inferred. Real cloud runner completion and group-specific Facebook restrictions remain external acceptance checks.
