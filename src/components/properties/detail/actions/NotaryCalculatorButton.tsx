'use client';

import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicNotaryCalculator } from '@/components/public/PublicNotaryCalculator';

export function NotaryCalculatorButton({ price }: { price: number }) {
  return <PublicNotaryCalculator price={price} trigger={
    <Button type="button" variant="outline" className="w-full min-h-12 gap-2 rounded-full px-4 py-3 text-sm font-semibold">
      <Calculator className="h-4 w-4 shrink-0" aria-hidden />
      Evaluează taxele notariale
    </Button>
  } />;
}
