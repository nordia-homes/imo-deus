'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Phone } from 'lucide-react';
import type { Viewing, Property, Contact } from '@/lib/types';
import { parseISO, format, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '../ui/button';
import { WhatsappIcon } from '../icons/WhatsappIcon';

export function MobileScheduledViewings({ viewings, properties, contacts }: { viewings: Viewing[]; properties: Property[]; contacts: Contact[] }) {

  return (
    <Card className="bg-muted/50 shadow-2xl rounded-2xl md:hidden">
      <CardHeader className="flex flex-row items-center justify-between bg-[#13b180] text-white p-3 rounded-t-2xl">
        <CardTitle className="text-base font-semibold text-white">Vizionări Programate</CardTitle>
        <Link href="/viewings" className="text-sm text-white hover:underline">
          Vezi tot
        </Link>
      </CardHeader>
      <CardContent>
        {viewings.length === 0 ? (
           <p className="text-muted-foreground text-center py-4">Nicio vizionare programată.</p>
        ) : (
            <div className="space-y-4">
                {viewings.map(viewing => {
                    const contact = contacts.find(c => c.id === viewing.contactId);
                    const property = properties.find(p => p.id === viewing.propertyId);
                    const contactPhone = contact?.phone?.replace(/\D/g, '');
                    const ownerPhone = property?.ownerPhone?.replace(/\D/g, '');
                    
                    return (
                        <div key={viewing.id} className="p-3 rounded-lg border bg-background">
                            <div className="flex justify-between items-start gap-2">
                                <Link href={`/properties/${viewing.propertyId}`} className="font-semibold text-sm truncate pr-2 flex-1 hover:underline">{viewing.propertyTitle}</Link>
                                <div className="font-bold text-sm flex items-center gap-1 shrink-0 text-primary">
                                    <Clock className="h-3 w-3" />
                                    {format(parseISO(viewing.viewingDate), 'HH:mm')}
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-muted-foreground">Vizionare cu: {viewing.contactName}</p>
                                {contactPhone && (
                                    <div className="flex items-center">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                        <a href={`tel:${contactPhone}`}><Phone className="h-4 w-4 text-green-600" /></a>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                        <a href={`https://wa.me/${contactPhone}`} target="_blank"><WhatsappIcon className="h-4 w-4 text-green-600" /></a>
                                    </Button>
                                    </div>
                                )}
                            </div>

                             {property?.ownerName && (
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs text-muted-foreground">Proprietar: {property.ownerName}</p>
                                    {ownerPhone && (
                                    <div className="flex items-center">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                            <a href={`tel:${ownerPhone}`}><Phone className="h-4 w-4 text-gray-500" /></a>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                            <a href={`https://wa.me/${ownerPhone}`} target="_blank"><WhatsappIcon className="h-4 w-4 text-gray-500" /></a>
                                        </Button>
                                    </div>
                                    )}
                                </div>
                            )}

                             <p className="text-xs font-medium mt-2">
                                {isToday(parseISO(viewing.viewingDate)) 
                                    ? 'Astăzi' 
                                    : format(parseISO(viewing.viewingDate), "eee, d MMM", { locale: ro })
                                }
                            </p>
                        </div>
                    )
                })}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
