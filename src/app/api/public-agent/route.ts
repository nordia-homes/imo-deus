import { NextRequest, NextResponse } from 'next/server';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function parseFirestoreValue(value: any): any {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in value) {
    const fields = value.mapValue.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, nestedValue]) => [key, parseFirestoreValue(nestedValue)])
    );
  }

  return undefined;
}

function parseFirestoreDocument<T>(document: any): T | null {
  if (!document?.fields) return null;
  return Object.fromEntries(
    Object.entries(document.fields).map(([key, value]) => [key, parseFirestoreValue(value)])
  ) as T;
}

async function getPublicDocument<T>(path: string): Promise<T | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${path}?key=${firebaseConfig.apiKey}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  return parseFirestoreDocument<T>(json);
}

export async function GET(request: NextRequest) {
  const agencyId = request.nextUrl.searchParams.get('agencyId')?.trim();
  const agentId = request.nextUrl.searchParams.get('agentId')?.trim();

  if (!agencyId || !agentId) {
    return NextResponse.json(
      { message: 'agencyId si agentId sunt obligatorii.' },
      { status: 400 }
    );
  }

  try {
    try {
      const { adminDb } = await import('@/firebase/admin');
      const snapshot = await adminDb.collection('users').doc(agentId).get();

      if (snapshot.exists) {
        const data = snapshot.data() as {
          agencyId?: string;
          name?: string;
          email?: string;
          phone?: string;
          photoUrl?: string;
        };

        if (data.agencyId === agencyId) {
          return NextResponse.json(
            {
              agent: {
                id: snapshot.id,
                name: data.name || null,
                email: data.email || null,
                phone: data.phone || null,
                photoUrl: data.photoUrl || null,
              },
            },
            { status: 200 }
          );
        }
      }
    } catch {
      // Fall through to the public mirror profile.
    }

    const publicProfile = await getPublicDocument<{
      agencyId?: string;
      name?: string;
      email?: string;
      phone?: string;
      photoUrl?: string;
    }>(`publicAgentProfiles/${agentId}`);

    if (!publicProfile || publicProfile.agencyId !== agencyId) {
      return NextResponse.json({ agent: null }, { status: 200 });
    }

    return NextResponse.json(
      {
        agent: {
          id: agentId,
          name: publicProfile.name || null,
          email: publicProfile.email || null,
          phone: publicProfile.phone || null,
          photoUrl: publicProfile.photoUrl || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Nu am putut incarca profilul public al agentului.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
