'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye, Clock } from 'lucide-react';
import type { Viewing } from '@/lib/types';
import { parseISO, format, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function MobileScheduledViewings({ viewings }: { viewings: Viewing[] }) {

  return (
    <Card className="bg-muted/50 shadow-2xl rounded-2xl md:hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Vizionări Programate</CardTitle>
        <Link href="/viewings" className="text-sm text-primary hover:underline">
          Vezi tot
        </Link>
      </CardHeader>
      <CardContent>
        {viewings.length === 0 ? (
           <p className="text-muted-foreground text-center py-4">Nicio vizionare programată.</p>
        ) : (
            <div className="space-y-4">
                {viewings.map(viewing => (
                    <Link href={`/properties/${viewing.propertyId}`} key={viewing.id} className="block p-3 rounded-lg border bg-background hover:bg-accent transition-colors">
                        <div className="flex justify-between items-start gap-2">
                            <p className="font-semibold text-sm truncate pr-2 flex-1">{viewing.propertyTitle}</p>
                            <div className="font-bold text-sm flex items-center gap-1 shrink-0 text-primary">
                                <Clock className="h-3 w-3" />
                                {format(parseISO(viewing.viewingDate), 'HH:mm')}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Vizionare cu: {viewing.contactName}</p>
                         <p className="text-xs font-medium mt-1">
                            {isToday(parseISO(viewing.viewingDate)) 
                                ? 'Astăzi' 
                                : format(parseISO(viewing.viewingDate), "eee, d MMM", { locale: ro })
                            }
                        </p>
                    </Link>
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
