import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { buildBillingSummary, getFeatureLabels, getPlanComparisonRows } from '@/lib/billing/entitlements';
import { BILLING_PLANS } from '@/lib/billing/plans';
import { isSmartBillConfigured } from '@/lib/billing/smartbill';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'Nu am putut incarca sumarul de billing.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Nu am putut incarca sumarul de billing.' };
}

export async function GET(request: NextRequest) {
  try {
    const { agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (!agencyId) {
      return NextResponse.json({ message: 'Utilizatorul nu este asociat unei agentii.' }, { status: 403 });
    }

    const [agencySnapshot, usersSnapshot] = await Promise.all([
      adminDb.collection('agencies').doc(agencyId).get(),
      adminDb.collection('users').where('agencyId', '==', agencyId).get(),
    ]);

    if (!agencySnapshot.exists) {
      return NextResponse.json({ message: 'Agentia nu a fost gasita.' }, { status: 404 });
    }

    const agency = agencySnapshot.data() as {
      billingPlan?: 'esential' | 'avansat' | 'profesional';
      billingStatus?: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
      purchasedSeats?: number;
      billingProvider?: 'stripe';
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      billingCurrentPeriodEnd?: string;
      billingCancelAtPeriodEnd?: boolean;
      billingDefaultPaymentMethodBrand?: string;
      billingDefaultPaymentMethodLast4?: string;
      billingEmail?: string;
      billingCompanyName?: string;
      billingTaxId?: string;
      smartbillCustomerId?: string;
      smartbillLastDocumentNumber?: string;
    };

    const seatUsageCount = usersSnapshot.docs.filter((docSnapshot) => {
      const user = docSnapshot.data() as { role?: string };
      return user.role === 'admin' || user.role === 'agent';
    }).length;

    const summary = buildBillingSummary({
      billingPlan: agency.billingPlan || 'esential',
      billingStatus: agency.billingStatus || 'inactive',
      purchasedSeats: agency.purchasedSeats || Math.max(1, seatUsageCount),
      seatUsageCount,
    });

    return NextResponse.json(
      {
        agencyId,
        summary,
        plans: BILLING_PLANS.map((plan) => ({
          ...plan,
          featureLabels: getFeatureLabels(plan.id),
        })),
        comparisonRows: getPlanComparisonRows(),
      stripe: {
          provider: agency.billingProvider || 'stripe',
          customerId: agency.stripeCustomerId || null,
          subscriptionId: agency.stripeSubscriptionId || null,
          currentPeriodEnd: agency.billingCurrentPeriodEnd || null,
          cancelAtPeriodEnd: Boolean(agency.billingCancelAtPeriodEnd),
          paymentMethodBrand: agency.billingDefaultPaymentMethodBrand || null,
          paymentMethodLast4: agency.billingDefaultPaymentMethodLast4 || null,
          billingEmail: agency.billingEmail || null,
          billingCompanyName: agency.billingCompanyName || null,
          billingTaxId: agency.billingTaxId || null,
        },
        smartbill: {
          configured: isSmartBillConfigured(),
          customerId: agency.smartbillCustomerId || null,
          lastDocumentNumber: agency.smartbillLastDocumentNumber || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
