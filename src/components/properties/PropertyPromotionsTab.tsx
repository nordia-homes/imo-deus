
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Rocket, CheckCircle, Clock, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Property, PromotionStatus } from '@/lib/types';
import Link from 'next/link';
import { useAgency } from "@/context/AgencyContext";

// Define the portals available for promotion
const PORTALS = [
    { id: 'imobiliare', name: 'Imobiliare.ro' },
    { id: 'storia', name: 'Storia.ro' },
    { id: 'olx', name: 'OLX.ro' },
];

export function PropertyPromotionsTab({ property }: { property: Property }) {
    const { toast } = useToast();
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const [selectedPortals, setSelectedPortals] = useState<string[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);

    const getStatusIcon = (status: PromotionStatus['status']) => {
        switch (status) {
            case 'published': return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'pending': return <Clock className="h-5 w-5 text-yellow-500 animate-spin" />;
            case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
            default: return <div className="h-5 w-5" />; // Placeholder for 'unpublished'
        }
    };
    
    const getStatusText = (status: PromotionStatus['status']) => {
        switch (status) {
            case 'published': return 'Publicat';
            case 'pending': return 'În așteptare';
            case 'error': return 'Eroare';
            default: return 'Nepublicat';
        }
    };

    const handleCheckboxChange = (portalId: string, checked: boolean) => {
        if (checked) {
            setSelectedPortals(prev => [...prev, portalId]);
        } else {
            setSelectedPortals(prev => prev.filter(id => id !== portalId));
        }
    };

    const handlePublish = async () => {
        if (!agencyId || selectedPortals.length === 0) return;

        setIsPublishing(true);
        toast({ title: "Publicare în curs...", description: `Proprietatea se publică pe ${selectedPortals.length} portal(uri).` });

        const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
        
        const updatedPromotions = { ...property.promotions };

        selectedPortals.forEach(portalId => {
            updatedPromotions[portalId] = {
                ...updatedPromotions[portalId],
                status: 'pending',
                lastSync: new Date().toISOString(),
            };
        });

        updateDocumentNonBlocking(propertyRef, { promotions: updatedPromotions });

        setTimeout(() => {
            const finalPromotions = { ...updatedPromotions };
            selectedPortals.forEach(portalId => {
                const portalName = PORTALS.find(p => p.id === portalId)?.name || portalId;
                finalPromotions[portalId] = {
                    ...finalPromotions[portalId],
                    status: 'published',
                    link: `https://www.${portalId}.ro/anunt/${property.id}`, // mock link
                    views: 0
                };
            });
            updateDocumentNonBlocking(propertyRef, { promotions: finalPromotions });
            setIsPublishing(false);
            setSelectedPortals([]);
            toast({
                title: "Publicare finalizată!",
                description: "Proprietatea a fost publicată cu succes.",
            });
        }, 2000);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Promovare One-Click</CardTitle>
                    <CardDescription>Publică proprietatea pe multiple portaluri simultan.</CardDescription>
                </div>
                 <Button onClick={handlePublish} disabled={isPublishing || selectedPortals.length === 0}>
                    {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                    Publică pe portalurile selectate ({selectedPortals.length})
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {PORTALS.map(portal => {
                    const promotion = property.promotions?.[portal.id];
                    const status = promotion?.status || 'unpublished';
                    const isChecked = selectedPortals.includes(portal.id) && status === 'unpublished';

                    return (
                        <div key={portal.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                                <Checkbox 
                                    id={portal.id} 
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handleCheckboxChange(portal.id, !!checked)}
                                    disabled={status !== 'unpublished' || isPublishing}
                                />
                                <Label htmlFor={portal.id} className="text-lg font-medium">{portal.name}</Label>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                                <div className="flex items-center gap-2 min-w-[120px]" title={`Status: ${status}`}>
                                    {getStatusIcon(status)}
                                    <span className="capitalize">{getStatusText(status)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Vizualizări: </span>
                                    <span className="font-semibold">{promotion?.views ?? '-'}</span>
                                </div>
                                 <div>
                                    <span className="text-muted-foreground">Ultima publicare: </span>
                                    <span className="font-semibold">{promotion?.lastSync ? new Date(promotion.lastSync).toLocaleDateString('ro-RO') : '-'}</span>
                                </div>
                                 <Button asChild variant="ghost" size="icon" disabled={!promotion?.link} title="Vezi anunțul">
                                     {promotion?.link ? (
                                        <Link href={promotion.link} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-4 w-4" />
                                        </Link>
                                     ) : (
                                        <div className="h-10 w-10 flex items-center justify-center">
                                            <ExternalLink className="h-4 w-4 text-muted-foreground/50" />
                                        </div>
                                     )}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
