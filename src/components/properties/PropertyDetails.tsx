
'use client';
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

export function PropertyDetails({ property }: { property: any }) {
    const [showExactLocation, setShowExactLocation] = useState(true);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">{property.title}</h1>
                <p className="text-xl text-muted-foreground">{property.location}</p>
                <p className="text-3xl font-bold text-primary mt-2">€{property.price.toLocaleString()}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Caracteristici</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Suprafață</p>
                        <p className="font-semibold">{property.surface} mp</p>
                    </div>
                     <div>
                        <p className="text-sm text-muted-foreground">Camere</p>
                        <p className="font-semibold">{property.rooms}</p>
                    </div>
                     <div>
                        <p className="text-sm text-muted-foreground">Etaj</p>
                        <p className="font-semibold">{property.floor}</p>
                    </div>
                     <div>
                        <p className="text-sm text-muted-foreground">An construcție</p>
                        <p className="font-semibold">{property.year}</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Descriere</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Agent Responsabil</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="font-semibold">{property.agent.name}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Hartă</CardTitle>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="location-toggle">Arată locația exactă</Label>
                        <Switch id="location-toggle" checked={showExactLocation} onCheckedChange={setShowExactLocation} />
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="aspect-video bg-gray-200 rounded-md flex items-center justify-center">
                        <p className="text-muted-foreground">
                            {showExactLocation ? `Placeholder hartă (iframe) pentru ${property.latitude}, ${property.longitude}` : 'Placeholder hartă (iframe) pentru locație aproximativă'}
                        </p>
                     </div>
                </CardContent>
            </Card>
        </div>
    )
}
