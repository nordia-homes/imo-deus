'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, TrendingUp } from "lucide-react";
import type { Property, UserProfile } from "@/lib/types";
import { PublicContactForm } from "./PublicContactForm";
import Image from "next/image";
import { usePublicAgency } from "@/context/PublicAgencyContext";
import { AiPriceEvaluationDialog } from "./AiPriceEvaluationDialog";
import { useMemo } from 'react';


export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    const getInitials = (name?: string | null) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    return (
        <div className="sticky top-28">
            <Card className="bg-slate-900/40 text-white border border-cyan-400/20 shadow-2xl shadow-cyan-500/10 backdrop-blur-lg glow-card">
                <CardContent className="p-6 space-y-6">
                    {/* Price section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-baseline">
                            <p className="text-4xl font-bold">€{property.price.toLocaleString()}</p>
                            {pricePerSqm && (
                                <p className="text-base text-white/70">€{pricePerSqm}/m²</p>
                            )}
                        </div>
                        <AiPriceEvaluationDialog property={property} />
                    </div>

                    <Separator className="bg-cyan-400/20" />

                    {/* Agent section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                             <Avatar className="h-16 w-16 border-2 border-white/50">
                                <AvatarImage src={agentProfile?.photoUrl || undefined} />
                                <AvatarFallback className="text-2xl bg-white/10">{getInitials(agentProfile?.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-bold text-lg">{agentProfile?.name || 'Agent Indisponibil'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="border-cyan-400/50 bg-cyan-900/30 text-cyan-300">
                                        <Star className="mr-1 h-3 w-3" /> 4.9
                                    </Badge>
                                    <p className="text-xs text-white/60">34 Recenzii</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="bg-white/10 rounded-lg p-2">
                                <p className="text-lg font-bold">54</p>
                                <p className="text-xs text-white/60">Vânzări</p>
                            </div>
                             <div className="bg-white/10 rounded-lg p-2">
                                <p className="text-lg font-bold">7</p>
                                <p className="text-xs text-white/60">ani exp.</p>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-cyan-400/20" />

                    {/* Contact Form */}
                    <div className="space-y-4">
                         <h3 className="text-lg font-semibold text-center">Programează o vizionare</h3>
                         {agencyId && <PublicContactForm agencyId={agencyId} propertyId={property.id} />}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}