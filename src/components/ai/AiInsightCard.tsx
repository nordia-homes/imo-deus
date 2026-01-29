
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Lightbulb } from "lucide-react";

export default function AiInsightCard({ insights }: { insights: any }) {
    return (
        <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="text-blue-600" />
                    <span>Perspective AI</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
        </Card>
    )
}
