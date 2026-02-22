'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/WhatsappIcon";
import type { Property } from "@/lib/types";
import { Avatar, AvatarFallback } from "../../../ui/avatar";
import { cn } from "@/lib/utils";

export function OwnerCard({ property, isMobile }: { property: Property, isMobile?: boolean }) {
    const ownerName = property.ownerName;
    const ownerPhone = property.ownerPhone;

    const sanitizeForWhatsapp = (phone?: string | null) => {
        if (!phone) return '';
        let sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 && sanitized.startsWith('07')) {
            return `40${sanitized.substring(1)}`;
        }
        return sanitized;
    };
    const sanitizedPhone = sanitizeForWhatsapp(ownerPhone);

    const getInitials = (name?: string | null) => {
        if (!name) return 'P'; // P for Proprietar
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    if (!ownerName && !ownerPhone) {
        return null;
    }

    const cardClassName = isMobile
        ? "bg-white/10 text-white border-none rounded-lg"
        : "rounded-2xl shadow-2xl p-0 flex items-center bg-[#f8f8f9] lg:bg-[#152A47] lg:border-none lg:text-white";
    
    const contentClassName = isMobile ? "p-3" : "p-2";

    return (
        <Card className={cardClassName}>
            <CardContent className={cn(contentClassName, "w-full")}>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <Avatar className="h-8 w-8">
                            <AvatarFallback className={cn("bg-muted", isMobile && "bg-white/20")}>{getInitials(ownerName)}</AvatarFallback>
                        </Avatar>
                        <div>
                             <p className={cn("text-xs", isMobile ? "text-white/70" : "text-muted-foreground lg:text-white/70")}>Proprietar:</p>
                             <p className="font-semibold text-sm leading-tight">{ownerName || 'Nespecificat'}</p>
                             {ownerPhone && <p className={cn("text-xs", isMobile ? "text-white/70" : "text-white/70")}>{ownerPhone}</p>}
                        </div>
                    </div>

                    <div className="flex items-center">
                        {ownerPhone && (
                            <Button variant="ghost" size="icon" className={cn("h-8 w-8", isMobile ? "text-white/80" : "lg:text-white/80")} asChild>
                                <a href={`tel:${ownerPhone}`} aria-label="Call owner">
                                    <Phone className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                         {sanitizedPhone && (
                            <Button variant="ghost" size="icon" className={cn("h-8 w-8", isMobile ? "text-white/80" : "lg:text-white/80")} asChild>
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message owner on WhatsApp">
                                    <WhatsappIcon className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
