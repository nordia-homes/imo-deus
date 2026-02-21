'use client';
import type { Property, UserProfile } from "@/lib/types";
import { AgentCard } from "@/components/properties/detail/actions/AgentCard";
import { PriceStatusCard } from "@/components/properties/detail/actions/PriceStatusCard";
import { PublicViewingForm } from "./PublicViewingForm";
import { usePublicAgency } from "@/context/PublicAgencyContext";

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Agent dedicat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };
    
    return (
        <div className="space-y-4 sticky top-28">
            <PriceStatusCard property={property} />
            <AgentCard agent={agentForCard} />
            {agencyId && <PublicViewingForm propertyId={property.id} agencyId={agencyId} />}
        </div>
    );
}
