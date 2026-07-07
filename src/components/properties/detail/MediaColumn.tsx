'use client';
import type { Property } from "@/lib/types";
import { PropertyGallery } from "./PropertyGallery";
import { VideoTourCard } from "./actions/VideoTourCard";

export function MediaColumn({
    property,
    showMatchPrompt = false,
    showVideoTour = true,
    shareUrl,
    shareImageUrl,
}: {
    property: Property;
    showMatchPrompt?: boolean;
    showVideoTour?: boolean;
    shareUrl?: string;
    shareImageUrl?: string;
}) {
    const propertyImages = (property.images || []).map(img => img.url).filter(Boolean);
    
    return (
        <div className="space-y-6 md:px-3 lg:px-0">
             <PropertyGallery
                images={propertyImages}
                title={property.title}
                propertyId={property.id}
                showMatchPrompt={showMatchPrompt}
                shareUrl={shareUrl}
                shareImageUrl={shareImageUrl}
                videoAction={showVideoTour ? <VideoTourCard property={property} triggerVariant="gallery-button" /> : null}
             />
        </div>
    );
}
