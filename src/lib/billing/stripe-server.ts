import { createHmac, timingSafeEqual } from 'node:crypto';
import { getBillingPlan, getSeatPricing, type BillingStatus } from '@/lib/billing/entitlements';
import type { BillingPlanId } from '@/lib/billing/plans';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

type StripeEnvConfig = {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  returnUrlBase: string;
  priceIds: Record<BillingPlanId, string | null>;
};

export function getStripeEnvConfig(): StripeEnvConfig {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    returnUrlBase: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '',
    priceIds: {
      esential: process.env.STRIPE_PRICE_ESENTIAL || null,
      avansat: process.env.STRIPE_PRICE_AVANSAT || null,
      profesional: process.env.STRIPE_PRICE_PROFESIONAL || null,
    },
  };
}

export function isStripeConfiguredForCheckout(planId: BillingPlanId) {
  const config = getStripeEnvConfig();
  return Boolean(config.secretKey && config.returnUrlBase && config.priceIds[planId]);
}

export async function createStripeCheckoutSession(params: {
  agencyId: string;
  customerId?: string | null;
  planId: BillingPlanId;
  seats: number;
  customerEmail?: string | null;
}) {
  const config = getStripeEnvConfig();
  const priceId = config.priceIds[params.planId];

  if (!config.secretKey || !config.returnUrlBase || !priceId) {
    throw new Error('Stripe nu este configurat complet pentru checkout.');
  }

  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('line_items[0][price]', priceId);
  body.set('line_items[0][quantity]', String(params.seats));
  body.set('success_url', `${config.returnUrlBase.replace(/\/$/, '')}/billing?checkout=success`);
  body.set('cancel_url', `${config.returnUrlBase.replace(/\/$/, '')}/billing?checkout=cancel`);
  body.set('metadata[agencyId]', params.agencyId);
  body.set('metadata[planId]', params.planId);
  body.set('metadata[purchasedSeats]', String(params.seats));

  if (params.customerId) {
    body.set('customer', params.customerId);
  } else if (params.customerEmail) {
    body.set('customer_email', params.customerEmail);
  }

  body.set('subscription_data[metadata][agencyId]', params.agencyId);
  body.set('subscription_data[metadata][planId]', params.planId);
  body.set('subscription_data[metadata][purchasedSeats]', String(params.seats));

  return stripeFormRequest<{ id: string; url?: string | null }>('checkout/sessions', body);
}

export async function createStripeBillingPortalSession(params: {
  customerId: string;
}) {
  const config = getStripeEnvConfig();

  if (!config.secretKey || !config.returnUrlBase) {
    throw new Error('Stripe nu este configurat complet pentru portal.');
  }

  const body = new URLSearchParams();
  body.set('customer', params.customerId);
  body.set('return_url', `${config.returnUrlBase.replace(/\/$/, '')}/billing`);

  return stripeFormRequest<{ url?: string | null }>('billing_portal/sessions', body);
}

export async function updateStripeSubscriptionPlan(params: {
  subscriptionId: string;
  subscriptionItemId: string;
  planId: BillingPlanId;
  seats: number;
}) {
  const config = getStripeEnvConfig();
  const priceId = config.priceIds[params.planId];

  if (!config.secretKey || !priceId) {
    throw new Error('Stripe nu este configurat complet pentru schimbarea planului.');
  }

  const body = new URLSearchParams();
  body.set('items[0][id]', params.subscriptionItemId);
  body.set('items[0][price]', priceId);
  body.set('items[0][quantity]', String(params.seats));
  body.set('proration_behavior', 'always_invoice');

  return stripeFormRequest<{
    id: string;
    status?: string | null;
    customer?: string | null;
    items?: { data?: Array<{ id?: string; quantity?: number; price?: { id?: string } }> };
    current_period_start?: number;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
    default_payment_method?: { card?: { brand?: string | null; last4?: string | null } } | string | null;
  }>(`subscriptions/${params.subscriptionId}`, body);
}

export async function updateStripeSubscriptionSeats(params: {
  subscriptionId: string;
  subscriptionItemId: string;
  seats: number;
}) {
  const config = getStripeEnvConfig();

  if (!config.secretKey) {
    throw new Error('Stripe nu este configurat complet pentru schimbarea seats.');
  }

  const body = new URLSearchParams();
  body.set('items[0][id]', params.subscriptionItemId);
  body.set('items[0][quantity]', String(params.seats));
  body.set('proration_behavior', 'always_invoice');

  return stripeFormRequest<{
    id: string;
    status?: string | null;
    customer?: string | null;
    items?: { data?: Array<{ id?: string; quantity?: number; price?: { id?: string } }> };
    current_period_start?: number;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
    default_payment_method?: { card?: { brand?: string | null; last4?: string | null } } | string | null;
  }>(`subscriptions/${params.subscriptionId}`, body);
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const config = getStripeEnvConfig();
  if (!config.webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET nu este configurat.');
  }
  if (!signatureHeader) {
    throw new Error('Lipseste semnatura Stripe.');
  }

  const pairs = Object.fromEntries(
    signatureHeader.split(',').map((entry) => {
      const [key, value] = entry.split('=');
      return [key, value];
    })
  );

  const timestamp = pairs.t;
  const signature = pairs.v1;
  if (!timestamp || !signature) {
    throw new Error('Headerul Stripe-Signature este invalid.');
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', config.webhookSecret).update(signedPayload).digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new Error('Semnatura webhook Stripe este invalida.');
  }
}

export function deriveStripeBillingState(subscription: {
  status?: string | null;
  items?: { data?: Array<{ id?: string; quantity?: number; price?: { id?: string } }> };
  customer?: string | null;
  id?: string;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  default_payment_method?: {
    card?: { brand?: string | null; last4?: string | null };
  } | string | null;
}) {
  const status = normalizeBillingStatus(subscription.status);
  const firstItem = subscription.items?.data?.[0];
  const priceId = firstItem?.price?.id || null;
  const planId = getPlanIdFromPriceId(priceId);
  const seats = Math.max(1, Number(firstItem?.quantity || 1));
  const pricing = planId ? getSeatPricing(planId, seats) : null;

  return {
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
    stripeSubscriptionId: subscription.id || null,
    stripeSubscriptionItemId: firstItem?.id || null,
    billingPlan: planId,
    billingStatus: status,
    purchasedSeats: seats,
    billingCurrentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
    billingCurrentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    billingCancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    billingDefaultPaymentMethodBrand:
      typeof subscription.default_payment_method === 'object' && subscription.default_payment_method?.card?.brand
        ? subscription.default_payment_method.card.brand
        : null,
    billingDefaultPaymentMethodLast4:
      typeof subscription.default_payment_method === 'object' && subscription.default_payment_method?.card?.last4
        ? subscription.default_payment_method.card.last4
        : null,
    pricing,
  };
}

function getPlanIdFromPriceId(priceId: string | null) {
  if (!priceId) return null;

  const env = getStripeEnvConfig();
  if (priceId === env.priceIds.esential) return 'esential';
  if (priceId === env.priceIds.avansat) return 'avansat';
  if (priceId === env.priceIds.profesional) return 'profesional';
  return null;
}

function normalizeBillingStatus(status: string | null | undefined): BillingStatus {
  if (status === 'trialing' || status === 'active' || status === 'past_due' || status === 'canceled' || status === 'incomplete') {
    return status;
  }

  return 'inactive';
}

async function stripeFormRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const config = getStripeEnvConfig();

  const response = await fetch(`${STRIPE_API_BASE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : 'Stripe a raspuns cu o eroare.';
    throw new Error(message);
  }

  return payload as T;
}

export function formatCurrencyEur(amount: number) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function describePlanSeatPricing(planId: BillingPlanId, seats: number) {
  const plan = getBillingPlan(planId);
  const pricing = getSeatPricing(planId, seats);

  return {
    planId,
    planName: plan.name,
    seats,
    unitAmountEur: pricing.unitAmountEur,
    monthlyTotalEur: pricing.monthlyTotalEur,
    tierLabel: pricing.tierLabel,
    discountPercent: pricing.discountPercent,
  };
}
