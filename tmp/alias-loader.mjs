import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(process.cwd());

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('@/')) {
    const basePath = path.join(projectRoot, 'src', specifier.slice(2));
    const resolvedPath = pathToFileURL(basePath.endsWith('.ts') ? basePath : `${basePath}.ts`).href;
    return defaultResolve(resolvedPath, context, defaultResolve);
  }

  return defaultResolve(specifier, context, defaultResolve);
}
