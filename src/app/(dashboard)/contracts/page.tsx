import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContractsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Contracte</h1>
                <p className="text-muted-foreground">
                    Gestionează, generează și urmărește statusul contractelor.
                </p>
            </div>
             <Card className="flex items-center justify-center h-96">
                <CardHeader className="text-center">
                    <CardTitle>Modulul de Contracte</CardTitle>
                    <CardDescription>Această secțiune este în construcție.</CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}
