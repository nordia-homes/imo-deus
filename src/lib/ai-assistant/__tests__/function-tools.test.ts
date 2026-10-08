import { describe, expect, it } from 'vitest';
import { functionDefinition, functionPayload } from '../function-tools';
import { coreToolSchemas } from '../tool-schemas';
import { explicitInstants, validateActionDates } from '../temporal-policy';
describe('strict native Responses tool contracts', () => {
  it('advertises query and discovery limits before the model calls them', () => {
    expect((functionDefinition('query_records').parameters as any).properties.limit.anyOf[0]).toMatchObject({ minimum: 1, maximum: 30 });
    expect((functionDefinition('discover_tools').parameters as any).properties.limit.anyOf[0]).toMatchObject({ minimum: 1, maximum: 20 });
  });
  it('advertises sparse action payloads so changing status does not clear unrelated nullable fields', () => {
    const tool = functionDefinition('update_task');
    expect((tool.parameters as any).properties).toEqual({ payload: expect.objectContaining({ type: 'string' }) });
    expect(functionPayload('update_task', JSON.stringify({ payload: JSON.stringify({ taskId: 't', status: 'completed' }) }))).toEqual({ taskId: 't', status: 'completed' });
    expect(functionPayload('update_task', JSON.stringify({ payload: JSON.stringify({ taskId: 't', contactId: null }) }))).toEqual({ taskId: 't', contactId: null });
  });
  it('exposes matching recipient resolution natively and normalizes optional choices', () => {
    const tool = functionDefinition('resolve_matching_recipient');
    expect((tool.parameters as any).properties.position.type).toBe('integer');
    const input = functionPayload('resolve_matching_recipient', JSON.stringify({ resultSetId: 'set', position: 2, messageId: null, conversationId: null, channel: null }));
    expect(coreToolSchemas.resolve_matching_recipient[0].parse(input)).toEqual({ resultSetId: 'set', position: 2 });
  });
  it('preserves intentional nulls for unassignment and nested field clearing', () => {
    expect(functionPayload('assign_record', JSON.stringify({ resource: 'contacts', id: 'contact1', agentId: null }))).toHaveProperty('agentId', null);
    expect(functionPayload('update_property', JSON.stringify({ propertyId: 'property1', patch: { ownerId: null, notes: 'Actualizat' }, agentId: null }))).toMatchObject({ patch: { ownerId: null }, agentId: null });
    expect(functionPayload('propose_actions', JSON.stringify({ payload: JSON.stringify({ actions: [{ kind: 'update_property', propertyId: 'property1', patch: { ownerId: null }, agentId: null }] }) }))).toMatchObject({ actions: [{ patch: { ownerId: null }, agentId: null }] });
  });
  it('exposes explicit search filters and optional nullable fields without arbitrary properties', () => { const tool = functionDefinition('search_properties'); const schema = tool.parameters as any; expect(schema.additionalProperties).toBe(false); expect(schema.required).toContain('priceMax'); expect(schema.properties.priceMax.anyOf).toEqual([{ type: 'number', minimum: 0 }, { type: 'null' }]); expect(schema.properties.zone).toBeDefined(); expect(schema.properties).not.toHaveProperty('agencyId'); });
  it('normalizes native nullable fields and applies server defaults', () => { const payload = functionPayload('search_properties', JSON.stringify({ source: null, zone: 'Titan', priceMax: 130000, rooms: null })); expect(coreToolSchemas.search_properties[0].parse(payload)).toMatchObject({ source: 'owners', zone: 'Titan', priceMax: 130000, limit: 5 }); });
  it('preserves complex action validation behind the strict payload wrapper', () => { const tool = functionDefinition('propose_actions'); expect((tool.parameters as any).properties.payload.type).toBe('string'); expect(() => coreToolSchemas.propose_actions[0].parse(functionPayload('propose_actions', JSON.stringify({ payload: JSON.stringify({ actions: [{ kind: 'grant_whatsapp_consent' }] }) })))).toThrow(); });
  it('rejects arbitrary tool schemas and malformed argument bodies', () => { expect(() => functionDefinition('attacker')).toThrow(); expect(() => functionPayload('search_properties', 'null')).toThrow(); expect(() => functionPayload('propose_actions', '{}')).toThrow(); });
  it('requires deterministic provenance for dates, including nested automations', () => { const action = { kind: 'create_task' as const, dueDate: '2026-10-10T11:00:00.000Z', description: 'Follow up' }; expect(() => validateActionDates([action], explicitInstants('10 octombrie la 14:00'))).toThrow('resolve_datetime'); expect(() => validateActionDates([action], explicitInstants('2026-10-10T14:00:00+03:00'))).not.toThrow(); });
});
