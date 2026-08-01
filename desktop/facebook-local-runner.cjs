const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawn } = require('node:child_process');

const DAILY_TASK = 'ImoDeus Facebook Runner Wake';
const NEXT_TASK = 'ImoDeus Facebook Runner Next Job';
const HEARTBEAT_MS = 30_000;
const NEAR_JOB_MS = 3 * 60_000;
const IDLE_BEFORE_SLEEP_SECONDS = 180;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeConnectionId(value) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(id)) throw new Error('Invalid Facebook connection id.');
  return id;
}

function psQuote(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || command + ' failed').trim()));
    });
  });
}

function createFacebookLocalRunner({
  app,
  safeStorage,
  powerMonitor,
  powerSaveBlocker,
  isDev,
  onStatus,
  launchReason,
}) {
  const rootDir = path.join(app.getPath('userData'), 'facebook-local-runner');
  const configPath = path.join(rootDir, 'device.json');
  const jobsDir = path.join(rootDir, 'claims');
  const profilesDir = path.join(app.getPath('userData'), 'facebook-local-profiles');
  let config = null;
  let running = false;
  let syncPromise = null;
  let heartbeatTimer = null;
  let nearJobTimer = null;
  let sleepTimer = null;
  let blockerId = null;
  let connectingProcess = null;
  let stopped = false;
  let lastError = null;
  let nextWakeAt = null;
  let lastSeenAt = null;

  function status() {
    return {
      paired: Boolean(config),
      running,
      deviceId: config?.deviceId || null,
      agencyId: config?.agencyId || null,
      apiBase: config?.apiBase || null,
      lastSeenAt,
      lastError,
      nextWakeAt,
      launchReason,
      wakeTasksConfigured: Boolean(config) && !isDev,
    };
  }

  function emitStatus() {
    onStatus?.(status());
  }

  async function readConfig() {
    try {
      const raw = JSON.parse(await fs.readFile(configPath, 'utf8'));
      if (!raw.encryptedToken || !safeStorage.isEncryptionAvailable()) return null;
      return {
        ...raw,
        deviceToken: safeStorage.decryptString(Buffer.from(raw.encryptedToken, 'base64')),
      };
    } catch {
      return null;
    }
  }

  async function saveConfig(value) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Windows credential encryption is not available.');
    }
    await fs.mkdir(rootDir, { recursive: true });
    const encryptedToken = safeStorage.encryptString(value.deviceToken).toString('base64');
    const persisted = { ...value, encryptedToken };
    delete persisted.deviceToken;
    await fs.writeFile(configPath, JSON.stringify(persisted, null, 2) + '\n', 'utf8');
    config = value;
  }

  function deviceHeaders() {
    if (!config) throw new Error('Local Facebook runner is not paired.');
    return {
      Authorization: 'Device ' + config.deviceToken,
      'Content-Type': 'application/json',
      'X-Imodeus-Agency-Id': config.agencyId,
      'X-Imodeus-Device-Id': config.deviceId,
    };
  }

  async function deviceRequest(pathname, body = {}) {
    const response = await fetch(config.apiBase + pathname, {
      method: 'POST',
      headers: deviceHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(70_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || 'Local runner API returned ' + response.status + '.');
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function runPowerShell(script) {
    return runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]);
  }

  function taskArguments(reason) {
    return '--background-runner --wake-reason=' + reason;
  }

  async function configureDailyWake() {
    if (isDev || process.platform !== 'win32') return;
    const executable = process.execPath;
    const script = [
      '$action = New-ScheduledTaskAction -Execute ' + psQuote(executable) + ' -Argument ' + psQuote(taskArguments('daily-sync')),
      '$trigger = New-ScheduledTaskTrigger -Daily -At 6:00AM',
      '$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -Hidden -ExecutionTimeLimit (New-TimeSpan -Hours 6)',
      'Register-ScheduledTask -TaskName ' + psQuote(DAILY_TASK) + ' -Action $action -Trigger $trigger -Settings $settings -Description ' + psQuote('ImoDeus local Facebook runner daily sync at 06:00 Europe/Bucharest') + ' -Force | Out-Null',
    ].join('; ');
    await runPowerShell(script);
    app.setLoginItemSettings({
      openAtLogin: true,
      args: ['--background-runner', '--wake-reason=startup'],
    });
  }

  async function configureNextWake(isoValue) {
    nextWakeAt = isoValue || null;
    emitStatus();
    if (isDev || process.platform !== 'win32') return;
    if (!isoValue) {
      await runPowerShell('Unregister-ScheduledTask -TaskName ' + psQuote(NEXT_TASK) + ' -Confirm:$false -ErrorAction SilentlyContinue').catch(() => undefined);
      return;
    }
    const due = new Date(isoValue).getTime();
    const wakeAt = new Date(Math.max(Date.now() + 60_000, due - 2 * 60_000));
    const localStamp = [
      wakeAt.getFullYear(),
      String(wakeAt.getMonth() + 1).padStart(2, '0'),
      String(wakeAt.getDate()).padStart(2, '0'),
    ].join('-') + ' ' + [
      String(wakeAt.getHours()).padStart(2, '0'),
      String(wakeAt.getMinutes()).padStart(2, '0'),
      String(wakeAt.getSeconds()).padStart(2, '0'),
    ].join(':');
    const script = [
      '$culture = [Globalization.CultureInfo]::InvariantCulture',
      '$at = [DateTime]::ParseExact(' + psQuote(localStamp) + ', ' + psQuote('yyyy-MM-dd HH:mm:ss') + ', $culture)',
      '$action = New-ScheduledTaskAction -Execute ' + psQuote(process.execPath) + ' -Argument ' + psQuote(taskArguments('scheduled-job')),
      '$trigger = New-ScheduledTaskTrigger -Once -At $at',
      '$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -Hidden -ExecutionTimeLimit (New-TimeSpan -Hours 6)',
      'Register-ScheduledTask -TaskName ' + psQuote(NEXT_TASK) + ' -Action $action -Trigger $trigger -Settings $settings -Description ' + psQuote('ImoDeus next local Facebook publication') + ' -Force | Out-Null',
    ].join('; ');
    await runPowerShell(script);
  }

  async function getPowerSource() {
    if (process.platform !== 'win32') return 'unknown';
    try {
      const result = await runPowerShell("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemInformation]::PowerStatus.PowerLineStatus.ToString()");
      const value = result.stdout.trim().toLowerCase();
      if (value === 'online') return 'ac';
      if (value === 'offline') return 'battery';
    } catch {
      // Report unknown and avoid blocking desktop operation.
    }
    return 'unknown';
  }

  async function wakeTimersEnabled() {
    if (process.platform !== 'win32') return null;
    try {
      const result = await runProcess('powercfg.exe', ['/query', 'SCHEME_CURRENT', 'SUB_SLEEP', 'RTCWAKE']);
      return /Current AC Power Setting Index:\s*0x00000001/i.test(result.stdout);
    } catch {
      return null;
    }
  }

  function profilePath(connectionId) {
    return path.join(profilesDir, safeConnectionId(connectionId));
  }

  async function reportConnection(connectionId, body) {
    return deviceRequest('/api/marketing/facebook-local/runner/connections/' + safeConnectionId(connectionId), body);
  }

  async function processCommands(commands) {
    for (const command of commands || []) {
      if (command.type !== 'delete_profile') continue;
      const connectionId = safeConnectionId(command.connectionId);
      await fs.rm(profilePath(connectionId), { recursive: true, force: true });
      await reportConnection(connectionId, { status: 'disconnected', profileDeleted: true });
    }
  }

  async function heartbeat() {
    const powerSource = await getPowerSource();
    const payload = await deviceRequest('/api/marketing/facebook-local/runner/heartbeat', {
      appVersion: app.getVersion(),
      powerSource,
      wakeTimersEnabled: await wakeTimersEnabled(),
      nextWakeAt,
      lastError,
    });
    lastSeenAt = new Date().toISOString();
    await processCommands(payload.commands);
    return { ...payload, powerSource };
  }

  async function progress(claim, update) {
    return deviceRequest('/api/marketing/facebook-local/runner/progress', {
      jobId: claim.jobId,
      leaseToken: claim.leaseToken,
      ...update,
    });
  }

  function workerEnvironment() {
    const bundledBrowsers = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'playwright-core', '.local-browsers')
      : path.join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers');
    return { ...process.env, ELECTRON_RUN_AS_NODE: '1', PLAYWRIGHT_BROWSERS_PATH: bundledBrowsers };
  }

  async function runWorker(claim) {
    await fs.mkdir(jobsDir, { recursive: true });
    await fs.mkdir(profilesDir, { recursive: true });
    const claimPath = path.join(jobsDir, claim.jobId + '-' + claim.groupIndex + '.json');
    await fs.writeFile(claimPath, JSON.stringify(claim, null, 2) + '\n', 'utf8');
    const workerPath = path.join(__dirname, 'automation', 'facebook-local-worker.mjs');
    let result = null;
    let submissionStarted = false;
    let progressChain = Promise.resolve();
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [
          workerPath,
          '--claim-file', claimPath,
          '--profile-dir', profilePath(claim.connectionId),
        ], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: workerEnvironment(),
        });
        let stderr = '';
        let buffer = '';
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.stdout.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              if (event.type === 'submitting') {
                submissionStarted = true;
                progressChain = progressChain.then(() => progress(claim, { action: 'submitting' }));
              }
              if (event.type === 'result') result = event;
            } catch {
              // Ignore non-protocol browser diagnostics.
            }
          }
        });
        child.on('error', reject);
        child.on('exit', (code) => {
          if (code === 0 || result) resolve();
          else reject(new Error(stderr.trim() || 'Facebook worker stopped unexpectedly.'));
        });
      });
      await progressChain;
      if (result) {
        await progress(claim, {
          action: result.action,
          code: result.code || null,
          message: result.message || null,
          currentUrl: result.currentUrl || null,
        });
      } else if (!submissionStarted) {
        await progress(claim, { action: 'failed', code: 'WORKER_NO_RESULT', message: 'Runnerul local nu a returnat un rezultat.' });
      }
    } catch (error) {
      if (!submissionStarted) {
        await progress(claim, {
          action: 'failed',
          code: 'WORKER_CRASH',
          message: error instanceof Error ? error.message : String(error),
        }).catch(() => undefined);
      }
      throw error;
    } finally {
      await fs.rm(claimPath, { force: true }).catch(() => undefined);
    }
  }

  async function claimNext() {
    try {
      const payload = await deviceRequest('/api/marketing/facebook-local/runner/claim');
      return payload.claim || null;
    } catch (error) {
      if (error.status === 409 && error.payload?.jobId && error.payload?.leaseToken) {
        const synthetic = {
          jobId: error.payload.jobId,
          leaseToken: error.payload.leaseToken,
        };
        await progress(synthetic, {
          action: error.payload.code === 'NEEDS_REAUTHENTICATION' ? 'needs_reauthentication' : 'failed',
          code: error.payload.code || 'CLAIM_INVALID',
          message: error.message,
        }).catch(() => undefined);
        return null;
      }
      throw error;
    }
  }

  function startBlocker() {
    if (blockerId === null) blockerId = powerSaveBlocker.start('prevent-app-suspension');
  }

  function stopBlocker() {
    if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId);
    blockerId = null;
  }

  async function maybeHibernate() {
    if (!/^(daily-sync|scheduled-job)$/.test(String(launchReason || ''))) return;
    if (powerMonitor.getSystemIdleTime() < IDLE_BEFORE_SLEEP_SECONDS) return;
    const powerSource = await getPowerSource();
    if (powerSource !== 'ac') return;
    await runProcess('shutdown.exe', ['/h']).catch(() => undefined);
  }

  function scheduleReturnToSleep() {
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {
      if (!running && powerMonitor.getSystemIdleTime() >= IDLE_BEFORE_SLEEP_SECONDS) {
        void maybeHibernate();
      }
    }, 120_000);
  }

  function scheduleNearJob(nextScheduledAt) {
    clearTimeout(nearJobTimer);
    nearJobTimer = null;
    if (!nextScheduledAt) return;
    const waitMs = new Date(nextScheduledAt).getTime() - Date.now();
    if (waitMs <= 0 || waitMs > NEAR_JOB_MS) return;
    nearJobTimer = setTimeout(() => void syncNow('near-job'), Math.max(1_000, waitMs + 250));
  }

  async function performSync(reason) {
    if (!config || stopped) return status();
    running = true;
    lastError = null;
    emitStatus();
    startBlocker();
    try {
      let state = await heartbeat();
      if (connectingProcess) {
        await heartbeat();
        return status();
      }
      if (state.powerSource === 'battery') {
        await configureNextWake(state.nextScheduledAt || null);
        scheduleNearJob(state.nextScheduledAt || null);
        lastError = 'Laptopul este pe baterie; joburile asteapta alimentarea la priza.';
        return status();
      }
      while (!stopped) {
        const claim = await claimNext();
        if (claim) {
          await runWorker(claim);
          state = await heartbeat();
          continue;
        }
        state = await heartbeat();
        const waitMs = state.nextScheduledAt ? new Date(state.nextScheduledAt).getTime() - Date.now() : Infinity;
        if (waitMs > 0 && waitMs <= NEAR_JOB_MS) {
          await delay(Math.max(1_000, waitMs + 250));
          continue;
        }
        await configureNextWake(state.nextScheduledAt || null);
        scheduleNearJob(state.nextScheduledAt || null);
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      running = false;
      stopBlocker();
      emitStatus();
      scheduleReturnToSleep();
    }
    return status();
  }

  function syncNow(reason = 'manual') {
    if (!config) return Promise.resolve(status());
    if (!syncPromise) {
      syncPromise = performSync(reason).finally(() => { syncPromise = null; });
    }
    return syncPromise;
  }

  async function pair({ idToken, apiBase, deviceName }) {
    const origin = new URL(apiBase).origin;
    const existingId = config?.deviceId || crypto.randomUUID().replace(/-/g, '');
    const response = await fetch(origin + '/api/marketing/facebook-local/devices', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: existingId,
        name: deviceName || os.hostname(),
        appVersion: app.getVersion(),
      }),
      signal: AbortSignal.timeout(70_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Laptopul nu a putut fi activat.');
    await saveConfig({
      deviceId: payload.device.id,
      agencyId: payload.device.agencyId,
      ownerUid: payload.device.ownerUid,
      apiBase: origin,
      deviceToken: payload.deviceToken,
    });
    await configureDailyWake();
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => void syncNow('heartbeat'), HEARTBEAT_MS);
    void syncNow('paired');
    emitStatus();
    return status();
  }

  async function openConnection(connectionId) {
    if (!config) throw new Error('Activeaza mai intai runnerul local pe acest laptop.');
    if (connectingProcess) throw new Error('O alta fereastra de conectare Facebook este deja deschisa.');
    if (syncPromise) await syncPromise;
    if (running) throw new Error('Asteapta finalizarea publicarii Facebook curente.');
    const id = safeConnectionId(connectionId);
    await fs.mkdir(profilesDir, { recursive: true });
    await reportConnection(id, { status: 'connecting', lastError: null });
    const workerPath = path.join(__dirname, 'automation', 'facebook-local-connect.mjs');
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        workerPath,
        '--profile-dir', profilePath(id),
      ], {
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: workerEnvironment(),
      });
      connectingProcess = child;
      let buffer = '';
      let settled = false;
      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === 'connected' && !settled) {
              settled = true;
              void reportConnection(id, {
                status: 'connected',
                facebookUserId: event.facebookUserId,
                displayName: event.displayName,
                currentUrl: event.currentUrl,
                lastError: null,
              }).then(() => resolve({ connected: true })).catch(reject);
            }
          } catch {
            // Ignore browser diagnostics.
          }
        }
      });
      child.on('error', (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      child.on('exit', (code) => {
        connectingProcess = null;
        if (!settled) {
          settled = true;
          const message = code === 0 ? 'Conectarea Facebook nu a fost finalizata.' : 'Fereastra Facebook a fost inchisa.';
          void reportConnection(id, { status: 'error', lastError: message }).catch(() => undefined);
          reject(new Error(message));
        }
      });
    });
  }

  async function init() {
    config = await readConfig();
    emitStatus();
    if (!config) return status();
    await configureDailyWake().catch((error) => { lastError = error.message; });
    heartbeatTimer = setInterval(() => void syncNow('heartbeat'), HEARTBEAT_MS);
    powerMonitor.on('resume', () => void syncNow('resume'));
    powerMonitor.on('on-ac', () => void syncNow('on-ac'));
    void syncNow('startup');
    return status();
  }

  function shouldKeepAlive() {
    return Boolean(config);
  }

  async function stop() {
    stopped = true;
    clearInterval(heartbeatTimer);
    clearTimeout(nearJobTimer);
    clearTimeout(sleepTimer);
    connectingProcess?.kill();
    stopBlocker();
  }

  return {
    init,
    pair,
    syncNow,
    openConnection,
    getStatus: status,
    shouldKeepAlive,
    stop,
  };
}

module.exports = { createFacebookLocalRunner };

