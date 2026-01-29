
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MapPage() {
    return (
        <div className="space-y-6 h-full flex flex-col">
            <div>
                <h1 className="text-3xl font-headline font-bold">Hartă Agregată</h1>
                <p className="text-muted-foreground">
                    Vezi toate proprietățile tale și ale competitorilor într-un singur loc.
                </p>
            </div>
            <Card className="flex-1">
                <CardContent className="p-0 h-full">
                    <div className="h-full bg-gray-200 rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">
                            Placeholder pentru harta agregată (iframe sau componentă de hartă).
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
