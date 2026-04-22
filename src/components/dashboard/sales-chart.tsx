"use client";

import type { SalesData } from '@/lib/types';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartConfig = {
  sales: {
    label: "Volum vanzari",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function SalesChart({ data }: { data: SalesData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-sm text-white/60">
        Nu exista inca suficiente vanzari inregistrate pentru acest grafic.
      </div>
    );
  }

  const chartData = data.length === 1
    ? [
        { month: 'Start', sales: 0 },
        data[0],
      ]
    : data;
  const latestSales = Math.round(data[data.length - 1]?.sales || 0);
  const maxSales = Math.max(...chartData.map((item) => item.sales), 0);
  const yAxisMax = Math.max(maxSales, 1);
  const yAxisTicks = [0, Math.round(yAxisMax / 2), Math.round(yAxisMax)].filter(
    (value, index, values) => values.indexOf(value) === index
  );

  return (
    <div className="space-y-5 pt-1">
      <div className="agentfinder-sales-chart-kpis grid gap-3 sm:grid-cols-2">
        <div className="agentfinder-sales-chart-kpi rounded-2xl px-4 py-3">
          <p className="agentfinder-sales-chart-kpi-label text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Ultima luna</p>
          <p className="agentfinder-sales-chart-kpi-value mt-2 text-3xl font-semibold text-white">
            EUR {latestSales.toLocaleString('ro-RO')}
          </p>
        </div>
        <div className="agentfinder-sales-chart-kpi agentfinder-sales-chart-kpi--max rounded-2xl px-4 py-3 sm:text-right">
          <p className="agentfinder-sales-chart-kpi-label text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Maxim</p>
          <p className="agentfinder-sales-chart-kpi-value mt-2 text-2xl font-semibold text-primary">
            EUR {Math.round(maxSales).toLocaleString('ro-RO')}
          </p>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[220px] w-full rounded-3xl border border-white/10 bg-white/5 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 18 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-sales)" stopOpacity={0.38} />
                <stop offset="100%" stopColor="var(--color-sales)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={12}
              axisLine={false}
              tickFormatter={(value) => value === 'Start' ? '' : String(value).slice(0, 3)}
              stroke="rgba(255, 255, 255, 0.45)"
              fontSize={12}
            />
            <YAxis
              stroke="rgba(255, 255, 255, 0.45)"
              tickFormatter={(value) => Number(value).toLocaleString('ro-RO')}
              fontSize={12}
              axisLine={false}
              tickLine={false}
              domain={[0, yAxisMax]}
              ticks={yAxisTicks}
              width={64}
            />
            <ChartTooltip
              cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
              content={<ChartTooltipContent formatter={(value) => `EUR ${Number(value).toLocaleString('ro-RO')}`} indicator="dot" />}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="var(--color-sales)"
              strokeWidth={3}
              fill="url(#salesFill)"
              dot={{ r: 4, fill: 'var(--color-sales)', strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-sales)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
