import { createHash } from 'node:crypto';
import type { AssistantContext } from './access';
import { normalized, type AssistantMessage } from './contracts';

export type PropertyPostMode = 'prepare' | 'commercial' | 'facts' | 'amenities';
export function propertyPostRequest(prompt: string): PropertyPostMode | null {
  const commands: Record<string, PropertyPostMode> = {
    'pregateste textul postarii pentru proprietate': 'prepare',
    'fa postarea mai orientata spre vanzare': 'commercial',
    'foloseste numai datele reale ale proprietatii': 'facts',
    'nu inventa facilitati in postare': 'amenities',
  };
  return commands[normalized(prompt).trim().replace(/[.!?]+$/, '')] || null;
}
function plain(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max) return null;
  const text = value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}
export function propertyPostDraft(row: Record<string, any>, style: 'neutral' | 'commercial') {
  const fields: string[] = [], omitted: string[] = [], lines: string[] = [];
  const status = normalized(String(row.status || ''));
  if (['vandut', 'inchiriat', 'inactiv'].includes(status)) return null;
  const type = normalized(String(row.transactionType || ''));
  const transaction = /^(vanzare|sale)$/.test(type) ? 'sale' : /^(inchiriere|rent|rental)$/.test(type) ? 'rent' : 'unknown';
  const title = plain(row.title, 250), location = plain(row.location, 250);
  if (title) { lines.push(title); fields.push('title'); } else omitted.push('title');
  if (transaction !== 'unknown') { lines.push(transaction === 'sale' ? 'De vânzare' : 'De închiriat'); fields.push('transactionType'); } else omitted.push('transactionType');
  if (status === 'rezervat') { lines.push('Status: rezervat'); fields.push('status'); }
  if (location) { lines.push('Localizare: ' + location); fields.push('location'); } else omitted.push('location');
  const details: string[] = [];
  for (const [field, label, integer] of [['rooms', 'camere', true], ['squareFootage', 'm² utili', false], ['bathrooms', 'băi', true]] as const) {
    const value = row[field];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0 && (!integer || Number.isInteger(value))) {
      details.push(new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(value) + ' ' + (value === 1 && field === 'rooms' ? 'cameră' : value === 1 && field === 'bathrooms' ? 'baie' : label)); fields.push(field);
    } else omitted.push(field);
  }
  if (details.length) lines.push(details.join(' · '));
  // CRM property prices use EUR. Advertising cost currency is unrelated.
  const currency = row.priceCurrency ?? row.currency ?? 'EUR';
  if (typeof row.price === 'number' && Number.isFinite(row.price) && row.price > 0 && ['EUR', 'RON', 'USD'].includes(currency)) {
    lines.push('Preț: ' + new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(row.price) + ' ' + currency);
    fields.push('price'); if (row.priceCurrency) fields.push('priceCurrency'); else if (row.currency) fields.push('currency');
  } else omitted.push('price');
  const seen = new Set<string>();
  const amenities = Array.isArray(row.amenities) ? row.amenities.flatMap((value: unknown) => {
    const text = plain(value, 120), key = text ? normalized(text) : '';
    if (!text || seen.has(key)) return []; seen.add(key); return [text];
  }) : [];
  if (amenities.length) { lines.push('Dotări: ' + amenities.slice(0, 12).join(', ')); fields.push('amenities'); }
  else omitted.push('amenities');
  if (!fields.some(field => ['title', 'location', 'rooms', 'squareFootage', 'price'].includes(field))) return null;
  if (style === 'commercial') lines.unshift(transaction === 'sale' ? 'Cauți o proprietate de cumpărat? Descoperă această ofertă.' : transaction === 'rent' ? 'Cauți o proprietate de închiriat? Descoperă această ofertă.' : 'Descoperă această proprietate.');
  lines.push(style === 'commercial' ? 'Scrie-ne pentru detalii și pentru a discuta o vizionare.' : 'Scrie-ne pentru mai multe detalii.');
  const text = lines.join('\n');
  return { text, style, transaction, omittedAmenityCount: Math.max(0, amenities.length - 12), usedFields: fields, omittedFields: omitted, revision: createHash('sha256').update(JSON.stringify({ text, fields })).digest('hex'), source: 'current_crm_fields', publicationConfirmed: false };
}
export function selectedPropertyPost(history: AssistantMessage[]) {
  const page = history.find(row => row.id === 'current-page-context');
  const last = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const drafts = last?.cards?.filter(card => card.source === 'facebookPostDraft').flatMap(card => card.rows) || [];
  const draft = drafts.length === 1 && typeof drafts[0].propertyId === 'string' ? drafts[0] : null;
  const previousStyle = draft?.style === 'commercial' ? 'commercial' as const : 'neutral' as const;
  const pageRows = page?.cards?.filter(card => card.source === 'properties').flatMap(card => card.rows) || [];
  if (pageRows.length) {
    const id = pageRows.length === 1 && typeof pageRows[0].id === 'string' ? pageRows[0].id : null;
    return { id, previousStyle: id && id === draft?.propertyId ? previousStyle : 'neutral' as const };
  }
  if (draft) return { id: draft.propertyId as string, previousStyle };
  const rows = page ? [] : last?.cards?.filter(card => card.source === 'properties').flatMap(card => card.rows) || [];
  return { id: rows.length === 1 && typeof rows[0].id === 'string' ? rows[0].id : null, previousStyle: 'neutral' as const };
}
export async function preparePropertyPost(ctx: AssistantContext, mode: PropertyPostMode, history: AssistantMessage[]) {
  const selected = selectedPropertyPost(history);
  if (!selected.id || !/^[A-Za-z0-9_.:-]{1,180}$/.test(selected.id) || selected.id === '..') return { rows: [], clarification: true, text: 'Selectează o singură proprietate din CRM pentru textul postării.' };
  return ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
    const snapshot = await tx.get(ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('properties').doc(selected.id!));
    const property = snapshot.data();
    if (!property || property.deletedAt || property.agencyId && property.agencyId !== ctx.agencyId) throw new Error('Proprietate inaccesibilă');
    if (['vandut', 'inchiriat', 'inactiv'].includes(normalized(String(property.status || '')))) return { rows: [], clarification: true, text: 'Proprietatea este marcată ' + property.status + ' în CRM. Nu am pregătit o ofertă activă; verifică starea înregistrării.' };
    const draft = propertyPostDraft(property, mode === 'commercial' ? 'commercial' : selected.previousStyle);
    if (!draft) return { rows: [], clarification: true, text: 'Proprietatea nu are date suficiente pentru o postare. Completează câmpurile publice în CRM.' };
    if (mode === 'commercial' && draft.transaction !== 'sale') return { rows: [], clarification: true, text: 'Proprietatea nu este înregistrată pentru vânzare. Nu am schimbat tipul tranzacției în postare; verifică înregistrarea din CRM.' };
    return { rows: [{ id: selected.id!, propertyId: selected.id!, ...draft }], clarification: false, text: 'Text pregătit din datele actuale ale proprietății:\n\n' + draft.text + '\n\nDraftul rămâne în conversație; nu am publicat și nu am modificat anunțul. Câmpurile lipsă sau invalide au fost omise.' };
  });
}
