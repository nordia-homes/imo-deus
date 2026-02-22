'use client';

import type { Property, UserProfile } from "@/lib/types";
import { Card, CardHeader, CardContent, CardTitle } from "../ui/card";
import { AgentCard } from "../properties/detail/actions/AgentCard";
import { PublicContactForm } from "./PublicContactForm";
import { useAgency } from "@/context/PublicAgencyContext";

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = useAgency();

    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nespecificat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };

    return (
        <div className="lg:sticky lg:top-24 lg:z-30">
            <Card className="bg-slate-900/60 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/10">
                 <CardHeader className="text-center p-4">
                    <CardTitle className="text-2xl font-bold">€{property.price.toLocaleString()}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <AgentCard agent={agentForCard} isMobile={false} />
                    {agencyId && <PublicContactForm agencyId={agencyId} propertyId={property.id} />}
                </CardContent>
            </Card>
        </div>
    );
}
