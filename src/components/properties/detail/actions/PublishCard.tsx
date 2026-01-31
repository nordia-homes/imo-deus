'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/lib/types";
import { useState } from "react";
import { updateDocumentNonBlocking, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAgency } from "@/context/AgencyContext";

const PORTALS = [
    { id: 'imobiliare', name: 'Imobiliare.ro' },
    { id: 'storia', name: 'Storia.ro' },
    { id: 'olx', name: 'OLX.ro' },
];

export function PublishCard({ property }: { property: Property }) {
    const { toast } = useToast();
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const handlePublish = (portalId: string) => {
        if (!agencyId) return;

        toast({ title: "Publicare în curs...", description: `Se publică pe ${portalId}...`});

        const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
        const currentPromotions = property.promotions || {};

        // Simulate publishing
        const updatedPromotions = {
            ...currentPromotions,
            [portalId]: { status: 'pending', lastSync: new Date().toISOString() }
        };
        updateDocumentNonBlocking(propertyRef, { promotions: updatedPromotions });

        // Simulate success after a delay
        setTimeout(() => {
            const finalPromotions = {
                ...updatedPromotions,
                [portalId]: { status: 'published', lastSync: new Date().toISOString(), link: '#' }
            };
            updateDocumentNonBlocking(propertyRef, { promotions: finalPromotions });
            toast({ title: "Publicat cu succes!", description: `Proprietatea este acum live pe ${portalId}.`});
        }, 1500);
    };

    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <CardTitle className="text-base font-semibold">Publicare One-Click</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {PORTALS.map(portal => {
                    const promotion = property.promotions?.[portal.id];
                    const isPublished = promotion?.status === 'published';
                    const isPending = promotion?.status === 'pending';
                    
                    return (
                        <div key={portal.id} className="flex items-center justify-between text-sm">
                            <p className="font-medium">{portal.name}</p>
                            <button
                                className="text-primary hover:underline text-xs font-semibold disabled:text-muted-foreground disabled:no-underline"
                                disabled={isPublished || isPending}
                                onClick={() => handlePublish(portal.id)}
                            >
                                {isPublished ? "Publicat" : isPending ? "În așteptare..." : "Selectat"}
                            </button>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
