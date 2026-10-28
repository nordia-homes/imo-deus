'use client';

import type { Property } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { PublicNotaryCalculator } from './PublicNotaryCalculator';

export function PublicPriceStatusCard({ property, isMobile = false, isAgentfinderTheme = false }: {
  property: Property; isMobile?: boolean; isAgentfinderTheme?: boolean;
}) {
  const perSqm = property.price && property.squareFootage ? Math.round(property.price / property.squareFootage) : null;
  return <Card className={`relative overflow-hidden rounded-b-[2rem] rounded-t-none border-0 ${isAgentfinderTheme ? 'bg-white' : 'bg-[#0b0f0d]'}`}>
    <CardContent className={`flex flex-col items-center justify-center gap-1 text-center ${isMobile ? 'p-4' : 'p-3'}`}>
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span className={`whitespace-nowrap text-xl font-bold ${isAgentfinderTheme ? 'text-slate-950' : 'text-[#e8bf79]'}`}>EUR {property.price.toLocaleString()}</span>
        {perSqm ? <span className={`whitespace-nowrap text-sm font-medium ${isAgentfinderTheme ? 'text-slate-500' : 'text-stone-400'}`}>(EUR {perSqm}/m²)</span> : null}
      </div>
      <PublicNotaryCalculator price={property.price} />
    </CardContent>
  </Card>;
}
