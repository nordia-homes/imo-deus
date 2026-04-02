# ImoDeus Desktop: Facebook Group Promotion

## Overview

This repo now contains the scaffolding for a desktop distribution of ImoDeus based on:

- Next.js for the CRM UI
- Electron as the desktop shell
- Playwright as the local Facebook promotion automation engine

The desktop flow is designed for assisted publishing:

1. The agent selects Facebook groups from the property detail page.
2. The CRM creates a promotion session/job.
3. The desktop runner opens the current group in a local Playwright browser profile.
4. The runner attempts to:
   - open the Facebook composer
   - fill the property description
   - attach the property photos
5. The runner stops before `Publish`.
6. The agent manually clicks `Publish`.
7. The agent returns to the app and confirms `Am publicat în grup`.

## Folder Layout

- `desktop/main.cjs`
  - Electron main process
  - window bootstrap
  - auto-update scaffolding
  - IPC handlers for the Facebook runner
- `desktop/preload.cjs`
  - secure bridge between Next.js UI and Electron IPC
- `desktop/automation/facebook-worker.mjs`
  - local Playwright worker
  - opens Facebook
  - prepares the current group and waits before publish
- `src/app/(dashboard)/facebook-promotion-runner/page.tsx`
  - web/desktop runner UI
- `src/lib/desktop/facebook-promotion.ts`
  - IPC contracts and shared desktop runner types

## Development

Run the web app:

```bash
npm run dev
```

In another terminal, run Electron:

```bash
npm run desktop:dev
```

By default, Electron loads:

```text
http://localhost:3000
```

To override:

```bash
set ELECTRON_START_URL=http://localhost:3000
npm run desktop:dev
```

## Packaging

The project includes `electron-builder` scaffolding in `package.json`.

Available commands:

```bash
npm run desktop:pack
npm run desktop:dist
```

## Auto-update

`electron-updater` is wired in `desktop/main.cjs` as scaffolding.

Current generic update feed:

```text
https://downloads.imodeus.ai/desktop
```

Before production use, replace this with your real release infrastructure.

## Production Checklist

### Phase 5 hardening

- improve Facebook selectors for Romanian and English UI variants
- detect modal failures, blocked popups, upload errors
- add retry and recovery states for:
  - composer not found
  - media upload button not found
  - publish button not found
- persist desktop runner status back to Firestore more frequently
- add desktop audit logs per job

### Phase 6 release readiness

- sign Windows binaries
- configure real auto-update hosting
- add release channels (`stable`, `beta`)
- add crash reporting and desktop diagnostics
- package Playwright runtime and verify browser install strategy
- test with Facebook already authenticated and unauthenticated flows

## Important Note

This solution is still local-by-design, even when wrapped inside a professional desktop app.
That is intentional:

- the Facebook session stays on the agent's machine
- the SaaS remains the orchestrator
- the desktop app is the local execution layer

This is the recommended product architecture for a multi-agency SaaS that needs assisted Facebook group publishing without storing customer Facebook credentials in the cloud.
