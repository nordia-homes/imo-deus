
'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Viewing } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';
import { Calendar } from 'lucide-react';

export function ScheduledViewingsCard({ viewings }: { viewings: Viewing[] }) {
    
    // Show only scheduled viewings
    const scheduledViewings = viewings
        .filter(v => v.status === 'scheduled')
        .sort((a, b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());

    return (
        <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
            <CardHeader className="p-4 pb-2 lg:p-6 lg:pb-4">
                 <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Calendar className="h-5 w-5" />
                    <span>Vizionări Programate</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 lg:p-6 lg:pt-0">
                {scheduledViewings.length > 0 ? (
                    scheduledViewings.map(viewing => (
                        <Link href={`/properties/${viewing.propertyId}`} key={viewing.id} className="block p-3 rounded-lg border border-white/20 hover:bg-white/10">
                            <p className="font-semibold text-sm truncate">{viewing.propertyTitle}</p>
                            <p className="text-xs text-white/80 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(viewing.viewingDate), "d MMM yyyy, HH:mm", { locale: ro })}
                            </p>
                        </Link>
                    ))
                ) : (
                    <p className="text-sm text-white/70 text-center py-2">
                        Nicio vizionare programată.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

    
