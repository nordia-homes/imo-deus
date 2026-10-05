import { NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { safeData } from '@/lib/ai-assistant/contracts';
import { z } from 'zod';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const ctx = await assistantContext(request), url = new URL(request.url);
    const cursor = z.string().min(1).max(180).regex(/^[^/]+$/).optional().parse(url.searchParams.get('cursor') || undefined);
    const ref = ctx.adminDb.collection('users').doc(ctx.uid);
    let query = ref.collection('emailTemplateOverrides').orderBy('__name__').limit(51);
    if (cursor) query = query.startAfter(cursor);
    const [user, snapshot] = await Promise.all([ref.get(), query.get()]);
    return NextResponse.json({ enabledTemplateIds: user.data()?.enabledSalesEmailTemplateIds || [], overrides: snapshot.docs.slice(0, 50).map(doc => safeData({ ...doc.data(), id: doc.id })), nextCursor: snapshot.size > 50 ? snapshot.docs[49].id : null, complete: snapshot.size <= 50, scope: 'own_agent', verifiedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
