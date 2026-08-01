# Facebook local runner

The local runner keeps Firebase/App Hosting as the central queue while all Facebook browser activity runs on the agent's Windows laptop and local IP.

## Runtime behavior

- Each Facebook connection has an isolated persistent Playwright profile under the Electron user-data directory.
- Interactive login is visible only while connecting or reconnecting an account.
- Publishing uses bundled Chromium in headless mode and does not open a window.
- A device-scoped token is stored with Electron safeStorage; Firebase stores only its SHA-256 hash.
- Jobs use a lease and per-group state. Expired work is recovered after restart.
- A crash before submission retries the group. A crash after the publish click marks it uncertain and does not click again.
- Missing membership and unavailable groups are marked skipped; remaining groups continue.
- A shared per-account cooldown enforces 90-120 seconds across all properties queued for that account.

## Wake and recovery

Pairing the desktop application creates or updates:

- ImoDeus Facebook Runner Wake: daily at 06:00 local Windows time, WakeToRun, StartWhenAvailable.
- ImoDeus Facebook Runner Next Job: one-time wake two minutes before the next known job.

Both tasks use the installed Electron executable with --background-runner. They use the default Windows battery restrictions, so the laptop must be connected to AC power. Login startup and every resume also synchronize overdue jobs.

If a job is scheduled from a phone while the laptop is already hibernating, the 06:00 sync downloads it. Overdue jobs run chronologically; future jobs create an exact wake task. After automated work the laptop hibernates only when it was runner-woken, is on AC, and the user has remained idle.

## Migration and fallback

Existing cloud connections are not deleted. The account page exposes Muta pe acest laptop, which changes new jobs to local execution and asks for one local Facebook login. Existing cloud jobs continue on the old runner. The legacy desktop worker and the Hetzner runner remain available until production acceptance is explicitly confirmed.

