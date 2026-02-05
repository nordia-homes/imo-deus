'use client';

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";

export function PriceStatusCard({ property }: { property: Property }) {

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    return (
        <Card className="rounded-2xl shadow-2xl border border-primary bg-[#f8f8f9]">
            <CardContent className="p-3 text-center flex items-baseline justify-center gap-2">
                <span className="text-xl font-bold text-primary">
                    €{property.price.toLocaleString()}
                </span>
                {pricePerSqm && (
                    <span className="text-sm font-medium text-muted-foreground">
                        (€{pricePerSqm}/m²)
                    </span>
                )}
            </CardContent>
        </Card>
    );
}
