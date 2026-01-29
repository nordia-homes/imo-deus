'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

type ChartData = {
    name: string;
    'Actual': number;
    'AI Projected': number;
};

export function SalesAnalyticsChart({ data, isLoading }: { data: ChartData[], isLoading: boolean }) {

    if (isLoading) {
        return (
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                    <Skeleton className="flex-1 h-[250px] w-full" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                 <div>
                    <CardTitle>Analiza Veniturilor</CardTitle>
                    <CardDescription>Ultimele 30 de zile</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground p-4 text-center">Graficul este temporar indisponibil din motive de compatibilitate. Se lucrează la o soluție.</p>
            </CardContent>
        </Card>
    );
}
