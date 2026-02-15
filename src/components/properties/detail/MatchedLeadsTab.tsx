
'use client';

import { useMemo } from 'react';
import type { Property, Contact } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';


interface MatchedLeadsTabProps {
    property: Property;
    allContacts: Contact[];
}

export function MatchedLeadsTab({ property, allContacts }: MatchedLeadsTabProps) {

    const matchedCumparatori = useMemo(() => {
        if (!allContacts || allContacts.length === 0) {
            return [];
        }

        return allContacts.filter(contact => {
            // Exclude already won or lost leads
            if (contact.status === 'Câștigat' || contact.status === 'Pierdut') {
                return false;
            }

            let score = 0;

            // Budget match
            const contactBudget = contact.budget || 0;
            if (contactBudget > 0) {
                const lowerBound = contactBudget * 0.8;
                const upperBound = contactBudget * 1.5; // More flexible upper bound
                if (property.price >= lowerBound && property.price <= upperBound) {
                    score += 50;
                }
            }

            // Room match
            const contactRooms = contact.preferences?.desiredRooms || 0;
            if (contactRooms > 0) {
                if (property.rooms === contactRooms) {
                    score += 30;
                } else if (Math.abs(property.rooms - contactRooms) === 1) {
                    score += 15;
                }
            }
            
            // Location match
            const contactCity = contact.city?.toLowerCase();
            const propertyCity = property.location.split(',')[0]?.trim().toLowerCase();
            if (contactCity && propertyCity && propertyCity.includes(contactCity)) {
                score += 20;
            }

            // Zone match
            if (contact.zones && contact.zones.length > 0) {
                const propertyLocationLower = property.location.toLowerCase();
                if (contact.zones.some(zone => propertyLocationLower.includes(zone.toLowerCase()))) {
                    score += 25;
                }
            }


            return score > 40; // Only show leads with a decent match score
        }).sort((a, b) => (b.leadScore || 0) - (a.leadScore || 0)); // Sort by existing AI score

    }, [property, allContacts]);

    if (matchedCumparatori.length === 0) {
        return (
            <div className="text-center py-10 lg:text-white/70">
                <p className="text-muted-foreground lg:text-white/70">Nu au fost găsiți cumpărători compatibili cu această proprietate.</p>
            </div>
        )
    }

    return (
        <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:bg-transparent lg:shadow-none lg:border-none">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="lg:border-white/10">
                            <TableHead className="lg:text-white/80">Nume Client</TableHead>
                            <TableHead className="lg:text-white/80">Buget</TableHead>
                            <TableHead className="lg:text-white/80">Status</TableHead>
                            <TableHead className="lg:text-white/80">Agent</TableHead>
                            <TableHead className="text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {matchedCumparatori.map(lead => (
                            <TableRow key={lead.id} className="lg:border-white/10">
                                <TableCell className="font-medium">{lead.name}</TableCell>
                                <TableCell>€{lead.budget?.toLocaleString()}</TableCell>
                                <TableCell><Badge variant="outline" className="lg:bg-white/10 lg:border-none">{lead.status}</Badge></TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {lead.agentName ? (
                                            <>
                                                <User className="h-4 w-4 text-muted-foreground lg:text-white/70" />
                                                <span className="text-sm">{lead.agentName}</span>
                                            </>
                                        ) : (
                                            <span className="text-sm text-muted-foreground lg:text-white/70">Nealocat</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="ghost" size="sm">
                                        <Link href={`/leads/${lead.id}`}>
                                            Vezi Cumpărător
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
