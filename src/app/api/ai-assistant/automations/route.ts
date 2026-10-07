import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assistantContext, readResource, readRelated } from '@/lib/ai-assistant/access';
import { idSchema } from '@/lib/ai-assistant/contracts';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readBriefDelivery } from '@/lib/ai-assistant/brief-delivery';
export const runtime = 'nodejs';
// Human editor reads. Mutations continue through the existing saved-plan approval flow.
export async function GET(request: NextRequest) {
  try {
    const ctx = await assistantContext(request);
    const input = z.object({ id: idSchema.optional(), cursor: idSchema.optional(), collection: z.enum(['audit', 'events']).default('audit') }).strict().parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = input.id ? await readRelated(ctx, { resource: 'assistantAutomations', id: input.id, collection: input.collection, cursor: input.cursor, limit: 30 }) : await readResource(ctx, { resource: 'assistantAutomations', cursor: input.cursor, limit: 30 });
    result.rows = await Promise.all(result.rows.map(async value => {
      const row = value as Record<string, any>;
      const receiptId = input.id ? row.result?.receiptId : row.automation?.type === 'daily_sales_brief' ? row.lastResult?.receiptId : undefined;
      if (typeof receiptId !== 'string') return value;
      return { ...row, deliveryEvidence: await readBriefDelivery(ctx, receiptId) };
    }));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
