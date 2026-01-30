'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type ChartData = {
    name: string;
    'Actual': number;
    'AI Projected': number;
};

const chartConfig = {
    Actual: {
      label: "Actual",
      color: "hsl(var(--primary))",
    },
    'AI Projected': {
      label: "AI Projected",
      color: "hsl(var(--primary) / 0.3)",
    },
  } satisfies ChartConfig

export function SalesAnalyticsChart({ data, isLoading }: { data: ChartData[], isLoading: boolean }) {

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                 <div>
                    <CardTitle>Analiza Veniturilor</CardTitle>
                    <CardDescription>Ultimele 30 de zile</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                 <ChartContainer config={chartConfig} className="w-full">
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                        >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `€${value / 1000}k`}
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                        <Legend />
                        <defs>
                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-Actual)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-Actual)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorAIProjected" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-AI Projected)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--color-AI Projected)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            dataKey="AI Projected"
                            type="monotone"
                            stroke="var(--color-AI Projected)"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            fillOpacity={0.4}
                            fill="url(#colorAIProjected)"
                        />
                        <Area
                            dataKey="Actual"
                            type="monotone"
                            stroke="var(--color-Actual)"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorActual)"
                        />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
