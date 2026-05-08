'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  seats: number;
  seatOptions?: number[];
  onSeatsChange: (value: number) => void;
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
  seats,
  seatOptions,
  onSeatsChange,
  onChoosePlan,
}: PlanCardProps) {
  const isCustom = price.toLowerCase() === 'custom';
  const normalizedSeatOptions = Array.isArray(seatOptions) && seatOptions.length > 0
    ? seatOptions
    : Array.from({ length: 150 }, (_, index) => index + 1);

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
        {!isCustom ? (
          <div className="rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-semibold text-white">Numar de agenti</Label>
              <Select
                value={String(seats)}
                onValueChange={(value) => onSeatsChange(Number(value))}
                disabled={disabled}
              >
                <SelectTrigger className="h-10 w-[132px] rounded-xl border-white/15 bg-[#0e1c30]/70 text-white shadow-none">
                  <SelectValue placeholder="Alege" />
                </SelectTrigger>
                <SelectContent>
                  {normalizedSeatOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
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
