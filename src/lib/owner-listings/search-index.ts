// Projection stored on the listing itself, in the SAME write as source changes.
// Firestore maintains its native indexes atomically. No second search database.
export const OWNER_SEARCH_VERSION = 2;
export function parseOwnerPrice(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (/\/\s*(?:mp|m2|m²)/i.test(text)) return null;
  const match = text.match(/-?\d[\d\s.,]*/);
  if (!match) return null;
  const raw = match[0].replace(/\s/g, '').replace(/[.,]+$/, '');
  const last = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  const decimals = last >= 0 ? raw.length - last - 1 : 0;
  const number = last >= 0 && decimals > 0 && decimals <= 2 ? raw.slice(0, last).replace(/[.,]/g, '') + '.' + raw.slice(last + 1) : raw.replace(/[.,]/g, '');
  const price = Number(number);
  return Number.isFinite(price) && price >= 0 ? price : null;
}
export function ownerPriceCurrency(value: unknown): 'EUR' | 'RON' | 'unknown' {
  const text = String(value || '').toUpperCase();
  if (/RON|LEI/.test(text)) return 'RON';
  if (/EUR|€|EURO/.test(text)) return 'EUR';
  return 'unknown';
}
export function ownerZoneKey(value: unknown) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
export function ownerSearchFields(row: { price?: unknown; priceValue?: unknown; location?: unknown; propertyType?: unknown; transactionType?: unknown; rooms?: unknown; roomsValue?: unknown }) {
  const words = ownerZoneKey(row.location).split(' ').filter(Boolean).slice(0,24), zones = new Set<string>();
  for (let start=0;start<words.length;start++) for(let length=1;length<=4&&start+length<=words.length;length++) zones.add(words.slice(start,start+length).join(' '));
  const rawType=ownerZoneKey(row.propertyType), rawTransaction=ownerZoneKey(row.transactionType), roomText=String(row.roomsValue??row.rooms??'');
  const searchType=/apart|garson/.test(rawType)?'apartment':/casa|house|vila/.test(rawType)?'house':/teren|land/.test(rawType)?'land':/comercial|commercial|birou|office/.test(rawType)?'commercial':'unknown';
  return { searchVersion: OWNER_SEARCH_VERSION, searchCurrency: ownerPriceCurrency(row.price), searchPrice: parseOwnerPrice(row.price), searchLocation: ownerZoneKey(row.location), searchZones: [...zones], searchType, searchTransaction: /sale|vanz|sell/.test(rawTransaction)?'sale':/rent|inchir/.test(rawTransaction)?'rent':'unknown', searchRooms: Number(roomText.match(/\d+/)?.[0]||0) };
}
