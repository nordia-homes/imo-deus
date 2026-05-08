'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  name: string;
  price: string;
  headline?: string;
  priceHelper?: string;
  features: string[];
  recommended?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  onChoosePlan: () => void;
}

export default function PlanCard({
  name,
  price,
  headline,
  priceHelper,
  features,
  recommended,
  disabled,
  buttonLabel,
  onChoosePlan,
}: PlanCardProps) {
  const isCustom = price.toLowerCase() === 'custom';

  return (
    <Card
      className={cn(
        'agentfinder-billing-plan-card flex flex-col rounded-2xl border-none bg-[#152A47] text-white shadow-2xl',
        recommended && 'agentfinder-billing-plan-card--recommended border-2 border-primary'
      )}
    >
      <CardHeader>
        {recommended ? <p className="mb-2 text-sm font-semibold text-primary">Recomandat</p> : null}
        <CardTitle className="text-white">{name}</CardTitle>
        {headline ? <p className="text-sm text-white/65">{headline}</p> : null}
        <CardDescription className="text-white/90">
          <span className="text-3xl font-bold text-white">{price}</span>
          {isCustom ? null : <span className="ml-1 text-white/70">{priceHelper || '/luna'}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-white/90">
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-400" />
            <span>{feature}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button
          className={cn('w-full', !recommended && 'border-white/20 bg-white/10 text-white hover:bg-white/20')}
          variant={recommended ? 'default' : 'outline'}
          disabled={disabled}
          onClick={onChoosePlan}
        >
          {isCustom ? 'Contacteaza-ne' : buttonLabel || 'Alege planul'}
        </Button>
      </CardFooter>
    </Card>
  );
}
