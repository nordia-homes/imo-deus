'use client';

import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Star, TrendingUp } from "lucide-react";
import type { Property, UserProfile } from "@/lib/types";
import { PublicContactForm } from "@/components/public/PublicContactForm";
import Image from "next/image";
import { usePublicAgency } from "@/context/PublicAgencyContext";
import { AiPriceEvaluationDialog } from "./AiPriceEvaluationDialog";


export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nespecificat",
        photoUrl: agentProfile?.photoUrl,
        rating: 4.8,
        reviews: 32,
        sales: 12,
    };

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    return (
        <Card className="shadow-2xl rounded-2xl bg-slate-900/40 border border-cyan-400/20 backdrop-blur-lg glow-card sticky top-24">
            <CardContent className="p-6">
                <div className="space-y-4">
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-white">€{property.price.toLocaleString()}</p>
                        {pricePerSqm && (
                            <span className="text-sm text-cyan-400 font-medium">(€{pricePerSqm}/m²)</span>
                        )}
                    </div>

                    <AiPriceEvaluationDialog property={property} />

                    <div className="border-t border-cyan-400/20 my-4"></div>

                    <div>
                        <p className="text-sm font-semibold text-white/80 mb-3">Agent Imobiliar</p>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 border-2 border-cyan-400/50">
                                <AvatarImage src={agentForCard.photoUrl || `https://i.pravatar.cc/150?u=${agentForCard.name}`} />
                                <AvatarFallback>{agentForCard.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-bold text-white">{agentForCard.name}</p>
                                <div className="flex items-center gap-1 text-xs text-amber-400">
                                    <Star className="h-3 w-3 fill-amber-400" />
                                    <span>{agentForCard.rating} ({agentForCard.reviews} recenzii)</span>
                                </div>
                                <div className="flex gap-2 mt-1 text-xs text-white/70">
                                    <span>{agentForCard.sales} vânzări</span>
                                    <span>•</span>
                                    <span>Top 5%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-cyan-400/20 my-4"></div>

                    <PublicContactForm propertyId={property.id} agencyId={agencyId!} />

                </div>
            </CardContent>
        </Card>
    );
}
