'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AiLeadSummary } from "@/lib/types";

type AiSummaryProps = {
    summary: AiLeadSummary;
}

export function AiSummary({ summary }: AiSummaryProps) {
    const potential = Math.round((summary.score / 100) * 25);
    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">All Lead Summary</CardTitle>
                <p className="text-sm text-muted-foreground">{potential}/25 potențial</p>
            </CardHeader>
            <CardContent className="space-y-5">
                <Progress value={potential * 4} />
                 {/* Placeholder for future graph */}
                <div className="h-24 bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Chart placeholder</p>
                </div>
            </CardContent>
        </Card>
    )
}
