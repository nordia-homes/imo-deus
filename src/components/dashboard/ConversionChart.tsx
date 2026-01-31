"use client";
import type { ConversionData } from '@/lib/types';
import { Bar, ComposedChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend, Line } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CardDescription } from '../ui/card';

const chartConfig = {
    vizionari: {
      label: "Vizionări",
      color: "hsl(var(--muted-foreground) / 0.3)",
    },
    tranzactii: {
      label: "Tranzacții",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig

export function ConversionChart({ data }: { data: ConversionData[] }) {
  const hasData = data.some(d => d.vizionari > 0 || d.tranzactii > 0);

  if (!hasData) {
      return (
          <div className="h-[250px] w-full flex items-center justify-center">
              <CardDescription>Nu sunt suficiente date în ultimele 30 de zile pentru a afișa graficul.</CardDescription>
          </div>
      )
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
        <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey="date"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => value.split(' ')[0]}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                />
                <Legend />
                <Bar dataKey="vizionari" yAxisId="left" fill="var(--color-vizionari)" radius={4} name="Vizionări" />
                <Line type="monotone" yAxisId="left" dataKey="tranzactii" stroke="var(--color-tranzactii)" strokeWidth={2} name="Tranzacții" />
            </ComposedChart>
        </ResponsiveContainer>
    </ChartContainer>
  );
}
