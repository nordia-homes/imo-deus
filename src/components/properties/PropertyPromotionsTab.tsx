
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Rocket, CheckCircle, Clock, XCircle, ExternalLink } from "lucide-react";

export function PropertyPromotionsTab({ propertyId }: { propertyId: string }) {
    // Placeholder data
    const portals = [
        { id: 'imobiliare', name: 'Imobiliare.ro', status: 'published', link: 'https://imobiliare.ro/...', views: 125, lastPublish: '28.05.2024' },
        { id: 'storia', name: 'Storia.ro', status: 'pending', link: null, views: 0, lastPublish: '-' },
        { id: 'olx', name: 'OLX.ro', status: 'error', link: null, views: 0, lastPublish: '27.05.2024' },
    ];

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'published': return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
            case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
            default: return null;
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Promovare One-Click</CardTitle>
                    <CardDescription>Publică proprietatea pe multiple portaluri simultan.</CardDescription>
                </div>
                 <Button>
                    <Rocket className="mr-2 h-4 w-4" />
                    Publică pe portalurile selectate
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {portals.map(portal => (
                    <div key={portal.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                            <Checkbox id={portal.id} defaultChecked={portal.status === 'published'} />
                            <Label htmlFor={portal.id} className="text-lg font-medium">{portal.name}</Label>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2" title={`Status: ${portal.status}`}>
                                {getStatusIcon(portal.status)}
                                <span className="capitalize">{portal.status}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Vizualizări: </span>
                                <span className="font-semibold">{portal.views}</span>
                            </div>
                             <div>
                                <span className="text-muted-foreground">Ultima publicare: </span>
                                <span className="font-semibold">{portal.lastPublish}</span>
                            </div>
                             <Button variant="ghost" size="sm" disabled={!portal.link} title="Vezi anunțul">
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
