import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const source = 'docs/jarvis/evals/master-scenarios.json';
const target = 'docs/jarvis/evals/MASTER_BATCHES.json';
const corpus = JSON.parse(fs.readFileSync(source, 'utf8'));
assert.equal(corpus.scenarios.length, 1000);
assert.equal(new Set(corpus.scenarios.map(row => row.id)).size, 1000);
const regressionIds = new Set(['master-0801', 'master-0806', 'master-0849', 'master-0850']);
const liveIds = new Map();
for (const file of ['docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_01.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_02.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_03.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_04.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_05.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_06.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_07.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_08.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_09.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_10.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_11.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_12.json', 'docs/jarvis/evals/CALENDAR_EXECUTION_BATCH_13.json']) {
  const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const row of [...evidence.finalRuns, ...(evidence.combinedRegression?.runs || [])]) {
    assert.equal(row.prompt, corpus.scenarios.find(scenario => scenario.id === row.scenarioId)?.text);
    if (row.executionVerified) liveIds.set(row.scenarioId, file);
  }
}
const batches = Array.from({ length: 20 }, (_, index) => {
  const scenarios = corpus.scenarios.slice(index * 50, (index + 1) * 50);
  scenarios.forEach((row, offset) => {
    assert.equal(row.sourceNumber, index * 50 + offset + 1);
    assert.equal(row.id, `master-${String(row.sourceNumber).padStart(4, '0')}`);
  });
  return {
    id: `batch-${String(index + 1).padStart(2, '0')}`,
    category: scenarios[0].category,
    status: [3, 16].includes(index) ? 'in_progress' : 'pending',
    scenarios: scenarios.map(row => ({
      id: row.id, sourceNumber: row.sourceNumber, request: row.text,
      requestSha256: crypto.createHash('sha256').update(row.text).digest('hex'),
      endToEnd: 'not_verified',
      ...(liveIds.has(row.id) ? { liveExecutionEvidence: { file: liveIds.get(row.id), scope: 'Original prompt, actual model and application handlers against local Firestore fixtures; scenario-specific outputs and database effects checked. Not production, voice or full variant certification.' } } : {}),
      ...(regressionIds.has(row.id) ? { deterministicCoverage: { file: 'src/lib/ai-assistant/__tests__/planner.test.ts', scope: 'Planner continuation / truthful incomplete result with a scripted provider. Does not certify execution, natural-language reliability or provider effects.' } } : {}),
    })),
  };
});
const result = {
  schemaVersion: 1,
  source, sourceSha256: corpus.sourceSha256,
  notice: 'Tracking inventory, not a passing evaluation report. A deterministic regression or a plan is not end-to-end success. Approval and clarification may be required by the scenario.',
  requiredEvidenceForEveryScenario: ['scenario_specific_fixture_and_assertions', 'required_conversation_context', 'natural_language_planning', 'authorized_execution_or_correct_read_result', 'final_business_evidence', 'no_forbidden_or_duplicate_effects', 'failure_and_resume_variants'],
  executionOrder: [17, 18, ...Array.from({ length: 16 }, (_, i) => i + 1), 19, 20].map(number => `batch-${String(number).padStart(2, '0')}`),
  total: 1000, verifiedEndToEnd: 0, batches,
};
const output = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n'), output, 'Corpus batch inventory is stale');
else fs.writeFileSync(target, output);
console.log(`20 batches / 1000 unique scenarios; 4 planner regression links; ${liveIds.size} local real-model execution links; 0 full end-to-end certifications in this inventory.`);
