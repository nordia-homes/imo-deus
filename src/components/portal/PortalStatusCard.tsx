
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';


interface PortalStatusCardProps {
    name: string;
    connected: boolean;
    lastSync: string;
    listings: number;
    leads: number;
    errors: number;
}
export default function PortalStatusCard({ name, connected, lastSync, listings, leads, errors }: PortalStatusCardProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>{name}</CardTitle>
                    {connected ? (
                        <span className="flex items-center text-sm text-green-600"><CheckCircle2 className="h-4 w-4 mr-1" /> Conectat</span>
                    ) : (
                        <span className="flex items-center text-sm text-red-600"><XCircle className="h-4 w-4 mr-1" /> Deconectat</span>
                    )}
                </div>
                 <CardDescription>Ultima sincronizare: {lastSync}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Anunțuri sincronizate:</span>
                    <span className="font-medium">{listings}</span>
                </div>
                 <div className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Lead-uri primite:</span>
                    <span className="font-medium">{leads}</span>
                </div>
                {errors > 0 && (
                     <div className="text-sm flex justify-between text-destructive">
                        <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Erori la sincronizare:</span>
                        <span className="font-medium">{errors}</span>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button variant="outline" className="w-full">
                    {connected ? 'Vezi Setări' : 'Conectează'}
                </Button>
            </CardFooter>
        </Card>
    )
}
