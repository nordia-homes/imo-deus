'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Viewing } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';
import { Calendar } from 'lucide-react';

export function ScheduledViewingsCard({ viewings }: { viewings: Viewing[] }) {
    
    // Show only scheduled viewings that are in the future
    const upcomingViewings = viewings
        .filter(v => v.status === 'scheduled' && parseISO(v.viewingDate) >= new Date())
        .sort((a, b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());

    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="text-base">Vizionări Programate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {upcomingViewings.length > 0 ? (
                    upcomingViewings.map(viewing => (
                        <Link href={`/properties/${viewing.propertyId}`} key={viewing.id} className="block p-2 rounded-md border hover:bg-accent">
                            <p className="font-semibold text-sm truncate">{viewing.propertyTitle}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(viewing.viewingDate), "d MMM yyyy, HH:mm", { locale: ro })}
                            </p>
                        </Link>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                        Nicio vizionare programată.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
