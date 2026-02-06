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
}

export function StatCard({
  title,
  value,
  icon,
  className,
  progress,
  period,
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
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <div className="text-xl font-bold">{value}</div>
                    {period && <p className="text-xs text-muted-foreground mt-0.5">{period}</p>}
                </div>
            </CardContent>
        </Card>
    );
}
