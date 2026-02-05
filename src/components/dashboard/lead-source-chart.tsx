
"use client";
import * as React from "react"
import type { BuyerSourceData } from '@/lib/types';
import { Label, Pie, PieChart, ResponsiveContainer } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig
} from '@/components/ui/chart';

export function LeadSourceChart({ data }: { data: BuyerSourceData[] }) {
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

  const totalBuyers = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.count, 0);
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
            paddingAngle={2}
          >
             <Label
                content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                    <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-3xl font-bold"
                        >
                        {totalBuyers.toLocaleString()}
                        </tspan>
                        <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 20}
                        className="fill-muted-foreground text-sm"
                        >
                        Cumpărători
                        </tspan>
                    </text>
                    )
                }
                }}
            />
          </Pie>
          <ChartLegend
            content={<ChartLegendContent nameKey="source" />}
            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
