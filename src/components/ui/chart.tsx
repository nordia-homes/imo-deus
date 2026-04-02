"use client"

import * as React from "react"
import {
  Label,
  Pie,
  PieChart,
  Sector,
  Tooltip,
  type PieLabel,
  type PieLabelRenderProps,
  type PieProps,
} from "recharts"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ReactNode
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-defs_svg]:-translate-y-4 [&_.recharts-polar-grid_[stroke=hsl(var(--card-foreground))]]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-radial-bar-background-sector]:stroke-border [&_.recharts-reference-line_line]:stroke-border [&_.recharts-reference-line_label_text]:fill-muted-foreground [&_.recharts-tooltip-cursor]:stroke-border [&.recharts-tooltip-wrapper]:text-sm",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {children}
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    React.ComponentProps<typeof Card> & {
      active?: boolean
      payload?: any[]
      label?: React.ReactNode
      labelFormatter?: (label: any, payload: any[]) => React.ReactNode
      labelClassName?: string
      formatter?: (
        value: any,
        name: any,
        item: any,
        index: number,
        payload: any
      ) => React.ReactNode
      indicator?: "dot" | "line" | "dashed" | "none"
      hideLabel?: boolean
      hideIndicator?: boolean
      nameKey?: string
      colorKey?: string
      itemSorter?: (a: any, b: any) => number
    }
>(
  (
    {
      active,
      animationDuration,
      animationEasing,
      payload,
      className,
      contentStyle,
      cursor,
      allowEscapeViewBox,
      accessibilityLayer,
      coordinate,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      itemStyle,
      label,
      labelFormatter,
      labelClassName,
      labelStyle,
      offset,
      formatter,
      colorKey = "fill",
      nameKey = "name",
      position,
      reverseDirection,
      separator,
      shared,
      trigger,
      viewBox,
      wrapperStyle,
      itemSorter,
      ...props
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload || !payload.length) {
        return null
      }

      const [item] = payload
      const key = `${item.name}`
      const itemConfig = config[key as keyof typeof config]

      if (labelFormatter) {
        return labelFormatter(item.name, payload)
      }

      if (label) {
        return label
      }

      if (itemConfig?.label) {
        return itemConfig.label
      }

      return item.name
    }, [label, payload, hideLabel, labelFormatter, config])

    if (!active || !payload || !payload.length) {
      return null
    }

    const nestLabel = payload.length > 1

    return (
      <Card
        ref={ref}
        className={cn(
          "min-w-[8rem] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        <CardContent className="p-2 text-sm">
          <div className="grid gap-1.5">
            {!hideLabel && tooltipLabel ? (
              <div className={cn("font-medium", labelClassName)}>
                {tooltipLabel}
              </div>
            ) : null}
            <div className="grid gap-1.5">
              {(itemSorter ? payload.sort(itemSorter) : payload).map(
                (item, i) => {
                  const key = `${item[nameKey]}`
                  const itemConfig = config[key as keyof typeof config]
                  const indicatorColor = item[colorKey] || itemConfig?.color

                  return (
                    <div
                      key={item.dataKey}
                      className={cn(
                        "flex w-full items-stretch gap-2 [&>svg]:size-2.5",
                        nestLabel ? "items-start" : "items-center"
                      )}
                    >
                      {!hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0",
                            {
                              dot: "size-2.5 rounded-[2px]",
                              line: "my-0.5 h-2 w-2.5 rounded-sm",
                              dashed: "my-0.5 h-2 w-2.5 border-t-2 border-dashed",
                              none: "",
                            }[indicator]
                          )}
                          style={{
                            backgroundColor: indicatorColor,
                            borderColor: indicatorColor,
                          }}
                        />
                      )}
                      <div
                        className={cn(
                          "flex flex-1 justify-between leading-none",
                          nestLabel ? "flex-col gap-0.5" : ""
                        )}
                      >
                        <p className="text-muted-foreground">
                          {itemConfig?.label || item[nameKey]}
                        </p>
                        {item.value && (
                          <p className="font-medium">
                            {formatter
                              ? formatter(item.value, key, item, i, payload)
                              : `${item.value}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

const ChartLegend = React.Component

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<(typeof PieChart)["defaultProps"], "verticalAlign"> & {
      payload?: any[]
      nameKey?: string
    }
>(
  (
    { className, nameKey = "dataKey", verticalAlign = "bottom", payload, ...props },
    ref
  ) => {
    const { config } = useChart()

    if (!payload || !payload.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-4" : "pt-4",
          className
        )}
        {...props}
      >
        {payload.map((item) => {
          const key = `${item.value}`
          const itemConfig = config[key as keyof typeof config]

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:size-3 [&>svg]:shrink-0"
              )}
            >
              {itemConfig?.icon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label || key}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegendContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
