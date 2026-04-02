import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const sourceDesktopDir = path.join(rootDir, 'desktop');
const appDir = path.join(rootDir, 'desktop-dist-app');

async function removeDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyDir(sourceDir, targetDir) {
  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

async function main() {
  const rootPackageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));

  await removeDir(appDir);
  await copyDir(sourceDesktopDir, appDir);

  const desktopPackageJson = {
    name: 'imodeus-desktop',
    version: rootPackageJson.version,
    private: true,
    main: 'main.cjs',
    description: rootPackageJson.description,
    author: rootPackageJson.author,
    dependencies: {
      'electron-updater': rootPackageJson.devDependencies['electron-updater'],
      playwright: rootPackageJson.devDependencies.playwright,
    },
  };

  await fs.writeFile(
    path.join(appDir, 'package.json'),
    `${JSON.stringify(desktopPackageJson, null, 2)}\n`,
    'utf8',
  );

  await new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe' : 'npm';
    const args =
      process.platform === 'win32'
        ? ['/d', '/s', '/c', 'npm install --omit=dev --no-package-lock']
        : ['install', '--omit=dev', '--no-package-lock'];

    const child = spawn(command, args, {
      cwd: appDir,
      stdio: 'inherit',
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm install pentru desktop-dist-app a ieșit cu codul ${code ?? 'necunoscut'}.`));
    });

    child.on('error', reject);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
