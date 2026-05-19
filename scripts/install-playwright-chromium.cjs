const { spawnSync } = require('node:child_process');
const path = require('node:path');

process.env.PLAYWRIGHT_BROWSERS_PATH = '0';

const cliPath = path.join(path.dirname(require.resolve('playwright')), 'cli.js');
const installArgs = ['install'];

if (process.env.PLAYWRIGHT_INSTALL_WITH_DEPS === '1') {
  installArgs.push('--with-deps');
}

installArgs.push('chromium');

const result = spawnSync(process.execPath, [cliPath, ...installArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: '0',
  },
});

process.exit(result.status || 0);
