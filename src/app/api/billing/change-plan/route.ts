import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyAdminFromBearerToken } from '@/lib/firebase-app-hosting';
import { deriveStripeBillingState, describePlanSeatPricing, updateStripeSubscriptionPlan } from '@/lib/billing/stripe-server';
import { isBillingPlanId } from '@/lib/billing/plans';

export const runtime = 'nodejs';

const schema = z.object({
  planId: z.string(),
  seats: z.coerce.number().int().min(1).max(500).optional(),
});

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return { status, message: error instanceof Error ? error.message : 'Nu am putut schimba planul.' };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'Nu am putut schimba planul.' };
}

export async function POST(request: NextRequest) {
  try {
    const { agencyId, adminDb } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (!agencyId) {
      return NextResponse.json({ message: 'Utilizatorul nu este asociat unei agentii.' }, { status: 403 });
    }

    const body = schema.parse(await request.json().catch(() => ({})));
    if (!isBillingPlanId(body.planId)) {
      return NextResponse.json({ message: 'Planul selectat este invalid.' }, { status: 400 });
    }

    const [agencySnapshot, usersSnapshot] = await Promise.all([
      adminDb.collection('agencies').doc(agencyId).get(),
      adminDb.collection('users').where('agencyId', '==', agencyId).get(),
    ]);
    if (!agencySnapshot.exists) {
      return NextResponse.json({ message: 'Agentia nu a fost gasita.' }, { status: 404 });
    }

    const agency = agencySnapshot.data() as {
      stripeSubscriptionId?: string;
      stripeSubscriptionItemId?: string;
      purchasedSeats?: number;
    };

    if (!agency.stripeSubscriptionId || !agency.stripeSubscriptionItemId) {
      return NextResponse.json(
        { message: 'Agentia nu are inca un abonament activ pentru schimbare de plan.', code: 'missing_subscription' },
        { status: 409 }
      );
    }

    const seatUsageCount = usersSnapshot.docs.filter((docSnapshot) => {
      const user = docSnapshot.data() as { role?: string };
      return user.role === 'admin' || user.role === 'agent';
    }).length;
    const seats = Math.max(1, Number(body.seats || agency.purchasedSeats || 1));
    if (seats < seatUsageCount) {
      return NextResponse.json(
        { message: `Nu poti cobori sub ${seatUsageCount} utilizatori activi.`, code: 'seat_usage_conflict' },
        { status: 409 }
      );
    }
    const subscription = await updateStripeSubscriptionPlan({
      subscriptionId: agency.stripeSubscriptionId,
      subscriptionItemId: agency.stripeSubscriptionItemId,
      planId: body.planId,
      seats,
    });
    const billingState = deriveStripeBillingState(subscription);

    await adminDb.collection('agencies').doc(agencyId).set(
      {
        billingProvider: 'stripe',
        billingPlan: billingState.billingPlan || body.planId,
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
        pricing: describePlanSeatPricing(body.planId, seats),
        billingState,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || 'Date invalide pentru schimbarea planului.' }, { status: 400 });
    }

    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
