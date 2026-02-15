'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
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
    const matchedBuyersCount = useMemo(() => {
        if (!allContacts || allContacts.length === 0) {
            return 0;
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
        }).length;

    }, [property, allContacts]);

    return (
        <Card className={cn(
            "rounded-2xl shadow-2xl p-0 h-12 flex items-center",
            isMobile ? "bg-[#152A47] text-white border-none" : "bg-[#f8f8f9]"
        )}>
            <CardContent className="p-2 flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Cumpărători Potențiali:</span>
                    <span className="font-bold text-base">{matchedBuyersCount}</span>
                </div>
                <Button asChild variant="link" size="sm" className={cn("text-primary text-xs px-2", isMobile && "text-white")}>
                    <Link href="/leads" aria-label="Vezi toți cumpărătorii">
                        Vezi tot
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
