'use client';

import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Phone } from "lucide-react";
import { WhatsappIcon } from "../icons/WhatsappIcon";
import { Star, TrendingUp } from "lucide-react";
import type { Property, UserProfile } from "@/lib/types";
import { PublicContactForm } from "../public/PublicContactForm";
import Image from "next/image";
import { usePublicAgency } from "@/context/PublicAgencyContext";
import { AiPriceEvaluationDialog } from "./AiPriceEvaluationDialog";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";


export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const pricePerSqm = property.price && property.squareFootage
        ? `(${(property.price / property.squareFootage).toFixed(0)} €/m²)`
        : null;

    const getInitials = (name?: string | null) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    const sanitizeForWhatsapp = (phone?: string | null) => {
        if (!phone) return '';
        let sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 && sanitized.startsWith('07')) {
            return `40${sanitized.substring(1)}`;
        }
        return sanitized;
    };
    
    const agentName = agentProfile?.name || property.agentName || "Nespecificat";
    const agentAvatarUrl = agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`;
    const agentPhone = agentProfile?.phone || null;
    const sanitizedWhatsappPhone = sanitizeForWhatsapp(agentPhone);

    return (
        <Card className="rounded-2xl shadow-2xl bg-slate-900/40 border border-cyan-400/20 backdrop-blur-lg text-white glow-card">
            <CardContent className="p-4 space-y-4">
                <div className="text-center">
                    <p className="text-3xl font-bold">
                        {property.price.toLocaleString()} € {pricePerSqm && <span className="text-base font-normal text-cyan-300">{pricePerSqm}</span>}
                    </p>
                    <div className="flex items-center justify-center gap-4 mt-2">
                        <AiPriceEvaluationDialog property={property} />
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-cyan-400/20">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={agentAvatarUrl || undefined} />
                            <AvatarFallback>{getInitials(agentName)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-lg">{agentName}</p>
                            <p className="text-sm text-cyan-300">Agent Imobiliar</p>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <Button variant="outline" asChild className="border-cyan-400/30 bg-cyan-400/10 hover:bg-cyan-400/20" disabled={!agentPhone}>
                            <a href={`tel:${agentPhone}`}>
                                <Phone className="mr-2" /> Apelează
                            </a>
                        </Button>
                        <Button variant="outline" asChild className="border-cyan-400/30 bg-cyan-400/10 hover:bg-cyan-400/20" disabled={!sanitizedWhatsappPhone}>
                            <a href={`https://wa.me/${sanitizedWhatsappPhone}`} target="_blank" rel="noopener noreferrer">
                                <WhatsappIcon className="mr-2" /> WhatsApp
                            </a>
                        </Button>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-cyan-400/20">
                    <h3 className="font-semibold text-center text-lg mb-3">Programează o vizionare</h3>
                    <PublicContactForm agencyId={agencyId!} propertyId={property.id} />
                </div>
            </CardContent>
        </Card>
    );
}
