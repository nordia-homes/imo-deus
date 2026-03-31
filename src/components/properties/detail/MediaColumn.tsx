'use client';
import type { Property } from "@/lib/types";
import { PropertyGallery } from "./PropertyGallery";
import { cn } from "@/lib/utils";

export function MediaColumn({
    property,
    showMatchPrompt = false,
    shareUrl,
    shareImageUrl,
}: {
    property: Property;
    showMatchPrompt?: boolean;
    shareUrl?: string;
    shareImageUrl?: string;
}) {
    const propertyImages = (property.images || []).map(img => img.url).filter(Boolean);
    
    return (
        <div className="space-y-6 md:px-3 lg:px-0">
             <PropertyGallery images={propertyImages} title={property.title} propertyId={property.id} showMatchPrompt={showMatchPrompt} shareUrl={shareUrl} shareImageUrl={shareImageUrl} />
        </div>
    );
}
