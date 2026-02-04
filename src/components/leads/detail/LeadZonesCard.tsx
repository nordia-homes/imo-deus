'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Contact } from '@/lib/types';
import { MapPin } from 'lucide-react';

export function LeadZonesCard({ contact }: { contact: Contact }) {
    if (!contact.zones || contact.zones.length === 0) {
        return null;
    }

    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="text-base">Zone Preferate</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
                {contact.zones.map(zone => (
                    <Button 
                        key={zone} 
                        variant="outline" 
                        className="pointer-events-none cursor-default border-primary w-full justify-start text-left h-auto"
                    >
                        <MapPin className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{zone}</span>
                    </Button>
                ))}
            </CardContent>
        </Card>
    );
}
