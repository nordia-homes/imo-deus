import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/firebase/admin';
import { requireAgencyAdminFromBearerToken, requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import {
  generateAgentPassword,
  isValidManagedAgentPassword,
  normalizeAgentEmail,
} from '@/lib/agent-passwords';

export const runtime = 'nodejs';

const createAgentSchema = z.object({
  name: z.string().trim().min(2, 'Numele agentului este obligatoriu.'),
  email: z.string().email('Adresa de email este invalida.'),
  phone: z.string().trim().optional(),
  password: z.string().trim().optional(),
});

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'A aparut o eroare la crearea agentului.',
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
    message: 'A aparut o eroare la crearea agentului.',
  };
}

async function emailExistsInAuth(email: string) {
  try {
    await adminAuth.getUserByEmail(email);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'auth/user-not-found'
    ) {
      return false;
    }

    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const snapshot = await adminDb
      .collection('users')
      .where('agencyId', '==', agencyId)
      .get();

    const agents = snapshot.docs
      .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
      .sort((left, right) => {
        const leftRole = left.role === 'admin' ? 0 : 1;
        const rightRole = right.role === 'admin' ? 0 : 1;
        if (leftRole !== rightRole) return leftRole - rightRole;
        return String(left.name || '').localeCompare(String(right.name || ''), 'ro');
      });

    return NextResponse.json({ agents }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  let createdUid: string | null = null;

  try {
    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const body = createAgentSchema.parse(await request.json().catch(() => ({})));

    const email = normalizeAgentEmail(body.email);
    const password = (body.password?.trim() || generateAgentPassword(body.name)).trim();
    const phone = body.phone?.trim() || '';

    if (!isValidManagedAgentPassword(password)) {
      return NextResponse.json(
        { message: 'Parola trebuie sa aiba intre 8 si 10 caractere, minimum 2 cifre si un caracter special.' },
        { status: 400 }
      );
    }

    const [agencySnapshot, authEmailExists] = await Promise.all([
      adminDb.collection('agencies').doc(agencyId).get(),
      emailExistsInAuth(email),
    ]);

    if (!agencySnapshot.exists) {
      return NextResponse.json({ message: 'Agentia nu a fost gasita.' }, { status: 404 });
    }

    if (authEmailExists) {
      return NextResponse.json(
        { message: 'Exista deja un cont cu acest email. Foloseste alt email sau conecteaza utilizatorul separat.' },
        { status: 409 }
      );
    }

    const createdUser = await adminAuth.createUser({
      email,
      password,
      displayName: body.name.trim(),
    });
    createdUid = createdUser.uid;

    const agencyRef = adminDb.collection('agencies').doc(agencyId);
    const userRef = adminDb.collection('users').doc(createdUid);
    const publicAgentProfileRef = adminDb.collection('publicAgentProfiles').doc(createdUid);
    const batch = adminDb.batch();
    const timestamp = new Date().toISOString();

    batch.set(
      userRef,
      {
        name: body.name.trim(),
        email,
        phone,
        agencyId,
        role: 'agent',
        photoUrl: '',
        createdAt: timestamp,
      },
      { merge: true }
    );
    batch.set(
      publicAgentProfileRef,
      {
        agencyId,
        name: body.name.trim(),
        email,
        phone,
        photoUrl: '',
        updatedAt: timestamp,
      },
      { merge: true }
    );
    batch.set(
      agencyRef,
      {
        agentIds: FieldValue.arrayUnion(createdUid),
      },
      { merge: true }
    );

    await batch.commit();

    return NextResponse.json(
      {
        agent: {
          id: createdUid,
          name: body.name.trim(),
          email,
          phone,
          agencyId,
          role: 'agent',
          photoUrl: '',
        },
        credentials: {
          email,
          password,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdUid) {
      await adminAuth.deleteUser(createdUid).catch(() => undefined);
    }

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
