'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Task, Contact } from '@/lib/types';
import { AddTaskDialog } from '../tasks/AddTaskDialog';

interface QuickActionsCardProps {
    onAddLead: () => void;
    onAddProperty: () => void;
    onAddViewing: () => void;
    onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => void;
    contacts: Contact[];
    realizedCommissionThisMonth: number;
}

export function QuickActionsCard({ onAddLead, onAddProperty, onAddViewing, onAddTask, contacts, realizedCommissionThisMonth }: QuickActionsCardProps) {
    return (
        <Card className="bg-[#0F1E33] shadow-2xl rounded-2xl md:hidden">
            <CardContent className="p-4 text-white">
                <div className="text-center mb-4">
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
                    <Button className="h-auto py-3 bg-[#f8f8f9] hover:bg-muted text-foreground text-sm rounded-full" onClick={onAddViewing}>
                        Vizionare
                    </Button>
                    <AddTaskDialog onAddTask={onAddTask} contacts={contacts}>
                        <Button className="h-auto py-3 bg-[#152a47] hover:bg-[#152a47]/90 text-white w-full text-sm rounded-full">
                           Task
                        </Button>
                    </AddTaskDialog>
                </div>
            </CardContent>
        </Card>
    );
}
