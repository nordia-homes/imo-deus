'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Star, TrendingUp } from "lucide-react";
import type { Property, UserProfile } from "@/lib/types";
import { PublicContactForm } from "../PublicContactForm";
import Image from "next/image";
import { usePublicAgency } from "@/context/PublicAgencyContext";
import { AiPriceEvaluationDialog } from "./AiPriceEvaluationDialog";

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nespecificat",
        email: agentProfile?.email || "N/A",
        phone: agentProfile?.phone || "N/A",
        photoUrl: agentProfile?.photoUrl || 'https://i.pravatar.cc/150?u=agent',
        rating: 4.9, // Placeholder
        reviews: 120, // Placeholder
        deals: 34, // Placeholder
    };

    const pricePerSqm = property.squareFootage > 0 ? (property.price / property.squareFootage).toFixed(0) : 'N/A';

    return (
        <Card className="sticky top-28 shadow-2xl rounded-2xl bg-slate-900/40 border border-cyan-400/20 backdrop-blur-lg glow-card text-white">
            <CardContent className="p-6 space-y-6">
                {/* Price Section */}
                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <span className="text-4xl font-bold">€{property.price.toLocaleString()}</span>
                        <span className="text-sm font-medium text-slate-300">€{pricePerSqm} / m²</span>
                    </div>
                    <div className="flex justify-end items-center text-sm">
                        <AiPriceEvaluationDialog property={property}>
                            <Button variant="link" className="p-0 h-auto text-cyan-400 font-semibold hover:text-cyan-300">
                                <TrendingUp className="h-4 w-4 mr-2" />
                                Evalueaza pretul cu ImoDeus.ai
                            </Button>
                        </AiPriceEvaluationDialog>
                    </div>
                </div>

                <Separator className="bg-cyan-400/20" />

                {/* Agent Info Section */}
                <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16">
                        <Image src={agentForCard.photoUrl} alt={agentForCard.name} fill className="rounded-full object-cover" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-lg">{agentForCard.name}</p>
                        <div className="flex items-center gap-1.5 text-sm text-yellow-400">
                            <Star className="h-4 w-4 fill-yellow-400" />
                            <span className="font-bold">{agentForCard.rating}</span>
                            <span className="text-slate-400">({agentForCard.reviews} recenzii)</span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg bg-cyan-900/30 p-2">
                        <p className="text-xl font-bold">{agentForCard.deals}</p>
                        <p className="text-xs text-cyan-300">Tranzacții</p>
                    </div>
                     <div className="rounded-lg bg-cyan-900/30 p-2">
                        <p className="text-xl font-bold">5 ani</p>
                        <p className="text-xs text-cyan-300">Experiență</p>
                    </div>
                </div>

                 <Separator className="bg-cyan-400/20" />

                {/* Contact Form Section */}
                <div>
                     <h3 className="font-semibold text-lg text-center mb-4">Programează o vizionare</h3>
                     {agencyId && <PublicContactForm agencyId={agencyId} propertyId={property.id} />}
                </div>
            </CardContent>
        </Card>
    );
}
