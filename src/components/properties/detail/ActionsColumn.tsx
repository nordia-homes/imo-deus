'use client';

import type { Property, Viewing, UserProfile, Contact } from "@/lib/types";
import { PriceStatusCard } from "./actions/PriceStatusCard";
import { AgentCard } from "./actions/AgentCard";
import { PublishCard } from "./actions/PublishCard";
import { CmaCard } from "./actions/CmaCard";
import { WebsiteToggleCard } from "./actions/WebsiteToggleCard";
import { ScheduledViewingsCard } from "./actions/ScheduledViewingsCard";
import { FacebookPromotionCard } from "./actions/FacebookPromotionCard";
import { PotentialBuyersCard } from "./actions/PotentialBuyersCard";
import { PropertyNotesCard } from "./actions/PropertyNotesCard";
import { SocialMediaCard } from "./actions/SocialMediaCard";
import { OwnerCard } from "./actions/OwnerCard";

export function ActionsColumn({ property, allProperties, viewings, agentProfile, allContacts }: { property: Property, allProperties: Property[], viewings: Viewing[], agentProfile: UserProfile | null, allContacts: Contact[] }) {
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nealocat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };
    
    return (
        <div className="space-y-4 sticky top-28">
            <PriceStatusCard property={property} />
            <AgentCard agent={agentForCard} />
            <OwnerCard property={property} />
            <ScheduledViewingsCard viewings={viewings} />
            <PotentialBuyersCard property={property} allContacts={allContacts} />
            <CmaCard property={property} allProperties={allProperties} />
            <PublishCard property={property} />
            <FacebookPromotionCard />
            <SocialMediaCard property={property} />
            <WebsiteToggleCard property={property} />
            <PropertyNotesCard property={property} />
        </div>
    );
}
