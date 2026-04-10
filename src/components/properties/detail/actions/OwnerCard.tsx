'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/WhatsappIcon";
import type { Property } from "@/lib/types";
import { Avatar, AvatarFallback } from "../../../ui/avatar";
import { cn } from "@/lib/utils";
import { ACTION_CARD_CLASSNAME, ACTION_PILL_CLASSNAME } from "./cardStyles";

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
        : `${ACTION_CARD_CLASSNAME} p-0`;
    
    const contentClassName = isMobile ? "p-3" : "p-2";

    return (
        <Card className={cardClassName}>
            <CardContent className={cn(contentClassName, "w-full")}>
                 <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                         <Avatar className="h-11 w-11">
                            <AvatarFallback className={cn("bg-muted", !isMobile && "bg-[#1a2a40] text-sky-100", isMobile && "bg-white/20")}>{getInitials(ownerName)}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                             <p className={cn("text-[11px] uppercase tracking-[0.18em]", isMobile ? "text-white/70" : "text-sky-100/62")}>Proprietar</p>
                             <p className="font-semibold text-sm leading-tight text-white">{ownerName || 'Nespecificat'}</p>
                             {ownerPhone && <p className={cn("text-sm", isMobile ? "text-white/70" : "text-white/60")}>{ownerPhone}</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {ownerPhone && (
                            <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-full", isMobile ? "text-white/80" : `${ACTION_PILL_CLASSNAME} lg:text-white`)} asChild>
                                <a href={`tel:${ownerPhone}`} aria-label="Call owner">
                                    <Phone className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                         {sanitizedPhone && (
                            <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-full", isMobile ? "text-white/80" : `${ACTION_PILL_CLASSNAME} lg:text-white`)} asChild>
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
