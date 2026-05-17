const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { app, BrowserWindow, dialog, ipcMain, clipboard } = require('electron');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let mainWindow = null;
let runnerProcess = null;
let olxContextPromise = null;
let runnerStatus = {
  state: 'idle',
  message: 'Nicio sesiune desktop activă.',
  currentGroupIndex: undefined,
  currentGroupName: null,
  sessionPath: null,
  completedCount: 0,
  totalCount: 0,
};
let currentSession = null;

function isIgnorableRunnerStderr(message) {
  const normalized = message.toLowerCase();
  return [
    'failed to reset the quota database',
    'service_worker_storage.cc',
    'quota_database.cc',
    'database io error',
    'devtools listening on',
    'unable to create cache',
    'unable to move the cache',
    'gpu cache creation failed',
    'disk_cache.cc',
    'gpu_disk_cache.cc',
    'cache_util_win.cc',
    'access is denied. (0x5)',
  ].some((pattern) => normalized.includes(pattern));
}

function getRunnerProfileDir() {
  return path.join(app.getPath('userData'), 'facebook-profile');
}

function getOlxProfileDir() {
  return path.join(app.getPath('userData'), 'olx-profile');
}

function normalizePhoneCandidate(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('4') && digits.length === 11 && digits.slice(1).startsWith('07')) {
    return digits.slice(1);
  }
  if (digits.startsWith('004') && digits.length === 13 && digits.slice(3).startsWith('07')) {
    return digits.slice(3);
  }
  if (digits.startsWith('07') && digits.length === 10) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
    return digits;
  }
  return '';
}

function extractOlxPhoneFromLimitedPhonesPayload(text) {
  try {
    const payload = JSON.parse(text || '{}');
    return payload?.data?.phones?.map((value) => normalizePhoneCandidate(value)).find(Boolean) || '';
  } catch {
    return '';
  }
}

async function launchOlxContext() {
  const { chromium } = require('playwright');
  const profileDir = getOlxProfileDir();
  const cacheDir = path.join(profileDir, 'playwright-cache');
  await fs.mkdir(cacheDir, { recursive: true });

  const sharedOptions = {
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-session-crashed-bubble',
      '--disable-features=Translate,OptimizationHints,MediaRouter',
      `--disk-cache-dir=${cacheDir}`,
      '--start-maximized',
    ],
  };

  const attempts = [
    { label: 'chrome', options: { ...sharedOptions, channel: 'chrome' } },
    { label: 'msedge', options: { ...sharedOptions, channel: 'msedge' } },
    { label: 'bundled-chromium', options: sharedOptions },
  ];
  const errors = [];

  for (const attempt of attempts) {
    try {
      return await chromium.launchPersistentContext(profileDir, attempt.options);
    } catch (error) {
      errors.push(`${attempt.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Nu am putut porni browserul OLX local. ${errors.join(' | ')}`);
}

async function getOlxContext() {
  if (!olxContextPromise) {
    olxContextPromise = launchOlxContext();
  }

  return olxContextPromise;
}

async function getOlxPhoneNumberFromLocalBrowser(url) {
  if (!/^https:\/\/(?:www\.)?olx\.ro\//i.test(url || '')) {
    throw new Error('URL-ul OLX este invalid.');
  }

  const context = await getOlxContext();
  const page = await context.newPage();
  const capturedPhones = [];

  const capturePhoneResponse = async (response) => {
    if (!/\/limited-phones(?:[/?#]|$)/i.test(response.url())) return;
    const text = await response.text().catch(() => '');
    const phone = extractOlxPhoneFromLimitedPhonesPayload(text);
    if (phone) capturedPhones.push(phone);
  };

  page.on('response', (response) => {
    void capturePhoneResponse(response);
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200).catch(() => undefined);
    await page.bringToFront().catch(() => undefined);

    const directPayload = await page.evaluate(async () => {
      const html = document.documentElement.innerHTML || '';
      const normalized = html.replace(/\s+/g, ' ');
      const adId =
        normalized.match(/"sku":"(\d{6,12})"/i)?.[1] ||
        normalized.match(/"id":(\d{6,12}),"title":/i)?.[1] ||
        normalized.match(/"(?:offer|ad|listing)"\s*:\s*\{[\s\S]{0,400}?"id":\s*"?(\d{6,12})"?/i)?.[1] ||
        normalized.match(/"(?:adId|ad_id|offerId|offer_id)":\s*"?(\d{6,12})"?/i)?.[1] ||
        normalized.match(/\bdata-(?:ad|offer)-id=["']?(\d{6,12})["']?/i)?.[1] ||
        '';

      if (!adId) return '';

      const response = await fetch(`https://www.olx.ro/api/v1/offers/${adId}/limited-phones`, {
        credentials: 'include',
        headers: { accept: 'application/json, text/plain, */*' },
      }).catch(() => null);

      return response?.ok ? await response.text().catch(() => '') : '';
    }).catch(() => '');
    const directPhone = extractOlxPhoneFromLimitedPhonesPayload(directPayload);
    if (directPhone) {
      await page.close().catch(() => undefined);
      return { phone: directPhone, message: 'Telefon preluat din sesiunea OLX locala.' };
    }

    const showPhoneButtonCandidates = [
      page.locator('[data-testid="show-phone"]').last(),
      page.getByRole('button', { name: /arat|afis|afi|numar|telefon/i }).last(),
      page.locator('button').filter({ hasText: /arat|afis|afi|numar|telefon/i }).last(),
    ];

    const phoneResponsePromise = page
      .waitForResponse((response) => /\/limited-phones(?:[/?#]|$)/i.test(response.url()), { timeout: 12000 })
      .then(async (response) => {
        await capturePhoneResponse(response);
      })
      .catch(() => undefined);

    for (const button of showPhoneButtonCandidates) {
      if ((await button.count().catch(() => 0)) > 0) {
        await button.click({ force: true, timeout: 10000 }).catch(() => undefined);
        await page.waitForTimeout(1500).catch(() => undefined);
        break;
      }
    }

    await phoneResponsePromise;

    const networkPhone = capturedPhones.find(Boolean) || '';
    if (networkPhone) {
      await page.close().catch(() => undefined);
      return { phone: networkPhone, message: 'Telefon preluat din OLX local.' };
    }

    const domPhone = await page.evaluate(() => {
      const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const tel = Array.from(document.querySelectorAll('a[href^="tel:"]'))
        .map((node) => node.getAttribute('href') || '')
        .map((href) => href.replace(/^tel:/i, ''))
        .find(Boolean);
      if (tel) return tel;
      return clean(document.body.innerText || '');
    }).catch(() => '');
    const phoneFromDom = normalizePhoneCandidate(domPhone);
    if (phoneFromDom) {
      await page.close().catch(() => undefined);
      return { phone: phoneFromDom, message: 'Telefon preluat din pagina OLX.' };
    }

    return {
      phone: '',
      message: 'Nu am gasit numarul. Daca OLX cere autentificare, logheaza-te in fereastra OLX deschisa si apasa din nou Apel AI.',
    };
  } catch (error) {
    return {
      phone: '',
      message: error instanceof Error ? error.message : 'Nu am putut prelua numarul OLX local.',
    };
  }
}

function getStartUrl() {
  if (process.env.ELECTRON_START_URL) {
    return process.env.ELECTRON_START_URL;
  }

  if (isDev) {
    return 'http://localhost:3000';
  }

  return 'https://studio--studio-652232171-42fb6.us-central1.hosted.app';
}

function emitRunnerStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('facebook-runner:status-changed', runnerStatus);
  }
}

function setRunnerStatus(nextStatus) {
  runnerStatus = { ...runnerStatus, ...nextStatus };
  emitRunnerStatus();
}

async function writeSessionToDisk(session) {
  const runnerDir = path.join(app.getPath('userData'), 'facebook-runner');
  await fs.mkdir(runnerDir, { recursive: true });
  const sessionPath = path.join(runnerDir, `facebook-promotion-session-${session.jobId || session.propertyId}.json`);
  await fs.writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  return sessionPath;
}

async function readSessionFromDisk(sessionPath) {
  const raw = await fs.readFile(sessionPath, 'utf8');
  return JSON.parse(raw);
}

function syncDescriptionToClipboard(session) {
  try {
    clipboard.writeText(session?.propertyDescription || '');
  } catch {
    // Ignore clipboard sync errors and let the worker fall back to direct input.
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: '#0F1E33',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.loadURL(getStartUrl());

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function startRunnerProcess(sessionPath) {
  if (runnerProcess) {
    runnerProcess.kill();
    runnerProcess = null;
  }

  const workerPath = path.join(__dirname, 'automation', 'facebook-worker.mjs');
  const profileDir = getRunnerProfileDir();

  runnerProcess = spawn(process.execPath, [workerPath, '--session', sessionPath, '--profile-dir', profileDir], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
  });
  const childProcess = runnerProcess;

  childProcess.stdout.on('data', async (chunk) => {
    const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const payload = JSON.parse(line);
        if (payload.type === 'status') {
          setRunnerStatus(payload.status);
        }
        if (payload.type === 'session' && runnerStatus.sessionPath) {
          currentSession = await readSessionFromDisk(runnerStatus.sessionPath);
        }
      } catch {
        // Ignore non-JSON log lines from worker.
      }
    }
  });

  childProcess.stderr.on('data', (chunk) => {
    const message = chunk.toString().trim();
    if (!message) return;
    if (isIgnorableRunnerStderr(message)) {
      return;
    }

    setRunnerStatus({
      state: 'error',
      message,
    });
  });

  childProcess.on('exit', (code) => {
    if (runnerProcess === childProcess) {
      runnerProcess = null;
    }

    if (
      runnerStatus.state === 'waiting_for_publish'
    ) {
      setRunnerStatus({
        state: 'waiting_for_publish',
        message: runnerStatus.message || 'Draftul este pregătit. Publică în Facebook, apoi apasă `Am publicat în grup`.',
      });
    } else if (
      runnerStatus.state !== 'completed' &&
      runnerStatus.state !== 'stopped' &&
      runnerStatus.state !== 'error' &&
      code !== 0
    ) {
      setRunnerStatus({
        state: 'error',
        message: `Worker-ul Facebook runner s-a închis cu codul ${code ?? 'necunoscut'}.`,
      });
    }
  });
}

function sendWorkerCommand(command) {
  if (!runnerProcess || !runnerProcess.stdin.writable) {
    throw new Error('Runner-ul desktop nu este pornit.');
  }

  runnerProcess.stdin.write(`${JSON.stringify({ command })}\n`);
}

async function shutdownRunnerProcess() {
  if (!runnerProcess) return;

  const processToStop = runnerProcess;

  try {
    if (processToStop.stdin?.writable) {
      processToStop.stdin.write(`${JSON.stringify({ command: 'stop' })}\n`);
    }
  } catch {
    // Ignore stop command failures during shutdown.
  }

  runnerProcess = null;

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try {
        processToStop.kill();
      } catch {
        // Ignore kill failure.
      }
      resolve();
    }, 1500);

    processToStop.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function advanceDesktopSession(nextStatus) {
  const sessionPath = runnerStatus.sessionPath;
  if (!sessionPath) {
    throw new Error('Nu există o sesiune desktop activă.');
  }

  const session = await readSessionFromDisk(sessionPath);
  const currentGroup = session.groups?.[session.currentGroupIndex];

  if (!currentGroup) {
    setRunnerStatus({
      state: 'completed',
      message: 'Nu mai există grupuri de procesat.',
      currentGroupIndex: session.currentGroupIndex,
      currentGroupName: null,
      completedCount: session.groups.filter((group) => group.status === 'posted' || group.status === 'skipped').length,
      totalCount: session.groups.length,
    });
    currentSession = session;
    return { status: runnerStatus, session };
  }

  currentGroup.status = nextStatus;
  const nextIndex = session.groups.findIndex((group, index) => index > session.currentGroupIndex && group.status === 'pending');
  if (nextIndex >= 0) {
    session.currentGroupIndex = nextIndex;
  }

  await writeSessionToDisk(session);
  currentSession = session;

  const completedCount = session.groups.filter((group) => group.status === 'posted' || group.status === 'skipped').length;
  const nextGroup = nextIndex >= 0 ? session.groups[nextIndex] : null;

  if (nextGroup) {
    setRunnerStatus({
      state: 'starting',
      message:
        nextStatus === 'posted'
          ? `Grupul a fost marcat ca publicat. Pregătesc ${nextGroup.name}...`
          : `Grupul a fost sărit. Pregătesc ${nextGroup.name}...`,
      currentGroupIndex: session.currentGroupIndex,
      currentGroupName: nextGroup.name,
      completedCount,
      totalCount: session.groups.length,
      sessionPath,
    });
    startRunnerProcess(sessionPath);
  } else {
    setRunnerStatus({
      state: 'completed',
      message:
        nextStatus === 'posted'
          ? 'Toate grupurile au fost parcurse. Ultimul grup a fost marcat ca publicat.'
          : 'Toate grupurile au fost parcurse. Ultimul grup a fost sărit.',
      currentGroupIndex: session.currentGroupIndex,
      currentGroupName: currentGroup.name || null,
      completedCount,
      totalCount: session.groups.length,
      sessionPath,
    });
  }

  return { status: runnerStatus, session };
}

app.whenReady().then(() => {
  createWindow();

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Auto-update remains best-effort in scaffolding mode.
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('desktop:is-desktop', async () => true);

ipcMain.handle('olx-phone:get-number', async (_event, { url }) => {
  return getOlxPhoneNumberFromLocalBrowser(url);
});

ipcMain.handle('facebook-runner:save-session-file', async (_event, { session }) => {
  const defaultPath = path.join(app.getPath('downloads'), `facebook-promotion-session-${session.jobId || session.propertyId}.json`);
  const result = await dialog.showSaveDialog({
    title: 'Salvează sesiunea Facebook Promotion',
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true, filePath: null };
  }

  await fs.writeFile(result.filePath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('facebook-runner:start', async (_event, { session }) => {
  currentSession = session;
  syncDescriptionToClipboard(session);
  const sessionPath = await writeSessionToDisk(session);

  setRunnerStatus({
    state: 'starting',
    message: 'Pornesc runner-ul local pentru Facebook Groups...',
    sessionPath,
    currentGroupIndex: session.currentGroupIndex,
    currentGroupName: session.groups?.[session.currentGroupIndex]?.name || null,
    completedCount: session.groups.filter((group) => group.status === 'posted' || group.status === 'skipped').length,
    totalCount: session.groups.length,
  });

  startRunnerProcess(sessionPath);
  return runnerStatus;
});

ipcMain.handle('facebook-runner:retry-current-group', async () => {
  if (currentSession) {
    syncDescriptionToClipboard(currentSession);
  }
  sendWorkerCommand('retry-current-group');
  return { status: runnerStatus, session: currentSession };
});

ipcMain.handle('facebook-runner:mark-posted', async () => {
  await shutdownRunnerProcess();
  return advanceDesktopSession('posted');
});

ipcMain.handle('facebook-runner:skip-group', async () => {
  await shutdownRunnerProcess();
  return advanceDesktopSession('skipped');
});

ipcMain.handle('facebook-runner:stop', async () => {
  if (runnerProcess) {
    sendWorkerCommand('stop');
    runnerProcess.kill();
    runnerProcess = null;
  }

  setRunnerStatus({
    state: 'stopped',
    message: 'Runner-ul desktop a fost oprit.',
  });

  return runnerStatus;
});

ipcMain.handle('facebook-runner:reset-profile', async () => {
  if (runnerProcess) {
    try {
      sendWorkerCommand('stop');
    } catch {
      // Ignore if the worker is already shutting down.
    }
    runnerProcess.kill();
    runnerProcess = null;
  }

  await fs.rm(getRunnerProfileDir(), { recursive: true, force: true });

  setRunnerStatus({
    state: 'idle',
    message: 'Profilul local al runner-ului Facebook a fost resetat. Pornește din nou runner-ul desktop.',
    currentGroupIndex: currentSession?.currentGroupIndex,
    currentGroupName: currentSession?.groups?.[currentSession?.currentGroupIndex || 0]?.name || null,
    completedCount: currentSession?.groups?.filter((group) => group.status === 'posted' || group.status === 'skipped').length || 0,
    totalCount: currentSession?.groups?.length || 0,
  });

  return runnerStatus;
});

ipcMain.handle('facebook-runner:get-status', async () => runnerStatus);
