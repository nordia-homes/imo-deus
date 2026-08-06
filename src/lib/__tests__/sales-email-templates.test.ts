import { describe, expect, it } from 'vitest';

import { DEFAULT_SALES_EMAIL_TEMPLATES } from '@/lib/sales';

const expectedPurposes = [
  'Documente necesare antecontract',
  'Documente necesare contract vânzare-cumpărare',
  'Documente lipsă antecontract',
  'Documente lipsă contract vânzare-cumpărare',
  'Confirmare programare antecontract',
  'Confirmare programare contract vânzare-cumpărare',
  'Mulțumire după finalizare',
];

describe('DEFAULT_SALES_EMAIL_TEMPLATES', () => {
  it.each([
    ['owner', 'Proprietar'],
    ['buyer', 'Cumpărător'],
  ] as const)('include toate cele șapte scopuri pentru %s', (role, label) => {
    const names = DEFAULT_SALES_EMAIL_TEMPLATES
      .filter((template) => template.recipientRole === role)
      .map((template) => template.name);

    expect(names).toEqual(expectedPurposes.map((purpose) => label + ' · ' + purpose));
  });

  it('folosește identificatori unici și template-uri active de sistem', () => {
    const ids = DEFAULT_SALES_EMAIL_TEMPLATES.map((template) => template.id);

    expect(new Set(ids).size).toBe(14);
    expect(DEFAULT_SALES_EMAIL_TEMPLATES).toHaveLength(14);
    expect(DEFAULT_SALES_EMAIL_TEMPLATES.every((template) => template.isSystem && template.isActive)).toBe(true);
  });
});
