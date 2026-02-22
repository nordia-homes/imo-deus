'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { PublicContactForm } from "./PublicContactForm";
import type { Property, UserProfile } from "@/lib/types";
import { Separator } from "../ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Mail, Phone } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/WhatsappIcon";


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

// This is the new component for displaying price inside the card
const PriceDisplay = ({ price, pricePerSqm }: { price: number, pricePerSqm: string | null }) => (
     <div className="text-center">
        <p className="text-4xl font-bold text-foreground">
            €{price.toLocaleString()}
        </p>
        {pricePerSqm && (
            <p className="text-sm font-medium text-muted-foreground">
                (€{pricePerSqm}/m²)
            </p>
        )}
    </div>
);

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nealocat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };
    const sanitizedPhone = sanitizeForWhatsapp(agentForCard.phone);

    const pricePerSqm = property.price && property.squareFootage 
        ? (property.price / property.squareFootage).toFixed(0) 
        : null;

    return (
        // The sticky positioning and negative margin for the overlap effect
        <div className="lg:sticky lg:top-24 lg:-mt-32 z-10">
            <Card className="shadow-2xl rounded-2xl bg-background/80 backdrop-blur-md border">
                <CardHeader className="p-4 space-y-4">
                    <PriceDisplay price={property.price} pricePerSqm={pricePerSqm} />
                    
                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                                <AvatarImage src={agentForCard.avatarUrl || undefined} alt={agentForCard.name || 'Agent'}/>
                                <AvatarFallback>{getInitials(agentForCard.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-xs text-muted-foreground">Agentul tău</p>
                                <p className="font-semibold text-lg leading-tight">{agentForCard.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center">
                            {agentForCard.phone && (
                                <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                                    <a href={`tel:${agentForCard.phone}`} aria-label="Call agent">
                                        <Phone className="h-5 w-5" />
                                    </a>
                                </Button>
                            )}
                            {sanitizedPhone && (
                                <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                                    <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message agent on WhatsApp">
                                        <WhatsappIcon className="h-5 w-5" />
                                    </a>
                                </Button>
                            )}
                            {agentForCard.email && (
                                <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                                    <a href={`mailto:${agentForCard.email}`} aria-label="Email agent">
                                        <Mail className="h-5 w-5" />
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <Separator className="mb-4" />
                    <div className="text-center">
                        <CardTitle>Programează o Vizionare</CardTitle>
                        <CardDescription className="mt-1">Un agent te va contacta în curând.</CardDescription>
                    </div>
                    <div className="mt-4">
                        <PublicContactForm propertyId={property.id} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
