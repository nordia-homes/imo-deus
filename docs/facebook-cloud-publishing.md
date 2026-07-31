# Facebook Groups Cloud Publishing

## Scope

This module is independent from the existing Electron/desktop Facebook runner.
The following legacy files are deliberately not used or modified:

- `desktop/automation/facebook-worker.mjs`
- the `facebook-runner:*` Electron IPC handlers
- `/facebook-promotion-runner`

The cloud module adds:

- self-hosted Playwright runner in `services/facebook-cloud-runner`
- agent-owned Facebook connection metadata
- a remote login console
- one durable queue per independent Facebook account
- parallel processing between accounts
- 90–120 second cooldown between groups on the same account
- direct property publishing without a confirmation modal

## Production topology

1. Hetzner server `imodeus-facebook-runner` (CPX42, server ID `157590258`)
   runs Ubuntu, Docker and Docker Compose at `167.233.175.46`.
2. The VM has a persistent boot/data disk.
3. `facebook-cloud-runner` stores Chrome profiles and its durable queue in the
   `facebook-runner-data` Docker volume.
4. Caddy terminates TLS at `https://facebook-runner.imodeus.ro` and renews the
   Let's Encrypt certificate automatically.
5. Firebase App Hosting calls the runner with a private bearer token.
6. The runner reports connection and job events to the authenticated internal
   callback endpoint in the ImoDeus application.

The VM can be stopped only when no publishing jobs are expected. The agent's
laptop is never required after a job is created.

## Required secrets

Generate two different random values with at least 32 bytes:

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
$rng.Dispose()
```

Configure the VM `services/facebook-cloud-runner/.env`:

```dotenv
FACEBOOK_CLOUD_RUNNER_TOKEN=<runner request token>
FACEBOOK_CLOUD_RUNNER_CALLBACK_TOKEN=<callback token>
IMODEUS_APP_URL=https://studio--studio-652232171-42fb6.us-central1.hosted.app
RUNNER_DOMAIN=facebook-runner.imodeus.ro
```

Configure Firebase App Hosting secrets:

```text
FACEBOOK_CLOUD_RUNNER_URL=https://facebook-runner.imodeus.ro
FACEBOOK_CLOUD_RUNNER_TOKEN=<same runner request token>
FACEBOOK_CLOUD_RUNNER_CALLBACK_TOKEN=<same callback token>
```

The existing Browserbase variables belong to other product modules and are not
used by Facebook cloud publishing.

## VM deployment

Install Docker Engine and the Compose plugin, point the runner domain's DNS A
record to the VM's static public IP, then run:

```bash
cd services/facebook-cloud-runner
cp .env.example .env
# edit .env
docker compose up -d --build
docker compose ps
curl https://facebook-runner.imodeus.ro/health
```

Back up the `facebook-runner-data` volume. It contains authenticated Facebook
browser sessions and must be treated as credential material. Restrict SSH,
disable password authentication, enable automatic security updates, and do not
expose Docker's socket or the runner's internal port.

The current server and its rebuild action are protected against accidental
deletion in Hetzner. The boot disk and Docker volume survive normal reboots.
Paid Hetzner backups are not enabled, so an infrastructure-level disk failure
would require reconnecting the Facebook accounts.

## Data model

Metadata only:

```text
agencies/{agencyId}/facebookCloudConnections/{connectionId}
agencies/{agencyId}/facebookCloudPublishingJobs/{jobId}
properties/{propertyId}.defaultFacebookConnectionId
users/{uid}.defaultFacebookCloudConnectionId
```

Passwords, cookies and Chrome profiles never enter Firestore. They stay on the
runner's persistent disk and must be treated as credentials.

## Runtime behavior

- Each connection permits one active job.
- Independent connections run concurrently.
- Jobs survive runner restarts through `runner-state.json`.
- An ambiguous or failed publish is not retried automatically, preventing
  duplicate posts.
- A Facebook login/checkpoint moves the job to
  `needs_reauthentication`.
- Cancelling a running job stops it before the next group.
- Job payloads are immutable snapshots of property text, images and groups.

## Operational checks

Before enabling the feature for agents:

1. Connect a dedicated test account.
2. Restart the VM and verify that the account remains connected.
3. Publish to one test group.
4. Publish to two groups and verify the cooldown.
5. Start jobs on two accounts and verify parallel execution.
6. Cancel during cooldown.
7. Expire a Facebook session and verify the reconnect state.
8. Remove a connection and verify its profile directory is destroyed.

Facebook Groups does not provide an official publishing API. This runner
automates the web interface and can be affected by Facebook UI changes,
checkpoints, account restrictions, group approval or platform policy.
