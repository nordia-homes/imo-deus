import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyAdminFromBearerToken } from '@/lib/firebase-app-hosting';
import { createStripeCheckoutSession, describePlanSeatPricing, isStripeConfiguredForCheckout } from '@/lib/billing/stripe-server';
import { isBillingPlanId } from '@/lib/billing/plans';

export const runtime = 'nodejs';

const checkoutSchema = z.object({
  planId: z.string(),
  seats: z.coerce.number().int().min(1).max(500),
});

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return { status, message: error instanceof Error ? error.message : 'Nu am putut porni checkout-ul.' };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'Nu am putut porni checkout-ul.' };
}

export async function POST(request: NextRequest) {
  try {
    const { agencyId, adminDb } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const body = checkoutSchema.parse(await request.json().catch(() => ({})));
    if (!agencyId) {
      return NextResponse.json({ message: 'Utilizatorul nu este asociat unei agentii.' }, { status: 403 });
    }

    if (!isBillingPlanId(body.planId)) {
      return NextResponse.json({ message: 'Planul selectat este invalid.' }, { status: 400 });
    }

    const agencySnapshot = await adminDb.collection('agencies').doc(agencyId).get();
    if (!agencySnapshot.exists) {
      return NextResponse.json({ message: 'Agentia nu a fost gasita.' }, { status: 404 });
    }

    const agency = agencySnapshot.data() as {
      stripeCustomerId?: string;
      billingEmail?: string;
      email?: string;
    };

    const pricing = describePlanSeatPricing(body.planId, body.seats);

    if (!isStripeConfiguredForCheckout(body.planId)) {
      return NextResponse.json(
        {
          message: 'Checkout-ul Stripe nu este configurat complet in acest mediu.',
          code: 'stripe_not_configured',
          pricing,
        },
        { status: 501 }
      );
    }

    const session = await createStripeCheckoutSession({
      agencyId,
      customerId: agency.stripeCustomerId || null,
      planId: body.planId,
      seats: body.seats,
      customerEmail: agency.billingEmail || agency.email || null,
    });

    return NextResponse.json(
      {
        checkoutUrl: session.url || null,
        sessionId: session.id,
        pricing,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || 'Datele checkout-ului sunt invalide.' }, { status: 400 });
    }

    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
