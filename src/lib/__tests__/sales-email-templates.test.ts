import { describe, expect, it } from 'vitest';

import { applySalesEmailTemplateOverrides, DEFAULT_SALES_EMAIL_TEMPLATES, filterEnabledSalesEmailTemplates } from '@/lib/sales';

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


describe('filterEnabledSalesEmailTemplates', () => {
  it('nu activează implicit niciun template', () => {
    expect(filterEnabledSalesEmailTemplates(DEFAULT_SALES_EMAIL_TEMPLATES)).toEqual([]);
    expect(filterEnabledSalesEmailTemplates(DEFAULT_SALES_EMAIL_TEMPLATES, [])).toEqual([]);
  });

  it('returnează exclusiv template-urile selectate explicit', () => {
    const selectedIds = [
      DEFAULT_SALES_EMAIL_TEMPLATES[1].id,
      DEFAULT_SALES_EMAIL_TEMPLATES[9].id,
    ];

    expect(filterEnabledSalesEmailTemplates(DEFAULT_SALES_EMAIL_TEMPLATES, selectedIds).map((template) => template.id))
      .toEqual(selectedIds);
  });

  it('exclude template-urile dezactivate la nivelul agenției', () => {
    const disabled = { ...DEFAULT_SALES_EMAIL_TEMPLATES[0], isActive: false };

    expect(filterEnabledSalesEmailTemplates([disabled], [disabled.id])).toEqual([]);
  });
});


describe('applySalesEmailTemplateOverrides', () => {
  const base = DEFAULT_SALES_EMAIL_TEMPLATES[0];
  const override = {
    id: base.id,
    baseTemplateId: base.id,
    baseVersion: base.version || 1,
    name: 'Varianta mea',
    description: 'Text adaptat de agent',
    recipientRole: base.recipientRole,
    stage: base.stage,
    subject: 'Subiect privat',
    body: 'Mesaj privat',
    bodyHtml: '<p>Mesaj privat</p>',
    defaultCc: ['notar@example.com'],
    defaultQuestions: ['Confirmați primirea?'],
    signatureMode: 'agent' as const,
    variables: base.variables,
    updatedAt: '2026-08-06T10:00:00.000Z',
    updatedByUid: 'agent-1',
  };

  it('înlocuiește conținutul fără să schimbe ID-ul sau numărul de template-uri', () => {
    const result = applySalesEmailTemplateOverrides([base], [override]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(base.id);
    expect(result[0].name).toBe('Varianta mea');
    expect(result[0].subject).toBe('Subiect privat');
    expect(result[0].isSystem).toBe(base.isSystem);
  });

  it('nu modifică template-ul de bază partajat', () => {
    applySalesEmailTemplateOverrides([base], [override]);

    expect(base.name).not.toBe('Varianta mea');
    expect(base.subject).not.toBe('Subiect privat');
  });

  it('păstrează selecția agentului deoarece ID-ul rămâne neschimbat', () => {
    const personalized = applySalesEmailTemplateOverrides([base], [override]);

    expect(filterEnabledSalesEmailTemplates(personalized, [base.id])).toEqual(personalized);
  });
});
