'use client';
import { Card, CardContent } from "@/components/ui/card";
import { PublicContactForm } from "./PublicContactForm";
import { usePublicAgency } from "@/context/PublicAgencyContext";
import type { Property, UserProfile } from "@/lib/types";
import { PriceStatusCard } from "../properties/detail/actions/PriceStatusCard";
import { AgentCard } from "../properties/detail/actions/AgentCard";
import { cn } from "@/lib/utils";

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nespecificat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };

    return (
        <div className="sticky top-28 space-y-6">
            <Card className="rounded-2xl shadow-2xl p-0 bg-background/60 dark:bg-[#152A47]/60 backdrop-blur-lg border border-border/20 glow-card">
                 <CardContent className="p-4 space-y-4">
                    <PriceStatusCard property={property} />
                    <AgentCard agent={agentForCard} isMobile={false} />
                    <div className="pt-4">
                        <h3 className="font-bold text-center text-lg mb-2">Programează o Vizionare</h3>
                        {agencyId && <PublicContactForm agencyId={agencyId} propertyId={property.id} />}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
