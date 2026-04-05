import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const targetFile = path.join(
  process.cwd(),
  'node_modules',
  'app-builder-lib',
  'out',
  'node-module-collector',
  'nodeModulesCollector.js',
);

async function main() {
  let source = await fs.readFile(targetFile, 'utf8');

  const shellNeedle = '                shell: true, // `true`` is now required: https://github.com/electron-userland/electron-builder/issues/9488';
  const shellReplacement = '                shell: false, // patched by ImoDeus desktop build';

  if (source.includes(shellNeedle)) {
    source = source.replace(shellNeedle, shellReplacement);
  }

  const cmdNeedle = '            command = "cmd.exe";';
  const cmdReplacement = '            command = process.env.ComSpec || "C:\\\\Windows\\\\System32\\\\cmd.exe";';

  if (source.includes(cmdNeedle)) {
    source = source.replace(cmdNeedle, cmdReplacement);
  }

  const batArgsNeedle = '            args = ["/c", `"${tempBatFile}"`, ...args];';
  const batArgsReplacement = '            args = ["/c", tempBatFile, ...args];';

  if (source.includes(batArgsNeedle)) {
    source = source.replace(batArgsNeedle, batArgsReplacement);
  }

  await fs.writeFile(targetFile, source, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
