# AI Outreach Calls - Implementation Plan

## 1. Product direction

AI Outreach Calls should be treated as an AI listing acquisition assistant, not just as a click-to-call feature.

The main goal is to help agencies contact owners from owner listings, validate whether the property is still available, collect missing listing details, negotiate collaboration terms inside agency-approved limits, and save a structured result for the agent.

The best user experience is:

1. The platform handles all Vapi/Telnyx setup centrally.
2. The agency only enables the feature and sets commercial rules.
3. The agent can launch AI calls from owner listings.
4. Owner listing cards show the latest AI call status directly on the image.
5. Clicking the status badge opens a modal with the call details, result, transcript, and next actions.
6. A dedicated AI Calls page gives agencies an operational view for settings, history, retries, and campaigns.

The first version should optimize for speed, clarity, and safe control. AI should be allowed to negotiate only within explicit commission boundaries and should never create binding contractual obligations without agency confirmation.

## 2. Core principles

- Hide Vapi and Telnyx complexity from agencies and agents.
- Use platform-managed phone numbers, not agency-managed integrations.
- Allocate phone numbers lazily, only when an agency enables or first uses AI calls.
- Start with a shared phone number pool for MVP, then add dedicated agency numbers for paid/high-volume plans.
- Store every call as a durable internal record before calling Vapi.
- Treat Vapi webhooks as the source for call lifecycle events, but keep the app database as the source of truth for product state.
- Save structured outcomes, not only transcripts.
- Keep human follow-up optional, not mandatory.
- Add compliance controls from day one: call windows, opt-out, do-not-call, retry limits, audit log, and recording/AI disclosure policy.

## 3. Recommended rollout

### Phase 1 - MVP: Individual AI calls from owner listings

Scope:

- Agency-level AI call settings.
- Platform shared phone number pool.
- "Call with AI" action on owner listing cards/details.
- Latest AI call status badge on owner listing card image.
- Status filters in the owner listings page.
- Call detail modal opened from the badge.
- Vapi outbound call creation.
- Vapi webhook endpoint.
- Structured call outcome saved to Firestore.
- Transcript, summary, duration, and cost metadata saved when available.
- Basic retry: manual retry only.

Do not build campaign automation yet. First validate call quality, outcome accuracy, cost, and owner reactions.

### Phase 2 - Operational AI Calls page

Scope:

- Dedicated dashboard page: `AI Calls` or `Apeluri AI`.
- Call history with filters.
- Agency call settings.
- Retry queue.
- Bulk selection from owner listings.
- Scheduled calls.
- Follow-up task creation.
- Admin visibility for failed calls and provider errors.

### Phase 3 - Campaigns and dedicated numbers

Scope:

- Batch campaigns.
- Auto-retry rules.
- Dedicated phone number per agency for eligible plans.
- Number reputation monitoring.
- Daily and monthly budget caps.
- Advanced analytics.
- Plan-based feature limits.

### Phase 4 - Advanced acquisition

Scope:

- AI can run different templates: collaboration check, details collection, commission negotiation, follow-up.
- AI can collect richer property data.
- AI can negotiate exclusivity, but only with stricter approval rules.
- Optional handoff to human agent.
- CRM-style pipeline for owner acquisition.

## 4. User experience

### Owner listings page

The owner listings page should remain the fastest working surface. Every listing card should show a compact AI status badge on the photo.

Recommended statuses:

- `Nesunat`
- `AI in asteptare`
- `In apel`
- `Colaboreaza`
- `Nu colaboreaza`
- `Revino`
- `Nu a raspuns`
- `Numar invalid`
- `Are agentie`
- `Deja vandut`
- `Nu mai suna`
- `Date incomplete`
- `Negociere blocata`
- `Acord verbal`

Recommended color mapping:

- Neutral gray: `Nesunat`
- Yellow: `AI in asteptare`
- Blue: `In apel`
- Green: `Colaboreaza`, `Acord verbal`
- Red: `Nu colaboreaza`
- Orange: `Revino`, `Date incomplete`, `Negociere blocata`
- Dark gray: `Numar invalid`, `Nu mai suna`, `Deja vandut`

Filters should include:

- All
- Uncalled
- Pending
- In progress
- Collaborates
- Does not collaborate
- Call later
- Failed
- Do not call

### Badge click behavior

Clicking the badge should open a modal.

If the listing was never called:

- Show a start modal.
- Confirm target phone number.
- Show selected call template.
- Show agency commission settings.
- Buttons:
  - `Suna acum cu AI`
  - `Programeaza`
  - `Anuleaza`

If a call is pending:

- Show scheduled time.
- Show caller number.
- Show target phone number.
- Show who created the call.
- Buttons:
  - `Ruleaza acum`
  - `Anuleaza apel`

If a call is in progress:

- Show live status if available.
- Disable destructive actions except safe cancellation if provider supports it.

If a call is completed:

- Show outcome.
- Show AI summary.
- Show collected fields.
- Show commission result.
- Show recording/transcript tabs if allowed.
- Buttons:
  - `Creeaza task`
  - `Suna proprietarul`
  - `Relanseaza apel AI`
  - `Marcheaza manual`

### AI Calls page

The dedicated page should be split into three practical areas:

1. Settings
2. Calls
3. Analytics/Admin insights

Agency settings:

- AI Calls enabled/disabled.
- Desired commission.
- Minimum commission.
- Commission type: percentage, fixed amount, mixed.
- Allow AI negotiation.
- Allow AI to collect exact address.
- Allow AI to obtain verbal collaboration agreement.
- Default call template.
- Call time window.
- Daily call limit.
- Monthly budget cap.
- Retry policy.
- AI disclosure and recording policy copy.

Calls table:

- Owner listing.
- Owner phone.
- Status.
- Outcome.
- Commission discussed.
- Call date.
- Duration.
- Agent.
- Attempts.
- Provider error.
- Cost.

Analytics:

- Calls placed.
- Answer rate.
- Collaboration rate.
- Average commission accepted.
- No-answer rate.
- Invalid-number rate.
- Cost per positive outcome.
- Calls by agent.

## 5. Agency onboarding and phone number strategy

Agencies should not configure Vapi or Telnyx directly.

Recommended strategy:

### MVP

Use a platform-managed shared pool of Telnyx phone numbers imported/configured in Vapi.

Flow:

1. Platform admin provisions several Telnyx numbers.
2. Numbers are connected/imported into Vapi.
3. Numbers are stored internally with Vapi and Telnyx identifiers.
4. When an agency launches a call, the backend chooses an available pool number.

Benefits:

- Fast launch.
- Low cost.
- No onboarding friction.
- No setup required from agencies.

Risks:

- Shared number reputation.
- Weaker agency branding.
- Potential deliverability/spam impact across agencies.

### V2

Allocate a dedicated number per agency when:

- agency enables AI calls on a paid plan;
- agency crosses a monthly volume threshold;
- agency requests a branded/dedicated number;
- shared pool reputation risk becomes meaningful.

### Premium

Dedicated number per agent or team.

### Lazy allocation

Do not buy or reserve numbers for every agency at signup. Allocate only when:

- AI Calls is enabled; or
- the first call is launched; or
- a paid plan includes a dedicated number.

## 6. Data model

Firestore collection names should match the existing project style, but conceptually these entities are needed.

### `aiCallSettings`

One document per agency.

Fields:

- `agencyId`
- `enabled`
- `desiredCommissionValue`
- `minimumCommissionValue`
- `commissionType`: `percent | fixed | mixed`
- `allowNegotiation`
- `allowVerbalAgreement`
- `allowExactAddressCollection`
- `defaultTemplateId`
- `callWindowStart`
- `callWindowEnd`
- `timezone`
- `maxDailyCalls`
- `monthlyBudgetCap`
- `retryPolicy`
- `recordCalls`
- `discloseAi`
- `createdAt`
- `updatedAt`

### `aiPhoneNumbers`

Platform-level phone number registry.

Fields:

- `phoneNumber`
- `telnyxPhoneNumberId`
- `telnyxConnectionId`
- `vapiPhoneNumberId`
- `assignmentType`: `shared_pool | agency | agent`
- `agencyId`
- `agentId`
- `status`: `available | assigned | suspended | retired`
- `reputationStatus`: `healthy | watch | blocked`
- `lastUsedAt`
- `monthlyCost`
- `createdAt`
- `updatedAt`

### `aiOutreachCalls`

One document per AI call attempt.

Fields:

- `agencyId`
- `agentId`
- `ownerListingId`
- `ownerPhone`
- `phoneNumberId`
- `vapiCallId`
- `status`: `draft | queued | scheduled | calling | completed | failed | canceled`
- `outcome`
- `attemptNumber`
- `templateId`
- `scheduledAt`
- `startedAt`
- `endedAt`
- `durationSeconds`
- `cost`
- `summary`
- `transcript`
- `recordingUrl`
- `endedReason`
- `providerErrorCode`
- `providerErrorMessage`
- `createdBy`
- `createdAt`
- `updatedAt`

### `aiOutreachCallResults`

Can be embedded in `aiOutreachCalls` or stored separately if results become large.

Fields:

- `callId`
- `collaborationStatus`: `yes | no | maybe | call_later | unknown`
- `propertyAvailable`: `yes | no | unknown`
- `exactAddressConfirmed`
- `exactAddress`
- `viewingAvailability`
- `desiredCommission`
- `minimumCommission`
- `ownerAcceptedCommission`
- `acceptedCommissionValue`
- `acceptedCommissionType`
- `wantsHumanCallback`
- `doNotCall`
- `alreadyHasAgency`
- `alreadySold`
- `priceMinimum`
- `documentsAvailable`
- `exclusivityInterest`
- `confidence`
- `missingFields`

### Owner listing denormalized fields

Each owner listing should store the latest AI status for fast list rendering:

- `latestAiCallId`
- `aiOutreachStatus`
- `aiOutreachOutcome`
- `aiOutreachUpdatedAt`
- `aiCollaborationStatus`
- `aiAcceptedCommissionValue`
- `aiNextFollowUpAt`
- `aiDoNotCall`

This prevents expensive joins on the owner listings page.

## 7. Backend architecture

### API routes

Recommended routes:

- `POST /api/ai-outreach/settings`
- `GET /api/ai-outreach/settings`
- `POST /api/ai-outreach/calls`
- `GET /api/ai-outreach/calls`
- `GET /api/ai-outreach/calls/:callId`
- `POST /api/ai-outreach/calls/:callId/cancel`
- `POST /api/ai-outreach/calls/:callId/retry`
- `POST /api/ai-outreach/vapi/webhook`
- `POST /api/ai-outreach/admin/phone-numbers/provision`
- `POST /api/ai-outreach/admin/phone-numbers/assign`

### Call creation flow

1. Agent clicks `Suna cu AI`.
2. Backend validates:
   - agency has AI Calls enabled;
   - user belongs to agency;
   - owner listing belongs to agency scope or is accessible;
   - phone number exists and is callable;
   - listing is not marked `doNotCall`;
   - call window allows calling now, unless scheduled;
   - daily/monthly limits are not exceeded;
   - commission settings are valid.
3. Backend creates `aiOutreachCalls` document with `queued` or `scheduled`.
4. Backend selects platform phone number:
   - dedicated agency number if available;
   - otherwise shared pool number.
5. Backend creates Vapi outbound call.
6. Backend stores `vapiCallId`.
7. Backend updates owner listing denormalized AI fields.

### Vapi webhook flow

The webhook handler should:

1. Verify request authenticity if supported/configured.
2. Find internal call by `vapiCallId`.
3. Store raw event in an audit/debug subcollection or log.
4. Update call lifecycle fields.
5. On call end, extract:
   - ended reason;
   - duration;
   - transcript;
   - summary;
   - structured data;
   - recording URL if allowed;
   - cost if available.
6. Normalize the result into product outcomes.
7. Update owner listing denormalized fields.
8. Create follow-up task only when configured or manually requested.

### Idempotency

Webhook events can arrive more than once or out of order. Use:

- `vapiCallId` as lookup key;
- event ID if available;
- monotonic status updates;
- `updatedAt` checks;
- raw event log for debugging.

## 8. Vapi assistant design

The assistant should be controlled by a generated system prompt plus structured call variables.

Dynamic variables:

- agency name;
- agent name;
- owner listing title;
- property location summary;
- current advertised price;
- desired commission;
- minimum commission;
- commission type;
- allowed negotiation flag;
- required data fields;
- AI disclosure policy;
- recording disclosure policy;
- callback phone number;
- call objective.

Assistant goals:

1. Introduce itself clearly.
2. Confirm it is speaking with the owner or responsible person.
3. Confirm the property is still available.
4. Confirm or collect the exact address if allowed.
5. Ask if the owner is open to agency collaboration.
6. Explain the agency's commission terms.
7. Negotiate only inside the approved range.
8. Collect viewing availability.
9. Ask if a human callback is desired, but do not require it.
10. End politely and summarize next steps.

Hard rules:

- Never go below minimum commission.
- Never promise legal or contractual obligations.
- Never claim exclusivity is guaranteed unless explicitly configured.
- If the owner asks for a human, mark `wantsHumanCallback`.
- If the owner asks not to be called again, mark `doNotCall`.
- If the owner is angry, apologize and end the call.
- If the AI is unsure, mark `confidence` low and recommend review.

## 9. Structured outcomes

Recommended primary outcomes:

- `uncalled`
- `queued`
- `calling`
- `collaborates`
- `does_not_collaborate`
- `call_later`
- `no_answer`
- `busy`
- `wrong_number`
- `invalid_number`
- `already_sold`
- `already_has_agency`
- `do_not_call`
- `verbal_agreement`
- `negotiation_success`
- `negotiation_blocked`
- `needs_human_review`
- `failed`

Commission-specific result:

- `accepted_desired_commission`
- `accepted_between_desired_and_minimum`
- `requested_below_minimum`
- `refused_commission_discussion`
- `commission_not_discussed`

## 10. Compliance and safety

This feature touches regulated communication and personal data. The product should include compliance controls before scaling.

Minimum controls:

- Store source of phone number.
- Respect do-not-call flags.
- Allow owner opt-out.
- Limit call times by local timezone.
- Limit retries.
- Avoid repeated calls from different agencies in an abusive way if listings are platform-shared.
- Log who launched each call.
- Provide audit history.
- Decide whether calls are recorded and disclose it.
- Decide whether the assistant discloses it is AI.
- Keep transcripts and recordings under a retention policy.
- Allow deletion/anonymization where required.

Important product recommendation:

Use transparent AI disclosure. It reduces legal and trust risk and avoids awkward owner reactions if they realize they are speaking with AI.

Suggested disclosure:

`Buna ziua, sunt asistentul virtual al agentiei [Agency]. Va sun in legatura cu anuntul pentru proprietatea publicata online.`

Recording disclosure should be added only if calls are recorded.

## 11. Rate limits and abuse prevention

For thousands of agencies, the system needs platform guardrails.

Agency limits:

- max calls per day;
- max calls per hour;
- max concurrent calls;
- max retries per owner listing;
- minimum delay between retries;
- monthly budget cap.

Platform limits:

- global max concurrent calls;
- shared pool number rotation;
- per-number cooldown;
- provider error circuit breaker;
- automatic pause when failure/spam rate increases.

Owner-level protection:

- do not call same phone too often;
- do not let multiple agencies call the same owner repeatedly in a short window if the listing source is shared;
- central phone suppression list.

## 12. UI implementation plan

### Owner listing card

Add:

- AI status badge over image.
- Badge click handler.
- Call action button or menu item.
- Tooltip with latest result.

The badge should be compact and not cover important image content.

### Owner listings page

Add:

- AI status filter.
- Optional sort by `latestAiCallAt`.
- Bulk select for later phases.

### AI call modal

Tabs:

- `Rezultat`
- `Detalii`
- `Transcript`
- `Evenimente`

Result tab:

- outcome;
- summary;
- commission result;
- collected fields;
- confidence;
- next recommended action.

Details tab:

- phone number;
- caller number;
- agent;
- template;
- call date;
- duration;
- attempts;
- provider status.

Transcript tab:

- transcript with speaker labels.

Events tab:

- useful for debugging/admin users only.

### AI Calls page

Path recommendation:

- Dashboard: `/ai-calls` or `/apeluri-ai`
- Existing route style likely: `src/app/(dashboard)/ai-calls/page.tsx`

Page sections:

- settings panel;
- calls table;
- metrics header;
- failed calls/retry queue.

## 13. Admin tools

Master admin should eventually see:

- all phone numbers;
- Vapi phone number IDs;
- Telnyx phone number IDs;
- assignment status;
- cost by number;
- call volume by agency;
- failed call rates;
- suspicious usage;
- paused agencies;
- provider webhook logs.

Admin actions:

- assign dedicated number;
- retire number;
- suspend agency AI calls;
- replay webhook event;
- mark number reputation as watch/blocked;
- change shared pool membership.

## 14. Billing and monetization

Billing can be layered:

- included minutes/calls per plan;
- pay-per-minute after included usage;
- pay-per-successful-contact;
- dedicated number monthly add-on;
- premium negotiation assistant add-on;
- campaign automation add-on.

Usage records should be created independently from call records so billing remains stable even if call details are edited later.

Fields:

- `agencyId`
- `callId`
- `durationSeconds`
- `providerCost`
- `platformMarkup`
- `billableAmount`
- `billingStatus`
- `createdAt`

## 15. Failure handling

Common cases:

- no answer;
- busy;
- voicemail;
- invalid number;
- provider failure;
- Vapi assistant failure;
- webhook missing;
- call created but no completion event;
- transcript unavailable;
- owner asks to stop.

Recommended handling:

- Normalize provider failures into product statuses.
- Show human-readable reason in modal.
- Allow manual retry where safe.
- Automatically block retry for invalid number and do-not-call.
- Add scheduled reconciliation job to find stuck calls.

## 16. Technical integration notes

Use Vapi for assistant and call orchestration. Use Telnyx as the telephony provider behind Vapi.

The app should not expose Vapi/Telnyx credentials to the client.

Environment variables:

- `VAPI_API_KEY`
- `VAPI_WEBHOOK_SECRET`
- `TELNYX_API_KEY`
- `TELNYX_CONNECTION_ID`
- `AI_CALLS_DEFAULT_VAPI_ASSISTANT_ID`
- `AI_CALLS_SHARED_POOL_ENABLED`

All provider calls should go through server-side utilities, for example:

- `src/lib/ai-outreach/vapi.ts`
- `src/lib/ai-outreach/phone-numbers.ts`
- `src/lib/ai-outreach/outcomes.ts`
- `src/lib/ai-outreach/prompts.ts`
- `src/lib/ai-outreach/limits.ts`

## 17. Suggested implementation order

1. Create data types and outcome normalization.
2. Add agency AI call settings.
3. Add phone number registry.
4. Add Vapi outbound call utility.
5. Add call creation API.
6. Add Vapi webhook API.
7. Add owner listing denormalized AI status fields.
8. Add badge to owner listing card.
9. Add AI call modal.
10. Add owner listing filters.
11. Add basic AI Calls page with settings and history.
12. Add manual retry.
13. Add admin phone number tooling.
14. Add billing usage records.
15. Add batch campaigns.

## 18. MVP acceptance criteria

The MVP is complete when:

- An agency can enable AI Calls.
- The agency can set desired and minimum commission.
- An agent can launch an AI call from an owner listing.
- The call is created through Vapi using a platform-managed Telnyx number.
- The owner listing shows a visible AI status badge.
- Clicking the badge opens the call modal.
- The modal shows outcome, summary, commission result, and transcript when available.
- Vapi webhook updates the call and owner listing status.
- Do-not-call is respected.
- Invalid numbers cannot be repeatedly called.
- A failed/no-answer call can be retried manually.
- Admin can inspect provider IDs and errors.

## 19. Best product decision

The strongest implementation path is:

1. Start with a shared platform phone pool.
2. Let agencies configure only commission and negotiation rules.
3. Put status badges directly on owner listing cards.
4. Use a modal for call details and immediate actions.
5. Add a dedicated AI Calls page for operations and settings.
6. Keep human callback optional.
7. Let AI negotiate inside strict boundaries, but require human review for edge cases.

This gives the product a simple surface for agents while keeping the complex infrastructure, compliance, and provider orchestration centralized and scalable.
