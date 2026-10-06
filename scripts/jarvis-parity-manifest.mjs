import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { dashboardReachability } from './lib/source-reachability.mjs';

const target = 'docs/jarvis/CRM_PARITY_LIVE_MANIFEST.json';
const text = fs.readFileSync('src/lib/ai-assistant/operations.ts', 'utf8');
const source = ts.createSourceFile('operations.ts', text, ts.ScriptTarget.Latest, true);
const operations = [];
for (const statement of source.statements) if (ts.isVariableStatement(statement)) for (const variable of statement.declarationList.declarations) {
  if (variable.name.getText(source) !== 'operations' || !ts.isObjectLiteralExpression(variable.initializer)) continue;
  for (const property of variable.initializer.properties) {
    const id = property.name.getText(source), fields = new Map(property.initializer.properties.map(field => [field.name.getText(source), field.initializer]));
    const literal = name => fields.get(name)?.text;
    const handler = fields.get('load').getText(source).match(/import\s*\(\s*['"]@\/([^'"]+)['"]\s*\)/)?.[1];
    if (!handler) throw new Error(`No explicit handler for ${id}`);
    const method = literal('method'), file = `src/${handler}.ts`;
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
    const route = fs.readFileSync(file, 'utf8');
    // Includes the catch-all's explicit method aliases.
    if (!new RegExp(`export (?:async )?function ${method}\\b|export const ${method}\\b|export \\{[^}]*\\b${method}\\b`).test(route)) throw new Error(`Missing ${method}: ${file}`);
    operations.push({ id, method, path: literal('path'), handler: file, description: literal('description'), readOnly: fields.get('readOnly')?.kind === ts.SyntaxKind.TrueKeyword || method === 'GET', externallySensitive: fields.get('external')?.kind === ts.SyntaxKind.TrueKeyword, verification: 'registered_handler_not_provider_certification' });
  }
}
function files(root) { return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(root, entry.name)) : [path.join(root, entry.name)]); }
const manualWrites = [];
const reachability = dashboardReachability();
for (const file of [...files('src/app/(dashboard)'), ...files('src/components'), ...files('src/hooks')].filter(file => /\.tsx?$/.test(file))) {
  const value = fs.readFileSync(file, 'utf8');
  const calls = [...value.matchAll(/\b(addDoc|updateDoc|setDoc|deleteDoc|writeBatch|uploadBytes|runTransaction|\w+DocumentNonBlocking|executeCrmAction|createManualViewing)\s*\(/g)].map(match => ({ call: match[1], line: value.slice(0, match.index).split('\n').length, sharedExecutor: ['executeCrmAction', 'createManualViewing'].includes(match[1]) }));
  if (calls.length) { const sourceFile = file.replaceAll('\\', '/'); manualWrites.push({ file: sourceFile, calls, reachability: reachability(sourceFile), verification: 'static_reference_requires_semantic_review' }); }
}
const contracts = fs.readFileSync('src/lib/ai-assistant/contracts.ts', 'utf8');
const contractSource = ts.createSourceFile('contracts.ts', contracts, ts.ScriptTarget.Latest, true);
const actionKinds = [];
for (const statement of contractSource.statements) if (ts.isVariableStatement(statement)) for (const variable of statement.declarationList.declarations) {
  if (variable.name.getText(contractSource) !== 'actionSchema' || !ts.isCallExpression(variable.initializer)) continue;
  const options = variable.initializer.arguments[1];
  if (!ts.isArrayLiteralExpression(options)) throw new Error('actionSchema must declare explicit top-level options.');
  for (const option of options.elements) {
    const kind = option.getText(contractSource).match(/kind:\s*z\.literal\(\s*['"]([^'"]+)['"]\s*\)/)?.[1];
    if (!kind || actionKinds.includes(kind)) throw new Error('Missing or duplicate native action discriminator.');
    actionKinds.push(kind);
  }
}
if (!actionKinds.length) throw new Error('No native action contract found.');
const manifest = { version: 2, operations, actionKinds, manualWrites, excluded: ['internal workers', 'provider webhooks', 'master-admin outside actor permissions', 'human-only consent and OAuth steps'] };
const output = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('Parity manifest drift: run npm run jarvis:parity.');
} else fs.writeFileSync(target, output);
console.log(`Parity manifest verified: ${operations.length} operations, ${manifest.actionKinds.length} native action kinds, ${manualWrites.length} UI files. No coverage percentage inferred.`);
