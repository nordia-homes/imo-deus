"use client";
import * as React from "react"
import type { LeadSourceData } from '@/lib/types';
import { Pie, PieChart, ResponsiveContainer } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig
} from '@/components/ui/chart';

export function LeadSourceChart({ data }: { data: LeadSourceData[] }) {
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
        count: {
            label: "Count",
        },
    };
    data.forEach(item => {
        config[item.source] = {
            label: item.source,
            color: item.fill
        }
    })
    return config;
  }, [data]);

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[250px]"
    >
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={data}
            dataKey="count"
            nameKey="source"
            innerRadius={60}
            strokeWidth={5}
          />
          <ChartLegend
            content={<ChartLegendContent nameKey="source" />}
            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
