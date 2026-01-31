'use client';

import React, { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '../ui/button';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

export function TasksCalendar() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'tasks');
    }, [firestore, agencyId]);

    const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

    const daysWithTasks = useMemo(() => {
        if (!tasks) return [];
        return tasks.reduce((acc: Date[], task) => {
            if (task.dueDate) {
                const taskDate = new Date(task.dueDate);
                const utcDate = new Date(taskDate.valueOf() + taskDate.getTimezoneOffset() * 60000);
                if (!acc.some(d => isSameDay(d, utcDate))) {
                    acc.push(utcDate);
                }
            }
            return acc;
        }, []);
    }, [tasks]);

    const tasksForSelectedDay = useMemo(() => {
        if (!selectedDay || !tasks) return [];
        return tasks.filter(task => {
            if (!task.dueDate) return false;
            const taskDate = new Date(task.dueDate);
            const utcDate = new Date(taskDate.valueOf() + taskDate.getTimezoneOffset() * 60000);
            return isSameDay(utcDate, selectedDay);
        }).sort((a,b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
    }, [selectedDay, tasks]);

    const handleDayClick = (day: Date) => {
        setSelectedDay(day);
        setIsPopupOpen(true);
    };
    
    const modifiers = {
        hasTasks: daysWithTasks,
    };

    const modifiersClassNames = {
        hasTasks: 'has-tasks-indicator',
    };

    if (isLoading) {
        return <Skeleton className="h-[400px] w-full rounded-md border" />;
    }

    return (
        <>
            <style>{`
                .has-tasks-indicator:not([aria-selected="true"]) .rdp-button:after {
                    content: '';
                    position: absolute;
                    bottom: 4px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background-color: hsl(var(--primary));
                }
            `}</style>
            <Card className="p-0">
                <Calendar
                    mode="single"
                    locale={ro}
                    onDayClick={handleDayClick}
                    className="p-3"
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                    showOutsideDays
                />
            </Card>

            <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Task-uri pentru {selectedDay ? format(selectedDay, 'd MMMM yyyy', { locale: ro }) : ''}
                        </DialogTitle>
                        <DialogDescription>
                            Lista activităților programate pentru această zi.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6 py-4 space-y-4">
                        {tasksForSelectedDay.length > 0 ? (
                            tasksForSelectedDay.map(task => (
                                <div key={task.id} className={cn("p-3 rounded-md", task.status === 'completed' ? 'bg-muted text-muted-foreground' : 'bg-muted/50')}>
                                    <p className={cn("font-semibold", task.status === 'completed' && 'line-through')}>
                                        {task.description}
                                    </p>
                                    <div className="flex items-center justify-between text-xs mt-1">
                                        {task.startTime ? <Badge variant="outline">{task.startTime}</Badge> : <span />}
                                        {task.contactName && task.contactId ? (
                                            <Link href={`/leads/${task.contactId}`} className="text-primary hover:underline truncate" onClick={() => setIsPopupOpen(false)}>
                                                {task.contactName}
                                            </Link>
                                        ) : <span />}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-10">
                                Niciun task programat pentru această zi.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPopupOpen(false)}>Închide</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
