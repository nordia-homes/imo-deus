"use client";

import { useState } from 'react';
import type { SalesData } from '@/lib/types';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CalendarRange, CircleGauge, Trophy } from 'lucide-react';

const chartConfig = {
  sales: {
    label: "Volum vanzari",
    color: "#22c55e",
  },
} satisfies ChartConfig;

export function SalesChart({ data }: { data: SalesData[] }) {
  const [period, setPeriod] = useState<3 | 6 | 12 | 'all'>(6);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-sm text-white/60">
        Nu exista inca suficiente vanzari inregistrate pentru acest grafic.
      </div>
    );
  }

  const filteredData = period === 'all' ? data : data.slice(-period);
  const chartData = filteredData.length === 1
    ? [
        { month: 'Start', sales: 0 },
        filteredData[0],
      ]
    : filteredData;
  const latestSales = Math.round(filteredData[filteredData.length - 1]?.sales || 0);
  const maxSales = Math.max(...chartData.map((item) => item.sales), 0);
  const totalSales = filteredData.reduce((total, item) => total + item.sales, 0);
  const bestMonth = filteredData.reduce<SalesData | null>(
    (best, item) => (!best || item.sales > best.sales ? item : best),
    null
  );
  const yAxisMax = Math.max(maxSales, 1);
  const yAxisTicks = [0, Math.round(yAxisMax / 2), Math.round(yAxisMax)].filter(
    (value, index, values) => values.indexOf(value) === index
  );

  return (
    <div className="space-y-4">
      <div className="agentfinder-sales-toolbar flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:pl-4">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
          <CalendarRange className="h-4 w-4" />
          Perioadă afișată
        </span>
        <div className="agentfinder-sales-period-filter grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Filtrează perioada comisioanelor">
          {([
            { value: 3, label: '3 luni' },
            { value: 6, label: '6 luni' },
            { value: 12, label: '12 luni' },
            { value: 'all', label: 'Tot' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={`min-h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                period === option.value
                  ? 'agentfinder-sales-period-option--active bg-white text-slate-900 shadow-sm'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="agentfinder-sales-chart-kpis grid gap-3 sm:grid-cols-3">
        <div className="agentfinder-sales-chart-kpi agentfinder-sales-chart-kpi--current rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="agentfinder-sales-chart-kpi-label text-[10px] font-bold uppercase tracking-[0.16em] text-pink-200">Comision luna curentă</p>
            <span className="agentfinder-sales-chart-current-icon flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300">
              <CircleGauge className="h-[18px] w-[18px]" />
            </span>
          </div>
          <p className="agentfinder-sales-chart-kpi-value mt-2 text-3xl font-bold tracking-tight text-pink-200">
            EUR {latestSales.toLocaleString('ro-RO')}
          </p>
        </div>
        <div className="agentfinder-sales-chart-kpi agentfinder-sales-chart-kpi--total rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="agentfinder-sales-chart-kpi-label text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200">Total perioadă</p>
            <span className="agentfinder-sales-chart-total-icon flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <CalendarRange className="h-[18px] w-[18px]" />
            </span>
          </div>
          <p className="agentfinder-sales-chart-kpi-value mt-2 text-3xl font-bold tracking-tight text-violet-200">
            EUR {Math.round(totalSales).toLocaleString('ro-RO')}
          </p>
        </div>
        <div className="agentfinder-sales-chart-kpi agentfinder-sales-chart-kpi--max rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="agentfinder-sales-chart-kpi-label text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">Luna de vârf</p>
            <span className="agentfinder-sales-chart-max-icon flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <Trophy className="h-[18px] w-[18px]" />
            </span>
          </div>
          <p className="agentfinder-sales-chart-kpi-value mt-2 text-3xl font-bold tracking-tight text-emerald-200">
            EUR {Math.round(maxSales).toLocaleString('ro-RO')}
          </p>
          <p className="mt-1 text-xs capitalize text-white/45">{bestMonth?.month || '—'}</p>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[230px] w-full rounded-3xl border border-white/10 bg-white/5 p-3 sm:h-[260px] sm:p-4">
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
              tickFormatter={(value) => value === 'Start' ? '' : String(value).split(' ')[0]}
              minTickGap={34}
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
              dot={{ r: 3.5, fill: 'var(--color-sales)', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-sales)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
