import type { AssistantContext } from './access';
import { collectionFor } from './access';
import { normalized, type AssistantSearch } from './contracts';
import { resolveAgencyOwnerListingScope, getOwnerListingScope } from '@/lib/owner-listings/scope';
import { parseOptionalNumber } from '@/lib/owner-listings/utils';
import type { Agency } from '@/lib/types';
import { CommunicationError } from '@/lib/communications/server';
import { OWNER_SEARCH_VERSION, ownerPriceCurrency, parseOwnerPrice, ownerZoneKey } from '@/lib/owner-listings/search-index';
import { createHash } from 'node:crypto';

export function listingCurrency(price: unknown): 'EUR' | 'RON' | 'unknown' {
  return ownerPriceCurrency(price);
}
export function searchMatches(row: Record<string, any>, input: AssistantSearch) {
  const owners = input.source === 'owners';
  if (!owners && row.status !== 'Activ') return false;
  if (owners && (row.publicationStatus !== 'ready' || row.isCanonical !== true)) return false;
  const location = normalized(owners ? row.location : `${row.zone || ''} ${row.location || ''} ${row.address || ''}`);
  // A zone mentioned in marketing prose is not evidence of the property's location.
  if (input.zone && !(owners ? ownerZoneKey(row.location).includes(ownerZoneKey(input.zone)) : location.includes(normalized(input.zone)))) return false;
  const rooms = Number(owners ? row.roomsValue ?? parseOptionalNumber(row.rooms) : row.rooms);
  if (input.rooms !== undefined && rooms !== input.rooms) return false;
  const type = normalized(row.propertyType);
  const aliases: Record<string, string[]> = { apartment: ['apartment', 'apartament', 'garsoniera'], house: ['house', 'casa', 'vila'], land: ['land', 'teren'], commercial: ['commercial', 'comercial', 'birou'] };
  if (input.propertyType && !aliases[input.propertyType].some(v => type.includes(v))) return false;
  const transaction = normalized(row.transactionType);
  if (!(input.transactionType === 'sale' ? ['sale', 'vanzare'] : ['rent', 'inchiriere']).some(v => transaction.includes(v))) return false;
  const price = owners ? parseOwnerPrice(row.price) : Number(row.price);
  if ((input.priceMin !== undefined || input.priceMax !== undefined) && owners && listingCurrency(row.price) !== 'EUR') return false;
  if (input.priceMin !== undefined && (price === null || !Number.isFinite(price) || price < input.priceMin)) return false;
  if (input.priceMax !== undefined && (price === null || !Number.isFinite(price) || price > input.priceMax)) return false;
  return true;
}
export async function searchProperties(ctx: AssistantContext, input: AssistantSearch) {
  let base: FirebaseFirestore.Query = collectionFor(ctx, 'properties');
  if (input.source === 'owners') {
    const agency = await ctx.adminDb.collection('agencies').doc(ctx.agencyId).get();
    const scope = input.scopeKey ? getOwnerListingScope(input.scopeKey) : resolveAgencyOwnerListingScope(agency.data() as Agency);
    if (!scope) throw new CommunicationError('Precizează orașul/scopeKey; orașul agenției nu este configurat.');
    base = ctx.adminDb.collection('ownerListings').where('scopeKey', '==', scope.key).where('publicationStatus', '==', 'ready').where('isCanonical', '==', true);
  }
  const fingerprint = createHash('sha256').update(JSON.stringify([OWNER_SEARCH_VERSION, ctx.agencyId, Object.entries(input).filter(([key, value]) => key !== 'cursor' && value !== undefined).sort(([a], [b]) => a.localeCompare(b))])).digest('hex').slice(0, 12);
  let indexed = false, cursor = input.cursor, complete = false, scanned = 0, uncertainCurrency = 0;
  let cursorPrice: number | undefined;
  if (cursor?.startsWith('i|')) {
    const [, hash, price, id] = cursor.split('|');
    if (hash !== fingerprint || input.source !== 'owners' || !id || !Number.isFinite(Number(price))) throw new CommunicationError('Cursorul nu aparține acestei căutări.');
    indexed = true; cursorPrice = Number(price); cursor = id;
  } else if (cursor?.startsWith('s|')) {
    const [, hash, id] = cursor.split('|');
    if (hash !== fingerprint) throw new CommunicationError('Cursorul nu aparține acestei căutări.');
    cursor = id || undefined;
  } else if (cursor) throw new CommunicationError('Cursor de căutare invalid.');
  if (input.source === 'owners' && !input.cursor && (input.priceMin !== undefined || input.priceMax !== undefined)) {
    try {
      const [all, covered] = await Promise.all([base.count().get(), base.where('searchVersion', '==', OWNER_SEARCH_VERSION).count().get()]);
      indexed = all.data().count > 0 && all.data().count === covered.data().count;
    } catch (error) {
      if (Number((error as { code?: unknown }).code) !== 9) throw error;
      // Index not deployed/READY: use fresh paginated reads with full coverage.
    }
  }
  if (indexed) {
    base = base.where('searchVersion', '==', OWNER_SEARCH_VERSION).where('searchCurrency', '==', 'EUR').where('searchPrice', '>=', input.priceMin ?? 0);
    base = base.where('searchTransaction', '==', input.transactionType);
    if (input.zone) base = base.where('searchZones','array-contains',ownerZoneKey(input.zone));
    if (input.propertyType) base = base.where('searchType','==',input.propertyType);
    if (input.rooms !== undefined) base = base.where('searchRooms','==',input.rooms);
    if (input.priceMax !== undefined) base = base.where('searchPrice', '<=', input.priceMax);
    // Probe before returning any result, so a missing native index cannot become an empty page.
    try { await base.orderBy('searchPrice').orderBy('__name__').limit(1).get(); }
    catch (error) {
      if (Number((error as { code?: unknown }).code) !== 9 || input.cursor) throw error;
      return searchProperties(ctx, { ...input, cursor: `s|${fingerprint}|` });
    }
  }
  const rows: Record<string, unknown>[] = [];
  // Fresh Firestore reads across the corpus, never the current UI page or TTL cache.
  // Bounded work continues with a cursor instead of silently dropping later pages.
  while (rows.length < input.limit && scanned < 5000) {
    const batchSize = 250;
    let query = indexed ? base.orderBy('searchPrice').orderBy('__name__').limit(batchSize) : base.orderBy('__name__').limit(batchSize);
    if (cursor) query = indexed ? query.startAfter(cursorPrice, cursor) : query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) { complete = true; break; }
    for (const doc of snapshot.docs) {
      cursor = doc.id; scanned++;
      const row = doc.data();
      if (indexed) cursorPrice = Number(row.searchPrice);
      if (input.source === 'owners' && listingCurrency(row.price) === 'unknown') uncertainCurrency++;
      if (!searchMatches(row, input)) continue;
      rows.push({ id: doc.id, title: row.title || '', location: row.location || row.zone || '', price: row.price, rooms: row.roomsValue ?? row.rooms ?? null, squareFootage: row.squareFootage || row.areaValue || row.area || null, imageUrl: row.imageUrl || row.image || (Array.isArray(row.images) ? typeof row.images[0]==='string' ? row.images[0] : row.images[0]?.url : null) || null, status: row.status || null, source: input.source, link: input.source === 'owners' ? row.link || '' : `/properties/${doc.id}`, lastVerifiedAt: row.lastVerifiedAt || null });
      if (rows.length === input.limit) break;
    }
    if (snapshot.size < batchSize && cursor === snapshot.docs.at(-1)?.id) { complete = true; break; }
  }
  return { rows, nextCursor: complete || !cursor ? null : indexed ? `i|${fingerprint}|${cursorPrice}|${cursor}` : `s|${fingerprint}|${cursor}`, complete, scanned, uncertainCurrency, freshness: 'live_firestore', searchMode: indexed ? 'native_index' : 'live_scan', note: uncertainCurrency ? `${uncertainCurrency} anunțuri citite au moneda necunoscută; nu au fost tratate drept EUR.` : null };
}
