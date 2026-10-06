import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { publicAddress } from './mcp';
import { collectionFor, type AssistantContext } from './access';
import { normalized } from './contracts';
import { officialAuthorities, officialUrl } from './official-source-contract';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
export { officialAuthorities, officialUrl } from './official-source-contract';

export async function extractOfficialText(bytes: Buffer, contentType: string) {
  if (bytes.length > 1024 * 1024) throw new Error('Sursa depășește limita de citire.');
  if (/^application\/pdf(?:\s*;|$)/i.test(contentType)) {
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Conținutul nu este un PDF valid.');
    const { extractTextFromPdfBuffer } = await import('@/lib/pdf-text');
    const text = await extractTextFromPdfBuffer(bytes, { maxBytes: 1024 * 1024, maxPages: 100, maxChars: 200000, timeoutMs: 8000, pageMarkers: true });
    if (text.length < 100) throw new Error('PDF-ul nu conține suficient text selectabil. OCR-ul nu este disponibil în acest flux.');
    return text;
  }
  if (!/^text\/(html|plain)(?:\s*;|$)/i.test(contentType)) throw new Error('Format de sursă nesuportat.');
  const text = bytes.toString('utf8');
  return /^text\/plain/i.test(contentType) ? text.trim() : text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
export async function fetchOfficialText(value: string) {
  const url = officialUrl(value), addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(row => !publicAddress(row.address))) throw new Error('Adresa sursei nu este publică.');
  const pinned = addresses[0];
  const response = await new Promise<{ bytes: Buffer; contentType: string }>((resolve, reject) => {
    const req = request(url, { method: 'GET', headers: { accept: 'text/html,text/plain,application/pdf' }, lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family) }, res => {
      const contentType = String(res.headers['content-type'] || '');
      if (res.statusCode !== 200 || !/^(text\/(html|plain)|application\/pdf)(?:\s*;|$)/i.test(contentType)) { res.resume(); reject(new Error('Sursa nu este disponibilă într-un format verificabil; redirecturile necesită un URL oficial direct.')); return; }
      let size = 0; const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1024 * 1024) req.destroy(new Error('Sursa depășește limita de citire.')); else chunks.push(chunk); });
      res.on('end', () => resolve({ bytes: Buffer.concat(chunks), contentType }));
      res.on('error', reject);
    });
    const deadline = setTimeout(() => req.destroy(new Error('Sursa oficială nu a răspuns la timp.')), 8000);
    req.on('error', reject); req.on('close', () => clearTimeout(deadline)); req.end();
  });
  return extractOfficialText(response.bytes, response.contentType);
}
async function requireMember(ctx: AssistantContext) {
  const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
  if (member?.agencyId !== ctx.agencyId || member?.role !== ctx.role) throw new Error('Acces revocat.');
}
export async function readOfficialSource(ctx: AssistantContext, url: string, offset = 0, snapshotId?: string): Promise<Record<string, any>> {
  if (snapshotId) {
    if (!/^legal-[a-f0-9]{64}-[a-f0-9]{64}$/.test(snapshotId)) throw new Error('Versiune de sursă invalidă.');
    await requireMember(ctx);
    const snapshot = (await collectionFor(ctx, 'assistantArtifacts').doc(snapshotId).get()).data();
    if (!snapshot || snapshot.kind !== 'official_source' || snapshot.sourceUrl !== officialUrl(url).href) throw new Error('Versiunea sursei nu este disponibilă.');
    const { text, kind: _kind, ...evidence } = snapshot;
    const value = String(text).slice(offset, offset + 10000);
    await requireMember(ctx);
    return { ...evidence, snapshotId, value, offset, nextOffset: offset + value.length < text.length ? offset + value.length : null, total: text.length, complete: !snapshot.truncated && offset + value.length >= text.length, temporalValidityVerified: false, note: 'Versiune arhivată, nu verificare live a formei în vigoare. Continuările folosesc aceeași versiune.' };
  }
  if (offset) throw new Error('Pentru continuarea paginării folosește snapshotId din prima citire.');
  await requireMember(ctx);
  const parsed = officialUrl(url), text = await fetchOfficialText(parsed.href);
  if (text.length < 100) throw new Error('Sursa nu conține suficient text pentru analiză.');
  const contentHash = createHash('sha256').update(text).digest('hex'), retrievedAt = new Date().toISOString();
  const sourceId = createHash('sha256').update(parsed.href).digest('hex');
  const evidence = { sourceUrl: parsed.href, authority: officialAuthorities[parsed.hostname], jurisdiction: 'RO', contentHash, retrievedAt, versionDate: null, effectiveFrom: null, classification: 'OFFICIAL_SOURCE_UNCLASSIFIED', temporalValidityVerified: false };
  // Versioned bounded excerpts in the existing server-private artifact store.
  await requireMember(ctx);
  const id = `legal-${sourceId}-${contentHash}`, ref = collectionFor(ctx, 'assistantArtifacts').doc(id);
  await ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [existing, member] = await Promise.all([tx.get(ref), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new Error('Acces revocat.');
    if (!existing.exists) tx.create(ref, { ...evidence, kind: 'official_source', text: text.slice(0, 200000), truncated: text.length > 200000 });
  });
  return readOfficialSource(ctx, parsed.href, 0, id);
}

export async function searchOfficialSources(ctx: AssistantContext, query: string, cursor?: string) {
  await requireMember(ctx);
  const terms = normalized(query).split(/[^a-z0-9]+/).filter(term => term.length >= 3).slice(0, 12);
  if (!terms.length) throw new Error('Introdu cel puțin un termen cu trei litere.');
  let scan = collectionFor(ctx, 'assistantArtifacts').where('kind', '==', 'official_source').orderBy('__name__').limit(101);
  if (cursor) {
    if (!/^legal-[a-f0-9]{64}-[a-f0-9]{64}$/.test(cursor)) throw new Error('Cursor invalid.');
    scan = scan.startAfter(cursor);
  }
  const page = await scan.get();
  const rows = page.docs.slice(0, 100).flatMap(doc => {
    const row = doc.data(), text = String(row.text || ''), searchable = normalized(text);
    const matches = terms.filter(term => searchable.includes(term));
    if (!matches.length) return [];
    const start = Math.max(0, searchable.indexOf(matches[0]) - 150);
    return [{ snapshotId: doc.id, sourceUrl: row.sourceUrl, authority: row.authority, retrievedAt: row.retrievedAt, contentHash: row.contentHash, temporalValidityVerified: false, matchedTerms: matches.length, excerpt: text.slice(start, start + 900), offset: start, truncated: Boolean(row.truncated) }];
  }).sort((a, b) => b.matchedTerms - a.matchedTerms || a.snapshotId.localeCompare(b.snapshotId));
  await requireMember(ctx);
  return { rows, complete: page.size <= 100, nextCursor: page.size > 100 ? page.docs[99].id : null, searchedVersions: Math.min(page.size, 100), note: 'Căutare lexicală în versiuni oficiale arhivate ale agenției, nu căutare completă în legislație și nu dovadă a formei în vigoare. Verifică URL-ul live și data aplicabilă înaintea unei concluzii juridice.' };
}
