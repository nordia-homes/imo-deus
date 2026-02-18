"use client";
import type { ConversionData } from '@/lib/types';
import { Bar, ComposedChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend, Line } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CardDescription } from '../ui/card';

const chartConfig = {
    vizionari: { // The line
      label: "Vizionări",
      color: "#37e6a5",
    },
    tranzactii: { // The bars
      label: "Tranzacții",
      color: "hsl(var(--primary))", 
    },
  } satisfies ChartConfig

export function ConversionChart({ data }: { data: ConversionData[] }) {
  const hasData = data.some(d => d.vizionari > 0 || d.tranzactii > 0);

  if (!hasData) {
      return (
          <div className="h-[180px] w-full flex items-center justify-center">
              <CardDescription className="text-white/70">Nu sunt suficiente date în ultimele 30 de zile pentru a afișa graficul.</CardDescription>
          </div>
      )
  }

  return (
    <ChartContainer config={chartConfig} className="w-full h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                    dataKey="date"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => value}
                    stroke="rgba(255, 255, 255, 0.5)"
                    fontSize={12}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="rgba(255, 255, 255, 0.5)"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={30}
                  fontSize={12}
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                />
                <Legend iconType="circle" />
                <Bar dataKey="tranzactii" yAxisId="left" fill="var(--color-tranzactii)" radius={2} name="Tranzacții" barSize={8}/>
                <Line type="monotone" yAxisId="left" dataKey="vizionari" stroke="var(--color-vizionari)" strokeWidth={2} name="Vizionări" dot={{ r: 4, fill: '#37e6a5', strokeWidth: 0 }} />
            </ComposedChart>
        </ResponsiveContainer>
    </ChartContainer>
  );
}
