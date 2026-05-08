import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyAdminFromBearerToken } from '@/lib/firebase-app-hosting';
import { deriveStripeBillingState, describePlanSeatPricing, updateStripeSubscriptionSeats } from '@/lib/billing/stripe-server';

export const runtime = 'nodejs';

const schema = z.object({
  seats: z.coerce.number().int().min(1).max(500),
});

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return { status, message: error instanceof Error ? error.message : 'Nu am putut actualiza numarul de seats.' };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'Nu am putut actualiza numarul de seats.' };
}

export async function POST(request: NextRequest) {
  try {
    const { agencyId, adminDb } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (!agencyId) {
      return NextResponse.json({ message: 'Utilizatorul nu este asociat unei agentii.' }, { status: 403 });
    }

    const body = schema.parse(await request.json().catch(() => ({})));
    const agencySnapshot = await adminDb.collection('agencies').doc(agencyId).get();
    if (!agencySnapshot.exists) {
      return NextResponse.json({ message: 'Agentia nu a fost gasita.' }, { status: 404 });
    }

    const agency = agencySnapshot.data() as {
      billingPlan?: 'esential' | 'avansat' | 'profesional';
      stripeSubscriptionId?: string;
      stripeSubscriptionItemId?: string;
      seatUsageCount?: number;
    };

    const seatUsageCount = Math.max(0, Number(agency.seatUsageCount || 0));
    if (body.seats < seatUsageCount) {
      return NextResponse.json(
        {
          message: `Nu poti reduce seats-urile sub numarul de utilizatori activi (${seatUsageCount}).`,
          code: 'seat_usage_conflict',
        },
        { status: 409 }
      );
    }

    if (!agency.stripeSubscriptionId || !agency.stripeSubscriptionItemId || !agency.billingPlan) {
      return NextResponse.json(
        { message: 'Agentia nu are inca un abonament activ pentru schimbare de seats.', code: 'missing_subscription' },
        { status: 409 }
      );
    }

    const subscription = await updateStripeSubscriptionSeats({
      subscriptionId: agency.stripeSubscriptionId,
      subscriptionItemId: agency.stripeSubscriptionItemId,
      seats: body.seats,
    });
    const billingState = deriveStripeBillingState(subscription);

    await adminDb.collection('agencies').doc(agencyId).set(
      {
        billingProvider: 'stripe',
        billingStatus: billingState.billingStatus,
        purchasedSeats: billingState.purchasedSeats,
        stripeCustomerId: billingState.stripeCustomerId || undefined,
        stripeSubscriptionId: billingState.stripeSubscriptionId || undefined,
        stripeSubscriptionItemId: billingState.stripeSubscriptionItemId || undefined,
        billingCurrentPeriodStart: billingState.billingCurrentPeriodStart || undefined,
        billingCurrentPeriodEnd: billingState.billingCurrentPeriodEnd || undefined,
        billingCancelAtPeriodEnd: billingState.billingCancelAtPeriodEnd,
        billingDefaultPaymentMethodBrand: billingState.billingDefaultPaymentMethodBrand || undefined,
        billingDefaultPaymentMethodLast4: billingState.billingDefaultPaymentMethodLast4 || undefined,
        billingLastSyncAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json(
      {
        success: true,
        pricing: describePlanSeatPricing(agency.billingPlan, body.seats),
        billingState,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || 'Date invalide pentru schimbarea seats-urilor.' }, { status: 400 });
    }

    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
