'use client';

import { Card, CardContent } from "@/components/ui/card";
import { PublicContactForm } from "./PublicContactForm";
import type { Property, UserProfile } from "@/lib/types";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Mail, Phone } from "lucide-react";
import { WhatsappIcon } from "../icons/WhatsappIcon";
import { Separator } from "../ui/separator";
import { usePublicAgency } from "@/context/PublicAgencyContext";

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nespecificat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };

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
    const sanitizedPhone = sanitizeForWhatsapp(agentForCard.phone);

    return (
        <Card className="sticky top-28 shadow-2xl rounded-2xl p-0 bg-gray-900/50 text-white backdrop-blur-lg border border-white/20">
            <CardContent className="p-6 space-y-6">
                
                {/* Price Section */}
                <div>
                    <p className="text-sm text-white/70">Preț</p>
                    <p className="text-4xl font-bold text-white">€{property.price.toLocaleString()}</p>
                </div>

                <Separator className="bg-white/20"/>
                
                {/* Agent Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={agentForCard.avatarUrl || undefined} alt={agentForCard.name || 'Agent'}/>
                            <AvatarFallback className="text-2xl bg-white/20">{getInitials(agentForCard.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                             <p className="font-semibold text-lg text-white">{agentForCard.name}</p>
                             <p className="text-sm text-white/70">Agent Imobiliar</p>
                        </div>
                    </div>
                     <div className="grid grid-cols-3 gap-2">
                        {agentForCard.phone && (
                            <Button variant="ghost" className="flex-1 hover:bg-white/10" asChild>
                                <a href={`tel:${agentForCard.phone}`} aria-label="Call agent">
                                    <Phone className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                         {sanitizedPhone && (
                            <Button variant="ghost" className="flex-1 hover:bg-white/10" asChild>
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message agent on WhatsApp">
                                    <WhatsappIcon className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                        {agentForCard.email && (
                            <Button variant="ghost" className="flex-1 hover:bg-white/10" asChild>
                                <a href={`mailto:${agentForCard.email}`} aria-label="Email agent">
                                    <Mail className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                    </div>
                </div>

                <Separator className="bg-white/20"/>
                
                {/* Contact Form Section */}
                <div>
                     <p className="text-lg font-semibold mb-4 text-white">Programează o vizionare</p>
                     <PublicContactForm propertyId={property.id} agencyId={agencyId || undefined} />
                </div>
            </CardContent>
        </Card>
    );
}
