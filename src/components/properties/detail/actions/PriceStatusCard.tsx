'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Property } from "@/lib/types";

export function PriceStatusCard({ property }: { property: Property }) {

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Preț</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-1">
                    <p className="text-2xl font-bold">€{property.price.toLocaleString()}</p>
                </div>
            </CardContent>
        </Card>
    );
}
