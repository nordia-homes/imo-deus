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
const command = `"${process.execPath}" "${path.resolve('node_modules/vitest/vitest.mjs')}" run src/lib/ai-assistant/__tests__/reconciliation.integration.test.ts src/lib/ai-assistant/__tests__/media-server.integration.test.ts src/lib/ai-assistant/__tests__/media-storage.integration.test.ts src/lib/ai-assistant/__tests__/property-assets-concurrency.integration.test.ts src/lib/ai-assistant/__tests__/sales-query.integration.test.ts src/lib/ai-assistant/__tests__/jobs-concurrency.integration.test.ts src/lib/ai-assistant/__tests__/calendar-concurrency.integration.test.ts src/lib/ai-assistant/__tests__/firestore-rules.test.ts src/lib/communications/__tests__/firestore-rules.test.ts src/lib/collaboration/firestore-rules.test.ts src/lib/tiktok-ads/__tests__/firestore-rules.integration.test.ts src/lib/property-removal/__tests__/firestore-rules.integration.test.ts`;
const child = spawn(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec', '--project', 'demo-imodeus-ai-assistant', '--only', 'firestore,storage', command], { stdio: 'inherit', windowsHide: true, env: { ...process.env, JAVA_HOME: javaHome, PATH: [path.join(javaHome, 'bin'), path.dirname(process.execPath), path.join(process.env.SystemRoot || 'C:/Windows', 'System32'), process.env.PATH].join(path.delimiter) } });
process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code || 0)));
