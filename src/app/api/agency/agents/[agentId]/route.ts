import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/firebase/admin';
import { requireAgencyAdminFromBearerToken } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

const updateAgentSchema = z.object({
  name: z.string().trim().min(2, 'Numele agentului este obligatoriu.'),
  phone: z.string().trim().optional(),
  photoUrl: z.string().url('URL-ul pozei este invalid.').or(z.literal('')).optional(),
});

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'A aparut o eroare la actualizarea agentului.',
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message,
    };
  }

  return {
    status: 500,
    message: 'A aparut o eroare la actualizarea agentului.',
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const { agentId } = await context.params;
    const body = updateAgentSchema.parse(await request.json().catch(() => ({})));

    const userRef = adminDb.collection('users').doc(agentId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json({ message: 'Agentul nu a fost gasit.' }, { status: 404 });
    }

    const userData = userSnapshot.data() as {
      agencyId?: string;
      role?: 'admin' | 'agent';
      email?: string;
    } | undefined;

    if (userData?.agencyId !== agencyId || userData?.role !== 'agent') {
      return NextResponse.json(
        { message: 'Poti modifica doar agentii din agentia ta.' },
        { status: 403 }
      );
    }

    const updatePayload = {
      name: body.name.trim(),
      phone: body.phone?.trim() || '',
      photoUrl: body.photoUrl?.trim() || '',
      updatedAt: new Date().toISOString(),
    };

    const batch = adminDb.batch();
    batch.set(userRef, updatePayload, { merge: true });
    batch.set(
      adminDb.collection('publicAgentProfiles').doc(agentId),
      {
        agencyId,
        name: updatePayload.name,
        email: userData.email || '',
        phone: updatePayload.phone,
        photoUrl: updatePayload.photoUrl,
        updatedAt: updatePayload.updatedAt,
      },
      { merge: true }
    );

    await batch.commit();
    await adminAuth.updateUser(agentId, {
      displayName: updatePayload.name,
    });

    return NextResponse.json(
      {
        agent: {
          id: agentId,
          ...userData,
          ...updatePayload,
          role: 'agent',
          agencyId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message || 'Datele introduse nu sunt valide.' },
        { status: 400 }
      );
    }

    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const { agentId } = await context.params;

    const userRef = adminDb.collection('users').doc(agentId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json({ message: 'Agentul nu a fost gasit.' }, { status: 404 });
    }

    const userData = userSnapshot.data() as {
      agencyId?: string;
      role?: 'admin' | 'agent';
    } | undefined;

    if (userData?.agencyId !== agencyId || userData?.role !== 'agent') {
      return NextResponse.json(
        { message: 'Poti sterge doar agentii din agentia ta.' },
        { status: 403 }
      );
    }

    const batch = adminDb.batch();
    batch.delete(userRef);
    batch.delete(adminDb.collection('publicAgentProfiles').doc(agentId));
    batch.set(
      adminDb.collection('agencies').doc(agencyId),
      {
        agentIds: FieldValue.arrayRemove(agentId),
      },
      { merge: true }
    );

    await batch.commit();

    await adminAuth.deleteUser(agentId);

    return NextResponse.json({ success: true, agentId }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
