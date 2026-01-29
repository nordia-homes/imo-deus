"use client";
import type { SalesData } from '@/lib/types';
import {
  ChartContainer,
} from '@/components/ui/chart';

export function SalesChart({ data }: { data: SalesData[] }) {
  return (
    <ChartContainer
      config={{
        sales: {
          label: 'Sales',
          color: 'hsl(var(--primary))',
        },
      }}
      className="min-h-[200px] w-full flex items-center justify-center"
    >
       <p className="text-sm text-muted-foreground p-4 text-center">Graficul este temporar indisponibil.</p>
    </ChartContainer>
  );
}
