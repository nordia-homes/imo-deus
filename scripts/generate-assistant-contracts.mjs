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
for (const match of definitions.matchAll(/(\w+): \{ method: '(\w+)',[^\n]*import\('@\/([^']+)'\)/g)) {
  const file = path.join(root, 'src', match[3] + '.ts');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const bodyFields = new Set(), queryFields = new Set();
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(source) === 'body') bodyFields.add(node.name.text);
    if (ts.isCallExpression(node) && /(?:params|searchParams)\.get$/.test(node.expression.getText(source)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) queryFields.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  contracts[match[1]] = { method: match[2], validation: schemaSnippets(file).join('\n\n').slice(0, 16000), bodyFields: [...bodyFields].sort(), queryFields: [...queryFields].sort(), note: 'Handler-ul și serviciul domeniului rămân autoritatea de validare. Nu executa scrieri pentru a ghici date lipsă.' };
}
fs.writeFileSync('src/lib/ai-assistant/handler-contracts.json', JSON.stringify(contracts, null, 2) + '\n');
console.log(`Generated contracts for ${Object.keys(contracts).length} registered handlers.`);
