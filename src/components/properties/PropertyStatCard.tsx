'use client';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PropertyStatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  className?: string;
}

export function PropertyStatCard({
  label,
  value,
  subValue,
  icon,
  className,
}: PropertyStatCardProps) {
  return (
    <Card className={cn("rounded-xl shadow-sm", className)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="font-bold text-foreground text-lg">{value}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-muted-foreground text-xs">{label}</p>
            {subValue && <p className="text-muted-foreground text-xs">· {subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
