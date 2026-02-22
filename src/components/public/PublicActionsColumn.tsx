'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, Phone, Mail } from "lucide-react";
import type { Property, UserProfile } from "@/lib/types";
import { PublicContactForm } from "./PublicContactForm";
import Image from "next/image";
import { usePublicAgency } from "@/context/PublicAgencyContext";
import { AiPriceEvaluationDialog } from "./AiPriceEvaluationDialog";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { WhatsappIcon } from "../icons/WhatsappIcon";

export function PublicActionsColumn({ property, agentProfile, agencyId }: { property: Property, agentProfile: UserProfile | null, agencyId: string }) {
    const [isPriceEvalOpen, setIsPriceEvalOpen] = useState(false);

    const pricePerSqm = (property.price && property.squareFootage)
        ? (property.price / property.squareFootage).toFixed(0)
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
    const sanitizedPhone = sanitizeForWhatsapp(agentProfile?.phone);

    return (
        <>
            <Card className="shadow-2xl rounded-2xl p-6 bg-black/30 border border-cyan-300/20 text-white backdrop-blur-xl glow-card space-y-6">
                
                {/* Price Section */}
                <div>
                    <p className="text-3xl font-bold">
                        €{property.price.toLocaleString()}
                        {pricePerSqm && <span className="text-lg font-normal text-white/70 ml-2">(€{pricePerSqm}/m²)</span>}
                    </p>
                    <Button variant="ghost" className="p-0 h-auto text-cyan-300 hover:text-cyan-200 mt-2" onClick={() => setIsPriceEvalOpen(true)}>
                        <TrendingUp className="mr-2 h-4 w-4"/>
                        Evalueaza pretul cu ImoDeus.ai
                    </Button>
                </div>
                
                {/* Agent Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-white/50">
                            <AvatarImage src={agentProfile?.photoUrl || undefined} alt={agentProfile?.name || 'Agent'} />
                            <AvatarFallback className="text-2xl bg-white/20">{getInitials(agentProfile?.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold text-lg">{agentProfile?.name || 'Agent Imobiliar'}</p>
                            <p className="text-sm text-white/80">Agent Imobiliar</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" asChild className="bg-white/10 hover:bg-white/20 border-white/20" disabled={!agentProfile?.phone}>
                            <a href={`tel:${agentProfile?.phone}`}>
                                <Phone className="mr-2"/>
                                Apelează
                            </a>
                        </Button>
                        <Button variant="outline" asChild className="bg-white/10 hover:bg-white/20 border-white/20" disabled={!sanitizedPhone}>
                            <a href={`https://wa.me/${sanitizedPhone}`} target="_blank">
                                <WhatsappIcon className="mr-2" />
                                WhatsApp
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Contact Form Section */}
                <div>
                    <p className="font-semibold text-center mb-4">Programează o Vizionare</p>
                    <PublicContactForm propertyId={property.id} agencyId={agencyId} />
                </div>

            </Card>

            <AiPriceEvaluationDialog 
                property={property}
                isOpen={isPriceEvalOpen}
                onOpenChange={setIsPriceEvalOpen}
            />
        </>
    );
}