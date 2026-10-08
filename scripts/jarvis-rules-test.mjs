import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const directory = path.resolve('.tmp/jarvis-java');
await fs.mkdir(directory, { recursive: true });
let entries = await fs.readdir(directory, { withFileTypes: true });
let runtime = entries.find(entry => entry.isDirectory() && entry.name.startsWith('jdk-'))?.name;
if (!runtime) {
  const metadata = await fetch('https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse').then(response => { if (!response.ok) throw new Error('Java metadata unavailable'); return response.json(); });
  const binary = metadata[0]?.binary?.package;
  if (!binary?.link || !binary.checksum || !binary.link.startsWith('https://github.com/adoptium/')) throw new Error('Unexpected Java download source');
  const response = await fetch(binary.link); if (!response.ok) throw new Error('Java download failed');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== binary.checksum) throw new Error('Java checksum mismatch');
  const archive = path.join(directory, 'runtime.zip'); await fs.writeFile(archive, bytes);
  const powershell = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const extract = spawn(powershell, ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${directory.replaceAll("'", "''")}' -Force`], { stdio: 'inherit', windowsHide: true });
  if (await new Promise(resolve => extract.on('exit', resolve)) !== 0) throw new Error('Java extraction failed');
  entries = await fs.readdir(directory, { withFileTypes: true }); runtime = entries.find(entry => entry.isDirectory() && entry.name.startsWith('jdk-'))?.name;
}
if (!runtime) throw new Error('Java runtime missing');
const javaHome = path.join(directory, runtime);
let command = `"${process.execPath}" "${path.resolve('node_modules/vitest/vitest.mjs')}" run --maxWorkers=2 --hookTimeout=60000 src/lib/ai-assistant/__tests__/media-pipeline.integration.test.ts src/lib/ai-assistant/__tests__/tiktok-schedule.integration.test.ts src/lib/ai-assistant/__tests__/outbound-recipient.integration.test.ts src/lib/ai-assistant/__tests__/matching-delivery.integration.test.ts src/lib/ai-assistant/__tests__/prospecting-workflow.integration.test.ts src/lib/ai-assistant/__tests__/reconciliation.integration.test.ts src/lib/ai-assistant/__tests__/media-server.integration.test.ts src/lib/ai-assistant/__tests__/media-storage.integration.test.ts src/lib/ai-assistant/__tests__/property-assets-concurrency.integration.test.ts src/lib/ai-assistant/__tests__/sales-query.integration.test.ts src/lib/ai-assistant/__tests__/jobs-concurrency.integration.test.ts src/lib/ai-assistant/__tests__/calendar-concurrency.integration.test.ts src/lib/ai-assistant/__tests__/notification-sweep.integration.test.ts src/lib/ai-assistant/__tests__/firestore-rules.test.ts src/lib/communications/__tests__/firestore-rules.test.ts src/lib/collaboration/firestore-rules.test.ts src/lib/tiktok-ads/__tests__/firestore-rules.integration.test.ts src/lib/property-removal/__tests__/firestore-rules.integration.test.ts`;
if (process.argv.includes('--viewing-live')) {
  process.env.JARVIS_LIVE_VIEWING_EVAL = 'true';
  command = command.slice(0, command.indexOf(' src/lib/')) + ' src/lib/ai-assistant/__tests__/viewing-command.live.integration.test.ts';
}
if (process.argv.includes('--corpus-calendar-live')) {
  process.env.JARVIS_CORPUS_LIVE = 'true';
  const selected = process.argv.find(arg => /^--case=master-\d{4}$/.test(arg));
  if (selected) process.env.JARVIS_CORPUS_CASE = selected.slice(7);
  if (process.argv.includes('--batch=confirmations')) process.env.JARVIS_CORPUS_BATCH = 'confirmations';
  if (process.argv.includes('--batch=availability')) process.env.JARVIS_CORPUS_BATCH = 'availability';
  if (process.argv.includes('--batch=task-context')) process.env.JARVIS_CORPUS_BATCH = 'task-context';
  if (process.argv.includes('--batch=task-deferral')) process.env.JARVIS_CORPUS_BATCH = 'task-deferral';
  if (process.argv.includes('--batch=task-priorities')) process.env.JARVIS_CORPUS_BATCH = 'task-priorities';
  if (process.argv.includes('--batch=task-agenda')) process.env.JARVIS_CORPUS_BATCH = 'task-agenda';
  if (process.argv.includes('--batch=viewing-followups')) process.env.JARVIS_CORPUS_BATCH = 'viewing-followups';
  if (process.argv.includes('--batch=property-history')) process.env.JARVIS_CORPUS_BATCH = 'property-history';
  if (process.argv.includes('--batch=viewing-details')) process.env.JARVIS_CORPUS_BATCH = 'viewing-details';
  if (process.argv.includes('--batch=viewing-notes')) process.env.JARVIS_CORPUS_BATCH = 'viewing-notes';
  if (process.argv.includes('--batch=viewing-edits')) process.env.JARVIS_CORPUS_BATCH = 'viewing-edits';
  if (process.argv.includes('--batch=context')) process.env.JARVIS_CORPUS_BATCH = 'context';
  if (!process.argv.includes('--with-regressions')) command = command.slice(0, command.indexOf(' src/lib/'));
  command += ' src/lib/ai-assistant/__tests__/corpus-calendar.live.integration.test.ts';
}
const child = spawn(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec', '--project', 'demo-imodeus-ai-assistant', '--only', 'firestore,storage', command], { stdio: 'inherit', windowsHide: true, env: { ...process.env, JAVA_HOME: javaHome, PATH: [path.join(javaHome, 'bin'), path.dirname(process.execPath), path.join(process.env.SystemRoot || 'C:/Windows', 'System32'), process.env.PATH].join(path.delimiter) } });
process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code || 0)));
