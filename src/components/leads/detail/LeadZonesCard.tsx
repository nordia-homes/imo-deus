'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Contact } from '@/lib/types';
import { MapPin, CheckCircle2 } from 'lucide-react';

export function LeadZonesCard({ contact }: { contact: Contact }) {
    if (!contact.zones || contact.zones.length === 0) {
        return null;
    }

    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="text-base">Zone Preferate</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                {contact.zones.map(zone => (
                    <Button key={zone} variant="outline" size="sm" className="pointer-events-none cursor-default bg-green-50 text-green-800 border-green-200">
                        <MapPin className="mr-2 h-3.5 w-3.5" />
                        {zone}
                        <CheckCircle2 className="ml-2 h-3.5 w-3.5" />
                    </Button>
                ))}
            </CardContent>
        </Card>
    );
}
