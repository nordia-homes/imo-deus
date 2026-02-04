'use client';

import type { Property, Viewing } from "@/lib/types";
import { PriceStatusCard } from "./actions/PriceStatusCard";
import { AgentCard } from "./actions/AgentCard";
import { PublishCard } from "./actions/PublishCard";
import { CmaCard } from "./actions/CmaCard";
import { WebsiteToggleCard } from "./actions/WebsiteToggleCard";
import { useUser } from "@/firebase";
import { ScheduledViewingsCard } from "./actions/ScheduledViewingsCard";
import { FacebookPromotionCard } from "./actions/FacebookPromotionCard";

export function ActionsColumn({ property, allProperties, viewings }: { property: Property, allProperties: Property[], viewings: Viewing[] }) {
    const { user } = useUser();

    // The user's own profile will be used for the agent card if they are the assigned agent.
    // This is a simplified approach. A more robust solution would be to fetch the agent's profile.
    const isCurrentUserTheAgent = user && property.agentId === user.uid;
    const agentForCard = {
        name: property.agentName || "Nealocat",
        email: isCurrentUserTheAgent ? user.email : null,
        phone: isCurrentUserTheAgent ? user.phoneNumber : null,
        avatarUrl: isCurrentUserTheAgent ? user.photoURL : `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };
    
    return (
        <div className="space-y-4 sticky top-28">
            <PriceStatusCard property={property} />
            <AgentCard agent={agentForCard} />
            <ScheduledViewingsCard viewings={viewings} />
            <FacebookPromotionCard />
            <PublishCard property={property} />
            <CmaCard property={property} allProperties={allProperties} />
            <WebsiteToggleCard property={property} />
        </div>
    );
}
