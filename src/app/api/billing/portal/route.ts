import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyAdminFromBearerToken } from '@/lib/firebase-app-hosting';
import { createStripeBillingPortalSession } from '@/lib/billing/stripe-server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return { status, message: error instanceof Error ? error.message : 'Nu am putut crea sesiunea de billing portal.' };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'Nu am putut crea sesiunea de billing portal.' };
}

export async function POST(request: NextRequest) {
  try {
    const { agencyId, adminDb } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (!agencyId) {
      return NextResponse.json({ message: 'Utilizatorul nu este asociat unei agentii.' }, { status: 403 });
    }

    const agencySnapshot = await adminDb.collection('agencies').doc(agencyId).get();

    if (!agencySnapshot.exists) {
      return NextResponse.json({ message: 'Agentia nu a fost gasita.' }, { status: 404 });
    }

    const agency = agencySnapshot.data() as { stripeCustomerId?: string };
    if (!agency.stripeCustomerId) {
      return NextResponse.json(
        {
          message: 'Agentia nu are inca un customer Stripe asociat.',
          code: 'missing_customer',
        },
        { status: 409 }
      );
    }

    const session = await createStripeBillingPortalSession({
      customerId: agency.stripeCustomerId,
    });

    return NextResponse.json({ portalUrl: session.url || null }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
