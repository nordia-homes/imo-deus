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
