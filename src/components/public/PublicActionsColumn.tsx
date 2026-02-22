'use client';
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Mail, Phone, Star, TrendingUp } from "lucide-react";
import type { Property, UserProfile } from "@/lib/types";
import { PublicContactForm } from "./PublicContactForm";
import Image from "next/image";
import { usePublicAgency } from "@/context/PublicAgencyContext";
import { AiPriceEvaluationDialog } from "./AiPriceEvaluationDialog";
import { WhatsappIcon } from "../icons/WhatsappIcon";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {

    const { agency } = usePublicAgency();

    const pricePerSqm = (property.price / property.squareFootage).toFixed(0);

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
        <Card className="sticky top-24 bg-slate-900/80 backdrop-blur-lg border-cyan-400/20 text-white shadow-2xl shadow-cyan-500/10 glow-card">
            <CardHeader>
                <div className="flex items-baseline gap-2">
                    <CardTitle className="text-4xl font-bold">€{property.price.toLocaleString()}</CardTitle>
                    {pricePerSqm && <CardDescription className="text-slate-300 -mb-1">(€{pricePerSqm}/m²)</CardDescription>}
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <AiPriceEvaluationDialog property={property} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Agent Section */}
                    <div className="border-t border-cyan-400/20 pt-4">
                         <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={agentProfile?.photoUrl || undefined} alt={agentProfile?.name || 'Agent'} />
                                <AvatarFallback className="text-xl bg-slate-700">{getInitials(agentProfile?.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-bold text-white text-lg">{agentProfile?.name || 'Agent Imobiliar'}</p>
                                <p className="text-sm text-slate-300">Agent Imobiliar</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <Button variant="outline" asChild className="bg-white/10 border-white/20 text-white hover:bg-white/20" disabled={!agentProfile?.phone}>
                                <a href={`tel:${agentProfile?.phone}`}>
                                    <Phone className="mr-2" /> Apelează
                                </a>
                            </Button>
                            <Button asChild className="bg-[#25D366] hover:bg-[#25D366]/90 text-white" disabled={!sanitizedPhone}>
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer">
                                    <WhatsappIcon className="mr-2" /> WhatsApp
                                </a>
                            </Button>
                        </div>
                    </div>

                    {/* Contact Form Section */}
                    <div className="border-t border-cyan-400/20 pt-4">
                        <PublicContactForm propertyId={property.id} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
