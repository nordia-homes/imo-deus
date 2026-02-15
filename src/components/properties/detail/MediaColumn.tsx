'use client';
import type { Property } from "@/lib/types";
import { PropertyGallery } from "./PropertyGallery";

export function MediaColumn({ property }: { property: Property }) {
    const propertyImages = (property.images || []).map(img => img.url).filter(Boolean);
    
    return (
        <div className="space-y-6">
             <PropertyGallery images={propertyImages} title={property.title} propertyId={property.id} />
        </div>
    );
}
