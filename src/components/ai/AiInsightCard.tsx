
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import type { PropertyInsightsOutput } from "@/ai/flows/property-insights-generator";
import { Button } from "../ui/button";

interface AiInsightCardProps {
    insights: PropertyInsightsOutput | null;
    onGenerate: () => void;
    isGenerating: boolean;
}

export default function AiInsightCard({ insights, onGenerate, isGenerating }: AiInsightCardProps) {
    return (
        <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="text-blue-600" />
                    <span>Perspective AI</span>
                </CardTitle>
                {!insights && !isGenerating && (
                    <CardDescription>
                        Generează o analiză AI a pieței pentru această proprietate.
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                {isGenerating && (
                     <div className="flex flex-col items-center justify-center text-center p-8 space-y-2">
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                        <p className="text-sm text-blue-700 font-semibold">Se analizează piața...</p>
                        <p className="text-xs text-blue-600">Acest proces poate dura câteva secunde.</p>
                    </div>
                )}
                {!isGenerating && !insights && (
                     <Button className="w-full" onClick={onGenerate}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generează Perspective
                    </Button>
                )}
                {insights && !isGenerating && (
                    <>
                        <div>
                            <p className="text-sm font-semibold">Scor de Piață</p>
                            <p className="text-lg font-bold text-blue-700">{insights.marketScore} / 100</p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Feedback Preț</p>
                            <p className="text-muted-foreground text-sm">{insights.pricingFeedback}</p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Profil Cumpărător</p>
                            <p className="text-muted-foreground text-sm">{insights.buyerProfile}</p>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
