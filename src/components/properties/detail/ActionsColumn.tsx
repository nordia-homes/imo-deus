'use client';

import type { MatchedBuyer, Property, Viewing, UserProfile } from "@/lib/types";
import { PriceStatusCard } from "./actions/PriceStatusCard";
import { AgentCard } from "./actions/AgentCard";
import { PublishCard } from "./actions/PublishCard";
import { WebsiteToggleCard } from "./actions/WebsiteToggleCard";
import { FacebookPromotionCard } from "./actions/FacebookPromotionCard";
import { FacebookGroupPromotionLauncherCard } from "./actions/FacebookGroupPromotionLauncherCard";
import { SocialMediaCard } from "./actions/SocialMediaCard";
import { OwnerCard } from "./actions/OwnerCard";
import { MetaAdsCard } from "./actions/MetaAdsCard";

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
            <MetaAdsCard property={property} />
            <FacebookGroupPromotionLauncherCard property={property} />
            <FacebookPromotionCard />
            <SocialMediaCard property={property} />
            <WebsiteToggleCard property={property} />
        </div>
    );
}
