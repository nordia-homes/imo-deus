import { describe, expect, it } from 'vitest';

import {
  applySalesEmailTemplateOverrides,
  DEFAULT_CONTRACT_OWNER_DOCUMENTS,
  DEFAULT_PRECONTRACT_OWNER_DOCUMENTS,
  DEFAULT_SALES_EMAIL_TEMPLATES,
  filterEnabledSalesEmailTemplates,
  renderSalesTemplate,
  withDefaultSaleDocumentsForStage,
} from '@/lib/sales';
import type { SaleTransaction } from '@/lib/types';

const expectedPurposes = [
  'Documente necesare antecontract',
  'Documente necesare contract vânzare-cumpărare',
  'Documente lipsă antecontract',
  'Documente lipsă contract vânzare-cumpărare',
  'Confirmare programare antecontract',
  'Confirmare programare contract vânzare-cumpărare',
  'Mulțumire după finalizare',
];

const expectedPrecontractOwnerDocuments = [
  'Carte de identitate proprietar',
  'Carte de identitate soț/soție (dacă este cazul)',
  'Certificat de căsătorie (dacă este cazul)',
  'Act de proprietate / contract de vânzare-cumpărare',
  'RLV / releveu',
  'Extras de carte funciară pentru informare',
  'Certificat energetic',
  'Extras de cont bancar (prima pagină, cu titularul și IBAN-ul vizibile; cont RON și, dacă este cazul, EUR)',
];

const expectedContractOwnerDocuments = [
  'Carte de identitate proprietar',
  'Carte de identitate soț/soție (dacă este cazul)',
  'Certificat de căsătorie (dacă este cazul)',
  'Act de proprietate în original, cu istoricul complet',
  'Act de proprietate pentru parcare, boxă sau alte anexe, în original, cu istoricul complet (dacă este cazul)',
  'RLV / releveu',
  'Extras de carte funciară pentru informare (poate fi obținut de notar)',
  'Certificat energetic valabil',
  'Poliță de asigurare PAD valabilă',
  'Document de intabulare în numele proprietarului',
  'Certificat fiscal cu mențiunea „Vânzare imobil”, pentru fiecare proprietar',
  'Dovada achitării integrale a proprietății / OP-urile de plată (dacă este cazul)',
  'Adeverință de la asociația de proprietari, în original (dacă este cazul)',
  'Extras de cont pentru încasarea prețului (prima pagină, cu titularul și IBAN-ul vizibile; cont RON și, dacă este cazul, EUR)',
  'Ultima factură de energie electrică și dovada plății',
  'Ultima factură de gaze și dovada plății (dacă este cazul)',
];

function saleFixture(): SaleTransaction {
  return {
    id: 'sale-1',
    agencyId: 'agency-1',
    trackingCode: 'IMD-VABC123',
    propertyId: 'property-1',
    propertyTitle: 'Apartament',
    propertyAddress: 'Strada Exemplu 1',
    agentId: 'agent-1',
    agentName: 'Agent',
    stage: 'precontract',
    participants: [{ id: 'owner-1', role: 'owner', name: 'Proprietar', email: 'owner@example.com' }],
    checklist: [
      { id: 'precontract-doc', label: 'Document pentru antecontract', participantRole: 'owner', stage: 'precontract', status: 'required', required: true },
      { id: 'contract-doc', label: 'Document pentru contract', participantRole: 'owner', stage: 'contract', status: 'required', required: true },
    ],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}


describe('DEFAULT_PRECONTRACT_OWNER_DOCUMENTS', () => {
  it('folosește lista rezultată din solicitările reale către proprietari', () => {
    expect(DEFAULT_PRECONTRACT_OWNER_DOCUMENTS.map((item) => item.label)).toEqual(expectedPrecontractOwnerDocuments);
    expect(DEFAULT_PRECONTRACT_OWNER_DOCUMENTS.every((item) => item.role === 'owner' && item.stage === 'precontract')).toBe(true);
  });

  it('nu amestecă documentele de antecontract cu cele ale contractului final în email', () => {
    const template = DEFAULT_SALES_EMAIL_TEMPLATES.find((item) => item.id === 'owner-required-documents-precontract');
    expect(template).toBeDefined();

    const rendered = renderSalesTemplate(template!, saleFixture(), { name: 'Proprietar', role: 'owner' }, { name: 'Agent' });
    expect(rendered.body).toContain('Document pentru antecontract');
    expect(rendered.body).not.toContain('Document pentru contract');
  });
});

describe('DEFAULT_CONTRACT_OWNER_DOCUMENTS', () => {
  it('folosește lista comună din solicitările pentru contractul final', () => {
    expect(DEFAULT_CONTRACT_OWNER_DOCUMENTS.map((item) => item.label)).toEqual(expectedContractOwnerDocuments);
    expect(DEFAULT_CONTRACT_OWNER_DOCUMENTS.every((item) => item.role === 'owner' && item.stage === 'contract')).toBe(true);
  });

  it('se adaugă o singură dată când dosarul ajunge în Contract', () => {
    const existing = saleFixture().checklist!.filter((item) => item.stage === 'precontract');
    let sequence = 0;
    const initialized = withDefaultSaleDocumentsForStage(existing, DEFAULT_CONTRACT_OWNER_DOCUMENTS, () => `contract-${sequence++}`);
    const initializedAgain = withDefaultSaleDocumentsForStage(initialized, DEFAULT_CONTRACT_OWNER_DOCUMENTS, () => `duplicate-${sequence++}`);

    expect(initialized.filter((item) => item.stage === 'contract')).toHaveLength(expectedContractOwnerDocuments.length);
    expect(initializedAgain).toEqual(initialized);
  });

  it('afișează în email numai documentele contractului final', () => {
    const template = DEFAULT_SALES_EMAIL_TEMPLATES.find((item) => item.id === 'owner-required-documents-sale-contract');
    expect(template).toBeDefined();

    const rendered = renderSalesTemplate(template!, saleFixture(), { name: 'Proprietar', role: 'owner' }, { name: 'Agent' });
    expect(rendered.body).toContain('Document pentru contract');
    expect(rendered.body).not.toContain('Document pentru antecontract');
  });
});


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

  it('asociază documentele cu Antecontract sau Contract, nu cu o etapă separată', () => {
    const precontractTemplates = DEFAULT_SALES_EMAIL_TEMPLATES.filter((template) => template.id.includes('precontract'));
    const contractTemplates = DEFAULT_SALES_EMAIL_TEMPLATES.filter((template) => template.id.includes('sale-contract'));

    expect(precontractTemplates.length).toBeGreaterThan(0);
    expect(contractTemplates.length).toBeGreaterThan(0);
    expect(precontractTemplates.every((template) => template.stage === 'precontract')).toBe(true);
    expect(contractTemplates.every((template) => template.stage === 'contract')).toBe(true);
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
