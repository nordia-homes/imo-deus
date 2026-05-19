const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'node_modules', 'playwright-core', '.local-browsers');
const targetDir = path.join(rootDir, '.next', 'standalone', 'node_modules', 'playwright-core', '.local-browsers');

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

if (!fs.existsSync(sourceDir)) {
  console.warn(`Playwright browsers not found at ${sourceDir}. Run npm install or node scripts/install-playwright-chromium.cjs first.`);
  process.exit(0);
}

if (!fs.existsSync(path.dirname(targetDir))) {
  console.warn(`Next standalone playwright-core folder not found at ${path.dirname(targetDir)}. Skipping browser copy.`);
  process.exit(0);
}

copyDir(sourceDir, targetDir);
console.log(`Copied Playwright browsers to ${targetDir}`);
