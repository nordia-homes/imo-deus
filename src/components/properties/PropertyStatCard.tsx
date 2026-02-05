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
    <Card className={cn("rounded-xl shadow-2xl", className)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex items-baseline gap-2">
          <p className="font-bold text-foreground text-lg">{value}</p>
          <p className="text-muted-foreground text-sm">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
