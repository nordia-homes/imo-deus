'use client';

import React, { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import {
  format,
  startOfWeek,
  addDays,
  isToday,
  isSameMonth,
  parse,
} from 'date-fns';
import { ro } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Card, CardContent } from '../ui/card';

// Helper to calculate task position
const calculateTaskPosition = (
  task: Task,
  hourHeight: number
): { top: number; height: number } => {
  if (!task.startTime || !task.duration) {
    return { top: 0, height: 0 };
  }
  const startTime = parse(task.startTime, 'HH:mm', new Date());
  const hours = startTime.getHours();
  const minutes = startTime.getMinutes();

  const top = (hours + minutes / 60) * hourHeight;
  const height = (task.duration / 60) * hourHeight;

  return { top, height };
};

export function TasksCalendar() {
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const tasksQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(
      collection(firestore, 'agencies', agencyId, 'tasks'),
      orderBy('dueDate')
    );
  }, [firestore, agencyId]);

  const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start week on Monday
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [currentDate]);

  const tasksByDay = useMemo(() => {
    const grouped: { [key: string]: Task[] } = {};
    if (!tasks) return grouped;

    tasks.forEach((task) => {
      // Normalize task date to avoid timezone issues
      const taskDate = new Date(task.dueDate);
      const utcDate = new Date(taskDate.valueOf() + taskDate.getTimezoneOffset() * 60000);
      const dayKey = format(utcDate, 'yyyy-MM-dd');

      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(task);
    });
    return grouped;
  }, [tasks]);

  const hourHeight = 64; // 64px per hour
  const hours = Array.from({ length: 24 }).map((_, i) =>
    i.toString().padStart(2, '0') + ':00'
  );

  const navigateWeek = (direction: 'prev' | 'next') => {
    const amount = direction === 'prev' ? -7 : 7;
    setCurrentDate((current) => addDays(current, amount));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Skeleton className="h-12 w-1/4 mb-4 bg-white/10" />
        <Skeleton className="flex-1 w-full bg-white/10" />
      </div>
    );
  }

  return (
     <Card className="flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#12213E] text-white shadow-[0_22px_70px_rgba(0,0,0,0.22)]">
      <CardContent className="p-4 flex flex-col flex-1">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Planificare săptămânală</p>
            <h2 className="mt-1 text-2xl font-semibold capitalize text-white">
              {format(currentDate, 'MMMM yyyy', { locale: ro })}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => setCurrentDate(new Date())} variant="outline" className="border-white/[0.15] bg-white/[0.08] text-white hover:bg-white/[0.14]">
              Astăzi
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek('prev')}
                className="rounded-full hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek('next')}
                className="rounded-full hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="flex-1 grid grid-cols-[auto_1fr] overflow-auto mt-4">
          {/* Time Column */}
          <div className="flex flex-col text-xs text-white/70 border-r border-white/10">
            {/* Empty space for day headers */}
            <div className="h-20 border-b border-white/10"></div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex-shrink-0 text-right pr-2"
                style={{ height: `${hourHeight}px` }}
              >
                {hour}
              </div>
            ))}
          </div>

          {/* Days Columns */}
          <div className="grid grid-cols-7 w-full">
            {weekDays.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDay[dayKey] || [];
              const isCurrent = isToday(day);

              return (
                <div
                  key={dayKey}
                  className="relative flex flex-col border-r border-white/10 last:border-r-0"
                >
                  {/* Day Header */}
                  <div className="sticky top-0 z-10 h-20 border-b border-white/10 bg-[#12213E] p-2 flex flex-col items-center justify-center">
                    <span className="text-sm uppercase font-medium text-white/70">
                      {format(day, 'eee', { locale: ro })}
                    </span>
                    <span
                      className={cn(
                        'text-2xl font-bold mt-1 w-10 h-10 flex items-center justify-center rounded-full',
                        !isSameMonth(day, currentDate) && 'text-white/40',
                        isCurrent && 'bg-primary text-primary-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Grid Lines */}
                  <div className="absolute top-20 left-0 w-full -z-10">
                      {hours.map((hour) => (
                          <div key={hour} style={{ height: `${hourHeight}px`}} className="border-b border-white/10"></div>
                      ))}
                  </div>

                  {/* Tasks Container */}
                  <div className="relative flex-1">
                    {dayTasks.map((task) => {
                      const { top, height } = calculateTaskPosition(task, hourHeight);
                      if (height === 0) return null; // Don't render tasks without duration/time

                      return (
                        <Link
                          key={task.id}
                          href={task.contactId ? `/leads/${task.contactId}` : '/tasks'}
                          className="absolute left-1 w-[calc(100%-8px)] rounded-xl border border-sky-300/[0.15] bg-[linear-gradient(180deg,rgba(59,130,246,0.26),rgba(37,99,235,0.16))] p-2 text-primary-foreground shadow-[0_10px_26px_rgba(37,99,235,0.18)] transition-all hover:bg-[linear-gradient(180deg,rgba(59,130,246,0.34),rgba(37,99,235,0.22))]"
                          style={{ top: `${top}px`, height: `${height}px` }}
                        >
                          <p className="text-xs font-bold text-white truncate">
                            {task.description}
                          </p>
                          {task.contactName && (
                            <p className="text-xs text-white/80 truncate">
                              {task.contactName}
                            </p>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
