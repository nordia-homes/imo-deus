'use client';

import type { Property } from "@/lib/types";
import { PriceStatusCard } from "./actions/PriceStatusCard";
import { AgentCard } from "./actions/AgentCard";
import { PublishCard } from "./actions/PublishCard";
import { CmaCard } from "./actions/CmaCard";
import { WebsiteToggleCard } from "./actions/WebsiteToggleCard";
import { useUser } from "@/firebase";

export function ActionsColumn({ property }: { property: Property }) {
    const { user } = useUser();

    // Use property agent if available, fallback to current user
    const agentForCard = property.agent ? {
        name: property.agent.name,
        email: 'agent@email.com', // Placeholder
        phone: '0744545454', // Placeholder
        avatarUrl: property.agent.avatarUrl,
    } : {
        name: user?.displayName || "Agent Nespecificat",
        email: user?.email,
        phone: user?.phoneNumber,
        avatarUrl: user?.photoURL
    };
    
    return (
        <div className="space-y-4 sticky top-28">
            <PriceStatusCard property={property} />
            <AgentCard agent={agentForCard} />
            <PublishCard property={property} />
            <CmaCard property={property} />
            <WebsiteToggleCard property={property} />
        </div>
    );
}
