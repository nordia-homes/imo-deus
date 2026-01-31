'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2, Sparkles, TrendingUp, ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/lib/types";
import { generatePropertyInsights, type PropertyInsightsOutput } from '@/ai/flows/property-insights-generator';
import { Badge } from '@/components/ui/badge';

export function AiPropertyInsights({ property }: { property: Property }) {
    const { toast } = useToast();
    const [insights, setInsights] = useState<PropertyInsightsOutput | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateInsights = async () => {
        setIsGenerating(true);
        setInsights(null);
        try {
            const result = await generatePropertyInsights({
                propertyType: property.propertyType,
                location: property.location,
                price: property.price,
                bedrooms: property.bedrooms,
                squareFootage: property.squareFootage,
                constructionYear: property.constructionYear,
                keyFeatures: property.keyFeatures || '',
            });
            setInsights(result);
            toast({
                title: "Perspective AI generate!",
                description: "Analiza de piață pentru proprietate este gata.",
            });
        } catch (error) {
            console.error("Failed to generate AI insights:", error);
            toast({
                variant: "destructive",
                title: "A apărut o eroare",
                description: "Nu am putut genera perspectivele AI. Încercați din nou.",
            });
        } finally {
            setIsGenerating(false);
        }
    };
    
    if (isGenerating) {
        return (
            <Card className="rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center text-center p-12 space-y-3">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <h3 className="text-lg font-semibold">AI-ul analizează piața...</h3>
                    <p className="text-sm text-muted-foreground">
                        Se calculează scorul de atractivitate și se identifică profilul cumpărătorului.
                    </p>
                </CardContent>
            </Card>
        )
    }

    if (!insights) {
         return (
            <Card className="rounded-2xl bg-muted/50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center text-center p-12 space-y-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <Lightbulb className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Descoperă Potențialul Pieței</h3>
                     <p className="text-sm text-muted-foreground">
                        Rulează o analiză AI pentru a primi un scor de atractivitate, feedback despre preț și profilul cumpărătorului ideal.
                    </p>
                    <Button onClick={handleGenerateInsights}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Rulează Analiza AI
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="rounded-2xl shadow-md border-primary/20">
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Property Insights</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleGenerateInsights}>Regenerează</Button>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center">
                        <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center text-primary text-3xl font-bold">
                            {insights.marketScore}
                        </div>
                        <p className="text-sm font-semibold mt-1">Scor Piață</p>
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="h-5 w-5 text-yellow-600" />
                            <p className="font-medium text-sm">
                                <span className="text-muted-foreground">Preț: </span>
                                {insights.pricingFeedback}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <ThumbsUp className="h-5 w-5 text-green-600" />
                            <p className="font-medium text-sm">
                                <span className="text-muted-foreground">Profil Cumpărător: </span>
                                {insights.buyerProfile}
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
