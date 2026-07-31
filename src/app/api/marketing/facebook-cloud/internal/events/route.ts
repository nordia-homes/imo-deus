import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';

export const runtime = 'nodejs';

function tokenMatches(header: string | null) {
  const actual = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const expected = String(process.env.FACEBOOK_CLOUD_RUNNER_CALLBACK_TOKEN || '');
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return Boolean(expected && a.length === b.length && crypto.timingSafeEqual(a, b));
}

export async function POST(request: NextRequest) {
  if (!tokenMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }
  const event = await request.json().catch(() => ({})) as Record<string, any>;
  if (event.type === 'connection.updated') {
    const agencyId = String(event.agencyId || '');
    const connectionId = String(event.connectionId || '');
    if (!agencyId || !connectionId) return NextResponse.json({ message: 'Invalid event.' }, { status: 400 });
    await adminDb.collection('agencies').doc(agencyId).collection('facebookCloudConnections').doc(connectionId).set({
      status: event.status || 'connecting',
      facebookUserId: event.facebookUserId || null,
      displayName: event.displayName || null,
      currentUrl: event.currentUrl || null,
      lastError: event.lastError || null,
      lastVerifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  }
  if (event.type === 'job.updated' && event.job) {
    const job = event.job as Record<string, unknown>;
    const agencyId = String(job.agencyId || '');
    const jobId = String(job.id || '');
    if (!agencyId || !jobId) return NextResponse.json({ message: 'Invalid event.' }, { status: 400 });
    const { id: _id, agencyId: _agencyId, ...updates } = job;
    await adminDb.collection('agencies').doc(agencyId).collection('facebookCloudPublishingJobs').doc(jobId).set({
      ...updates,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    if (job.status === 'needs_reauthentication' && job.connectionId) {
      await adminDb.collection('agencies').doc(agencyId)
        .collection('facebookCloudConnections')
        .doc(String(job.connectionId))
        .set({
          status: 'needs_reauthentication',
          lastError: String(job.errorMessage || 'Sesiunea Facebook trebuie reconectată.'),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ message: 'Unsupported event.' }, { status: 400 });
}
