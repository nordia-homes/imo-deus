'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, Building, CalendarCheck, CheckSquare } from 'lucide-react';
import type { Task, Contact } from '@/lib/types';
import { AddTaskDialog } from '../tasks/AddTaskDialog';

interface QuickActionsCardProps {
    onAddLead: () => void;
    onAddProperty: () => void;
    onAddViewing: () => void;
    onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => void;
    contacts: Contact[];
}

export function QuickActionsCard({ onAddLead, onAddProperty, onAddViewing, onAddTask, contacts }: QuickActionsCardProps) {
    return (
        <Card className="bg-[#0F1E33] shadow-2xl rounded-2xl md:hidden">
            <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-2 text-center">
                    <Button className="h-auto py-3 bg-[#13b180] hover:bg-[#13b180]/90 text-white text-sm" onClick={onAddLead}>
                        Adaugă Cumpărător
                    </Button>
                    <Button className="h-auto py-3 bg-[#13b180] hover:bg-[#13b180]/90 text-white text-sm" onClick={onAddProperty}>
                        Adaugă Proprietate
                    </Button>
                    <Button className="h-auto py-3 bg-[#13b180] hover:bg-[#13b180]/90 text-white text-sm" onClick={onAddViewing}>
                        Adaugă Vizionare
                    </Button>
                    <AddTaskDialog onAddTask={onAddTask} contacts={contacts}>
                        <Button className="h-auto py-3 bg-[#152a47] hover:bg-[#152a47]/90 text-white w-full text-sm">
                           Adaugă Task
                        </Button>
                    </AddTaskDialog>
                </div>
            </CardContent>
        </Card>
    );
}
