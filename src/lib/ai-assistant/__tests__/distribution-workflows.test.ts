import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { distributionWorkflowCatalog, distributionWorkflows } from '../distribution-workflows';
import { coreToolSchemas, actionToolSchemas } from '../tool-schemas';
import { visibleTools } from '../capability-catalog';
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource } from '../access';
import { propertyPublicLink } from '../property-public-link';
afterEach(() => vi.unstubAllEnvs());
describe('distribution workflow contracts', () => {
 it('references only registered services and exposes all requested channels without exact phrase matching', () => {
  const source=readFileSync(new URL('../operations.ts',import.meta.url),'utf8');
  const operations=[...source.matchAll(/^  ([a-z_]+): { method:/gm)].map(m=>m[1]);
  const known=new Set([...operations,...Object.keys(coreToolSchemas),...Object.keys(actionToolSchemas)]);
  for(const flow of distributionWorkflows) for(const tool of flow.tools) expect(known.has(tool),flow.id+': '+tool).toBe(true);
  expect(distributionWorkflowCatalog().workflows).toHaveLength(8);
  expect(distributionWorkflowCatalog(['facebook_page','tiktok_organic','connected_portals','matched_buyers_whatsapp']).workflows).toHaveLength(4);
  expect(() => distributionWorkflowCatalog(['invented'])).toThrow();
 });
 it('makes workflow discovery available to semantic domain selection with no lexical query', () => {
  for(const domain of ['marketing','matching','communications']) expect(visibleTools(Object.keys(coreToolSchemas),[domain],'')).toContain('workflow_catalog');
  expect(distributionWorkflowCatalog().workflows.every(row => !('steps' in row))).toBe(true);
 });
});
describe('public property link', () => {
 const ctx=(customDomain?: string,exists=true)=>({agencyId:'agency', adminDb:{collection:vi.fn(()=>({doc:vi.fn(()=>({get:async()=>({exists,data:()=>({customDomain})})}))}))}} as any);
 it('uses the agency public domain and exposes that availability is not certified', async()=>{
  vi.mocked(getResource).mockResolvedValue({status:'Activ',title:'Cișmigiu',agencyId:'agency'});
  expect(await propertyPublicLink(ctx('nordia.example'),'p')).toMatchObject({url:'https://nordia.example/properties/p',availabilityVerified:false,title:'Cișmigiu'});
 });
 it('uses the agency public route instead of the private CRM path without a custom domain',async()=>{
  vi.stubEnv('NEXT_PUBLIC_APP_URL','https://imodeus.ro');
  vi.mocked(getResource).mockResolvedValue({status:'Activ'});
  expect(await propertyPublicLink(ctx(),'p')).toMatchObject({url:'https://imodeus.ro/agencies/agency/properties/p'});
 });
 it.each([{status:'Vândut'},{status:'Activ',deletedAt:'now'},{status:'Activ',agencyId:'other'}])('does not distribute an unavailable or foreign property %j',async row=>{
  vi.mocked(getResource).mockResolvedValue(row);
  await expect(propertyPublicLink(ctx(),'p')).rejects.toThrow();
 });
 it('propagates resource authorization failures before reading agency configuration',async()=>{
  vi.mocked(getResource).mockRejectedValue(new Error('denied'));
  const context=ctx(); await expect(propertyPublicLink(context,'p')).rejects.toThrow('denied');
  expect(context.adminDb.collection).not.toHaveBeenCalled();
 });
 it('rejects missing agency configuration',async()=>{
  vi.mocked(getResource).mockResolvedValue({status:'Activ'});
  await expect(propertyPublicLink(ctx(undefined,false),'p')).rejects.toThrow();
 });
});
