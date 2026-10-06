import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const suitePath = 'docs/jarvis/evals/continuation-scenarios.json';
const suiteText = await fs.readFile(suitePath, 'utf8');
const suite = JSON.parse(suiteText);
if (suite.scenarios.length < 100 || new Set(suite.scenarios.map(row => row.id)).size !== suite.scenarios.length) throw new Error('At least 100 unique scenarios required');
await fs.mkdir('.tmp', { recursive: true });
const output = '.tmp/jarvis-continuation-vitest.json';
// Avoid accepting a report left by an earlier, failed process startup.
await fs.writeFile(output, '{}');
const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
  'src/lib/ai-assistant/__tests__/continuation-scenarios.test.ts',
  'src/lib/ai-assistant/__tests__/retrieval.test.ts',
  'src/lib/ai-assistant/__tests__/timezone-memory.test.ts',
  'src/lib/ai-assistant/__tests__/function-tools.test.ts',
  '--reporter=default', '--reporter=json', `--outputFile=${output}`], { stdio: 'inherit', windowsHide: true });
const evidence = JSON.parse(await fs.readFile(output, 'utf8'));
const assertions = (evidence.testResults || []).flatMap(row => row.assertionResults || []);
const scenarios = suite.scenarios.map(row => {
  const tests = assertions.filter(test => test.title.startsWith(row.id + ' '));
  return { id: row.id, category: row.category, name: row.name, relatedSourceNumber: row.source, status: tests.length === 1 ? tests[0].status : 'missing_or_duplicate', durationMs: tests[0]?.duration ?? null };
});
const files = ['contracts.ts','search.ts','search-criteria.ts','context.ts','policy.ts','outcome.ts','goal-coverage.ts','verified-outputs.ts','daily-brief-contract.ts','official-source-contract.ts','preferences.ts'];
const hash = crypto.createHash('sha256');
for (const file of files) hash.update(file).update(await fs.readFile('src/lib/ai-assistant/' + file));
const report = {
  verifiedAt: new Date().toISOString(), scope: suite.scope,
  suiteSha256: crypto.createHash('sha256').update(suiteText).digest('hex'), codeSha256: hash.digest('hex'),
  totalScenarios: scenarios.length, passedScenarios: scenarios.filter(row => row.status === 'passed').length,
  supportingTests: { total: evidence.numTotalTests ?? 0, passed: evidence.numPassedTests ?? 0, failed: evidence.numFailedTests ?? 0 },
  processExitCode: run.status, scenarios,
};
await fs.writeFile('docs/jarvis/evals/CONTINUATION_ACCEPTANCE.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.totalScenarios, passed: report.passedScenarios, supportingTests: report.supportingTests }));
process.exitCode = run.status === 0 && report.passedScenarios === report.totalScenarios ? 0 : 1;
