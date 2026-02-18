'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Task, Contact, Viewing, Property } from '@/lib/types';
import { AddTaskDialog } from '../tasks/AddTaskDialog';
import { Clock, Plus } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import Link from 'next/link';

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
        <Card className="bg-[#152a47] text-white border-none rounded-2xl shadow-2xl shadow-black/20">
            <CardContent className="p-4 space-y-4">
                 <div className="text-left">
                    <h1 className="text-xl font-bold text-white">
                        {`Bună ${displayName}, de la ${agencyName}!`}
                    </h1>
                    <p className="text-sm text-white/70">
                        Iată o privire de ansamblu asupra activităților.
                    </p>
                </div>
                <div className="text-left">
                    <p className="text-sm text-white/70">Comision luna aceasta</p>
                    <p className="text-3xl font-bold">€{realizedCommissionThisMonth.toLocaleString('ro-RO')}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button 
                        className="h-auto py-3 text-sm rounded-lg text-white font-semibold border-none"
                        style={{backgroundImage: 'linear-gradient(to right, #13b180, #37e6a5)'}}
                        onClick={onAddLead}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Cumpărător
                    </Button>
                    <Button 
                        className="h-auto py-3 text-sm rounded-lg text-white font-semibold border-none"
                        style={{backgroundImage: 'linear-gradient(to right, #4a00e0, #8e2de2)'}}
                        onClick={onAddProperty}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Proprietate
                    </Button>
                    <AddTaskDialog onAddTask={onAddTask} contacts={contacts}>
                        <Button className="h-auto py-3 bg-white/10 hover:bg-white/20 text-white w-full text-sm rounded-lg">
                           <Plus className="mr-2 h-4 w-4" />
                           Task
                        </Button>
                    </AddTaskDialog>
                    <Button className="h-auto py-3 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg" onClick={onAddViewing}>
                        <Plus className="mr-2 h-4 w-4" />
                        Vizionare
                    </Button>
                </div>
                
                <div className="pt-2">
                    <div className="text-white text-center p-3 rounded-lg font-semibold mb-2">
                        Vizionări Programate
                    </div>
                     {viewings.length === 0 ? (
                       <p className="text-white/70 text-center py-4 text-sm">Nicio viziune programată.</p>
                    ) : (
                        <div className="space-y-2">
                            {viewings.map(viewing => (
                                <div key={viewing.id} className="p-3 rounded-lg border border-white/10 bg-white/5">
                                    <div className="flex justify-between items-start gap-2">
                                        <Link href={`/properties/${viewing.propertyId}`} className="font-semibold text-sm truncate pr-2 flex-1 text-white hover:underline min-w-0">{viewing.propertyTitle}</Link>
                                        <div className="font-bold text-sm flex items-center gap-1 shrink-0 text-white/90">
                                            <Clock className="h-3 w-3" />
                                            {format(parseISO(viewing.viewingDate), 'HH:mm')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
