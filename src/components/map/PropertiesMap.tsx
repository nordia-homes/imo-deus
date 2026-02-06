'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from '@/lib/types';
import { PropertyMarker } from './PropertyMarker';

// Function to convert lat/lon to a percentage-based x/y position
const getPosition = (
    lat: number,
    lon: number,
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number
) => {
    const y = ((lat - minLat) / (maxLat - minLat)) * 100;
    const x = ((lon - minLon) / (maxLon - minLon)) * 100;
    // We invert y because screen coordinates start from top-left
    return { x, y: 100 - y };
};

export function PropertiesMap({ properties }: { properties: Property[] }) {

    const validProperties = useMemo(() => {
        return properties.filter(p => p.latitude != null && p.longitude != null);
    }, [properties]);

    const bounds = useMemo(() => {
        if (validProperties.length === 0) {
            // Default to Bucharest area if no properties
            return {
                minLat: 44.40,
                maxLat: 44.47,
                minLon: 26.05,
                maxLon: 26.15,
            };
        }

        const latitudes = validProperties.map(p => p.latitude!);
        const longitudes = validProperties.map(p => p.longitude!);

        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLon = Math.min(...longitudes);
        const maxLon = Math.max(...longitudes);
        
        // Add some padding to the bounds
        const latPadding = (maxLat - minLat) * 0.1 || 0.01;
        const lonPadding = (maxLon - minLon) * 0.1 || 0.01;

        return {
            minLat: minLat - latPadding,
            maxLat: maxLat + latPadding,
            minLon: minLon - lonPadding,
            maxLon: maxLon + lonPadding,
        };
    }, [validProperties]);

    if (properties.length === 0) {
        return (
             <Card className="flex-1 shadow-2xl rounded-2xl">
                <CardContent className="p-0 h-full">
                    <div className="h-full bg-gray-200 rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">
                            Adaugă proprietăți cu latitudine și longitudine pentru a le vedea pe hartă.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="flex-1 shadow-2xl rounded-2xl">
            <CardContent className="p-0 h-full">
                <div className="relative h-full w-full bg-muted rounded-lg overflow-hidden">
                    {/* Placeholder map background */}
                     <Image
                        src="https://picsum.photos/seed/map/1600/900"
                        alt="Map background"
                        fill
                        className="object-cover opacity-20"
                        priority
                     />

                    {validProperties.map(property => {
                        const { x, y } = getPosition(
                            property.latitude!,
                            property.longitude!,
                            bounds.minLat,
                            bounds.maxLat,
                            bounds.minLon,
                            bounds.maxLon
                        );

                        if (isNaN(x) || isNaN(y)) return null;

                        return (
                            <PropertyMarker
                                key={property.id}
                                property={property}
                                style={{
                                    left: `${x}%`,
                                    top: `${y}%`,
                                }}
                            />
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
