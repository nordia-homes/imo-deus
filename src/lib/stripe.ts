import type { BillingPlanId } from '@/lib/billing/plans';

async function buildAuthHeaders() {
  const { getAuth } = await import('firebase/auth');
  const { initializeFirebase } = await import('@/firebase/init');
  const { auth } = initializeFirebase();
  const activeUser = auth.currentUser || getAuth().currentUser;

  if (!activeUser) {
    throw new Error('Trebuie sa fii autentificat pentru a gestiona facturarea.');
  }

  const token = await activeUser.getIdToken(true);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function redirectToCheckout(planId: BillingPlanId, seats: number) {
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: await buildAuthHeaders(),
    body: JSON.stringify({ planId, seats }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Nu am putut porni checkout-ul Stripe.');
  }

  if (!payload?.checkoutUrl) {
    throw new Error('Stripe nu a returnat un URL de checkout.');
  }

  window.location.assign(payload.checkoutUrl);
}

export async function redirectToBillingPortal() {
  const response = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: await buildAuthHeaders(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Nu am putut deschide portalul de facturare.');
  }

  if (!payload?.portalUrl) {
    throw new Error('Stripe nu a returnat un URL pentru billing portal.');
  }

  window.location.assign(payload.portalUrl);
}

export async function changeBillingPlan(planId: BillingPlanId, seats: number) {
  const response = await fetch('/api/billing/change-plan', {
    method: 'POST',
    headers: await buildAuthHeaders(),
    body: JSON.stringify({ planId, seats }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Nu am putut schimba planul.');
  }

  return payload;
}

export async function changeBillingSeats(seats: number) {
  const response = await fetch('/api/billing/change-seats', {
    method: 'POST',
    headers: await buildAuthHeaders(),
    body: JSON.stringify({ seats }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Nu am putut actualiza numarul de seats.');
  }

  return payload;
}
