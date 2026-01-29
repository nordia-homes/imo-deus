"use client";
import type { LeadSourceData } from '@/lib/types';
import {
  ChartContainer,
} from '@/components/ui/chart';

export function LeadSourceChart({ data }: { data: LeadSourceData[] }) {
  const chartConfig = {
    count: { label: 'Count' },
    Website: { label: 'Website', color: 'hsl(var(--chart-1))' },
    Referral: { label: 'Referral', color: 'hsl(var(--chart-2))' },
    'Ad Campaign': { label: 'Ad Campaign', color: 'hsl(var(--chart-3))' },
    'Social Media': { label: 'Social Media', color: 'hsl(var(--chart-4))' },
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[250px] flex items-center justify-center"
    >
      <p className="text-sm text-muted-foreground p-4 text-center">Graficul este temporar indisponibil.</p>
    </ChartContainer>
  );
}
