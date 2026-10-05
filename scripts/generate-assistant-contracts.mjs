import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = process.cwd();
function schemaSnippets(file, depth = 0, visited = new Set()) {
  if (visited.has(file) || depth > 2 || !fs.existsSync(file)) return [];
  visited.add(file);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const snippets = [];
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) if (/schema/i.test(declaration.name.getText(source)) && declaration.initializer) snippets.push(declaration.getText(source));
    }
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) && statement.importClause.namedBindings.elements.some(e => /schema/i.test(e.name.text))) {
      const specifier = statement.moduleSpecifier.text;
      const target = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null;
      if (target) snippets.push(...schemaSnippets(target + '.ts', depth + 1, visited));
    }
  }
  return snippets;
}
const definitions = fs.readFileSync('src/lib/ai-assistant/operations.ts', 'utf8');
const contracts = {};
const registry = ts.createSourceFile('operations.ts', definitions, ts.ScriptTarget.Latest, true);
const entries = [];
function collect(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(registry) === 'operations' && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
    for (const property of node.initializer.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) continue;
      const fields = new Map(property.initializer.properties.filter(ts.isPropertyAssignment).map(field => [field.name.getText(registry), field.initializer]));
      let handler;
      function findImport(child) {
        if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(child.arguments[0])) handler = child.arguments[0].text;
        ts.forEachChild(child, findImport);
      }
      if (fields.get('load')) findImport(fields.get('load'));
      if (!handler?.startsWith('@/')) throw new Error(`Missing handler for ${property.name.getText(registry)}`);
      entries.push({ id: property.name.getText(registry), method: fields.get('method').text, handler: handler.slice(2) });
    }
  }
  ts.forEachChild(node, collect);
}
collect(registry);
for (const entry of entries) {
  const file = path.join(root, 'src', entry.handler + '.ts');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const bodyFields = new Set(), queryFields = new Set();
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(source) === 'body') bodyFields.add(node.name.text);
    if (ts.isCallExpression(node) && /(?:params|searchParams)\.get$/.test(node.expression.getText(source)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) queryFields.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  contracts[entry.id] = { method: entry.method, validation: schemaSnippets(file).join('\n\n').slice(0, 16000), bodyFields: [...bodyFields].sort(), queryFields: [...queryFields].sort(), note: 'Handler-ul și serviciul domeniului rămân autoritatea de validare. Nu executa scrieri pentru a ghici date lipsă.' };
}
fs.writeFileSync('src/lib/ai-assistant/handler-contracts.json', JSON.stringify(contracts, null, 2) + '\n');
console.log(`Generated contracts for ${Object.keys(contracts).length} registered handlers.`);
