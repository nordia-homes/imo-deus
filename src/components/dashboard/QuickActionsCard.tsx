'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Task, Contact, Viewing, Property } from '@/lib/types';
import { AddTaskDialog } from '../tasks/AddTaskDialog';

// new imports
import { Clock, Phone } from 'lucide-react';
import { parseISO, format, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';
import { WhatsappIcon } from '../icons/WhatsappIcon';

interface QuickActionsCardProps {
    onAddLead: () => void;
    onAddProperty: () => void;
    onAddViewing: () => void;
    onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => void;
    contacts: Contact[];
    realizedCommissionThisMonth: number;
    viewings: Viewing[];
    properties: Property[];
    agencyName?: string | null;
    displayName: string;
}

export function QuickActionsCard({ onAddLead, onAddProperty, onAddViewing, onAddTask, contacts, realizedCommissionThisMonth, viewings, properties, agencyName, displayName }: QuickActionsCardProps) {
    return (
        <Card className="bg-[#0F1E33] shadow-2xl rounded-2xl md:hidden">
            <CardContent className="p-4 text-white space-y-4">
                 <div className="text-center">
                    <h1 className="text-lg font-bold text-center text-white">
                        {agencyName ? `Buna ${displayName}, de la ${agencyName}!` : `Bine ai revenit, ${displayName}!`}
                    </h1>
                    <p className="text-xs text-white/80">
                        Iata o privire de ansamblu asupra activitatilor.
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-sm text-white/70">Comision luna aceasta</p>
                    <p className="text-3xl font-bold">€{realizedCommissionThisMonth.toLocaleString('ro-RO')}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                    <Button className="h-auto py-3 bg-[#f8f8f9] hover:bg-muted text-foreground text-sm rounded-full" onClick={onAddLead}>
                        Cumpărător
                    </Button>
                    <Button className="h-auto py-3 bg-[#f8f8f9] hover:bg-muted text-foreground text-sm rounded-full" onClick={onAddProperty}>
                        Proprietate
                    </Button>
                    <AddTaskDialog onAddTask={onAddTask} contacts={contacts}>
                        <Button className="h-auto py-3 bg-[#152a47] hover:bg-[#152a47]/90 text-white w-full text-sm rounded-full">
                           Task
                        </Button>
                    </AddTaskDialog>
                    <Button className="h-auto py-3 bg-[#152a47] hover:bg-[#152a47]/90 text-white text-sm rounded-full" onClick={onAddViewing}>
                        Vizionare
                    </Button>
                </div>
                
                <div className="pt-2">
                    <div className="bg-[#f8f8f9] text-center p-2 rounded-lg font-semibold text-foreground mb-2">
                        Vizionări Programate
                    </div>
                     {viewings.length === 0 ? (
                       <p className="text-white/70 text-center py-4 text-sm">Nicio vizionare programată.</p>
                    ) : (
                        <div className="space-y-2">
                            {viewings.map(viewing => {
                                const contact = contacts.find(c => c.id === viewing.contactId);
                                const property = properties.find(p => p.id === viewing.propertyId);
                                const contactPhone = contact?.phone?.replace(/\D/g, '');
                                const ownerPhone = property?.ownerPhone?.replace(/\D/g, '');
                                
                                return (
                                    <div key={viewing.id} className="p-3 rounded-lg border border-white/10 bg-white/5">
                                        <div className="flex justify-between items-start gap-2">
                                            <Link href={`/properties/${viewing.propertyId}`} className="font-semibold text-sm truncate pr-2 flex-1 text-white hover:underline">{viewing.propertyTitle}</Link>
                                            <div className="font-bold text-sm flex items-center gap-1 shrink-0 text-white/90">
                                                <Clock className="h-3 w-3" />
                                                {format(parseISO(viewing.viewingDate), 'HH:mm')}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-xs text-white/70">Vizionare cu: {viewing.contactName}</p>
                                            {contactPhone && (
                                                <div className="flex items-center">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                    <a href={`tel:${contactPhone}`}><Phone className="h-4 w-4 text-green-400" /></a>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                    <a href={`https://wa.me/${contactPhone}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon className="h-4 w-4 text-green-400" /></a>
                                                </Button>
                                                </div>
                                            )}
                                        </div>

                                         {property?.ownerName && (
                                            <div className="flex items-center justify-between mt-1">
                                                <p className="text-xs text-white/70">Proprietar: {property.ownerName}</p>
                                                {ownerPhone && (
                                                <div className="flex items-center">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                        <a href={`tel:${ownerPhone}`}><Phone className="h-4 w-4 text-gray-400" /></a>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                        <a href={`https://wa.me/${ownerPhone}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon className="h-4 w-4 text-gray-400" /></a>
                                                    </Button>
                                                </div>
                                                )}
                                            </div>
                                        )}

                                         <p className="text-xs font-medium text-white/80 mt-2">
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
                </div>
            </CardContent>
        </Card>
    );
}
