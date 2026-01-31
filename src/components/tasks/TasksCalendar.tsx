'use client';

import React, { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { buttonVariants } from '@/components/ui/button';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type DayWithTasks = {
    date: Date;
    tasks: Task[];
};

export function TasksCalendar() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'tasks');
    }, [firestore, agencyId]);

    const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

    const tasksByDay = useMemo(() => {
        const grouped: { [key: string]: DayWithTasks } = {};
        if (!tasks) return grouped;

        tasks.forEach(task => {
            if (task.dueDate) {
                const taskDate = new Date(task.dueDate);
                // Adjust for timezone offset to prevent date shifting
                const utcDate = new Date(taskDate.valueOf() + taskDate.getTimezoneOffset() * 60000);
                const dayKey = format(utcDate, 'yyyy-MM-dd');
                
                if (!grouped[dayKey]) {
                    grouped[dayKey] = {
                        date: utcDate,
                        tasks: [],
                    };
                }
                grouped[dayKey].tasks.push(task);
            }
        });
        return grouped;
    }, [tasks]);

    const CustomDay = ({ date }: { date: Date }) => {
        if (!date || isNaN(date.getTime())) {
            return <div className="h-full w-full" />;
        }
        
        const dayKey = format(date, 'yyyy-MM-dd');
        const dayTasks = tasksByDay[dayKey]?.tasks || [];

        if (dayTasks.length === 0) {
            return (
                 <div className="h-full w-full p-1.5 text-left">
                    <span className="text-xs text-muted-foreground">{date.getDate()}</span>
                </div>
            );
        }

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button className="relative flex flex-col items-start h-full w-full p-1.5 rounded-sm text-left hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:z-10">
                        <span className="text-xs font-semibold text-foreground">{date.getDate()}</span>
                        <div className="flex-1 mt-1 space-y-0.5 overflow-hidden w-full">
                            {dayTasks.slice(0, 3).map(task => (
                                <div key={task.id} className="text-xs truncate px-1 py-0.5 rounded bg-primary/20 text-primary-foreground">
                                    {task.startTime && <span className="font-bold">{task.startTime} </span>}
                                    {task.description}
                                </div>
                            ))}
                            {dayTasks.length > 3 && (
                                <div className="text-xs text-muted-foreground">+ {dayTasks.length - 3} more</div>
                            )}
                        </div>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <div className="space-y-4">
                        <h4 className="font-semibold">{format(date, "PPPP", { locale: ro })}</h4>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {dayTasks.map(task => (
                                <div key={task.id}>
                                    <p className="font-medium text-sm">{task.description}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {task.startTime && `Ora: ${task.startTime}`}
                                        {task.contactName && task.contactId && (
                                            <>
                                                {' | Pentru: '}
                                                <Link href={`/leads/${task.contactId}`} className="text-primary hover:underline">
                                                    {task.contactName}
                                                </Link>
                                            </>
                                        )}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        );
    };

    if (isLoading) {
        return <Skeleton className="h-full w-full" />
    }
    
    return (
        <Card className="h-full flex flex-col">
            <CardContent className="p-2 flex-1">
                <Calendar
                    locale={ro}
                    mode="single"
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                    className="w-full"
                    captionLayout="buttons"
                    classNames={{
                        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                        month: 'space-y-4 w-full',
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: "text-lg font-bold",
                        nav: 'space-x-1 flex items-center',
                        nav_button: cn(
                          buttonVariants({ variant: 'outline' }),
                          'h-7 w-7 bg-transparent p-0'
                        ),
                        nav_button_previous: 'absolute left-1 top-1/2 -translate-y-1/2',
                        nav_button_next: 'absolute right-1 top-1/2 -translate-y-1/2',
                        table: 'w-full border-collapse',
                        head_row: 'flex',
                        head_cell: 'w-[14.28%] text-muted-foreground rounded-md font-normal text-[0.8rem] text-center border-b pb-1',
                        row: 'flex w-full border-b',
                        cell: 'h-28 w-[14.28%] p-0 text-center text-sm relative border-r last:border-r-0',
                        day: 'h-full w-full p-0 font-normal focus:relative focus:z-20',
                        day_selected: 'bg-transparent text-foreground',
                        day_today: 'bg-accent text-accent-foreground',
                        day_outside: 'text-muted-foreground opacity-50',
                        day_disabled: 'text-muted-foreground opacity-50',
                        day_hidden: 'invisible',
                    }}
                    components={{
                        Day: CustomDay,
                    }}
                />
            </CardContent>
        </Card>
    );
}
