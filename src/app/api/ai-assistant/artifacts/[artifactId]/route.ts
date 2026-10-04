import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStorage } from 'firebase-admin/storage';
import { assistantContext, collectionFor, referencesAllowed } from '@/lib/ai-assistant/access';
import { CommunicationError } from '@/lib/communications/server';
import { assistantError } from '@/lib/ai-assistant/http-error';
export const runtime = 'nodejs';
export async function GET(request: Request, route: { params: Promise<{ artifactId: string }> }) {
  try {
    const ctx = await assistantContext(request);
    const id = z.string().uuid().parse((await route.params).artifactId);
    const doc = await collectionFor(ctx, 'assistantArtifacts').doc(id).get();
    const data = doc.data();
    if (!data || data.ownerId !== ctx.uid || !(await referencesAllowed(ctx, data.accessRefs))) throw new CommunicationError('Fișierul nu este accesibil.', 404);
    const prefix = `agencies/${ctx.agencyId}/privateCommunications/assistant-artifacts/${ctx.uid}/`;
    if (!String(data.storagePath).startsWith(prefix)) throw new CommunicationError('Fișier invalid.', 403);
    const [bytes] = await getStorage(ctx.adminAuth.app).bucket().file(data.storagePath).download();
    return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${String(data.fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'Cache-Control': 'private, no-store' } });
  } catch (error) { return assistantError(error); }
}
