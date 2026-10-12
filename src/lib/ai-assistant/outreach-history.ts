import { z } from 'zod';
import { readResource, type AssistantContext } from './access';
import { idSchema } from './contracts';
import { zonedParts } from './zoned-time';

export const outreachHistorySchema = z.object({ mode: z.enum(['all', 'failed', 'latest_result']).default('all'), cursor: idSchema.optional() }).strict();

function details(row: Record<string, any>) {
  const timestamp = [row.startedAt, row.endedAt, row.createdAt].find(value => typeof value === 'string' && Number.isFinite(Date.parse(value)));
  const local = timestamp ? zonedParts(new Date(timestamp), 'Europe/Bucharest') : null;
  const scheduled = typeof row.scheduledAt === 'string' && Number.isFinite(Date.parse(row.scheduledAt)) ? zonedParts(new Date(row.scheduledAt), 'Europe/Bucharest') : null;
  return { id: row.id, ownerListingId: row.ownerListingId || null, title: row.ownerListingTitle || null, status: row.status || null,
    outcome: row.outcome || null, summary: row.summary || null, result: row.result || null, durationSeconds: row.durationSeconds ?? null,
    providerErrorCode: row.providerErrorCode || null, providerErrorMessage: row.providerErrorMessage || null,
    uncertain: row.providerErrorCode === 'vapi_create_unknown', timestamp: timestamp || null,
    callLocal: local ? `${local.date} ${local.time} (ora București)` : null, scheduledAt: row.scheduledAt || null,
    scheduledLocal: scheduled ? `${scheduled.date} ${scheduled.time} (ora București)` : null };
}

export async function readOutreachHistory(ctx: AssistantContext, input: z.infer<typeof outreachHistorySchema>) {
  if (input.mode !== 'latest_result') {
    const page = await readResource(ctx, { resource: 'aiOutreachCalls', limit: 30, ...(input.cursor ? { cursor: input.cursor } : {}) });
    return { ...page, rows: page.rows.filter(row => input.mode === 'all' || row.status === 'failed').map(details), scope: 'agency',
      note: 'Citește toate paginile nextCursor. failed este statusul salvat, nu include apelurile anulate sau programate. uncertain indică rezultat de lansare necunoscut; nu îl declara eșec cert și nu retrimite. scheduled/queued nu înseamnă apel efectuat. Afișează callLocal fără altă conversie; pentru ora programării folosește scheduledLocal.' };
  }
  if (input.cursor) throw new Error('Ultimul rezultat se calculează de la începutul istoricului, fără cursor.');
  let cursor: string | undefined, complete = false, scanned = 0, undated = 0, latest = -Infinity, matchingCount = 0;
  let rows: ReturnType<typeof details>[] = [];
  do {
    const page = await readResource(ctx, { resource: 'aiOutreachCalls', limit: 100, ...(cursor ? { cursor } : {}) });
    scanned += page.rows.length;
    for (const row of page.rows) {
      if (!['calling', 'completed', 'failed'].includes(String(row.status))) continue;
      const result = details(row), time = result.timestamp ? Date.parse(result.timestamp) : NaN;
      if (!Number.isFinite(time)) { undated++; continue; }
      if (time > latest) { latest = time; rows = [result]; matchingCount = 1; }
      else if (time === latest) { matchingCount++; if (rows.length < 30) rows.push(result); }
    }
    complete = page.complete; cursor = page.nextCursor || undefined;
  } while (!complete && cursor && scanned < 5000);
  return { rows, complete, scanned, undated, matchingCount, tiesTruncated: matchingCount > rows.length, latestVerified: complete && undated === 0, scope: 'agency', nextCursor: null,
    note: 'Ultimul apel încercat, după startedAt, altfel endedAt, altfel createdAt. Programările, cozile și anulările sunt excluse. calling nu are rezultat final; failed poate fi o încercare fără conversație. Dacă latestVerified=false, nu afirma că acesta este ultimul apel al agenției. Egalitățile de timp sunt returnate împreună; matchingCount numără potrivirile din scanare, tiesTruncated semnalează lista limitată la 30. Folosește callLocal; nu converti din nou.' };
}
