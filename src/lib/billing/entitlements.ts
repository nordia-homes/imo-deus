import {
  BILLING_FEATURE_LABELS,
  BILLING_PLANS,
  BILLING_PLANS_BY_ID,
  type BillingFeatureKey,
  type BillingPlanDefinition,
  type BillingPlanId,
} from '@/lib/billing/plans';

export type BillingStatus =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export type AgencyBillingLike = {
  billingPlan?: BillingPlanId | null;
  billingStatus?: BillingStatus | null;
  purchasedSeats?: number | null;
  seatUsageCount?: number | null;
};

export type SeatPricingResult = {
  unitAmountEur: number;
  discountPercent: number;
  monthlyTotalEur: number;
  tierLabel: string;
};

export type BillingSummary = {
  plan: BillingPlanDefinition;
  status: BillingStatus;
  purchasedSeats: number;
  seatUsageCount: number;
  seatsAvailable: number;
  seatPricing: SeatPricingResult;
};

export function getDefaultBillingPlan(): BillingPlanDefinition {
  return BILLING_PLANS_BY_ID.esential;
}

export function getBillingPlan(planId: BillingPlanId | null | undefined): BillingPlanDefinition {
  if (!planId) {
    return getDefaultBillingPlan();
  }

  return BILLING_PLANS_BY_ID[planId] || getDefaultBillingPlan();
}

export function getSeatPricing(planId: BillingPlanId, quantity: number): SeatPricingResult {
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));
  const plan = getBillingPlan(planId);
  const tier = plan.tiers.find((candidate) => candidate.quantityMax === null || safeQuantity <= candidate.quantityMax) || plan.tiers[plan.tiers.length - 1];
  const quantityMaxLabel = tier.quantityMax === null ? '31+' : String(tier.quantityMax);
  const quantityMin =
    plan.tiers
      .slice(0, plan.tiers.indexOf(tier))
      .reduce((currentMin, candidate) => (candidate.quantityMax === null ? currentMin : candidate.quantityMax + 1), 1);

  return {
    unitAmountEur: tier.unitAmountEur,
    discountPercent: tier.discountPercent,
    monthlyTotalEur: roundCurrency(tier.unitAmountEur * safeQuantity),
    tierLabel: tier.quantityMax === null ? `${quantityMin}+ utilizatori` : `${quantityMin}-${quantityMaxLabel} utilizatori`,
  };
}

export function hasBillingFeature(planId: BillingPlanId | null | undefined, feature: BillingFeatureKey) {
  return getBillingPlan(planId).features.includes(feature);
}

export function getFeatureLabels(planId: BillingPlanId | null | undefined) {
  return getBillingPlan(planId).features.map((feature) => BILLING_FEATURE_LABELS[feature]);
}

export function buildBillingSummary(billing: AgencyBillingLike): BillingSummary {
  const plan = getBillingPlan(billing.billingPlan || null);
  const purchasedSeats = Math.max(1, Math.floor(billing.purchasedSeats || 1));
  const seatUsageCount = Math.max(0, Math.floor(billing.seatUsageCount || 0));
  const seatsAvailable = Math.max(0, purchasedSeats - seatUsageCount);

  return {
    plan,
    status: billing.billingStatus || 'inactive',
    purchasedSeats,
    seatUsageCount,
    seatsAvailable,
    seatPricing: getSeatPricing(plan.id, purchasedSeats),
  };
}

export function getPlanComparisonRows() {
  const everyFeature = Object.keys(BILLING_FEATURE_LABELS) as BillingFeatureKey[];

  return everyFeature.map((feature) => ({
    feature,
    label: BILLING_FEATURE_LABELS[feature],
    plans: BILLING_PLANS.map((plan) => ({
      planId: plan.id,
      included: plan.features.includes(feature),
    })),
  }));
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
