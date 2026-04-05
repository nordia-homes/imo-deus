
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/lib/types";
import { updateDocumentNonBlocking, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAgency } from "@/context/AgencyContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ACTION_CARD_CLASSNAME, ACTION_CARD_INNER_CLASSNAME } from "./cardStyles";

// Logo components
const ImobiliareLogo = () => (
    <svg viewBox="0 0 130 20" className="h-4 w-auto" preserveAspectRatio="xMinYMid meet">
        <text x="0" y="15" fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight="bold" fill="#0078d4">imobiliare</text>
        <text x="98" y="15" fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight="bold" fill="white">.ro</text>
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
            <tspan fill="#FFF">ol</tspan><tspan fill="#23e5db">x</tspan>
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
    const isMobile = useIsMobile();

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
        <Card className={cn(
            ACTION_CARD_CLASSNAME
        )}>
            <CardHeader className={cn(isMobile ? "px-4 pb-0 pt-4" : "px-4 pb-0 pt-4")}>
                <CardTitle className={cn(isMobile ? "text-base font-semibold text-white" : "text-base font-semibold text-white")}>
                    Promovare One-Click
                </CardTitle>
            </CardHeader>
            <CardContent className={cn("space-y-2 pt-0", isMobile ? "p-4" : "p-4")}>
                <div className="grid grid-cols-[minmax(0,1fr)_140px_52px] items-center gap-4 border-b border-white/8 px-1 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
                    <span>Portal</span>
                    <span className="justify-self-start pl-4">Status</span>
                    <span className="text-right">Actiune</span>
                </div>
                {PORTALS.map(portal => {
                    const promotion = property.promotions?.[portal.id];
                    const isPublished = promotion?.status === 'published';
                    const isPending = promotion?.status === 'pending';
                    
                    return (
                        <div
                            key={portal.id}
                            className={cn(
                                "grid grid-cols-[minmax(0,1fr)_140px_52px] gap-4 rounded-xl p-3 text-sm hover:bg-white/[0.06]",
                                ACTION_CARD_INNER_CLASSNAME
                            )}
                        >
                             <Label htmlFor={`portal-${portal.id}`} className="font-medium flex-1 cursor-pointer flex items-center gap-2 min-w-0">
                                {portal.logo}
                             </Label>
                            <div className="flex items-center justify-center">
                               {isPublished && (
                                    <span className="rounded-full border border-emerald-300/16 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                                        Publicat
                                    </span>
                                )}
                               {isPending && (
                                    <span className="rounded-full border border-yellow-300/18 bg-yellow-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-200">
                                        În curs...
                                    </span>
                                )}
                                {!isPublished && !isPending ? (
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55">
                                        Nepublicat
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex justify-end">
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
