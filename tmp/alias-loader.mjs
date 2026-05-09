import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const projectRoot = path.resolve(process.cwd());

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('@/')) {
    const basePath = path.join(projectRoot, 'src', specifier.slice(2));
    const resolvedFilePath = (() => {
      if (basePath.endsWith('.ts') && fs.existsSync(basePath)) {
        return basePath;
      }

      if (fs.existsSync(`${basePath}.ts`)) {
        return `${basePath}.ts`;
      }

      if (fs.existsSync(path.join(basePath, 'index.ts'))) {
        return path.join(basePath, 'index.ts');
      }

      return `${basePath}.ts`;
    })();
    const resolvedPath = pathToFileURL(resolvedFilePath).href;
    return defaultResolve(resolvedPath, context, defaultResolve);
  }

  return defaultResolve(specifier, context, defaultResolve);
}
