import { expect, it } from 'vitest';
import { selectActionTools } from '../capability-discovery';
import { actionToolSchemas } from '../tool-schemas';
it.each(['Modifică taskul de mâine la ora 11.', 'Redeschide taskul acesta.', 'Marchează sarcinile ca finalizate.'])('keeps the task mutation discoverable for Romanian inflections: %s', prompt => {
  expect(selectActionTools(prompt, Object.keys(actionToolSchemas))).toContain('update_task');
});
