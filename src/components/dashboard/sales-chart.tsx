"use client";
import type { SalesData } from '@/lib/types';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CardDescription } from '../ui/card';

const chartConfig = {
    sales: {
      label: "Comision",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig

export function SalesChart({ data }: { data: SalesData[] }) {
    const hasData = data && data.length > 0 && data.some(d => d.sales > 0);

    if (!hasData) {
        return (
            <div className="h-[180px] w-full flex items-center justify-center">
                <CardDescription className="text-white/70">Nu sunt date despre comisioane.</CardDescription>
            </div>
        )
    }

  return (
    <ChartContainer config={chartConfig} className="w-full h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                    dataKey="month"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => value.slice(0, 3)}
                    stroke="rgba(255, 255, 255, 0.5)"
                    fontSize={12}
                />
                <YAxis 
                   stroke="rgba(255, 255, 255, 0.5)"
                   tickFormatter={(value) => `€${Number(value) / 1000}k`}
                   fontSize={12}
                   axisLine={false}
                   tickLine={false}
                />
                <ChartTooltip 
                    cursor={false} 
                    content={<ChartTooltipContent 
                                formatter={(value) => `€${Number(value).toLocaleString()}`} 
                                indicator="dot"
                            />} 
                />
                <Bar dataKey="sales" fill="var(--color-sales)" radius={2} barSize={12} />
            </BarChart>
        </ResponsiveContainer>
    </ChartContainer>
  );
}
