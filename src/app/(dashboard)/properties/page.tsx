import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PropertiesPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-headline font-bold">Proprietăți</h1>
                <p className="text-muted-foreground">
                    Gestionează portofoliul tău de proprietăți.
                </p>
            </div>
            <AddPropertyDialog />
        </div>
        <Card className="flex items-center justify-center h-96">
            <CardHeader className="text-center">
                <CardTitle>Listă Proprietăți</CardTitle>
                <CardDescription>Această secțiune este în construcție.</CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
