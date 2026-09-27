import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { stableId, validSignature, secretMatches } from '@/lib/communications/crypto';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  if (p.get('hub.mode') !== 'subscribe' || !secretMatches(p.get('hub.verify_token') || '', process.env.META_WEBHOOK_VERIFY_TOKEN || '')) return new NextResponse('Forbidden', { status: 403 });
  return new NextResponse(p.get('hub.challenge') || '', { headers: { 'Content-Type': 'text/plain' } });
}
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 800000) return new NextResponse('Payload too large', { status: 413 });
  if (!validSignature(raw, request.headers.get('x-hub-signature-256') || '', process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '')) return new NextResponse('Forbidden', { status: 403 });
  try { JSON.parse(raw); } catch { return new NextResponse('Invalid JSON', { status: 400 }); }
  try {
    const ref = adminDb.collection('communicationWebhookEvents').doc(stableId(raw));
    await adminDb.runTransaction(async tx => { if (!(await tx.get(ref)).exists) tx.create(ref, { raw, status: 'queued', createdAt: new Date().toISOString(), expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000), attempts: 0 }); });
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ received: false }, { status: 503 }); }
}
