# Demo Environment Implementation Plan

## Goal

Build a demo experience for `ImoDeus.ai CRM` that is as close as possible to the real application by running the real product routes and components on a completely separate demo backend.

The guiding principle is:

`the demo should feel real because it uses the real app, while remaining safe because it never touches the production backend`

## Chosen Strategy

The chosen premium strategy for this repository is:

- the real application UI
- the real application routes
- a separate Firebase demo backend
- a distinct runtime mode called `demo`
- one isolated demo agency per visitor

This is better than maintaining a copied UI or a simplified parallel mock app because it keeps the presentation aligned with the actual product.

## Non-Negotiable Constraints

- No writes to the production Firebase project while the user is in demo mode.
- No reuse of production agencies, users, contacts, properties, tasks, or viewings for the demo.
- No live external side effects from demo mode:
  - portal publish
  - custom domain provisioning
  - push notifications
  - email / WhatsApp side effects
  - Facebook promotion
- Every demo visitor must get an isolated workspace.
- Exiting demo mode must return the app to the real backend.

## High-Level Architecture

### Runtime switching

The app supports two client runtime modes:

- `real`
- `demo`

The mode is stored in browser storage and read by the Firebase client provider on startup.

### Real mode

- uses the current production Firebase config
- uses the current production auth, Firestore, and storage
- unchanged behavior for all normal users

### Demo mode

- uses a separate Firebase project configured by `NEXT_PUBLIC_DEMO_FIREBASE_*`
- authenticates the visitor into the demo Firebase project
- provisions one isolated demo agency per visitor
- then opens the standard app routes like `/dashboard`, `/properties`, `/leads`, `/viewings`, `/tasks`

### Provisioning model

Each demo visitor gets:

- one auth identity in the demo Firebase project
- one demo agency document
- one seeded set of:
  - properties
  - contacts
  - viewings
  - tasks
- one user profile pointing to that agency

Recommended agency id format:

- `demo-<uid>`

This prevents cross-user contamination even when the visitor edits data heavily.

## Why This Is The Best Option

Compared to a fake cloned UI, this approach gives:

- maximum fidelity
- automatic alignment with real app evolution
- lower long-term maintenance
- stronger demo credibility
- better sales and onboarding impact

Compared to using production with a shared demo account, it gives:

- true isolation
- no risk to real data
- no interference between demo visitors
- cleaner security boundaries

## Product Flow

### Public entry flow

1. Visitor lands on the homepage.
2. Visitor clicks `Intra in demo`.
3. Visitor reaches `/demo`.
4. Visitor reads:
   - this is the real application experience
   - it runs on a separate demo backend
   - their demo workspace is isolated
5. Visitor clicks `Intra in demo-ul real`.
6. The app stores runtime mode `demo`.
7. The visitor is redirected to `/demo/launch`.

### Demo launch flow

At `/demo/launch`:

1. the app boots using the demo Firebase config
2. the app signs the visitor into the demo Firebase project
3. the app calls `/api/demo/provision`
4. the server provisions or reuses `agencies/demo-<uid>`
5. the visitor is redirected to `/dashboard`

### In-app demo flow

Once redirected to `/dashboard`, the visitor sees:

- the actual dashboard page
- the actual leads page
- the actual properties page
- the actual viewings page
- the actual tasks page
- all powered by demo backend data

### Exit flow

1. visitor clicks `Iesire demo`
2. app clears runtime mode
3. app signs out from demo auth
4. app redirects to `/`
5. subsequent visits use production backend again

## Environment Variables

### Client-side demo Firebase config

Required:

- `NEXT_PUBLIC_DEMO_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_DEMO_FIREBASE_APP_ID`
- `NEXT_PUBLIC_DEMO_FIREBASE_API_KEY`
- `NEXT_PUBLIC_DEMO_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_DEMO_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_DEMO_FIREBASE_MESSAGING_SENDER_ID`

### Server-side demo admin credentials

Required:

- `DEMO_FIREBASE_PROJECT_ID`
- `DEMO_FIREBASE_CLIENT_EMAIL`
- `DEMO_FIREBASE_PRIVATE_KEY`

These credentials must point to the demo Firebase project only.

## Security And Safety Model

### Production protection

Production protection is achieved by:

- separate Firebase project for demo
- separate Firebase Admin app for demo
- separate provisioning API path under `/api/demo/*`
- no production admin Firestore imports inside demo provisioning
- runtime mode only affecting clients that explicitly choose demo

### Visitor isolation

Visitor isolation is achieved by:

- one agency per visitor
- no shared editable demo account
- agency data namespaced by uid

### Side effect protection

Sensitive modules must stay safe in demo mode.

Initial rule:

- demo mode can display the real UI
- but all risky external actions must be guarded or simulated

Modules needing explicit demo-safe behavior:

- portal publish
- custom domain setup
- push notifications
- Facebook promotion
- outbound messaging

## Data Model For Demo Provisioning

Seed one coherent agency profile:

- Bucharest-focused premium agency
- owner/admin identity
- 2-3 seeded agents
- multiple realistic listings
- multiple leads across statuses
- scheduled and completed viewings
- active tasks

The seed must feel like one real agency, not sample rows.

## Repo Implementation Plan

### Phase 1: Runtime foundation

- add runtime mode storage helpers
- add demo Firebase client config support
- add demo Firebase admin helper
- keep real app behavior unchanged unless demo mode is explicit

### Phase 2: Demo entry and launch

- add `/demo`
- add `/demo/launch`
- add `/demo/exit`
- add CTA from homepage
- launch anonymous or temporary demo auth

### Phase 3: Demo provisioning backend

- add `/api/demo/provision`
- provision one agency per visitor
- create user profile for demo backend
- seed properties, contacts, viewings, tasks

### Phase 4: Real app reuse

- allow `/dashboard` and related routes to run against demo backend when runtime mode is `demo`
- keep `AgencyContext` unchanged because it should work if the backend schema matches
- rely on real pages and real UI for fidelity

### Phase 5: Demo UX polish

- visible `Demo Mode` affordance
- clear `Exit demo`
- conversion CTAs toward real registration
- optional onboarding checklist

### Phase 6: Hardening

- cleanup strategy for old demo agencies
- throttling and abuse protection
- optional analytics
- optional richer seed rotation

## Current Status Intended In Repo

The code should include:

- local runtime mode infrastructure
- support for a separate demo Firebase config
- a demo admin Firestore helper
- a provisioning route
- a launch route that enters the real app through the demo backend
- existing local mock demo utilities can remain as fallback exploratory tooling, but the premium direction is the separate backend flow

## Hardening Added

The implementation also adds explicit demo guardrails for side-effect routes.

Current blocked or protected areas for demo agencies:

- `custom-domain/setup`
- `custom-domain/status`
- `viewings/notify`
- `imobiliare/connect`
- `imobiliare/disconnect`
- `imobiliare/publish`
- `imobiliare/unpublish`
- `imobiliare/retry`
- `imobiliare/settings`
- `imobiliare/property-promotion-settings`
- `imobiliare/property-link`
- `imobiliare/reconcile`
- `imobiliare/agents/sync`

The rule is intentionally simple and safe:

- any agency id that starts with `demo-` is treated as a demo workspace
- routes with external or risky behavior fail closed for demo agencies
- real production agencies continue unchanged

## Guardrails For Coding

- Never modify production Firestore schemas just for demo.
- Never point demo admin code at production credentials.
- Never automatically enter demo mode for normal visitors.
- Prefer additive changes only.
- If demo config is missing, fail closed and stay out of demo mode.

## Acceptance Criteria

- Visitor can start demo without using production credentials.
- Demo backend is separate from production backend.
- Visitor gets isolated seeded data.
- Real dashboard routes render using demo backend in demo mode.
- Exiting demo returns app to normal production mode.
- Real users of the production app are unaffected.
