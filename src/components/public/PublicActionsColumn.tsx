'use client';

import type { Property, UserProfile } from "@/lib/types";
import { PublicContactForm } from "./PublicContactForm";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useAgency as usePublicAgency } from "@/context/PublicAgencyContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail } from "lucide-react";
import { WhatsappIcon } from "../icons/WhatsappIcon";

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const agent = {
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
    const sanitizedPhone = sanitizeForWhatsapp(agent.phone);
    
    return (
        <div className="sticky top-28 space-y-6">
             <Card className="bg-background shadow-2xl rounded-2xl border">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-bold text-primary">€{property.price.toLocaleString()}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Separator />
                     <div className="flex flex-col items-center gap-2 text-center pt-2">
                        <Avatar className="h-20 w-20 border-2 border-primary">
                            <AvatarImage src={agent.avatarUrl || undefined} alt={agent.name || 'Agent'}/>
                            <AvatarFallback className="text-2xl">{getInitials(agent.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                             <p className="font-semibold">{agent.name}</p>
                             <p className="text-sm text-muted-foreground">Agent imobiliar</p>
                        </div>
                         <div className="flex items-center gap-1">
                            {agent.phone && (
                                <Button variant="outline" size="icon" asChild>
                                    <a href={`tel:${agent.phone}`} aria-label="Call agent">
                                        <Phone className="h-4 w-4" />
                                    </a>
                                </Button>
                            )}
                            {sanitizedPhone && (
                                <Button variant="outline" size="icon" asChild>
                                    <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message agent on WhatsApp">
                                        <WhatsappIcon className="h-4 w-4" />
                                    </a>
                                </Button>
                            )}
                            {agent.email && (
                                <Button variant="outline" size="icon" asChild>
                                    <a href={`mailto:${agent.email}`} aria-label="Email agent">
                                        <Mail className="h-4 w-4" />
                                    </a>
                                </Button>
                            )}
                         </div>
                    </div>
                    <Separator />
                    <PublicContactForm agencyId={agencyId!} propertyId={property.id} />
                </CardContent>
            </Card>
        </div>
    );
}
