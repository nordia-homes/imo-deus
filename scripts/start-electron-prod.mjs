import { spawn } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';

const electronBin = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

const child = spawn(electronBin, ['.'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
