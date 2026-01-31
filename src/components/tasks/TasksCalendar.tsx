'use client';

import React, { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { buttonVariants } from '@/components/ui/button';
import { format, isSameDay } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

export function TasksCalendar() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());

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
                // Adjust for timezone issues by creating a date in UTC
                const utcDate = new Date(taskDate.valueOf() + taskDate.getTimezoneOffset() * 60000);
                if (!acc.some(d => isSameDay(d, utcDate))) {
                    acc.push(utcDate);
                }
            }
            return acc;
        }, []);
    }, [tasks]);

    const selectedDayTasks = useMemo(() => {
        if (!selectedDay || !tasks) return [];
        return tasks.filter(task => {
            if (!task.dueDate) return false;
            const taskDate = new Date(task.dueDate);
            const utcDate = new Date(taskDate.valueOf() + taskDate.getTimezoneOffset() * 60000);
            return isSameDay(utcDate, selectedDay);
        }).sort((a,b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
    }, [selectedDay, tasks]);

    const modifiers = {
        hasTasks: daysWithTasks,
    };

    const modifiersClassNames = {
        hasTasks: 'has-tasks',
    };

    if (isLoading) {
        return (
             <div className="grid md:grid-cols-2 gap-6 h-full">
                <Skeleton className="h-full w-full" />
                <Skeleton className="h-full w-full" />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <Card className="lg:col-span-2">
                 <style>{`
                    .has-tasks button:after {
                        content: '';
                        position: absolute;
                        bottom: 6px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 5px;
                        height: 5px;
                        border-radius: 50%;
                        background-color: hsl(var(--primary));
                    }
                `}</style>
                <Calendar
                    mode="single"
                    selected={selectedDay}
                    onSelect={setSelectedDay}
                    locale={ro}
                    className="p-4"
                    classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center mb-4",
                        caption_label: "text-lg font-bold",
                        nav: "space-x-1 flex items-center",
                        nav_button_previous: 'absolute left-1',
                        nav_button_next: 'absolute right-1',
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell:
                          "text-muted-foreground rounded-md w-full font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                        day: cn(
                          buttonVariants({ variant: "ghost" }),
                          "h-12 w-full p-0 font-normal aria-selected:opacity-100 relative"
                        ),
                        day_selected:
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                        day_outside: "text-muted-foreground opacity-50",
                    }}
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                    showOutsideDays
                />
            </Card>
            
            <Card className="lg:col-span-1 h-full flex flex-col">
                <CardHeader>
                    <CardTitle>
                        Task-uri pentru {selectedDay ? format(selectedDay, 'd MMMM yyyy', { locale: ro }) : '...'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4">
                            {selectedDayTasks.length > 0 ? (
                                selectedDayTasks.map(task => (
                                    <div key={task.id} className={cn("p-3 rounded-md", task.status === 'completed' ? 'bg-muted text-muted-foreground' : 'bg-muted/50')}>
                                        <p className={cn("font-semibold", task.status === 'completed' && 'line-through')}>
                                            {task.description}
                                        </p>
                                        <div className="flex items-center justify-between text-xs mt-1">
                                             {task.startTime && <Badge variant="outline">{task.startTime}</Badge>}
                                             {task.contactName && task.contactId ? (
                                                 <Link href={`/leads/${task.contactId}`} className="text-primary hover:underline truncate">
                                                    {task.contactName}
                                                 </Link>
                                             ) : <span />}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-muted-foreground pt-10">
                                    Niciun task pentru această zi.
                                </p>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
