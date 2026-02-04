'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import type { Property } from "@/lib/types";
import { AiPropertyInsights } from '@/components/properties/detail/AiPropertyInsights';
import { Button } from "@/components/ui/button";


export function InfoColumn({ property }: { property: Property }) {
    return (
        <div className="space-y-6">
            <Card className="rounded-2xl shadow-2xl">
                <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
                </CardContent>
            </Card>

            {property.amenities && property.amenities.length > 0 && (
                <Card className="rounded-2xl shadow-2xl">
                    <CardHeader><CardTitle>Dotări și Facilități</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {property.amenities.map(amenity => (
                                <Button key={amenity} variant="outline" size="sm" className="pointer-events-none cursor-default">
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    {amenity}
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <AiPropertyInsights property={property} />

            <Card className="rounded-2xl shadow-2xl">
                <CardHeader><CardTitle>Locație pe Hartă</CardTitle></CardHeader>
                <CardContent>
                    {(property.latitude && property.longitude) ? (
                        <iframe
                            className="w-full aspect-video rounded-md border"
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps/embed/v1/place?key=&q=${encodeURIComponent(property.address)}`}>
                        </iframe>
                    ) : (
                        <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                            <p className="text-sm text-muted-foreground">Adresa sau coordonatele nu sunt disponibile.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
