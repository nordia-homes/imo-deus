import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

const registrationSchema = z.object({
  installationId: z.string().trim().min(8).max(160),
  target: z.string().trim().min(20).max(4096),
  origin: z.string().url().max(500),
  platform: z.literal('web'),
  deviceLabel: z.string().trim().max(160).optional(),
});

const deleteSchema = z.object({
  registrationId: z.string().trim().min(8).max(80),
});

function registrationId(uid: string, installationId: string, origin: string) {
  return `reg_${crypto.createHash('sha256').update(`${uid}\u001f${installationId}\u001f${origin}`).digest('base64url').slice(0, 44)}`;
}

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ message: 'Datele dispozitivului sunt invalide.' }, { status: 400 });
  }
  const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
    ? error.status
    : 500;
  return NextResponse.json(
    { message: error instanceof Error ? error.message : 'Nu am putut actualiza dispozitivul.' },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (context.runtimeMode === 'demo' || context.agencyId.startsWith('demo-')) {
      return NextResponse.json({ message: 'Notificarile push sunt dezactivate in modul demo.' }, { status: 403 });
    }
    const input = registrationSchema.parse(await request.json());
    const id = registrationId(context.uid, input.installationId, input.origin);
    const ref = context.adminDb.collection('users').doc(context.uid).collection('messagingRegistrations').doc(id);
    const existing = await ref.get();
    await ref.set({
      installationId: input.installationId,
      target: input.target,
      targetKind: 'token',
      platform: input.platform,
      origin: input.origin,
      deviceLabel: input.deviceLabel || null,
      enabled: true,
      agencyId: context.agencyId,
      createdAt: existing.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
      lastError: null,
    }, { merge: true });
    await context.adminDb.collection('users').doc(context.uid).set({
      pushTokens: FieldValue.arrayRemove(input.target),
    }, { merge: true });
    const duplicates = await context.adminDb.collection('users').doc(context.uid)
      .collection('messagingRegistrations').where('target', '==', input.target).get();
    const cleanup = context.adminDb.batch();
    for (const duplicate of duplicates.docs) {
      if (duplicate.id === id) continue;
      cleanup.set(duplicate.ref, {
        enabled: false,
        target: FieldValue.delete(),
        disabledReason: 'duplicate_target',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    if (duplicates.docs.some((duplicate) => duplicate.id !== id)) await cleanup.commit();
    return NextResponse.json({ registrationId: id });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const input = deleteSchema.parse(await request.json());
    const ref = context.adminDb.collection('users').doc(context.uid)
      .collection('messagingRegistrations').doc(input.registrationId);
    const existing = await ref.get();
    const legacyTarget = typeof existing.data()?.target === 'string' ? existing.data()?.target : null;
    const matching = legacyTarget
      ? await context.adminDb.collection('users').doc(context.uid)
        .collection('messagingRegistrations').where('target', '==', legacyTarget).get()
      : null;
    const cleanup = context.adminDb.batch();
    const matchingRefs = matching?.docs.map((item) => item.ref) || [ref];
    for (const matchingRef of matchingRefs) {
      cleanup.set(matchingRef, {
        enabled: false,
        target: FieldValue.delete(),
        disabledReason: 'user_disabled',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await cleanup.commit();
    if (legacyTarget) {
      await context.adminDb.collection('users').doc(context.uid).set({
        pushTokens: FieldValue.arrayRemove(legacyTarget),
      }, { merge: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
