'use client';

import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";

export function PriceStatusCard({ property }: { property: Property }) {

    return (
        <Card className="rounded-2xl shadow-2xl border border-primary bg-[#f8f8f9]">
            <CardContent className="p-3 text-center">
                <span className="text-xl font-bold text-primary">
                    €{property.price.toLocaleString()}
                </span>
            </CardContent>
        </Card>
    );
}
