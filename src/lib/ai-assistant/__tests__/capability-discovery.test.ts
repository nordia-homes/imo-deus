import { expect, it } from 'vitest';
import { selectActionTools, capabilityScore } from '../capability-discovery';
import { actionToolSchemas } from '../tool-schemas';
it.each(['Modifică taskul de mâine la ora 11.', 'Redeschide taskul acesta.', 'Marchează sarcinile ca finalizate.'])('keeps the task mutation discoverable for Romanian inflections: %s', prompt => {
  expect(selectActionTools(prompt, Object.keys(actionToolSchemas))).toContain('update_task');
});

it.each(['Mută vizionarea lui Andrei la ora 18.', 'Mută vizionarea de mâine cu o oră mai târziu.', 'Anulează vizionarea de mâine cu Maria.'])('offers the actual viewing editor before unrelated tools: %s', prompt => {
  const selected = selectActionTools(prompt, Object.keys(actionToolSchemas));
  expect(selected).toContain('update_viewing');
  expect(selected.indexOf('update_viewing')).toBe(0);
});
it('does not confuse clock words with collaboration/prospecting substrings', () => {
  expect(capabilityScore('ora', 'update_prospect')).toBe(0);
  expect(capabilityScore('ora', 'import_owner_listing')).toBe(0);
});

import { discoverTools } from '../registry';
it('discovers specialized internal tools by domain instead of requiring their exact name',()=>{
 const page=discoverTools('calendar',0,20,'agent');
 expect(page.tools.some(tool=>tool.id==='calendar_availability')).toBe(true);
 expect(page.tools.some(tool=>tool.id==='viewing_confirmation_draft')).toBe(true);
});

import { toolRegistry, requireTool } from '../registry';
it('keeps the complete authorized catalog discoverable when wording has no lexical overlap',()=>{
 const first=discoverTools('xyzzunmatched',0,20,'agent');
 expect(first.matching).toBe('authorized_catalog_fallback');
 const ids:string[]=[];
 let cursor:number|null=0;
 while(cursor!==null){const page=discoverTools('xyzzunmatched',cursor,20,'agent');ids.push(...page.tools.map(tool=>tool.id));cursor=page.nextCursor;}
 const expected=[...toolRegistry.keys()].filter(id=>{try{requireTool(id,'agent');return true;}catch{return false;}});
 expect(ids.sort()).toEqual(expected.sort());expect(new Set(ids).size).toBe(ids.length);
 expect(ids).not.toContain('meta_campaign_publish');
});
it('uses actual registry descriptions and keeps category search explicitly lexical',()=>{
 const page=discoverTools('calendar',0,20,'agent');
 expect(page.matching).toBe('lexical_or_domain_ranking');
 for(const tool of page.tools)expect(tool.description).toBe(toolRegistry.get(tool.id)!.description);
});

import { visibleTools } from '../capability-catalog';
it('fits requested schemas without losing discovery or loading unrelated ranked tools',()=>{
 const names=['read','discover_tools','operation_contract','load_capabilities','goal_coverage','propose_actions','schedule_viewing','update_viewing','create_task'];
 const compact=visibleTools(names,['calendar'],'modifică vizionarea',['schedule_viewing'],0);
 expect(compact).toContain('schedule_viewing');expect(compact).toContain('discover_tools');expect(compact).toContain('propose_actions');
 expect(compact).not.toContain('update_viewing');expect(compact).not.toContain('create_task');
});
