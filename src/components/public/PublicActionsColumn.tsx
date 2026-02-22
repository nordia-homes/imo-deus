'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Phone, Star, TrendingUp } from "lucide-react";
import type { Property, UserProfile } from "@/lib/types";
import { PublicContactForm } from "../public/PublicContactForm";
import Image from "next/image";
import { usePublicAgency } from "@/context/PublicAgencyContext";
import { AiPriceEvaluationDialog } from "./AiPriceEvaluationDialog";
import { useMemo } from 'react';
import { WhatsappIcon } from "../icons/WhatsappIcon";


export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nespecificat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl,
    };
    
    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    const sanitizeForWhatsapp = (phone?: string | null) => {
        if (!phone) return '';
        let sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 && sanitized.startsWith('07')) {
            return `40${sanitized.substring(1)}`;
        }
        return sanitized;
    };
    const sanitizedPhone = sanitizeForWhatsapp(agentForCard.phone);

    return (
        <Card className="sticky top-24 shadow-2xl rounded-2xl bg-slate-900/50 border border-cyan-300/20 text-white backdrop-blur-md glow-card">
            <CardContent className="p-4 space-y-4">
                {/* Price section */}
                <div className="text-center">
                    <p className="text-3xl font-bold">€{property.price.toLocaleString()} <span className="text-base font-normal text-cyan-200/80">({pricePerSqm ? `€${pricePerSqm}/m²` : ''})</span></p>
                    <AiPriceEvaluationDialog property={property} allProperties={[]} />
                </div>
                
                <Separator className="my-4 bg-cyan-300/20" />

                {/* Agent Section */}
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Image
                            src={agentForCard.avatarUrl || 'https://i.pravatar.cc/150'}
                            alt={agentForCard.name || 'Agent'}
                            width={48}
                            height={48}
                            className="rounded-full border-2 border-cyan-400/50"
                        />
                        <div className="flex-1">
                             <p className="text-sm text-cyan-200/80">Agentul tău dedicat</p>
                            <p className="font-bold text-white">{agentForCard.name}</p>
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-2">
                        {agentForCard.phone && (
                            <Button asChild className="bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 border border-cyan-400/20">
                                <a href={`tel:${agentForCard.phone}`}>
                                    <Phone className="mr-2 h-4 w-4" />
                                    Apelează
                                </a>
                            </Button>
                        )}
                        {sanitizedPhone && (
                            <Button asChild className="bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 border border-cyan-400/20">
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer">
                                    <WhatsappIcon className="mr-2 h-4 w-4" />
                                    WhatsApp
                                </a>
                            </Button>
                        )}
                    </div>
                </div>

                <Separator className="my-4 bg-cyan-300/20" />

                {/* Contact Form Section */}
                <div>
                     <PublicContactForm agencyId={agencyId!} propertyId={property.id} />
                </div>
            </CardContent>
        </Card>
    )
}
