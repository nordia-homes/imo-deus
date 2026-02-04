'use client';

import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";

export function PriceStatusCard({ property }: { property: Property }) {

    return (
        <Card className="rounded-2xl shadow-2xl border-2 border-primary">
            <CardContent className="p-4 text-center">
                <span className="text-2xl font-bold text-primary">
                    €{property.price.toLocaleString()}
                </span>
            </CardContent>
        </Card>
    );
}
