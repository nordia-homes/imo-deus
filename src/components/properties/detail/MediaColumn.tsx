'use client';
import type { Property } from "@/lib/types";
import { PropertyGallery } from "./PropertyGallery";
import { VideoTourCard } from "./actions/VideoTourCard";
import { PresentationPdfButton } from "./actions/PresentationPdfButton";

export function MediaColumn({
    property,
    showMatchPrompt = false,
    showVideoTour = true,
    shareUrl,
    shareImageUrl,
    showMobileActions = false,
}: {
    property: Property;
    showMatchPrompt?: boolean;
    showVideoTour?: boolean;
    shareUrl?: string;
    shareImageUrl?: string;
    showMobileActions?: boolean;
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
                pdfAction={showMobileActions ? <PresentationPdfButton property={property} /> : null}
                ownerListingUrl={showMobileActions ? property.ownerListingUrl : undefined}
                videoAction={showVideoTour ? <VideoTourCard property={property} triggerVariant="gallery-button" /> : null}
                uploadedVideoUrl={property.uploadedVideo?.url}
                uploadedVideoName={property.uploadedVideo?.fileName}
             />
        </div>
    );
}
