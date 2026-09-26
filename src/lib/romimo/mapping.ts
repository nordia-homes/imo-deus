import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import type { Property } from '@/lib/types';
import type { RomimoArticle, RomimoCatalog, RomimoSettings } from './types';

export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const previewHashFor = (property: Property, payload: RomimoArticle) => digest({ property, payload });
export const externalIdFor = (agencyId: string, propertyId: string) => `imo${digest([agencyId, propertyId]).slice(0, 27)}`;
export const settingsSchema = z.object({
  category: z.number().int().nonnegative(), currency: z.string().max(3),
  county: z.string().max(150), city: z.string().max(150), area: z.string().max(150),
  contactName: z.string().max(150), contactEmail: z.string().max(254), contactPhone: z.string().max(40),
  validFrom: z.string().max(40), validTo: z.string().max(40),
  fields: z.record(z.string().max(100), z.string().max(2000)).refine(v => Object.keys(v).length <= 100),
}).strict();

// Carry forward deliberate portal overrides, but refresh values that originally
// came from the CRM when the property/agent changes. Dates stay user-controlled.
export function refreshSavedSettings(current: RomimoSettings, saved?: RomimoSettings, baseline?: RomimoSettings): RomimoSettings {
  if (!saved) return current;
  if (!baseline) return saved;
  const result = { ...saved, fields: { ...saved.fields } };
  for (const key of ['category', 'currency', 'county', 'city', 'area', 'contactName', 'contactEmail', 'contactPhone'] as const) {
    if (saved[key] === baseline[key]) Object.assign(result, { [key]: current[key] });
  }
  for (const key of new Set([...Object.keys(current.fields), ...Object.keys(baseline.fields), ...Object.keys(saved.fields)])) {
    if (saved.fields[key] === baseline.fields[key]) {
      if (current.fields[key] === undefined) delete result.fields[key];
      else result.fields[key] = current.fields[key];
    }
  }
  return result;
}

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export function suggestCategory(property: Property, catalog: RomimoCatalog): number {
  const type = normalize(property.propertyType || '');
  const transaction = normalize(property.transactionType || '');
  const deal = transaction === 'vanzare' ? 'de vanzare' : transaction === 'inchiriere' ? 'de inchiriat' : '';
  let description = ({ casa: 'case vile', vila: 'case vile', garsoniera: 'garsoniera', birou: 'birou', 'spatiu comercial': 'spatiu comercial' } as Record<string, string>)[type];
  if (type === 'apartament' && Number.isInteger(property.rooms) && property.rooms >= 1 && property.rooms <= 6) {
    description = `apartamente ${property.rooms} ${property.rooms === 1 ? 'camera' : 'camere'}`;
  }
  return catalog.categories.find(c => normalize(c.dealType) === deal && normalize(c.description) === description)?.id || 0;
}

export function defaultSettings(property: Property, catalog: RomimoCatalog, contact: { name?: string; email?: string; phone?: string }, now = new Date()): RomimoSettings {
  const location = property.locationProfile?.primary;
  const floor = property.floor?.trim() || '';
  const candidates: Record<string, unknown> = {
    livingspace: property.squareFootage, usedspace: property.totalSurface,
    roomno: property.rooms >= 6 ? '6 camere sau mai multe' : `${property.rooms} ${property.rooms === 1 ? 'camera' : 'camere'}`,
    bathroomno: property.bathrooms, yearofbuilding: property.constructionYear,
    storey: /^\d+$/.test(floor) ? `Etaj ${floor}` : floor,
    resfeatures: property.partitioning, comfort: property.comfort,
    heating: property.heatingSystem, heatingsystem: property.heatingSystem,
    levelno: property.totalFloors, furniture: property.furnishing, innerstate: property.interiorState,
    kitchen: property.kitchen,
  };
  const fields: Record<string, string> = {};
  for (const field of catalog.properties) {
    const raw = candidates[field.key];
    if (raw === undefined || raw === null || raw === '') continue;
    const text = String(raw);
    const match = field.predefinedValues?.find(v => normalize(v) === normalize(text));
    if (field.predefinedValues?.length && !match) continue;
    fields[field.key] = match || text;
  }
  return {
    category: suggestCategory(property, catalog), currency: 'EUR',
    county: location?.county || '', city: location?.locality || property.city || '', area: location?.zone || property.zone || '',
    contactName: contact.name || '', contactEmail: contact.email || '', contactPhone: contact.phone || '',
    validFrom: now.toISOString().slice(0, 10),
    validTo: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10), fields,
  };
}

export function buildArticle(property: Property, settings: RomimoSettings, catalog: RomimoCatalog, accountEmail: string, externalId: string, now = new Date()) {
  const issues: string[] = [];
  const warnings: string[] = [];
  const title = property.title?.trim() || '';
  const text = property.description?.trim() || '';
  if (property.status && property.status !== 'Activ') issues.push('Proprietatea trebuie să fie activă pentru publicare.');
  if (title.length < 5 || title.length > 100) issues.push('Titlul trebuie să aibă între 5 și 100 de caractere.');
  if (text.length < 15 || text.length > 10000) issues.push('Descrierea trebuie să aibă între 15 și 10.000 de caractere.');
  if (!Number.isFinite(property.price) || property.price <= 0 || property.price > 1e9) issues.push('Prețul trebuie să fie mai mare decât zero și cel mult un miliard.');
  const category = catalog.categories.find(c => c.id === settings.category);
  if (!category) issues.push('Selectează categoria Romimo.');
  const transaction = normalize(property.transactionType || '');
  const expectedDeal = transaction === 'vanzare' ? 'de vanzare' : transaction === 'inchiriere' ? 'de inchiriat' : '';
  if (!expectedDeal || (category && normalize(category.dealType) !== expectedDeal)) issues.push('Categoria Romimo trebuie să corespundă tranzacției proprietății: vânzare sau închiriere.');
  if (!catalog.currencies.includes(settings.currency)) issues.push('Selectează o monedă acceptată de Romimo.');
  if (!settings.county.trim() || !settings.city.trim()) issues.push('Completează județul și localitatea Romimo (sectorul pentru București).');
  if (!settings.contactName.trim() || !settings.contactPhone.trim()) issues.push('Completează numele și telefonul agentului de contact.');
  if (!z.string().email().safeParse(settings.contactEmail).success) issues.push('Completează un email valid pentru agentul de contact.');
  if (!z.string().email().safeParse(accountEmail).success) issues.push('Conectează contul Romimo al agenției.');
  const start = calendarDate(settings.validFrom), end = calendarDate(settings.validTo);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end <= now.getTime()) issues.push('Perioada de valabilitate trebuie să aibă sfârșitul în viitor, după început.');
  const properties: RomimoArticle['properties'] = [];
  for (const field of catalog.properties.filter(f => f.categoryIds.includes(settings.category))) {
    const value = (settings.fields[field.key] || '').trim();
    if (!value) {
      if (field.isRequired) issues.push(`Completează: ${field.description}.`);
      continue;
    }
    const values = field.multipleValuesAllowed && field.multipleValuesSeparator ? value.split(field.multipleValuesSeparator).map(v => v.trim()) : [value];
    if (field.predefinedValues?.length && values.some(v => !field.predefinedValues!.includes(v))) issues.push(`Valoare neacceptată pentru ${field.description}.`);
    if (['Integer', 'Decimal'].includes(field.valueType) && (!/^\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || (field.valueType === 'Integer' && !Number.isInteger(Number(value))))) issues.push(`${field.description} trebuie să fie un număr pozitiv valid.`);
    if (field.valueType === 'Boolean' && !['true', 'false'].includes(value)) issues.push(`${field.description} trebuie să fie true sau false.`);
    if (['livingspace', 'propertyspace'].includes(field.key) && Number(value) <= 0) issues.push(`${field.description} trebuie să fie mai mare decât zero.`);
    properties.push({ key: field.key, value });
  }
  const images = Array.isArray(property.images) ? property.images : [];
  if (images.length > 20) warnings.push('Vor fi trimise primele 20 de fotografii, în ordinea din proprietate.');
  const pictures = images.slice(0, 20).map((photo, index) => ({ url: typeof photo?.url === 'string' ? photo.url : '', rank: index + 1 }));
  for (const picture of pictures) {
    try {
      const url = new URL(picture.url);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || isIP(url.hostname) || url.hostname.startsWith('[') || !url.hostname.includes('.') || /\.(localhost|local|internal)\.?$/i.test(url.hostname)) throw new Error();
    } catch { issues.push(`Fotografia ${picture.rank} trebuie să aibă un URL public HTTP(S).`); }
  }
  if (!pictures.length) warnings.push('Anunțul nu are fotografii.');
  const payload: RomimoArticle = {
    user: { email: accountEmail },
    ad: { active: true, promoted: false, externalid: externalId, category: settings.category, price: property.price, currency: settings.currency, title, text,
      validFrom: Number.isFinite(start) ? new Date(start).toISOString() : '', validTo: Number.isFinite(end) ? new Date(end).toISOString() : '' },
    contact: { contactName: settings.contactName.trim(), contactEmail: settings.contactEmail.trim(), contactPhone: settings.contactPhone.trim(), allowWhatsApp: false },
    location: { countyName: settings.county.trim(), cityName: settings.city.trim(), ...(settings.area.trim() ? { areaName: settings.area.trim() } : {}) },
    properties, pictures,
  };
  return { payload, issues, warnings };
}
