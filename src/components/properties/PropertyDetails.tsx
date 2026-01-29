
'use client';
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Separator } from "../ui/separator";

export function PropertyDetails({ property }: { property: any }) {
    const [showExactLocation, setShowExactLocation] = useState(true);

    return (
        <div className="space-y-8">
             <div className="flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-headline font-semibold">Proprietate administrată de {property.agent.name}</h2>
                    <div className="text-muted-foreground flex items-center gap-2">
                        <span>{property.rooms} camere</span>
                        <span>&middot;</span>
                        <span>{property.bathrooms} băi</span>
                        <span>&middot;</span>
                        <span>{property.surface} mp</span>
                    </div>
                </div>
                <Avatar className="h-14 w-14">
                    {/* Placeholder for agent avatar */}
                    <AvatarFallback>{property.agent.name.charAt(0)}</AvatarFallback>
                </Avatar>
             </div>
             
             <Separator />

            <div className="space-y-4">
                 <h3 className="text-xl font-headline font-semibold">Descriere</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
            </div>
            
            <Separator />

            <div className="space-y-4">
                <h3 className="text-xl font-headline font-semibold">Caracteristici</h3>
                <div className="grid grid-cols-2 gap-4 text-muted-foreground">
                    <div className="flex flex-col">
                        <span>Suprafață utilă:</span>
                        <span className="font-bold text-foreground">{property.surface} mp</span>
                    </div>
                     <div className="flex flex-col">
                        <span>An construcție:</span>
                        <span className="font-bold text-foreground">{property.year}</span>
                    </div>
                     <div className="flex flex-col">
                        <span>Etaj:</span>
                        <span className="font-bold text-foreground">{property.floor}</span>
                    </div>
                     <div className="flex flex-col">
                        <span>Confort:</span>
                        <span className="font-bold text-foreground">{property.comfort}</span>
                    </div>
                </div>
            </div>

            <Separator />

            <div>
                <div className="flex flex-row items-center justify-between mb-4">
                    <h3 className="text-xl font-headline font-semibold">Locație pe hartă</h3>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="location-toggle">Arată locația exactă</Label>
                        <Switch id="location-toggle" checked={showExactLocation} onCheckedChange={setShowExactLocation} />
                    </div>
                </div>
                 <div className="aspect-video bg-gray-200 rounded-md flex items-center justify-center">
                    <p className="text-muted-foreground">
                        {showExactLocation ? `Placeholder hartă (iframe) pentru ${property.latitude}, ${property.longitude}` : 'Placeholder hartă (iframe) pentru locație aproximativă'}
                    </p>
                 </div>
            </div>
        </div>
    )
}
