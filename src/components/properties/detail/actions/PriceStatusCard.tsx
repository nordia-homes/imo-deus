'use client';

import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";

export function PriceStatusCard({ property }: { property: Property }) {

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardContent className="p-4 flex items-baseline gap-3">
                <span className="text-base font-semibold text-muted-foreground">Preț</span>
                <span className="text-2xl font-bold">€{property.price.toLocaleString()}</span>
            </CardContent>
        </Card>
    );
}
