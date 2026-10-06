import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// This reports static reachability, not whether a button is visible for a
// particular tenant/role. Runtime acceptance remains a separate requirement.
export function dashboardReachability(root = process.cwd()) {
  const dependencies = new Map(), reached = new Map();
  const relative = file => path.relative(root, file).replaceAll('\\', '/');
  function files(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]); }
  function resolve(from, specifier) {
    const base = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(from), specifier) : null;
    if (!base) return null;
    return [base, ...['.ts', '.tsx', '.js', '.jsx', '.mjs'].map(extension => base + extension), ...['index.ts', 'index.tsx', 'index.js'].map(name => path.join(base, name))].find(file => fs.existsSync(file) && fs.statSync(file).isFile()) || null;
  }
  function imports(file) {
    if (dependencies.has(file)) return dependencies.get(file);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const found = new Set();
    function walk(node) {
      const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
      if (specifier && ts.isStringLiteral(specifier)) { const target = resolve(file, specifier.text); if (target) found.add(target); }
      ts.forEachChild(node, walk);
    }
    walk(source); const result = [...found]; dependencies.set(file, result); return result;
  }
  const roots = files(path.join(root, 'src/app/(dashboard)')).filter(file => /[/\\](?:page|layout)\.tsx?$/.test(file));
  if (fs.existsSync(path.join(root, 'src/app/layout.tsx'))) roots.push(path.join(root, 'src/app/layout.tsx'));
  for (const entry of roots.sort()) {
    const seen = new Set(), pending = [entry];
    while (pending.length) {
      const file = pending.pop(); if (seen.has(file)) continue; seen.add(file);
      if (!reached.has(relative(file))) reached.set(relative(file), new Set());
      reached.get(relative(file)).add(relative(entry)); pending.push(...imports(file));
    }
  }
  return file => ({ staticallyReachable: reached.has(file), entrypoints: [...(reached.get(file) || [])].sort(), limitation: 'Static imports do not prove runtime visibility, permissions or complete manual parity.' });
}
