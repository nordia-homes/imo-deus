'use client';

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from '@/lib/types';

export function PropertiesMap({
    properties,
    zoomMode = 'default',
}: {
    properties: Property[];
    zoomMode?: 'default' | 'close';
}) {

    const validProperties = useMemo(() => {
        return properties.filter(p => p.latitude != null && p.longitude != null);
    }, [properties]);

    const bounds = useMemo(() => {
        if (validProperties.length === 0) {
            // Default to Bucharest area if no properties
            return {
                minLat: 44.3,
                maxLat: 44.6,
                minLon: 25.8,
                maxLon: 26.4,
            };
        }

        const latitudes = validProperties.map(p => p.latitude!);
        const longitudes = validProperties.map(p => p.longitude!);

        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLon = Math.min(...longitudes);
        const maxLon = Math.max(...longitudes);
        
        // Use tighter bounds when we want a closer zoom around a single property.
        const paddingFactor = zoomMode === 'close' ? 0.04 : 0.1;
        const minimumPadding = zoomMode === 'close' ? 0.0025 : 0.01;
        const latPadding = (maxLat - minLat) * paddingFactor || minimumPadding;
        const lonPadding = (maxLon - minLon) * paddingFactor || minimumPadding;

        return {
            minLat: minLat - latPadding,
            maxLat: maxLat + latPadding,
            minLon: minLon - lonPadding,
            maxLon: maxLon + lonPadding,
        };
    }, [validProperties, zoomMode]);

    const mapEmbedUrl = useMemo(() => {
        const { minLon, minLat, maxLon, maxLat } = bounds;
        const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
        const markers = validProperties
            .map(p => `marker=${p.latitude},${p.longitude}`)
            .join('&');
        
        const markerString = markers ? `&${markers}` : '';

        return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${markerString}`;
    }, [bounds, validProperties]);

    return (
        <Card className="h-full shadow-2xl rounded-2xl bg-[#152A47] text-white border-none">
            <CardContent className="p-0 h-full">
                <iframe
                    className="h-full w-full border-0 rounded-2xl"
                    loading="lazy"
                    allowFullScreen
                    title="Proprietăți pe hartă"
                    src={mapEmbedUrl}
                ></iframe>
            </CardContent>
        </Card>
    );
}
