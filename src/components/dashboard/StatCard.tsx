'use client';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
  progress?: number;
  period?: string;
  segmentedScore?: number;
}

export function StatCard({
  title,
  value,
  icon,
  className,
  progress,
  period,
  segmentedScore,
}: StatCardProps) {
    
    if (progress !== undefined) {
        return (
            <Card className={cn("rounded-2xl shadow-2xl", className)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                  {icon}
                </div>
                <div className="w-full space-y-1">
                    <div className="flex items-baseline justify-between">
                        <p className="text-muted-foreground text-sm">{title}</p>
                        <span className="text-xs font-semibold text-muted-foreground">{`${Math.round(progress)}%`}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <p className="font-bold text-foreground text-lg">{value}</p>
                        {period && (
                            <p className="text-sm text-muted-foreground">{period}</p>
                        )}
                    </div>
                    <Progress value={progress} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("shadow-2xl rounded-2xl", className)}>
            <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-lg shrink-0">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    </div>
                    <p className="text-lg font-bold">{value}</p>
                    {period && <p className="text-xs text-muted-foreground mt-0.5">{period}</p>}
                    {typeof segmentedScore === 'number' && (
                      <div className="mt-3 flex items-center gap-1.5">
                        {[0, 1, 2, 3, 4].map((index) => {
                          const threshold = (index + 1) * 20;
                          const isActive = segmentedScore >= threshold;

                          return (
                            <span
                              key={index}
                              className={cn(
                                "h-1.5 flex-1 rounded-full transition-colors",
                                isActive
                                  ? segmentedScore > 85
                                    ? "bg-emerald-400"
                                    : segmentedScore > 60
                                      ? "bg-amber-400"
                                      : "bg-rose-400"
                                  : "bg-white/10"
                              )}
                            />
                          );
                        })}
                      </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

    
