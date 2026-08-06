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
    id: "owner-required-documents-precontract",
    name: "Proprietar · Documente necesare antecontract",
    description: "Solicită într-un singur mesaj actele necesare pregătirii antecontractului.",
    recipientRole: "owner",
    stage: "documents",
    subject: "Documente necesare pentru antecontract · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nPentru pregătirea antecontractului aferent proprietății din {{property.address}}, vă rog să ne transmiteți, prin răspuns la acest email, documentele de mai jos:\n\n{{documents.list}}\n\nDacă unul dintre documente nu este disponibil momentan, vă rog să îmi spuneți când estimați că îl puteți trimite. După verificare, vă confirm imediat dacă dosarul este complet.\n\nCu bine,\n{{agent.name}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "owner-required-documents-sale-contract",
    name: "Proprietar · Documente necesare contract vânzare-cumpărare",
    description: "Centralizează actele necesare semnării contractului final de vânzare-cumpărare.",
    recipientRole: "owner",
    stage: "documents",
    subject: "Documente pentru contractul de vânzare-cumpărare · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nPentru pregătirea contractului de vânzare-cumpărare privind proprietatea din {{property.address}}, avem nevoie de următoarele documente:\n\n{{documents.list}}\n\nLe puteți atașa direct ca răspuns la acest email. Vă voi confirma după verificare dacă dosarul este complet sau dacă notarul solicită informații suplimentare.\n\nCu bine,\n{{agent.name}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "owner-missing-documents-precontract",
    name: "Proprietar · Documente lipsă antecontract",
    description: "Reminder politicos care afișează numai documentele încă lipsă pentru antecontract.",
    recipientRole: "owner",
    stage: "documents",
    subject: "Completare documente antecontract · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nVă mulțumesc pentru documentele transmise. Pentru a putea finaliza pregătirea antecontractului pentru {{property.address}}, mai avem nevoie doar de:\n\n{{documents.list}}\n\nLe puteți trimite direct prin răspuns la acest mesaj. Dacă aveți nevoie de ajutor pentru obținerea unui document, vă rog să îmi spuneți.\n\nMulțumesc,\n{{agent.name}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "owner-missing-documents-sale-contract",
    name: "Proprietar · Documente lipsă contract vânzare-cumpărare",
    description: "Solicită punctual elementele rămase pentru contractul final.",
    recipientRole: "owner",
    stage: "documents",
    subject: "Completare dosar contract vânzare-cumpărare · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nDosarul pentru contractul de vânzare-cumpărare al proprietății din {{property.address}} este aproape complet. Mai avem nevoie de următoarele documente:\n\n{{documents.list}}\n\nVă rog să le transmiteți prin răspuns la acest email. Vă confirm imediat ce dosarul poate fi trimis notarului în forma completă.\n\nMulțumesc,\n{{agent.name}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "owner-precontract-appointment-confirmation",
    name: "Proprietar · Confirmare programare antecontract",
    description: "Confirmă clar data, ora și locul semnării antecontractului.",
    recipientRole: "owner",
    stage: "notary_scheduling",
    subject: "Confirmare programare antecontract · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nVă confirm programarea pentru semnarea antecontractului aferent proprietății din {{property.address}}:\n\n{{notary.summary}}\n\nVă rog să aveți asupra dumneavoastră actul de identitate în original și să îmi confirmați prin răspuns că detaliile programării sunt în regulă.\n\nCu bine,\n{{agent.name}}",
    defaultQuestions: ["Confirmați disponibilitatea pentru data, ora și locul programării?"],
    isSystem: true,
    isActive: true,
  },
  {
    id: "owner-sale-contract-appointment-confirmation",
    name: "Proprietar · Confirmare programare contract vânzare-cumpărare",
    description: "Rezumatul final al programării pentru semnarea contractului de vânzare-cumpărare.",
    recipientRole: "owner",
    stage: "ready_to_sign",
    subject: "Confirmare semnare contract vânzare-cumpărare · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nVă confirm programarea pentru semnarea contractului de vânzare-cumpărare privind proprietatea din {{property.address}}:\n\n{{notary.summary}}\n\nVă rog să aveți actul de identitate în original și să îmi comunicați cât mai curând dacă intervine orice schimbare.\n\nCu bine,\n{{agent.name}}",
    defaultQuestions: ["Confirmați participarea la programarea pentru semnarea contractului?"],
    isSystem: true,
    isActive: true,
  },
  {
    id: "owner-completion-thanks",
    name: "Proprietar · Mulțumire după finalizare",
    description: "Încheie tranzacția elegant, cu un mesaj personal și fără solicitări comerciale insistente.",
    recipientRole: "owner",
    stage: "completed",
    subject: "Vă mulțumesc pentru colaborare · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nVă confirm că tranzacția pentru proprietatea din {{property.address}} a fost finalizată. Vă mulțumesc pentru încredere, pentru colaborare și pentru disponibilitatea din fiecare etapă a procesului.\n\nDacă aveți nevoie ulterior de informații legate de dosar, îmi puteți scrie oricând.\n\nCu apreciere,\n{{agent.name}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "buyer-required-documents-precontract",
    name: "Cumpărător · Documente necesare antecontract",
    description: "Explică simplu ce trebuie transmis pentru pregătirea antecontractului.",
    recipientRole: "buyer",
    stage: "documents",
    subject: "Documente necesare pentru antecontract · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nPentru pregătirea antecontractului aferent proprietății din {{property.address}}, vă rog să ne transmiteți, prin răspuns la acest email, documentele de mai jos:\n\n{{documents.list}}\n\nDacă achiziția se realizează prin credit, puteți include și documentele disponibile din partea băncii. Dacă un act nu este încă disponibil, este suficient să îmi comunicați termenul estimat.\n\nCu bine,\n{{agent.name}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "buyer-required-documents-sale-contract",
    name: "Cumpărător · Documente necesare contract vânzare-cumpărare",
    description: "Centralizează actele și informațiile cumpărătorului pentru contractul final.",
    recipientRole: "buyer",
    stage: "documents",
    subject: "Documente pentru contractul de vânzare-cumpărare · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nPentru redactarea contractului de vânzare-cumpărare privind proprietatea din {{property.address}}, avem nevoie de următoarele documente și informații:\n\n{{documents.list}}\n\nLe puteți atașa direct ca răspuns la acest email. După verificare, vă voi confirma dacă dosarul este complet pentru notar.\n\nCu bine,\n{{agent.name}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "buyer-missing-documents-precontract",
    name: "Cumpărător · Documente lipsă antecontract",
    description: "Reminder calm și clar pentru actele încă necesare antecontractului.",
    recipientRole: "buyer",
    stage: "documents",
    subject: "Completare documente antecontract · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nVă mulțumesc pentru documentele transmise. Pentru a finaliza pregătirea antecontractului pentru proprietatea din {{property.address}}, mai avem nevoie doar de:\n\n{{documents.list}}\n\nLe puteți trimite prin răspuns la acest mesaj. Dacă unul dintre documente depinde de bancă sau de o altă instituție, vă rog să îmi comunicați stadiul.\n\nMulțumesc,\n{{agent.name}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "buyer-missing-documents-sale-contract",
    name: "Cumpărător · Documente lipsă contract vânzare-cumpărare",
    description: "Solicită numai elementele rămase înaintea contractului final.",
    recipientRole: "buyer",
    stage: "documents",
    subject: "Completare dosar contract vânzare-cumpărare · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nDosarul pentru contractul de vânzare-cumpărare al proprietății din {{property.address}} este aproape complet. Mai avem nevoie de:\n\n{{documents.list}}\n\nVă rog să transmiteți documentele prin răspuns la acest email. Dacă achiziția este finanțată prin credit, ne puteți comunica și stadiul aprobării finale.\n\nMulțumesc,\n{{agent.name}}",
    isSystem: true,
    isActive: true,
  },
  {
    id: "buyer-precontract-appointment-confirmation",
    name: "Cumpărător · Confirmare programare antecontract",
    description: "Confirmă programarea și indică simplu ce trebuie pregătit pentru antecontract.",
    recipientRole: "buyer",
    stage: "notary_scheduling",
    subject: "Confirmare programare antecontract · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nVă confirm programarea pentru semnarea antecontractului aferent proprietății din {{property.address}}:\n\n{{notary.summary}}\n\nVă rog să aveți actul de identitate în original și să îmi confirmați prin răspuns că detaliile programării sunt potrivite. Dacă achiziția implică finanțare bancară, vă recomand să aveți la îndemână și datele consilierului bancar.\n\nCu bine,\n{{agent.name}}",
    defaultQuestions: ["Confirmați disponibilitatea pentru data, ora și locul programării?"],
    isSystem: true,
    isActive: true,
  },
  {
    id: "buyer-sale-contract-appointment-confirmation",
    name: "Cumpărător · Confirmare programare contract vânzare-cumpărare",
    description: "Rezumatul final pentru semnarea contractului de vânzare-cumpărare.",
    recipientRole: "buyer",
    stage: "ready_to_sign",
    subject: "Confirmare semnare contract vânzare-cumpărare · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nVă confirm programarea pentru semnarea contractului de vânzare-cumpărare privind proprietatea din {{property.address}}:\n\n{{notary.summary}}\n\nVă rog să aveți actul de identitate în original și să verificați din timp îndeplinirea eventualelor formalități bancare. Dacă intervine orice schimbare, vă rog să mă anunțați cât mai curând.\n\nCu bine,\n{{agent.name}}",
    defaultQuestions: ["Confirmați participarea la programarea pentru semnarea contractului?"],
    isSystem: true,
    isActive: true,
  },
  {
    id: "buyer-completion-thanks",
    name: "Cumpărător · Mulțumire după finalizare",
    description: "Un mesaj cald de încheiere, fără presiune comercială sau solicitări inutile.",
    recipientRole: "buyer",
    stage: "completed",
    subject: "Felicitări pentru noua proprietate · {{property.address}}",
    body: "Bună ziua, {{recipient.name}},\n\nVă confirm că tranzacția pentru proprietatea din {{property.address}} a fost finalizată. Vă mulțumesc pentru încredere și colaborare și vă doresc să vă bucurați din plin de noua proprietate.\n\nDacă aveți nevoie ulterior de informații legate de dosar, îmi puteți scrie oricând.\n\nCu apreciere,\n{{agent.name}}",
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
  const bodyHtml = template.bodyHtml ? Object.entries(values).reduce((result, [placeholder, replacement]) => result.split(placeholder).join(replacement.replace(/\\n/g, '<br>')), template.bodyHtml) : null;
  return { subject: replace(template.subject), body: replace(template.body), bodyHtml };
}
