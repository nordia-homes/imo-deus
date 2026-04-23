"use client";
import type { ActiveBuyersEvolutionData } from '@/lib/types';
import { Line, ComposedChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CardDescription } from '../ui/card';

const chartConfig = {
    count: {
      label: "Cumpărători Noi",
      color: "#8884d8",
    },
  } satisfies ChartConfig

export function ActiveBuyersChart({ data }: { data: ActiveBuyersEvolutionData[] }) {
  const hasData = data.some(d => d.count > 0);

  if (!hasData) {
      return (
          <div className="h-[120px] w-full flex items-center justify-center">
              <CardDescription className="text-white/70">Nu sunt cumpărători noi în ultimele 30 de zile.</CardDescription>
          </div>
      )
  }

  return (
    <ChartContainer config={chartConfig} className="w-full h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 8 }}>
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
                  width={36}
                  fontSize={12}
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                />
                <Legend iconType="circle" />
                <Line type="monotone" yAxisId="left" dataKey="count" stroke="var(--color-count)" strokeWidth={2} name="Cumpărători Noi" dot={{ r: 4, fill: '#8884d8', strokeWidth: 0 }} />
            </ComposedChart>
        </ResponsiveContainer>
    </ChartContainer>
  );
}
