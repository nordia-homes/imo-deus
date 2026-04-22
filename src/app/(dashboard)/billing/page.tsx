'use client';

import PlanCard from "@/components/billing/PlanCard";
import UsageMeter from "@/components/billing/UsageMeter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { redirectToBillingPortal, redirectToCheckout } from "@/lib/stripe";
import { CreditCard } from "lucide-react";

export default function BillingPage() {
  const plans = [
    { id: 'starter', name: 'Starter', price: '49€', features: ['5 agenți', '100 credite AI/lună', 'Management lead-uri'] },
    { id: 'pro', name: 'Pro', price: '99€', features: ['15 agenți', '500 credite AI/lună', 'Pipeline vizual'], recommended: true },
    { id: 'enterprise', name: 'Enterprise', price: 'Custom', features: ['Agenți nelimitați', 'Credite AI nelimitate', 'Suport dedicat'] },
  ];

  const currentUsage = {
      agents: { used: 3, total: 5 },
      aiCredits: { used: 45, total: 100 },
  };

  return (
    <div className="agentfinder-billing-page space-y-8 bg-[#0F1E33] text-white p-4 lg:p-6">
      <div className="agentfinder-billing-hero">
        <h1 className="text-3xl font-headline font-bold text-white">Facturare și Abonament</h1>
        <p className="text-white/70">
          Gestionează abonamentul și vezi consumul.
        </p>
      </div>

       <Card className="agentfinder-billing-current-card shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
           <CardHeader>
               <CardTitle className="text-white">Abonamentul Tău: Starter</CardTitle>
           </CardHeader>
           <CardContent className="grid md:grid-cols-2 gap-6">
                <UsageMeter title="Agenți" used={currentUsage.agents.used} total={currentUsage.agents.total} />
                <UsageMeter title="Credite AI" used={currentUsage.aiCredits.used} total={currentUsage.aiCredits.total} />
           </CardContent>
           <CardFooter>
                <Button onClick={redirectToBillingPortal} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Gestionează Facturarea
                </Button>
            </CardFooter>
       </Card>

      <div className="agentfinder-billing-plans-section">
        <h2 className="text-2xl font-headline font-semibold mb-4 text-white">Schimbă abonamentul</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map(plan => (
                <PlanCard 
                    key={plan.id} 
                    {...plan}
                    onChoosePlan={() => redirectToCheckout(plan.id)}
                />
            ))}
        </div>
      </div>
    </div>
  );
}
