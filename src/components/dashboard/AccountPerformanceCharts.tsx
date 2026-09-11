"use client";

import type { ActiveBuyersEvolutionData, ConversionData } from '@/lib/types';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { ConversionChart } from '@/components/dashboard/ConversionChart';

type AccountPerformanceChartsProps = {
  activeProperties: number;
  activeBuyers: number;
  reservedProperties: number;
  soldProperties: number;
  reservedThisMonth: number;
  soldThisMonth: number;
  buyersEvolution: ActiveBuyersEvolutionData[];
  conversionData: ConversionData[];
};

const portfolioColors = ['#38e1a6', '#8b5cf6', '#f43f5e'];

function ChartPanel({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-0.5 text-xs text-white/55">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function AccountPerformanceCharts({
  activeProperties,
  activeBuyers,
  reservedProperties,
  soldProperties,
  reservedThisMonth,
  soldThisMonth,
  buyersEvolution,
  conversionData,
}: AccountPerformanceChartsProps) {
  const portfolioData = [
    { name: 'Active', value: activeProperties },
    { name: 'Rezervate', value: reservedProperties },
    { name: 'Vândute', value: soldProperties },
  ];
  const portfolioTotal = portfolioData.reduce((total, item) => total + item.value, 0);
  const visiblePortfolioData = portfolioTotal > 0
    ? portfolioData
    : [{ name: 'Fără date', value: 1 }];
  const newBuyers = buyersEvolution.reduce((total, item) => total + item.count, 0);
  const monthlyActivity = [
    { name: 'Rezervate', value: reservedThisMonth, color: '#8b5cf6' },
    { name: 'Vândute', value: soldThisMonth, color: '#f43f5e' },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <ChartPanel title="Structura portofoliului" description="Proprietăți după starea curentă">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="relative h-[156px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visiblePortfolioData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={67}
                  paddingAngle={portfolioTotal > 0 ? 4 : 0}
                  stroke="none"
                >
                  {visiblePortfolioData.map((item, index) => (
                    <Cell
                      key={item.name}
                      fill={portfolioTotal > 0 ? portfolioColors[index] : 'rgba(255,255,255,0.12)'}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums text-white">{portfolioTotal}</span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">total</span>
            </div>
          </div>
          <div className="space-y-2.5 pr-1">
            {portfolioData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: portfolioColors[index] }} />
                <span className="text-white/60">{item.name}</span>
                <span className="ml-auto font-semibold tabular-nums text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </ChartPanel>

      <ChartPanel title="Dinamică cumpărători" description="Contacte noi în ultimele 30 de zile">
        <div className="mb-1 flex items-end justify-between gap-3">
          <div>
            <span className="text-2xl font-bold tabular-nums text-white">{newBuyers}</span>
            <span className="ml-1.5 text-xs text-white/50">noi</span>
          </div>
          <span className="rounded-full bg-[#38e1a6]/10 px-2.5 py-1 text-xs font-medium text-[#62ebba]">
            {activeBuyers} activi
          </span>
        </div>
        <div className="h-[132px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={buyersEvolution} margin={{ top: 10, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="buyersPerformanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38e1a6" stopOpacity={0.38} />
                  <stop offset="100%" stopColor="#38e1a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                tickMargin={8}
              />
              <YAxis hide allowDecimals={false} domain={[0, 'auto']} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#38e1a6"
                strokeWidth={2.5}
                fill="url(#buyersPerformanceGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#38e1a6', stroke: '#152a47', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel title="Rezultatele lunii" description="Proprietăți finalizate în luna curentă">
        <div className="h-[174px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyActivity}
              layout="vertical"
              margin={{ top: 10, right: 30, bottom: 0, left: 4 }}
            >
              <XAxis type="number" hide allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, dataMax)]} />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={70}
                tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11 }}
              />
              <Bar
                dataKey="value"
                barSize={18}
                radius={[0, 9, 9, 0]}
                background={{ fill: 'rgba(255,255,255,0.07)', radius: 9 }}
              >
                {monthlyActivity.map((item) => <Cell key={item.name} fill={item.color} />)}
                <LabelList dataKey="value" position="right" fill="#ffffff" fontSize={12} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel title="Conversie vizionări–tranzacții" description="Ultimele 30 de zile">
        <div className="-mx-2 pt-1">
          <ConversionChart data={conversionData} />
        </div>
      </ChartPanel>
    </div>
  );
}
