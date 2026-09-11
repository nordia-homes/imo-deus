'use client';

import type { MatchedBuyer, Property, Viewing, UserProfile } from "@/lib/types";
import { PriceStatusCard } from "./actions/PriceStatusCard";
import { AgentCard } from "./actions/AgentCard";
import { PublishCard } from "./actions/PublishCard";
import { FacebookPromotionCard } from "./actions/FacebookPromotionCard";
import { SocialMediaCard } from "./actions/SocialMediaCard";
import { OwnerCard } from "./actions/OwnerCard";
import { MetaAdsCard } from "./actions/MetaAdsCard";
import { FacebookCloudPublishingCard } from "./actions/FacebookCloudPublishingCard";
import { TikTokAdsCard } from "./actions/TikTokAdsCard";

export function ActionsColumn({ property, allProperties, viewings, agentProfile, matchedBuyers }: { property: Property, allProperties: Property[], viewings: Viewing[], agentProfile: UserProfile | null, matchedBuyers: MatchedBuyer[] }) {
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nealocat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };
    
    return (
        <div className="space-y-4 sticky top-28">
            <PriceStatusCard property={property} variant="admin" />
            <AgentCard agent={agentForCard} />
            <OwnerCard property={property} />
            <PublishCard property={property} />
            <FacebookCloudPublishingCard property={property} />
            <MetaAdsCard property={property} />
            <SocialMediaCard property={property} />
            <TikTokAdsCard property={property} />
            <FacebookPromotionCard />
        </div>
    );
}
