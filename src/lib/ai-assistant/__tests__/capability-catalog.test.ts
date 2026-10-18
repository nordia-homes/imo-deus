import { it, expect } from 'vitest';
import { selectCapabilities, visibleTools, capabilityIds, expandCapabilities } from '../capability-catalog';
import { coreToolSchemas, actionToolSchemas } from '../tool-schemas';
import { buildInstructions } from '../policy';
import { functionDefinition } from '../function-tools';
it('measures compact CRM contexts', () => { for (const prompt of ['Salut', 'Programează o vizionare pentru apartamentul X cu Matei Alin mâine la 07:30', 'Citește clienți și sarcini.']) {
    const modules = selectCapabilities(prompt), names = visibleTools([...Object.keys(coreToolSchemas), ...Object.keys(actionToolSchemas)], modules);
    const instructions = buildInstructions({ uid: 'u', role: 'agent' } as any, { memory: [], readiness: {}, allowedTools: names, modules });
    console.log(JSON.stringify({ prompt, modules, names: names.length, policy: Buffer.byteLength(instructions), tools: Buffer.byteLength(JSON.stringify(names.map(functionDefinition))) }));
    expect(modules.every(x => capabilityIds.includes(x))).toBe(true);
} });
it('expands calendar prerequisites and rejects invented capabilities', () => { expect(expandCapabilities(['calendar'])).toEqual(['properties', 'contacts', 'calendar']); expect(() => expandCapabilities(['invented'])).toThrow(); });
