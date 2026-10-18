import { it, expect } from 'vitest';
import fs from 'node:fs';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { selectCapabilities, expandCapabilities, visibleTools, capabilityIds } from '../capability-catalog';
import { coreToolSchemas, actionToolSchemas } from '../tool-schemas';
import { functionDefinition } from '../function-tools';
import { buildInstructions } from '../policy';
it('evaluates local selection and context size for all 1000 original corpus prompts without paid model calls', () => {
    const names = [...Object.keys(coreToolSchemas), ...Object.keys(actionToolSchemas)];
    const rows = corpus.scenarios.map(row => {
        const modules = selectCapabilities(row.text), visible = visibleTools(names, modules, row.text);
        const dynamic = { memory: [], readiness: {}, allowedTools: visible, modules };
        const instructions = buildInstructions({ uid: 'synthetic', role: 'admin' } as any, dynamic);
        const bytes = Buffer.byteLength(instructions + JSON.stringify(visible.map(functionDefinition)) + row.text);
        expect(modules.every(id => capabilityIds.includes(id))).toBe(true);
        expect(visible).toContain('load_capabilities');
        expect(visible).toContain('goal_coverage');
        return { id: row.id, category: row.category, modules, emptyInitialSelection: modules.length === 0, initialContextBytes: bytes, under50000ByteInputBound: bytes + 2200 < 50000, selectionSource: 'local_heuristic', liveJevEvaluated: false };
    });
    expect(rows).toHaveLength(1000);
    const report = { generatedAt: new Date().toISOString(), scope: 'All original prompts: local candidate selection and sizing only. No semantic accuracy labels, live Jev or E2E certification.', count: rows.length, withinInputBound: rows.filter(r => r.under50000ByteInputBound).length, emptyInitialSelection: rows.filter(r => r.emptyInitialSelection).length, maxInitialContextBytes: Math.max(...rows.map(r => r.initialContextBytes)), liveJevCalls: 0, externalCostUsd: 0, rows };
    fs.writeFileSync('docs/jarvis/evals/JEV_CORPUS_SELECTION.json', JSON.stringify(report, null, 2) + '\n');
    expect(report.withinInputBound).toBe(1000);
});
