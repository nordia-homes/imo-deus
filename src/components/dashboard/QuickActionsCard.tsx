'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Card className="bg-muted/50 shadow-2xl rounded-2xl md:hidden">
            <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-2 text-center">
                    <Button variant="outline" className="h-auto flex-col py-2 bg-card" onClick={onAddLead}>
                        <User className="h-5 w-5 mb-1 text-primary" />
                        <span className="text-xs">Adaugă Cumpărător</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col py-2 bg-card" onClick={onAddProperty}>
                        <Building className="h-5 w-5 mb-1 text-primary" />
                        <span className="text-xs">Adaugă Proprietate</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col py-2 bg-card" onClick={onAddViewing}>
                        <CalendarCheck className="h-5 w-5 mb-1 text-primary" />
                        <span className="text-xs">Adaugă Vizionare</span>
                    </Button>
                    <AddTaskDialog onAddTask={onAddTask} contacts={contacts}>
                        <Button variant="outline" className="h-auto flex-col py-2 bg-card w-full">
                            <CheckSquare className="h-5 w-5 mb-1 text-primary" />
                            <span className="text-xs">Adaugă Task</span>
                        </Button>
                    </AddTaskDialog>
                </div>
            </CardContent>
        </Card>
    );
}
