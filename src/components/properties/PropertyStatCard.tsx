'use client';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface PropertyStatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
  progress?: number;
  subValue?: string;
}

export function PropertyStatCard({
  label,
  value,
  icon,
  className,
  progress,
  subValue,
}: PropertyStatCardProps) {
  return (
    <Card className={cn("rounded-xl shadow-2xl", className)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
        <div className="w-full space-y-1">
            <div className="flex items-baseline justify-between">
                <p className="text-muted-foreground text-sm">{label}</p>
                {progress !== undefined && (
                     <span className="text-xs font-semibold text-green-600">{`${Math.round(progress)}% Realizat`}</span>
                )}
            </div>
            <div className="flex items-baseline gap-1.5">
                <p className="font-bold text-foreground text-lg">{value}</p>
                {subValue && (
                     <p className="text-sm text-muted-foreground">{subValue}</p>
                )}
            </div>
             {progress !== undefined && (
                <Progress value={progress} className="h-1.5" />
            )}
        </div>
      </CardContent>
    </Card>
  );
}
