'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";
import type { Property, Contact } from "@/lib/types";
import Link from 'next/link';
import { useMemo } from 'react';
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PotentialBuyersCardProps {
    property: Property;
    allContacts: Contact[];
}

export function PotentialBuyersCard({ property, allContacts }: PotentialBuyersCardProps) {
    const isMobile = useIsMobile();
    const matchedBuyers = useMemo(() => {
        if (!allContacts || allContacts.length === 0) {
            return [];
        }

        return allContacts.filter(contact => {
            if (contact.status === 'Câștigat' || contact.status === 'Pierdut') {
                return false;
            }

            let score = 0;
            const contactBudget = contact.budget || 0;
            if (contactBudget > 0) {
                const lowerBound = contactBudget * 0.8;
                const upperBound = contactBudget * 1.5;
                if (property.price >= lowerBound && property.price <= upperBound) {
                    score += 50;
                }
            }

            const contactRooms = contact.preferences?.desiredRooms || 0;
            if (contactRooms > 0) {
                if (property.rooms === contactRooms) {
                    score += 30;
                } else if (Math.abs(property.rooms - contactRooms) === 1) {
                    score += 15;
                }
            }
            
            const contactCity = contact.city?.toLowerCase();
            const propertyCity = property.location.split(',')[0]?.trim().toLowerCase();
            if (contactCity && propertyCity && propertyCity.includes(contactCity)) {
                score += 20;
            }

            if (contact.zones && contact.zones.length > 0) {
                const propertyLocationLower = property.location.toLowerCase();
                if (contact.zones.some(zone => propertyLocationLower.includes(zone.toLowerCase()))) {
                    score += 25;
                }
            }
            return score > 40;
        }).sort((a, b) => (b.leadScore || 0) - (a.leadScore || 0));
    }, [property, allContacts]);

    return (
        <Card className={cn(
            "rounded-2xl shadow-2xl",
            isMobile ? "bg-[#152A47] text-white border-none" : "bg-[#f8f8f9]"
        )}>
            <CardHeader className="px-3 pt-3 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cumpărători Potriviți ({matchedBuyers.length})
                </CardTitle>
                <Button asChild variant="link" size="sm" className={cn("text-primary text-xs px-0", isMobile && "text-white")}>
                    <Link href="/leads" aria-label="Vezi toți cumpărătorii">
                        Vezi toți
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
                 {matchedBuyers.length > 0 ? (
                    <div className="space-y-2">
                        {matchedBuyers.slice(0, 3).map(lead => (
                            <Link key={lead.id} href={`/leads/${lead.id}`} className={cn("flex items-center justify-between p-2 rounded-lg border hover:bg-accent group", isMobile ? "border-white/10 hover:bg-white/20" : "border-border")}>
                                <div>
                                    <p className="font-semibold text-sm group-hover:text-primary">{lead.name}</p>
                                    <p className={cn("text-xs", isMobile ? "text-white/70" : "text-muted-foreground")}>Buget: €{lead.budget?.toLocaleString()}</p>
                                </div>
                                <ArrowRight className={cn("h-4 w-4 group-hover:translate-x-1 transition-transform", isMobile ? "text-white/70" : "text-muted-foreground")} />
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className={cn("text-sm text-center py-4", isMobile ? "text-white/70" : "text-muted-foreground")}>Niciun cumpărător potrivit.</p>
                )}
            </CardContent>
        </Card>
    );
}
