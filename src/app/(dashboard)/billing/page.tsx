'use client';

import { useEffect, useMemo, useState } from 'react';
import PlanCard from '@/components/billing/PlanCard';
import UsageMeter from '@/components/billing/UsageMeter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeBillingPlan, changeBillingSeats, redirectToBillingPortal, redirectToCheckout } from '@/lib/stripe';
import { type BillingPlanId } from '@/lib/billing/plans';
import { type BillingSummary, getPlanComparisonRows, getSeatPricing } from '@/lib/billing/entitlements';
import { CreditCard, Loader2, Lock, RefreshCw, Users } from 'lucide-react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

type PlanApiRecord = {
  id: BillingPlanId;
  name: string;
  headline: string;
  description: string;
  recommended?: boolean;
  featureLabels: string[];
};

type BillingResponse = {
  summary: BillingSummary;
  plans: PlanApiRecord[];
  comparisonRows: ReturnType<typeof getPlanComparisonRows>;
  stripe: {
    currentPeriodEnd?: string | null;
    paymentMethodBrand?: string | null;
    paymentMethodLast4?: string | null;
    subscriptionId?: string | null;
  };
  smartbill: {
    configured: boolean;
    customerId?: string | null;
    lastDocumentNumber?: string | null;
  };
};

export default function BillingPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [data, setData] = useState<BillingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<null | BillingPlanId>(null);
  const [isUpdatingSeats, setIsUpdatingSeats] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [requestedSeats, setRequestedSeats] = useState(3);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      if (!user) return;

      setIsLoading(true);
      try {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/billing/summary', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut incarca sumarul de facturare.');
        }

        if (isMounted) {
          setData(payload as BillingResponse);
          setRequestedSeats((current) => {
            const next = payload?.summary?.purchasedSeats || 3;
            return current > 0 ? current : next;
          });
        }
      } catch (error) {
        if (isMounted) {
          toast({
            title: 'Facturare indisponibila',
            description: error instanceof Error ? error.message : 'Nu am putut incarca sumarul de facturare.',
            variant: 'destructive',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, [toast, user]);

  async function reloadSummary() {
    if (!user) return;

    const token = await user.getIdToken(true);
    const response = await fetch('/api/billing/summary', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'Nu am putut reincarca sumarul de facturare.');
    }
    setData(payload as BillingResponse);
  }

  const safeSeats = Math.max(1, Math.min(500, Math.floor(requestedSeats || 1)));
  const planCards = useMemo(() => {
    if (!data) return [];

    return data.plans.map((plan) => {
      const pricing = getSeatPricing(plan.id, safeSeats);
      return {
        ...plan,
        price: `${pricing.unitAmountEur.toFixed(2)} EUR`,
        priceHelper: `/utilizator/luna`,
        billingNote: `${pricing.tierLabel} • total ${pricing.monthlyTotalEur.toFixed(2)} EUR/luna`,
      };
    });
  }, [data, safeSeats]);

  async function handleCheckout(planId: BillingPlanId) {
    setIsSubmitting(planId);
    try {
      if (data?.stripe.subscriptionId) {
        await changeBillingPlan(planId, safeSeats);
        await reloadSummary();
        toast({
          title: 'Plan actualizat',
          description: `Planul ${planCards.find((plan) => plan.id === planId)?.name || planId} a fost trimis spre actualizare in Stripe.`,
        });
      } else {
        await redirectToCheckout(planId, safeSeats);
      }
    } catch (error) {
      toast({
        title: 'Checkout indisponibil',
        description: error instanceof Error ? error.message : 'Nu am putut porni checkout-ul Stripe.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(null);
    }
  }

  async function handleSeatUpdate() {
    if (!data?.stripe.subscriptionId) {
      toast({
        title: 'Abonament inactiv',
        description: 'Mai intai finalizeaza checkout-ul initial, apoi poti modifica numarul de seats.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingSeats(true);
    try {
      await changeBillingSeats(safeSeats);
      await reloadSummary();
      toast({
        title: 'Seats actualizate',
        description: `Abonamentul a fost actualizat la ${safeSeats} utilizatori.`,
      });
    } catch (error) {
      toast({
        title: 'Actualizare indisponibila',
        description: error instanceof Error ? error.message : 'Nu am putut actualiza numarul de seats.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingSeats(false);
    }
  }

  async function handleOpenPortal() {
    setIsOpeningPortal(true);
    try {
      await redirectToBillingPortal();
    } catch (error) {
      toast({
        title: 'Portal indisponibil',
        description: error instanceof Error ? error.message : 'Nu am putut deschide portalul de facturare.',
        variant: 'destructive',
      });
    } finally {
      setIsOpeningPortal(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 bg-[#0F1E33] p-4 text-white lg:p-6">
        <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Incarcam facturarea...</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-white/70">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Pregatim sumarul abonamentului si configuratia planurilor.</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="agentfinder-billing-page space-y-8 bg-[#0F1E33] p-4 text-white lg:p-6">
      <div className="agentfinder-billing-hero space-y-2">
        <h1 className="text-3xl font-headline font-bold text-white">Facturare si abonament</h1>
        <p className="text-white/70">
          Agentia este taxata pe plan si pe numarul de utilizatori activi. Seats-urile disponibile controleaza adaugarea de agenti noi.
        </p>
      </div>

      <Card className="agentfinder-billing-current-card rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Plan curent: {data.summary.plan.name}</CardTitle>
          <CardDescription className="text-white/70">
            Status: {data.summary.status} • {data.summary.seatPricing.monthlyTotalEur.toFixed(2)} EUR/luna la {data.summary.purchasedSeats} seats
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <UsageMeter title="Utilizatori activi" used={data.summary.seatUsageCount} total={data.summary.purchasedSeats} />
          <UsageMeter title="Seats disponibile" used={data.summary.seatsAvailable} total={data.summary.purchasedSeats} />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/45">Card salvat</p>
            <p className="mt-2 text-sm text-white/85">
              {data.stripe.paymentMethodBrand && data.stripe.paymentMethodLast4
                ? `${data.stripe.paymentMethodBrand.toUpperCase()} •••• ${data.stripe.paymentMethodLast4}`
                : 'Cardul nu este inca sincronizat in sumar.'}
            </p>
            <p className="mt-2 text-xs text-white/55">
              Portalul Stripe ramane fallback pentru administrarea cardului pana finalizam centrul whitelabel complet.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/45">Regula seats</p>
            <p className="mt-2 text-sm text-white/85">
              Agentii noi se pot crea doar daca exista seats libere. Daca numarul este depasit, API-ul de agenti blocheaza operatiunea.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 md:flex-row md:justify-between">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            Perioada curenta: {data.stripe.currentPeriodEnd ? new Date(data.stripe.currentPeriodEnd).toLocaleDateString('ro-RO') : 'nesincronizata'}
          </div>
          <Button
            onClick={handleOpenPortal}
            disabled={isOpeningPortal}
            variant="outline"
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            {isOpeningPortal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Gestioneaza cardul si facturile
          </Button>
        </CardFooter>
      </Card>

      <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Configureaza simularea de pret</CardTitle>
          <CardDescription className="text-white/70">
            Alege numarul de utilizatori pentru a vedea costul per seat si totalul lunar pe fiecare plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="requested-seats" className="text-white/80">
              Numar utilizatori
            </Label>
            <Input
              id="requested-seats"
              type="number"
              min={1}
              max={500}
              value={safeSeats}
              onChange={(event) => setRequestedSeats(Number(event.target.value))}
              className="border-white/20 bg-white/10 text-white"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            Pentru {safeSeats} utilizatori, discountul se aplica automat la tot planul in functie de tier-ul de volum. Valorile de mai jos sunt pregatite pentru integrarea cu Stripe tiered pricing.
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="button"
            onClick={handleSeatUpdate}
            disabled={isUpdatingSeats || !data.stripe.subscriptionId || safeSeats === data.summary.purchasedSeats}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isUpdatingSeats ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizeaza seats
          </Button>
        </CardFooter>
      </Card>

      <div className="agentfinder-billing-plans-section space-y-4">
        <h2 className="text-2xl font-headline font-semibold text-white">Alege planul potrivit</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {planCards.map((plan) => (
            <div key={plan.id} className="space-y-2">
              <PlanCard
                name={plan.name}
                headline={plan.headline}
                price={plan.price}
                priceHelper={plan.priceHelper}
                features={plan.featureLabels.slice(0, 8)}
                recommended={plan.recommended}
                disabled={Boolean(isSubmitting)}
                buttonLabel={data.stripe.subscriptionId ? 'Schimba planul' : 'Alege planul'}
                onChoosePlan={() => handleCheckout(plan.id)}
              />
              <p className="px-2 text-sm text-white/65">{plan.billingNote}</p>
            </div>
          ))}
        </div>
      </div>

      <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">SmartBill</CardTitle>
          <CardDescription className="text-white/70">
            La plata confirmata, webhook-ul Stripe pregateste si trimite emiterea facturii fiscale in SmartBill.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/45">Configurare</p>
            <p className="mt-2 text-sm text-white/85">{data.smartbill.configured ? 'SmartBill configurat' : 'SmartBill neconfigurat'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/45">Ultimul document</p>
            <p className="mt-2 text-sm text-white/85">{data.smartbill.lastDocumentNumber || 'Niciun document emis inca'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Comparatie functii</CardTitle>
          <CardDescription className="text-white/70">
            Functiile obligatorii raman disponibile in toate planurile, iar diferentierea apare in AI, documente, branding si automatizari.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.comparisonRows.map((row) => (
            <div key={row.feature} className="grid grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
              <div className="font-medium text-white">{row.label}</div>
              {row.plans.map((plan) => (
                <div key={plan.planId} className="flex items-center justify-center">
                  {plan.included ? <span className="text-emerald-300">Inclus</span> : <Lock className="h-4 w-4 text-white/35" />}
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Users className="h-5 w-5 text-primary" />
            Seat enforcement activ in fluxul de agenti
          </CardTitle>
          <CardDescription className="text-white/70">
            API-ul de creare agenti este acum punctul oficial de validare pentru seats. UI-ul de billing si backend-ul folosesc aceeasi logica de capacitate.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
