import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { stableId, validSignature, secretMatches } from './crypto';
import { whatsappAppId, whatsappAppSecret } from './whatsapp-config';
export async function verifyWebhook(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  if (p.get('hub.mode') !== 'subscribe' || !secretMatches(p.get('hub.verify_token') || '', process.env.META_WEBHOOK_VERIFY_TOKEN || '')) return new NextResponse('Forbidden', { status: 403 });
  return new NextResponse(p.get('hub.challenge') || '', { headers: { 'Content-Type': 'text/plain' } });
}
export async function receiveWebhook(request: NextRequest, whatsapp: boolean) {
  // Limit bytes while reading, before allocating an unbounded request body.
  const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  if (reader) while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 800000) { await reader.cancel(); return new NextResponse('Payload too large', { status: 413 }); } chunks.push(value); }
  const raw = Buffer.concat(chunks).toString('utf8');
  const secret = whatsapp ? whatsappAppSecret() : process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
  if (!validSignature(raw, request.headers.get('x-hub-signature-256') || '', secret)) return new NextResponse('Forbidden', { status: 403 });
  let payload;
  try { payload = JSON.parse(raw); } catch { return new NextResponse('Invalid JSON', { status: 400 }); }
  if (!payload || !Array.isArray(payload.entry) || (whatsapp ? payload.object !== 'whatsapp_business_account' : !['page', 'instagram'].includes(payload.object))) return new NextResponse('Invalid webhook object', { status: 400 });
  try {
    const sourceAppId = whatsapp ? whatsappAppId() : process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
    const ref = adminDb.collection('communicationWebhookEvents').doc(stableId(sourceAppId, raw));
    await adminDb.runTransaction(async tx => { if (!(await tx.get(ref)).exists) tx.create(ref, { raw, sourceAppId, channel: whatsapp ? 'whatsapp' : 'meta', status: 'queued', createdAt: new Date().toISOString(), expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000), attempts: 0 }); });
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ received: false }, { status: 503 }); }
}
