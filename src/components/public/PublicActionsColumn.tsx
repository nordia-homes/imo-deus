'use client';
import type { Property, UserProfile } from "@/lib/types";
import { PriceStatusCard } from "../properties/detail/actions/PriceStatusCard";
import { AgentCard } from "../properties/detail/actions/AgentCard";
import { OwnerCard } from "../properties/detail/actions/OwnerCard";
import { PublicContactForm } from "./PublicContactForm";
import { AiPriceEvaluationDialog } from "./AiPriceEvaluationDialog";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
            <AiPriceEvaluationDialog trigger={<Button variant="outline" style={{color: '#67e8f9'}} className="w-full glow-card h-12 text-base"><Calculator className="mr-2 h-4 w-4"/>Evalueaza Pretul cu ImoDeus.ai</Button>} />
            <PublicContactForm propertyId={property.id} agencyId={agencyId} />
        </div>
    );
}
