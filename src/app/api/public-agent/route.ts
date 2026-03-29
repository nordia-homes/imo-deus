import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
    const { adminDb } = await import('@/firebase/admin');
    const snapshot = await adminDb.collection('users').doc(agentId).get();

    if (!snapshot.exists) {
      return NextResponse.json({ agent: null }, { status: 200 });
    }

    const data = snapshot.data() as {
      agencyId?: string;
      name?: string;
      email?: string;
      phone?: string;
      photoUrl?: string;
    };

    if (data.agencyId !== agencyId) {
      return NextResponse.json({ agent: null }, { status: 200 });
    }

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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Nu am putut incarca profilul public al agentului.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
