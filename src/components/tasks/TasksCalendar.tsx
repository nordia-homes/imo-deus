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
import { buttonVariants } from '../ui/button';

export function TasksCalendar() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    // State for the selected day and popup visibility
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'tasks');
    }, [firestore, agencyId]);

    const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

    // Memoize the list of days that have tasks to add a visual indicator
    const daysWithTasks = useMemo(() => {
        if (!tasks) return [];
        return tasks.reduce((acc: Date[], task) => {
            if (task.dueDate) {
                // Adjust for timezone differences to ensure correct day matching
                const taskDate = new Date(task.dueDate);
                const utcDate = new Date(taskDate.valueOf() + taskDate.getTimezoneOffset() * 60000);
                if (!acc.some(d => isSameDay(d, utcDate))) {
                    acc.push(utcDate);
                }
            }
            return acc;
        }, []);
    }, [tasks]);

    // Memoize the tasks for the currently selected day
    const tasksForSelectedDay = useMemo(() => {
        if (!selectedDay || !tasks) return [];
        return tasks.filter(task => {
            if (!task.dueDate) return false;
            const taskDate = new Date(task.dueDate);
            const utcDate = new Date(taskDate.valueOf() + taskDate.getTimezoneOffset() * 60000);
            return isSameDay(utcDate, selectedDay);
        }).sort((a,b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
    }, [selectedDay, tasks]);

    const handleDayClick = (day: Date, modifiers: { hasTasks?: boolean }) => {
        // We only open the popup if the day actually has tasks
        if (modifiers.hasTasks) {
            setSelectedDay(day);
            setIsPopupOpen(true);
        }
    };
    
    const modifiers = {
        hasTasks: daysWithTasks,
    };

    const modifiersClassNames = {
        hasTasks: 'has-tasks-indicator', // Custom class for styling
    };

    if (isLoading) {
        return <Skeleton className="h-[500px] w-full" />;
    }

    return (
        <>
            <style>{`
                .has-tasks-indicator:not([aria-selected="true"]) button:after {
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
                locale={ro}
                onDayClick={handleDayClick}
                className="rounded-md border w-full"
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
                    head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem]",
                    row: "flex w-full mt-2",
                    cell: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                    day: cn(
                      buttonVariants({ variant: "ghost" }),
                      "h-12 w-full p-0 font-normal aria-selected:opacity-100 relative"
                    ),
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground",
                    day_outside: "text-muted-foreground opacity-50",
                }}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
                showOutsideDays
                fixedWeeks
            />

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
                    <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 py-4">
                        {tasksForSelectedDay.length > 0 ? (
                            tasksForSelectedDay.map(task => (
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
                    <DialogFooter>
                        <Button onClick={() => setIsPopupOpen(false)}>Închide</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}