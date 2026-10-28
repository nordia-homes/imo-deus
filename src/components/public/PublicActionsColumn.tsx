'use client';
import type { Property, UserProfile } from "@/lib/types";
import { PublicPriceStatusCard as PriceStatusCard } from "./PublicPriceStatusCard";
import { AgentCard } from "../properties/detail/actions/AgentCard";
import { OwnerCard } from "../properties/detail/actions/OwnerCard";
import { PublicContactForm } from "./PublicContactForm";

export function PublicActionsColumn({ property, agentProfile, agencyId, isMobile }: { property: Property, agentProfile: UserProfile | null, agencyId: string, isMobile?: boolean }) {
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nealocat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };
    
    if (isMobile) {
        return (
            <div className="space-y-4">
                <AgentCard agent={agentForCard} isMobile={true} />
                <OwnerCard property={property} isMobile={true} />
                <PublicContactForm propertyId={property.id} agencyId={agencyId} />
            </div>
        )
    }

    return (
        <div className="space-y-4 sticky top-28">
            <PriceStatusCard property={property} />
            <AgentCard agent={agentForCard} />
            <OwnerCard property={property} />
            <PublicContactForm propertyId={property.id} agencyId={agencyId} />
        </div>
    );
}
