'use client';
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Separator } from "../ui/separator";
import { Star, TrendingUp, Phone, Mail } from "lucide-react";
import type { Property, UserProfile } from "@/lib/types";
import { PublicContactForm } from "./PublicContactForm";
import Image from "next/image";
import { usePublicAgency } from "@/context/PublicAgencyContext";
import { AiPriceEvaluationDialog } from "./AiPriceEvaluationDialog";
import { WhatsappIcon } from "../icons/WhatsappIcon";

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const pricePerSqm = property.price && property.squareFootage
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
        <Card className="glow-card bg-slate-900/60 backdrop-blur-xl border-cyan-400/20 text-white shadow-2xl shadow-cyan-500/10 rounded-2xl">
            <CardContent className="p-6 space-y-6">
                {/* Price Section */}
                <div>
                     <p className="text-3xl font-bold">
                        €{property.price.toLocaleString()}
                        {pricePerSqm && <span className="text-base font-normal text-slate-400 ml-2">({`€${pricePerSqm}/mp`})</span>}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                        <AiPriceEvaluationDialog property={property} />
                    </div>
                </div>

                <Separator className="bg-cyan-400/20" />
                
                {/* Agent Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-cyan-400/50">
                            <AvatarImage src={agentProfile?.photoUrl || undefined} alt={agentProfile?.name ?? 'Agent'} />
                            <AvatarFallback className="bg-slate-700 text-slate-300">{getInitials(agentProfile?.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold text-lg">{agentProfile?.name || 'Agent Imobiliar'}</p>
                            <p className="text-sm text-slate-400">Agent Imobiliar</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <Button variant="outline" className="bg-slate-800/50 border-slate-700 hover:bg-slate-800" asChild disabled={!agentProfile?.phone}>
                            <a href={`tel:${agentProfile?.phone}`}>
                                <Phone className="mr-2 h-4 w-4" /> Apel
                            </a>
                        </Button>
                         <Button variant="outline" className="bg-slate-800/50 border-slate-700 hover:bg-slate-800" asChild disabled={!sanitizedPhone}>
                             <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer">
                                <WhatsappIcon className="mr-2 h-4 w-4" /> WhatsApp
                            </a>
                        </Button>
                    </div>
                </div>

                <Separator className="bg-cyan-400/20" />
                
                {/* Contact Form Section */}
                <div>
                    <p className="font-semibold text-center mb-4">Programează o vizionare</p>
                    {agencyId && <PublicContactForm agencyId={agencyId} propertyId={property.id} />}
                </div>

            </CardContent>
        </Card>
    );
}
