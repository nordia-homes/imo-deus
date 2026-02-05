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
        {progress !== undefined ? (
            <div className="w-full space-y-1">
                <div className="flex items-baseline justify-between">
                    <p className="text-muted-foreground text-sm">{label}</p>
                    <span className="text-xs font-semibold text-muted-foreground">{`${Math.round(progress)}%`}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                    <p className="font-bold text-foreground text-lg">{value}</p>
                    {subValue && (
                        <p className="text-sm text-muted-foreground">{subValue}</p>
                    )}
                </div>
                <Progress value={progress} className="h-1.5" />
            </div>
        ) : (
            <div className="flex items-baseline gap-2">
                <p className="font-bold text-lg">{value}</p>
                <p className="text-muted-foreground text-sm">{label}</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
