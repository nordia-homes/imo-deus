import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
await fs.mkdir('.tmp/jarvis-matching', { recursive: true });
for (const file of ['src/lib/zones/zone-services.test.ts', 'src/lib/location-catalog/location-scoring.test.ts']) {
  const target = path.resolve('.tmp/jarvis-matching', path.basename(file) + '.cjs');
  await build({ entryPoints: [file], outfile: target, bundle: true, platform: 'node', format: 'cjs', packages: 'external' });
  execFileSync(process.execPath, [target], { stdio: 'inherit', windowsHide: true });
}
