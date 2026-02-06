"use client";
import * as React from "react"
import type { BuyerSourceData } from '@/lib/types';
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig
} from '@/components/ui/chart';
import { CardDescription } from "../ui/card";

export function LeadSourceChart({ data }: { data: BuyerSourceData[] }) {
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    data.forEach(item => {
        config[item.source] = {
            label: item.source,
            color: item.fill
        }
    })
    return config;
  }, [data]);

  if (!data || data.length === 0) {
      return (
          <div className="h-[180px] w-full flex items-center justify-center">
              <CardDescription>Nu sunt date despre sursa lead-urilor.</CardDescription>
          </div>
      )
  }

  return (
    <ChartContainer config={chartConfig} className="w-full h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 100, bottom: 5 }}
        >
            <XAxis type="number" hide />
            <YAxis
                dataKey="source"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={5}
                width={100}
                stroke="hsl(var(--muted-foreground))"
            />
            <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" formatter={(value) => `${value} lead-uri`} />}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
            </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
