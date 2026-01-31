'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { AiPropertyInsights } from "./AiPropertyInsights";
import {
    BedDouble,
    Bath,
    Ruler,
    Building,
    CalendarDays,
    Layers,
    Thermometer,
    Car,
    Sparkles,
    CheckCircle2,
    Tag,
    HandCoins
} from "lucide-react";

const FeatureItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value?: string | number | null }) => {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted text-primary shrink-0">
                {icon}
            </div>
            <div>
                <p className="font-semibold text-card-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    );
};

interface InfoColumnProps {
    property: Property;
    allProperties: Property[];
    agencyId: string;
}

export function InfoColumn({ property, allProperties, agencyId }: InfoColumnProps) {

    return (
        <div className="space-y-6">
             <AiPropertyInsights property={property} />
             <Card className="rounded-2xl">
                <CardHeader><CardTitle>Caracteristici Esențiale</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <FeatureItem icon={<HandCoins />} label="Tip tranzacție" value={property.transactionType} />
                    <FeatureItem icon={<Building />} label="Tip proprietate" value={property.propertyType} />
                    <FeatureItem icon={<Ruler />} label="Suprafață utilă" value={`${property.squareFootage} mp`} />
                    {property.totalSurface && <FeatureItem icon={<Ruler />} label="Suprafață construită" value={`${property.totalSurface} mp`} />}
                    <FeatureItem icon={<BedDouble />} label="Dormitoare" value={property.bedrooms} />
                    <FeatureItem icon={<Bath />} label="Băi" value={property.bathrooms} />
                    <FeatureItem icon={<CalendarDays />} label="An construcție" value={property.constructionYear} />
                    <FeatureItem icon={<Layers />} label="Etaj" value={property.floor} />
                    <FeatureItem icon={<Sparkles />} label="Stare interior" value={property.interiorState} />
                    <FeatureItem icon={<Tag />} label="Confort" value={property.comfort} />
                    <FeatureItem icon={<Thermometer />} label="Sistem încălzire" value={property.heatingSystem} />
                    <FeatureItem icon={<Car />} label="Parcare" value={property.parking} />
                </CardContent>
            </Card>
            <Card className="rounded-2xl">
                <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
                </CardContent>
            </Card>
            
            {property.amenities && property.amenities.length > 0 && (
                <Card className="rounded-2xl">
                    <CardHeader><CardTitle>Dotări și Facilități</CardTitle></CardHeader>
                    <CardContent>
                        <div className="columns-2 md:columns-3 gap-4 space-y-2">
                            {property.amenities.map(amenity => (
                                <div key={amenity} className="flex items-center gap-2 break-inside-avoid">
                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                    <span className="text-sm">{amenity}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="rounded-2xl">
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
    );
}
