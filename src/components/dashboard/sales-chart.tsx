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

  return (
    <ChartContainer config={chartConfig} className="w-full h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey="month"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => value.slice(0, 3)}
                />
                <YAxis 
                   stroke="hsl(var(--muted-foreground))"
                   tickFormatter={(value) => `€${Number(value) / 1000}k`}
                />
                <ChartTooltip 
                    cursor={false} 
                    content={<ChartTooltipContent 
                                formatter={(value) => `€${Number(value).toLocaleString()}`} 
                                indicator="dot"
                            />} 
                />
                <Bar dataKey="sales" fill="var(--color-sales)" radius={4} />
                 {(!data || data.length === 0) && (
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-sm">
                        Nu sunt date despre comisioane.
                    </text>
                )}
            </BarChart>
        </ResponsiveContainer>
    </ChartContainer>
  );
}
