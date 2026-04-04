"use client";
import type { SalesData } from '@/lib/types';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartConfig = {
    sales: {
      label: "Volum vânzări",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig

export function SalesChart({ data }: { data: SalesData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-sm text-white/60">
        Nu există încă suficiente vânzări înregistrate pentru acest grafic.
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-1">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Ultima lună</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            €{Math.round(data[data.length - 1]?.sales || 0).toLocaleString('ro-RO')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Maxim</p>
          <p className="mt-2 text-lg font-medium text-primary">
            €{Math.round(Math.max(...data.map((item) => item.sales), 0)).toLocaleString('ro-RO')}
          </p>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[220px] w-full rounded-3xl border border-white/10 bg-white/5 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
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
              tickFormatter={(value) => value.slice(0, 3)}
              stroke="rgba(255, 255, 255, 0.45)"
              fontSize={12}
            />
            <YAxis
              stroke="rgba(255, 255, 255, 0.45)"
              tickFormatter={(value) => `€${Math.round(Number(value) / 1000)}k`}
              fontSize={12}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
              content={<ChartTooltipContent formatter={(value) => `€${Number(value).toLocaleString('ro-RO')}`} indicator="dot" />}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="var(--color-sales)"
              strokeWidth={3}
              fill="url(#salesFill)"
              dot={{ r: 0 }}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-sales)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
