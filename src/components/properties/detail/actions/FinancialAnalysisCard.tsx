'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { DollarSign, Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { Separator } from "@/components/ui/separator";

export function FinancialAnalysisCard({ property }: { property: Property }) {
    const [monthlyRent, setMonthlyRent] = useState('');

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    const annualYield = useMemo(() => {
        const rent = parseFloat(monthlyRent);
        if (!rent || isNaN(rent) || !property.price || rent <= 0) return null;
        const annualRent = rent * 12;
        return ((annualRent / property.price) * 100).toFixed(2);
    }, [monthlyRent, property.price]);

    return (
        <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9]">
            <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Analiză Financiară
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
                {pricePerSqm && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-muted-foreground">Preț / mp</span>
                        <span className="font-bold text-base">€{pricePerSqm}</span>
                    </div>
                )}
                {property.transactionType === 'Închiriere' && (
                    <>
                        <Separator />
                        <div>
                            <Label htmlFor="monthly-rent" className="text-xs font-medium">Estimează randamentul</Label>
                            <CardDescription className="text-xs !mt-0 mb-2">Introdu o chirie lunară pentru a calcula randamentul anual.</CardDescription>
                            <Input 
                                id="monthly-rent"
                                type="number" 
                                placeholder="Chirie lunară (€)" 
                                className="h-8"
                                value={monthlyRent}
                                onChange={(e) => setMonthlyRent(e.target.value)}
                            />
                        </div>
                        {annualYield && (
                             <div className="flex items-center justify-between text-sm pt-1">
                                <span className="font-medium text-muted-foreground flex items-center gap-1"><Percent className="h-4 w-4"/> Randament anual</span>
                                <span className="font-bold text-base text-primary">{annualYield}%</span>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
