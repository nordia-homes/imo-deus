'use client';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AiLeadSummary } from "@/lib/types";
import { ThumbsUp } from "lucide-react";

type AiSummaryProps = {
    summary: AiLeadSummary;
}

export function AiSummary({ summary }: AiSummaryProps) {
    const scoreColor = summary.score > 75 ? 'text-green-600' : summary.score > 50 ? 'text-yellow-600' : 'text-red-600';
    const scoreBgColor = summary.score > 75 ? 'bg-green-100' : summary.score > 50 ? 'bg-yellow-100' : 'bg-red-100';

    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">AI Lead Summary</CardTitle>
                <CardDescription>5 2/5 potențial</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="flex items-center justify-center gap-6 text-center">
                    <div className="relative">
                        <div className={`h-24 w-24 rounded-full flex items-center justify-center text-3xl font-bold ${scoreColor} ${scoreBgColor}`}>
                            {summary.score}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Scor</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold">{summary.probability}%</p>
                        <p className="text-xs text-muted-foreground">șanse de închidere</p>
                    </div>
                </div>
                 <div className="flex justify-center gap-2">
                    {summary.tags.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                 </div>
                 <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-3 flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-full">
                            <ThumbsUp className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Next Best Action</p>
                            <p className="font-semibold text-sm">{summary.nextBestAction}</p>
                        </div>
                    </CardContent>
                 </Card>
            </CardContent>
        </Card>
    )
}
