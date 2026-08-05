import type {
  Property,
  SaleParticipantRole,
  SaleStage,
  SaleTransaction,
  SalesEmailTemplate,
} from '@/lib/types';

export const SALE_STAGE_META: Record<
  SaleStage,
  { label: string; shortLabel: string; description: string; tone: 'info' | 'success' | 'warning' | 'danger' | 'muted' }
> = {
  preparing: {
    label: 'În pregătire',
    shortLabel: 'Pregătire',
    description: 'Oferta este acceptată și dosarul urmează să fie organizat.',
    tone: 'info',
  },
  documents: {
    label: 'Documente',
    shortLabel: 'Documente',
    description: 'Se solicită, primesc și verifică documentele părților.',
    tone: 'warning',
  },
  notary_scheduling: {
    label: 'Programare notar',
    shortLabel: 'Notar',
    description: 'Se confirmă notarul, data și disponibilitatea părților.',
    tone: 'info',
  },
  ready_to_sign: {
    label: 'Pregătită pentru semnare',
    shortLabel: 'Semnare',
    description: 'Dosarul este complet și programarea este confirmată.',
    tone: 'success',
  },
  completed: {
    label: 'Finalizată',
    shortLabel: 'Finalizată',
    description: 'Vânzarea a fost semnată și arhivată.',
    tone: 'success',
  },
  blocked: {
    label: 'Blocată',
    shortLabel: 'Blocată',
    description: 'Există o problemă care împiedică avansarea dosarului.',
    tone: 'danger',
  },
  cancelled: {
    label: 'Anulată',
    shortLabel: 'Anulată',
    description: 'Tranzacția nu mai continuă.',
    tone: 'muted',
  },
};

export const DEFAULT_SALES_EMAIL_TEMPLATES: SalesEmailTemplate[] = [
  {
    id: 'buyer-first-steps',
    name: 'Cumpărător · Primii pași',
    description: 'Confirmarea deciziei și pașii inițiali ai dosarului.',
    recipientRole: 'buyer',
    stage: 'preparing',
    subject: 'Pașii următori pentru {{property.address}}',
    body:
      'Bună ziua, {{recipient.name}},\n\nVă confirm că am început organizarea dosarului pentru proprietatea din {{property.address}}.\n\nÎn această etapă vom centraliza documentele, vom confirma forma de finanțare și vom stabili împreună programarea la notar. Vă voi ține la curent numai atunci când este necesară o acțiune din partea dumneavoastră.\n\nCu bine,\n{{agent.name}}',
    defaultQuestions: ['Confirmați că achiziția se realizează cash sau prin credit?'],
    isSystem: true,
    isActive: true,
  },
  {
    id: 'buyer-documents',
    name: 'Cumpărător · Documente necesare',
    description: 'Solicitare consolidată pentru documentele cumpărătorului.',
    recipientRole: 'buyer',
    stage: 'documents',
    subject: 'Documente necesare · {{property.address}}',
    body:
      'Bună ziua, {{recipient.name}},\n\nPentru pregătirea tranzacției privind proprietatea din {{property.address}}, avem nevoie de documentele menționate mai jos. Le puteți trimite direct ca răspuns la acest email.\n\n{{documents.list}}\n\nDacă un document nu este disponibil încă, este suficient să îmi spuneți când estimați că îl puteți trimite.\n\nMulțumesc,\n{{agent.name}}',
    isSystem: true,
    isActive: true,
  },
  {
    id: 'owner-documents',
    name: 'Proprietar · Documente necesare',
    description: 'Solicitare clară, într-un singur mesaj, pentru proprietar.',
    recipientRole: 'owner',
    stage: 'documents',
    subject: 'Pregătirea actelor pentru {{property.address}}',
    body:
      'Bună ziua, {{recipient.name}},\n\nAm început pregătirea dosarului pentru vânzarea proprietății din {{property.address}}. Pentru a putea avansa către notar, vă rog să ne transmiteți prin răspuns la acest email următoarele documente:\n\n{{documents.list}}\n\nVă voi confirma după verificare dacă dosarul este complet.\n\nCu bine,\n{{agent.name}}',
    isSystem: true,
    isActive: true,
  },
  {
    id: 'missing-documents',
    name: 'Documente lipsă',
    description: 'Reminder scurt care include numai elementele încă lipsă.',
    recipientRole: 'buyer',
    stage: 'documents',
    subject: 'Completare dosar · {{property.address}}',
    body:
      'Bună ziua, {{recipient.name}},\n\nVă mulțumesc pentru documentele transmise. Pentru a completa dosarul mai avem nevoie doar de:\n\n{{documents.list}}\n\nLe puteți atașa direct ca răspuns la acest mesaj.\n\nMulțumesc,\n{{agent.name}}',
    isSystem: true,
    isActive: true,
  },
  {
    id: 'notary-proposal',
    name: 'Propunere programare notar',
    description: 'Propune data și solicită o confirmare explicită.',
    recipientRole: 'buyer',
    stage: 'notary_scheduling',
    subject: 'Propunere programare notar · {{property.address}}',
    body:
      'Bună ziua, {{recipient.name}},\n\nPentru semnarea tranzacției privind proprietatea din {{property.address}}, propunerea de programare este:\n\n{{notary.summary}}\n\nVă rog să confirmați dacă data și ora sunt potrivite.\n\nCu bine,\n{{agent.name}}',
    defaultQuestions: ['Confirmați disponibilitatea pentru data și ora propuse?'],
    isSystem: true,
    isActive: true,
  },
  {
    id: 'notary-confirmation',
    name: 'Confirmare programare',
    description: 'Rezumatul final înaintea semnării.',
    recipientRole: 'buyer',
    stage: 'ready_to_sign',
    subject: 'Confirmare notar · {{property.address}}',
    body:
      'Bună ziua, {{recipient.name}},\n\nProgramarea pentru semnarea tranzacției este confirmată:\n\n{{notary.summary}}\n\nVă recomand să aveți asupra dumneavoastră actul de identitate în original. Dacă apare orice schimbare, vă rog să mă anunțați cât mai curând.\n\nCu bine,\n{{agent.name}}',
    isSystem: true,
    isActive: true,
  },
  {
    id: 'completion-thanks',
    name: 'Mulțumire după finalizare',
    description: 'Mesaj scurt, fără solicitări comerciale inutile.',
    recipientRole: 'buyer',
    stage: 'completed',
    subject: 'Tranzacție finalizată · {{property.address}}',
    body:
      'Bună ziua, {{recipient.name}},\n\nVă confirm că tranzacția pentru proprietatea din {{property.address}} a fost finalizată. Vă mulțumesc pentru colaborare și vă doresc să vă bucurați de noua proprietate.\n\nCu bine,\n{{agent.name}}',
    isSystem: true,
    isActive: true,
  },
];

export function saleTrackingCode(propertyId: string) {
  const compact = propertyId.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `IMD-V${compact.slice(-7).padStart(7, '0')}`;
}

export function isSoldProperty(property: Property) {
  const value = String(property.status || '').toLocaleLowerCase('ro');
  return value.includes('vândut') || value.includes('vandut');
}

export function isReservedProperty(property: Property) {
  const value = String(property.status || '').toLocaleLowerCase('ro');
  return value.includes('rezervat');
}

export function createSaleFromProperty(
  property: Property,
  agencyId: string,
  fallbackAgent: { id: string; name: string }
): Omit<SaleTransaction, 'id'> {
  const now = new Date().toISOString();
  const completed = isSoldProperty(property);
  return {
    agencyId,
    trackingCode: saleTrackingCode(property.id),
    propertyId: property.id,
    propertyTitle: property.title,
    propertyAddress: property.address || property.location || property.title,
    propertyImageUrl: property.images?.[0]?.url || null,
    agentId: property.agentId || fallbackAgent.id,
    agentName: property.agentName || property.agent?.name || fallbackAgent.name,
    collaboratorIds: [],
    stage: completed ? 'completed' : isReservedProperty(property) ? 'preparing' : 'preparing',
    agreedPrice: property.soldPrice || property.price || null,
    financingType: 'unknown',
    participants: property.ownerName
      ? [{
          id: `owner-${property.id}`,
          role: 'owner',
          name: property.ownerName,
          email: '',
          phone: property.ownerPhone || null,
          preferredChannel: 'email',
        }]
      : [],
    checklist: [],
    notary: null,
    nextAction: completed ? 'Dosar finalizat' : 'Completează participanții și documentele',
    nextActionAt: null,
    lastCommunicationAt: null,
    unreadReplyCount: 0,
    receivedDocumentCount: 0,
    requiredDocumentCount: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: completed ? now : null,
    cancelledAt: null,
    source: completed ? 'sold_property' : 'reserved_property',
    setupStatus: 'incomplete',
    setupCompletedAt: null,
    setupCompletedByUid: null,
    pendingReviewCount: 0,
    overdueActionCount: 0,
    reminderPolicy: { enabled: true, digestMode: 'daily', remindBeforeHours: 24 },
    retentionPolicy: { attachmentRetentionDays: 365, completedSaleRetentionDays: 1825 },
  };
}

export function participantRoleLabel(role: SaleParticipantRole) {
  if (role === 'buyer') return 'Cumpărător';
  if (role === 'owner') return 'Proprietar';
  if (role === 'notary') return 'Notar';
  return 'Colaborator';
}

export type SaleReadinessIssue = {
  id: string;
  label: string;
  section: 'participants' | 'transaction' | 'documents' | 'notary';
};

export function getSaleReadiness(sale: Pick<SaleTransaction, 'participants' | 'financingType' | 'agreedPrice' | 'checklist' | 'stage' | 'notary'>) {
  const issues: SaleReadinessIssue[] = [];
  const buyer = sale.participants?.find((participant) => participant.role === 'buyer');
  const owner = sale.participants?.find((participant) => participant.role === 'owner');
  if (!buyer?.name?.trim()) issues.push({ id: 'buyer-name', label: 'Numele cumpărătorului', section: 'participants' });
  if (!buyer?.email?.trim()) issues.push({ id: 'buyer-email', label: 'Emailul cumpărătorului', section: 'participants' });
  if (!owner?.name?.trim()) issues.push({ id: 'owner-name', label: 'Numele proprietarului', section: 'participants' });
  if (!owner?.email?.trim()) issues.push({ id: 'owner-email', label: 'Emailul proprietarului', section: 'participants' });
  if (!sale.agreedPrice || sale.agreedPrice <= 0) issues.push({ id: 'agreed-price', label: 'Prețul agreat', section: 'transaction' });
  if (!sale.financingType || sale.financingType === 'unknown') issues.push({ id: 'financing', label: 'Forma de finanțare', section: 'transaction' });
  if (!(sale.checklist || []).some((item) => item.required)) issues.push({ id: 'checklist', label: 'Lista documentelor necesare', section: 'documents' });
  if (['notary_scheduling', 'ready_to_sign'].includes(sale.stage) && !sale.notary?.name?.trim()) {
    issues.push({ id: 'notary-name', label: 'Notarul tranzacției', section: 'notary' });
  }
  return {
    ready: issues.length === 0,
    issues,
    progress: Math.max(0, Math.round(((7 - Math.min(7, issues.length)) / 7) * 100)),
  };
}

export const DEFAULT_SALE_DOCUMENTS: Array<{ label: string; role: 'buyer' | 'owner' }> = [
  { label: 'Act de identitate cumpărător', role: 'buyer' },
  { label: 'Dovada finanțării / preaprobare', role: 'buyer' },
  { label: 'Act de identitate proprietar', role: 'owner' },
  { label: 'Act de proprietate', role: 'owner' },
  { label: 'Extras de carte funciară', role: 'owner' },
  { label: 'Certificat fiscal', role: 'owner' },
  { label: 'Certificat energetic', role: 'owner' },
  { label: 'Cadastru / releveu', role: 'owner' },
];

function documentsForRole(sale: SaleTransaction, role: SaleParticipantRole) {
  return (sale.checklist || [])
    .filter((item) => item.participantRole === role && item.status !== 'verified')
    .map((item) => `• ${item.label}`)
    .join('\n');
}

export function renderSalesTemplate(
  template: SalesEmailTemplate,
  sale: SaleTransaction,
  recipient: { name: string; role: SaleParticipantRole },
  agent: { name: string }
) {
  const appointment = sale.notary?.appointmentAt
    ? new Intl.DateTimeFormat('ro-RO', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(sale.notary.appointmentAt))
    : 'Data urmează să fie confirmată';
  const notarySummary = [
    appointment,
    sale.notary?.name ? `Notar: ${sale.notary.name}` : null,
    sale.notary?.address ? `Adresă: ${sale.notary.address}` : null,
  ].filter(Boolean).join('\n');
  const values: Record<string, string> = {
    '{{recipient.name}}': recipient.name,
    '{{property.address}}': sale.propertyAddress,
    '{{property.title}}': sale.propertyTitle,
    '{{agent.name}}': agent.name,
    '{{documents.list}}': documentsForRole(sale, recipient.role) || '• Nu există documente selectate încă',
    '{{notary.summary}}': notarySummary,
  };
  const replace = (value: string) => Object.entries(values).reduce(
    (result, [placeholder, replacement]) => result.split(placeholder).join(replacement),
    value
  );
  return { subject: replace(template.subject), body: replace(template.body) };
}
