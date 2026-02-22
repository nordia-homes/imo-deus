'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { PublicContactForm } from './PublicContactForm';
import { AiPriceEvaluationDialog } from './AiPriceEvaluationDialog';
import type { Property, UserProfile } from '@/lib/types';
import { useMemo } from 'react';

export function PublicActionsColumn({ property, agentProfile, agencyId }: { property: Property, agentProfile: UserProfile | null, agencyId: string }) {
    
    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

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
        <Card className="rounded-2xl shadow-2xl bg-[#152A47] border-none text-white">
            <CardContent className="p-4 space-y-4">
                {/* Price Section */}
                <div className="text-center p-3 rounded-lg bg-black/20">
                    <span className="text-2xl font-bold text-white">
                        €{property.price.toLocaleString()}
                    </span>
                    {pricePerSqm && (
                        <span className="text-base font-medium text-white/70">
                            (€{pricePerSqm}/m²)
                        </span>
                    )}
                </div>

                {/* AI Evaluation */}
                <AiPriceEvaluationDialog property={property} />
                
                <Separator className="bg-white/20" />

                {/* Agent Section */}
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-14 w-14">
                            <AvatarImage src={agentProfile?.photoUrl || undefined} alt={agentProfile?.name || 'Agent'} />
                            <AvatarFallback className="text-xl bg-white/20">{getInitials(agentProfile?.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-lg font-semibold">{agentProfile?.name || 'Contactează-ne'}</p>
                            <p className="text-sm text-white/70">Agent Imobiliar</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       {agentProfile?.phone && (
                            <>
                             <Button variant="outline" asChild className="bg-white/10 hover:bg-white/20 border-white/20">
                                <a href={`tel:${agentProfile.phone}`}>
                                <Phone className="mr-2 h-4 w-4" /> Apelează
                                </a>
                             </Button>
                             <Button variant="outline" asChild className="bg-white/10 hover:bg-white/20 border-white/20">
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer">
                                <WhatsappIcon className="mr-2 h-4 w-4" /> WhatsApp
                                </a>
                             </Button>
                            </>
                       )}
                    </div>
                </div>
                
                <Separator className="bg-white/20" />

                {/* Contact Form Section */}
                <PublicContactForm propertyId={property.id} agencyId={agencyId} />

            </CardContent>
        </Card>
    );
}
