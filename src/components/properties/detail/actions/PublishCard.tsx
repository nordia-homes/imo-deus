'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/lib/types";
import { useState } from "react";
import { updateDocumentNonBlocking, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAgency } from "@/context/AgencyContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Logo components
const ImobiliareLogo = () => (
    <svg viewBox="0 0 130 20" className="h-4 w-auto" preserveAspectRatio="xMinYMid meet">
        <text x="0" y="15" fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight="bold" fill="#0078d4">imobiliare</text>
        <text x="98" y="15" fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight="bold" fill="#333">.ro</text>
    </svg>
);

const StoriaLogo = () => (
    <svg viewBox="0 0 100 20" className="h-4 w-auto" preserveAspectRatio="xMinYMid meet">
        <text x="0" y="15" fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight="bold" fill="#ff5a00">storia.ro</text>
    </svg>
);

const OlxLogo = () => (
    <svg viewBox="0 0 45 20" className="h-5 w-auto" preserveAspectRatio="xMinYMid meet">
        <text x="0" y="16" fontFamily="Verdana, Arial, sans-serif" fontSize="20" fontWeight="bold">
            <tspan fill="#002f34">ol</tspan><tspan fill="#23e5db">x</tspan>
        </text>
    </svg>
);


const PORTALS = [
    { id: 'imobiliare', name: 'Imobiliare.ro', logo: <ImobiliareLogo /> },
    { id: 'storia', name: 'Storia.ro', logo: <StoriaLogo /> },
    { id: 'olx', name: 'OLX.ro', logo: <OlxLogo /> },
];

export function PublishCard({ property }: { property: Property }) {
    const { toast } = useToast();
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const handlePublishToggle = (portalId: string, isChecked: boolean) => {
        if (!agencyId) return;

        const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
        const currentPromotions = property.promotions || {};
        
        let updatedPromotions;

        if (isChecked) {
            toast({ title: "Publicare în curs...", description: `Se publică pe ${portalId}...`});
            updatedPromotions = {
                ...currentPromotions,
                [portalId]: { status: 'pending', lastSync: new Date().toISOString() }
            };
            updateDocumentNonBlocking(propertyRef, { promotions: updatedPromotions });

            setTimeout(() => {
                const finalPromotions = {
                    ...updatedPromotions,
                    [portalId]: { status: 'published', lastSync: new Date().toISOString(), link: '#' }
                };
                updateDocumentNonBlocking(propertyRef, { promotions: finalPromotions });
                toast({ title: "Publicat cu succes!", description: `Proprietatea este acum live pe ${portalId}.`});
            }, 1500);

        } else {
             toast({ title: "Retragere...", description: `Se retrage de pe ${portalId}.`});
             const { [portalId]: _, ...rest } = currentPromotions;
             updatedPromotions = rest;
             updateDocumentNonBlocking(propertyRef, { promotions: updatedPromotions });
        }
    };

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Promovare One-Click</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {PORTALS.map(portal => {
                    const promotion = property.promotions?.[portal.id];
                    const isPublished = promotion?.status === 'published';
                    const isPending = promotion?.status === 'pending';
                    
                    return (
                        <div key={portal.id} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted/50">
                             <Label htmlFor={`portal-${portal.id}`} className="font-medium flex-1 cursor-pointer flex items-center gap-3">
                                {portal.logo}
                             </Label>
                            <div className="flex items-center gap-2">
                               {isPublished && <span className="text-xs text-green-600 font-semibold">Publicat</span>}
                               {isPending && <span className="text-xs text-yellow-600 font-semibold">În curs...</span>}
                                <Checkbox
                                    id={`portal-${portal.id}`}
                                    checked={isPublished || isPending}
                                    disabled={isPending}
                                    onCheckedChange={(checked) => handlePublishToggle(portal.id, !!checked)}
                                />
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
