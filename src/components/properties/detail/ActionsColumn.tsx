'use client';

import type { MatchedBuyer, Property, Viewing, UserProfile } from "@/lib/types";
import { PriceStatusCard } from "./actions/PriceStatusCard";
import { AgentCard } from "./actions/AgentCard";
import { PublishCard } from "./actions/PublishCard";
import { SocialMediaCard } from "./actions/SocialMediaCard";
import { OwnerCard } from "./actions/OwnerCard";
import { MetaAdsCard } from "./actions/MetaAdsCard";
import { FacebookCloudPublishingCard } from "./actions/FacebookCloudPublishingCard";
import { TikTokAdsCard } from "./actions/TikTokAdsCard";
import { TikTokOrganicPublishingCard } from "./actions/TikTokOrganicPublishingCard";
import { PropertyAdCostsCard } from "./actions/PropertyAdCostsCard";
import { PropertyPublicStatsCard } from "./actions/PropertyPublicStatsCard";
import { PropertyNotesCard } from "./actions/PropertyNotesCard";

export function ActionsColumn({ property, allProperties, viewings, agentProfile, matchedBuyers }: { property: Property, allProperties: Property[], viewings: Viewing[], agentProfile: UserProfile | null, matchedBuyers: MatchedBuyer[] }) {
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nealocat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };
    
    return (
        <div className="sticky top-28 flex h-full flex-col gap-4">
            <PriceStatusCard property={property} variant="admin" />
            <AgentCard agent={agentForCard} />
            <OwnerCard property={property} />
            <PublishCard property={property} />
            <FacebookCloudPublishingCard property={property} />
            <MetaAdsCard property={property} />
            <SocialMediaCard property={property} />
            <TikTokAdsCard property={property} />
            <TikTokOrganicPublishingCard property={property} />
            <PropertyAdCostsCard property={property} />
            <PropertyPublicStatsCard property={property} />
            <div className="min-h-[220px] flex-1">
                <PropertyNotesCard property={property} fillAvailableHeight />
            </div>
        </div>
    );
}
