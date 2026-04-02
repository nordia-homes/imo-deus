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

  const closeNeedle = `            child.on("close", code => {
                outStream.close();
                // https://github.com/npm/npm/issues/17624
                const shouldIgnore = code === 1 && "npm" === execName.toLowerCase() && args.includes("list");
                if (shouldIgnore) {
                    builder_util_1.log.debug(null, "\`npm list\` returned non-zero exit code, but it MIGHT be expected (https://github.com/npm/npm/issues/17624). Check stderr for details.");
                }
                if (stderr.length > 0) {
                    builder_util_1.log.debug({ stderr }, "note: there was node module collector output on stderr");
                    this.cache.logSummary[moduleManager_1.LogMessageByKey.PKG_COLLECTOR_OUTPUT].push(stderr);
                }
                const shouldResolve = code === 0 || shouldIgnore;
                return shouldResolve ? resolve() : reject(new Error(\`Node module collector process exited with code \${code}:\\n\${stderr}\`));
            });`;

  const closeReplacement = `            child.on("close", code => {
                outStream.end();
                outStream.on("close", () => {
                    // https://github.com/npm/npm/issues/17624
                    const shouldIgnore = code === 1 && "npm" === execName.toLowerCase() && args.includes("list");
                    if (shouldIgnore) {
                        builder_util_1.log.debug(null, "\`npm list\` returned non-zero exit code, but it MIGHT be expected (https://github.com/npm/npm/issues/17624). Check stderr for details.");
                    }
                    if (stderr.length > 0) {
                        builder_util_1.log.debug({ stderr }, "note: there was node module collector output on stderr");
                        this.cache.logSummary[moduleManager_1.LogMessageByKey.PKG_COLLECTOR_OUTPUT].push(stderr);
                    }
                    const shouldResolve = code === 0 || shouldIgnore;
                    return shouldResolve ? resolve() : reject(new Error(\`Node module collector process exited with code \${code}:\\n\${stderr}\`));
                });
            });`;

  if (source.includes(closeNeedle)) {
    source = source.replace(closeNeedle, closeReplacement);
  }

  await fs.writeFile(targetFile, source, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
