import { PropertyLifecycleError } from '@/lib/property-removal/lifecycle';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { isDemoAgencyId, createDemoBlockedResponse } from '@/lib/demo/guards';
import { RomimoError } from '@/lib/romimo/client';
import { settingsSchema } from '@/lib/romimo/mapping';
import { checkOrUnpublish, connect, connectionStatus, disconnect, listManagedArticles, preview, publish } from '@/lib/romimo/service';
import { BodyLimitError, readBoundedText } from '@/lib/romimo/transport';

export const runtime = 'nodejs';
export const maxDuration = 180;
const propertyIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
type RouteContext = { params: Promise<{ action: string }> };

async function handle(request: NextRequest, context: RouteContext) {
  try {
    const { action } = await context.params;
    const valid = request.method === 'GET' ? ['status', 'listings'] : ['connect', 'disconnect', 'preview', 'publish', 'verify', 'unpublish'];
    if (!valid.includes(action)) return NextResponse.json({ message: 'Operațiune necunoscută.' }, { status: 404 });
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (!['admin', 'agent'].includes(auth.role || '')) throw new RomimoError('Acces nepermis.', 403);
    if (isDemoAgencyId(auth.agencyId)) return createDemoBlockedResponse('Integrarea Romimo nu poate accesa portalul din mediul demo.');
    const ctx = { db: auth.adminDb, agencyId: auth.agencyId, uid: auth.uid };
    let result: unknown;
    if (action === 'status') result = { ...await connectionStatus(ctx), role: auth.role };
    else if (action === 'listings') result = await listManagedArticles(ctx, propertyIdSchema.optional().parse(request.nextUrl.searchParams.get('cursor') || undefined));
    else {
      if (['connect', 'disconnect'].includes(action) && auth.role !== 'admin') throw new RomimoError('Doar administratorul poate conecta sau deconecta Romimo.', 403);
      const text = await readBoundedText(request.body, 100000);
      let body: unknown;
      try { body = text ? JSON.parse(text) : {}; } catch { throw new RomimoError('Cerere JSON invalidă.'); }
      if (action === 'connect') {
        const input = z.object({ apiKey: z.string().trim().min(1).max(4096), email: z.string().trim().email().max(254) }).strict().parse(body);
        result = await connect(ctx, input.apiKey, input.email);
      } else if (action === 'disconnect') result = await disconnect(ctx);
      else if (action === 'preview') {
        const input = z.object({ propertyId: propertyIdSchema, settings: settingsSchema.optional() }).strict().parse(body);
        result = await preview(ctx, input.propertyId, input.settings);
      } else if (action === 'publish') {
        const input = z.object({ propertyId: propertyIdSchema, settings: settingsSchema, previewHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(body);
        result = await publish(ctx, input.propertyId, input.settings, input.previewHash);
      } else {
        const input = z.object({ propertyId: propertyIdSchema }).strict().parse(body);
        result = await checkOrUnpublish(ctx, input.propertyId, action === 'unpublish');
      }
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof BodyLimitError) return NextResponse.json({ message: 'Cererea este prea mare.' }, { status: 413 });
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Date invalide. Verifică emailul, categoria și câmpurile formularului.' }, { status: 400 });
    if (error instanceof RomimoError || error instanceof PropertyLifecycleError) return NextResponse.json({ message: error.message }, { status: error.status });
    // Auth helpers carry numeric status; don't return arbitrary errors / secrets.
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' && [401, 403].includes(error.status) ? error.status : 500;
    return NextResponse.json({ message: status === 500 ? 'Operațiunea nu a putut fi finalizată. Verifică starea înainte de retrimitere.' : 'Sesiune invalidă sau acces nepermis.' }, { status });
  }
}
export const GET = handle;
export const POST = handle;
