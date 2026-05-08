import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { deriveStripeBillingState, verifyStripeWebhookSignature } from '@/lib/billing/stripe-server';
import { buildSmartBillSubscriptionInvoice, isSmartBillConfigured, issueSmartBillInvoice } from '@/lib/billing/smartbill';
import { getBillingPlan } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';

type StripeEvent = {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  try {
    verifyStripeWebhookSignature(rawBody, request.headers.get('stripe-signature'));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Semnatura Stripe este invalida.' },
      { status: 400 }
    );
  }

  const event = JSON.parse(rawBody) as StripeEvent;

  try {
    if (event.type === 'checkout.session.completed' || event.type.startsWith('customer.subscription.')) {
      const payload = (event.data?.object || {}) as {
        metadata?: { agencyId?: string | null };
        subscription?: string | null;
        customer?: string | null;
        id?: string;
        status?: string | null;
        items?: { data?: Array<{ id?: string; quantity?: number; price?: { id?: string } }> };
        current_period_start?: number;
        current_period_end?: number;
        cancel_at_period_end?: boolean;
        default_payment_method?: { card?: { brand?: string | null; last4?: string | null } } | null;
      };

      let agencyId = payload.metadata?.agencyId || null;
      if (!agencyId && payload.subscription) {
        const snapshot = await adminDb.collection('agencies').where('stripeSubscriptionId', '==', String(payload.subscription)).limit(1).get();
        agencyId = snapshot.docs[0]?.id || null;
      }
      if (!agencyId && payload.customer) {
        const snapshot = await adminDb.collection('agencies').where('stripeCustomerId', '==', String(payload.customer)).limit(1).get();
        agencyId = snapshot.docs[0]?.id || null;
      }
      if (agencyId) {
        const billingState = deriveStripeBillingState({
          id: payload.subscription?.toString() || payload.id,
          status: payload.status,
          customer: payload.customer,
          items: payload.items,
          current_period_start: payload.current_period_start,
          current_period_end: payload.current_period_end,
          cancel_at_period_end: payload.cancel_at_period_end,
          default_payment_method: payload.default_payment_method || null,
        });

        await adminDb.collection('agencies').doc(agencyId).set(
          {
            billingProvider: 'stripe',
            billingPlan: billingState.billingPlan || undefined,
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
      }
    }

    if (event.type === 'invoice.paid') {
      const payload = (event.data?.object || {}) as {
        customer?: string | null;
        subscription?: string | null;
        amount_paid?: number | null;
        currency?: string | null;
      };

      let agencySnapshot: { id: string; data: () => Record<string, unknown> } | null = null;

      if (payload.subscription) {
        const snapshot = await adminDb.collection('agencies').where('stripeSubscriptionId', '==', String(payload.subscription)).limit(1).get();
        agencySnapshot = snapshot.docs[0] || null;
      }
      if (!agencySnapshot && payload.customer) {
        const snapshot = await adminDb.collection('agencies').where('stripeCustomerId', '==', String(payload.customer)).limit(1).get();
        agencySnapshot = snapshot.docs[0] || null;
      }

      if (agencySnapshot) {
        const agencyId = agencySnapshot.id;
        const agency = agencySnapshot.data() as {
          id?: string;
          name?: string;
          billingPlan?: 'esential' | 'avansat' | 'profesional';
          purchasedSeats?: number;
          legalCompanyName?: string;
          companyTaxId?: string;
          address?: string;
          billingEmail?: string;
          billingCompanyName?: string;
          billingTaxId?: string;
          billingAddress?: string;
        };

        const plan = getBillingPlan(agency.billingPlan || 'esential');
        const totalAmountEur = Number(payload.amount_paid || 0) / 100;

        await adminDb.collection('agencies').doc(agencyId).collection('billingInvoices').doc(event.id).set(
          {
            provider: 'stripe',
            stripeEventId: event.id,
            stripeSubscriptionId: payload.subscription || null,
            stripeCustomerId: payload.customer || null,
            amountPaid: totalAmountEur,
            currency: String(payload.currency || 'eur').toUpperCase(),
            status: 'paid',
            smartbillStatus: isSmartBillConfigured() ? 'pending' : 'not_configured',
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );

        if (isSmartBillConfigured()) {
          try {
            const smartBillPayload = buildSmartBillSubscriptionInvoice({
              agency: {
                id: agencyId,
                name: agency.name,
                legalCompanyName: agency.legalCompanyName,
                companyTaxId: agency.companyTaxId,
                address: agency.address,
                billingEmail: agency.billingEmail,
                billingCompanyName: agency.billingCompanyName,
                billingTaxId: agency.billingTaxId,
                billingAddress: agency.billingAddress,
              },
              planId: plan.id,
              planName: plan.name,
              seats: Math.max(1, Number(agency.purchasedSeats || 1)),
              totalAmountEur,
              issueDate: new Date().toISOString().slice(0, 10),
            });
            const smartBillResult = await issueSmartBillInvoice(smartBillPayload);

            await adminDb.collection('agencies').doc(agencyId).set(
              {
                smartbillLastDocumentNumber: smartBillResult.number || undefined,
              },
              { merge: true }
            );
            await adminDb.collection('agencies').doc(agencyId).collection('billingInvoices').doc(event.id).set(
              {
                smartbillStatus: 'issued',
                smartbillDocumentNumber: smartBillResult.number || null,
                smartbillSeries: smartBillResult.series || null,
                smartbillUrl: smartBillResult.url || null,
                smartbillIssuedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } catch (smartBillError) {
            await adminDb.collection('agencies').doc(agencyId).collection('billingInvoices').doc(event.id).set(
              {
                smartbillStatus: 'failed',
                smartbillError: smartBillError instanceof Error ? smartBillError.message : 'Nu am putut emite factura in SmartBill.',
                smartbillFailedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        }
      }
    }

    await adminDb.collection('stripeWebhookEvents').doc(event.id).set(
      {
        type: event.type,
        receivedAt: new Date().toISOString(),
        payload: event.data?.object || {},
        processed: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Nu am putut procesa webhook-ul Stripe.' },
      { status: 500 }
    );
  }
}
