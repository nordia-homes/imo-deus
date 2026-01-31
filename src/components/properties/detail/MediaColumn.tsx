'use client';
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import type { Property } from "@/lib/types";

export function MediaColumn({ property }: { property: Property }) {
    const propertyImages = (property.images || []).map(img => img.url).filter(Boolean);
    const allImages = propertyImages.length > 0 ? propertyImages : ['https://placehold.co/1200x800?text=Imagine+lipsa'];
    
    return (
        <div className="space-y-6">
            <PropertyGallery images={allImages} title={property.title || 'Proprietate'} />
        </div>
    );
}
