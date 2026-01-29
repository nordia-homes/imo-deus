import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PropertyDetailPage({ params }: { params: { propertyId: string }}) {

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Detalii Proprietate: {params.propertyId}</h1>
                <p className="text-muted-foreground">
                    Vezi toate detaliile, contractele și analizele pentru această proprietate.
                </p>
            </div>
             <Card className="flex items-center justify-center h-96">
                <CardHeader className="text-center">
                    <CardTitle>Pagină de Detalii Proprietate</CardTitle>
                    <CardDescription>Această secțiune este în construcție.</CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
}
