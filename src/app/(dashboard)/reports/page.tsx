import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Rapoarte</h1>
                <p className="text-muted-foreground">
                    Analizează performanța anunțurilor și a agenților.
                </p>
            </div>
            <Card className="flex items-center justify-center h-96">
                <CardHeader className="text-center">
                    <CardTitle>Modulul de Rapoarte</CardTitle>
                    <CardDescription>Această secțiune este în construcție.</CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}
