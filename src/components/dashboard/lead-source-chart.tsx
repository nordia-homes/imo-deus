"use client";
import type { LeadSourceData } from '@/lib/types';
import { Pie, PieChart, Cell, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';

export function LeadSourceChart({ data }: { data: LeadSourceData[] }) {
  const chartConfig = {
    count: { label: 'Count' },
    Website: { label: 'Website', color: 'hsl(var(--chart-1))' },
    Referral: { label: 'Referral', color: 'hsl(var(--chart-2))' },
    'Ad Campaign': { label: 'Ad Campaign', color: 'hsl(var(--chart-3))' },
    'Social Media': { label: 'Social Media', color: 'hsl(var(--chart-4))' },
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[250px]"
    >
      <PieChart>
        <Tooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="source"
          innerRadius={60}
          strokeWidth={5}
        >
            {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
        </Pie>
        <ChartLegend
            content={<ChartLegendContent nameKey="source" />}
            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
        />
      </PieChart>
    </ChartContainer>
  );
}
