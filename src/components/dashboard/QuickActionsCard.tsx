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
                    <Button className="h-auto flex-col py-2 bg-[#13b180] hover:bg-[#13b180]/90 text-white" onClick={onAddLead}>
                        <User className="h-5 w-5 mb-1" />
                        <span className="text-xs">Adaugă Cumpărător</span>
                    </Button>
                    <Button className="h-auto flex-col py-2 bg-[#13b180] hover:bg-[#13b180]/90 text-white" onClick={onAddProperty}>
                        <Building className="h-5 w-5 mb-1" />
                        <span className="text-xs">Adaugă Proprietate</span>
                    </Button>
                    <Button className="h-auto flex-col py-2 bg-[#13b180] hover:bg-[#13b180]/90 text-white" onClick={onAddViewing}>
                        <CalendarCheck className="h-5 w-5 mb-1" />
                        <span className="text-xs">Adaugă Vizionare</span>
                    </Button>
                    <AddTaskDialog onAddTask={onAddTask} contacts={contacts}>
                        <Button className="h-auto flex-col py-2 bg-[#152a47] hover:bg-[#152a47]/90 text-white w-full">
                            <CheckSquare className="h-5 w-5 mb-1" />
                            <span className="text-xs">Adaugă Task</span>
                        </Button>
                    </AddTaskDialog>
                </div>
            </CardContent>
        </Card>
    );
}
