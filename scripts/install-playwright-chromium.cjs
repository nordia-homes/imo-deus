const { spawnSync } = require('node:child_process');

process.env.PLAYWRIGHT_BROWSERS_PATH = '0';

const cliPath = require.resolve('playwright/cli');
const result = spawnSync(process.execPath, [cliPath, 'install', 'chromium'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: '0',
  },
});

process.exit(result.status || 0);
