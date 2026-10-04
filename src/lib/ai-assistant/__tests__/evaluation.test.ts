import { describe, expect, it } from 'vitest';
import cases from '../evaluation-cases.json';
import { toolRegistry, requireTool, inputContract, discoverTools } from '../registry';
import { actionSchema } from '../contracts';
import { routeModel } from '../models';
describe('versioned task corpus and runtime contracts', () => {
  it('covers more than thirty ordinary, matching and hostile commands', () => { expect(cases.length).toBeGreaterThanOrEqual(30); expect(new Set(cases.map(row => row.id)).size).toBe(cases.length); });
  it.each(cases)('$id has a valid expected server contract and remains Luna first', scenario => {
    expect(routeModel({ estimatedTools: 3 }).model).toBe('gpt-6-luna');
    if (!scenario.tool) return;
    const expected = 'action' in scenario ? { actions: [scenario.action] } : scenario.subset;
    expect(() => requireTool(scenario.tool!, 'agent').inputSchema.parse(expected)).not.toThrow();
    expect(typeof requireTool(scenario.tool!, 'agent').handler).toBe('function');
  });
  it('exports one small action schema on demand with dates and mandatory IDs', () => {
    const schema = inputContract('propose_actions', 'schedule_viewing').inputSchema as any;
    expect(schema.properties.viewingDate.format).toBe('date-time'); expect(schema.required).toContain('contactId');
    expect(schema.properties.kind.const).toBe('schedule_viewing'); expect(schema.properties).not.toHaveProperty('whatsappToken');
    expect(() => inputContract('propose_actions', 'grant_whatsapp_consent')).toThrow();
  });
  it('does not expose consent grants, generic DB writes or arbitrary HTTP to the model', () => { for (const name of ['grant_whatsapp_consent', 'firestore_write', 'http_request']) expect(toolRegistry.has(name)).toBe(false); expect(actionSchema.options.some(schema => String(schema.shape.kind.value).includes('consent'))).toBe(false); });
  it('keeps admin-only operations out of agent discovery and enforces the registry permission', () => { expect(() => requireTool('meta_campaign_publish', 'agent')).toThrow(); expect(() => requireTool('meta_campaign_publish', 'admin')).not.toThrow(); expect(discoverTools('meta_', 0, 20, 'agent').tools.some(tool => tool.id === 'meta_campaign_publish')).toBe(false); expect(discoverTools('meta_', 0, 20, 'admin').tools.some(tool => tool.id === 'meta_campaign_publish')).toBe(true); });
});
