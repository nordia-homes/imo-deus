'use client';

import React, { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isSameDay, addMonths, subMonths } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';

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

    const handleMonthChange = (date: Date) => {
        setCurrentMonth(date);
    };

    const CustomDay = ({ date, displayMonth }: { date: Date, displayMonth: Date }) => {
        if (!date || isNaN(date.getTime())) {
            // Guard against invalid date objects which can be passed by the calendar library.
            return <div />;
        }
        
        const dayKey = format(date, 'yyyy-MM-dd');
        const dayTasks = tasksByDay[dayKey]?.tasks || [];

        if (dayTasks.length === 0) {
            return (
                <div className="h-full w-full p-1 text-sm text-muted-foreground">{date.getDate()}</div>
            );
        }

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button className="relative flex flex-col h-full w-full p-1 rounded-sm text-left hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:z-10">
                        <span className="font-semibold">{date.getDate()}</span>
                        <div className="flex-1 mt-1 space-y-1 overflow-hidden">
                            {dayTasks.slice(0, 2).map(task => (
                                <div key={task.id} className="text-xs truncate px-1 py-0.5 rounded bg-primary/20 text-primary-foreground">
                                    {task.startTime && <span className="font-bold">{task.startTime} </span>}
                                    {task.description}
                                </div>
                            ))}
                            {dayTasks.length > 2 && (
                                <div className="text-xs text-muted-foreground">+ {dayTasks.length - 2} more</div>
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
                    mode="single"
                    selected={new Date()} // Doesn't do much here, but required
                    month={currentMonth}
                    onMonthChange={handleMonthChange}
                    className="w-full h-full"
                    classNames={{
                        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 h-full',
                        month: 'space-y-4 flex flex-col flex-1',
                        table: 'w-full border-collapse space-y-1 flex-1',
                        head_row: 'flex border-b',
                        head_cell: 'text-muted-foreground rounded-md w-full font-normal text-[0.8rem] p-2 text-center',
                        row: 'flex w-full mt-2 h-[calc((100%-2.5rem)/5)]', // Distribute height
                        cell: 'h-full w-full text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 border',
                        day: 'h-full w-full p-0 font-normal aria-selected:opacity-100',
                        day_outside: 'text-muted-foreground/50',
                    }}
                    components={{
                        Day: CustomDay,
                        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                        IconRight: () => <ChevronRight className="h-4 w-4" />,
                    }}
                />
            </CardContent>
        </Card>
    );
}
