'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCollection, useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import type { Task } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import { TaskCard } from './TaskCard';
import { isToday, isPast, isThisWeek, endOfWeek, startOfToday, addDays } from 'date-fns';

const columns = [
    { id: 'overdue', title: 'Scadente' },
    { id: 'today', title: 'Azi' },
    { id: 'this_week', title: 'Săptămâna aceasta' },
    { id: 'future', title: 'Viitor' },
    { id: 'completed', title: 'Completate' }
] as const;

type ColumnId = typeof columns[number]['id'];

function TaskColumn({ id, title, tasks }: { id: ColumnId, title: string, tasks: Task[] }) {
    return (
        <div className="bg-muted/50 rounded-lg p-2 flex flex-col h-full w-full">
            <h3 className="font-semibold text-sm mb-3 px-1 text-center">{title} ({tasks.length})</h3>
            <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="flex-1 overflow-y-auto space-y-2 min-h-24 p-1">
                    {tasks.length > 0 ? tasks.map(task => (
                        <TaskCard key={task.id} task={task} />
                    )) : (
                        <div className="h-full flex items-center justify-center">
                            <p className="text-xs text-muted-foreground">Niciun task</p>
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

export function TasksBoard() {
    const { user } = useUser();
    const firestore = useFirestore();
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
    const [tasks, setTasks] = useState<Task[]>([]);

    const tasksQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'tasks');
    }, [firestore, user]);

    const { data: fetchedTasks, isLoading } = useCollection<Task>(tasksQuery);

    useEffect(() => {
        if (fetchedTasks) {
            setTasks(fetchedTasks);
        }
    }, [fetchedTasks]);

    const categorizedTasks = useMemo(() => {
        const initial: Record<ColumnId, Task[]> = { overdue: [], today: [], this_week: [], future: [], completed: [] };
        if (!tasks) return initial;

        return tasks.reduce((acc, task) => {
            if (task.status === 'completed') {
                acc.completed.push(task);
                return acc;
            }
            
            try {
                const dueDate = new Date(task.dueDate);
                
                if (isPast(dueDate) && !isToday(dueDate)) {
                    acc.overdue.push(task);
                } else if (isToday(dueDate)) {
                    acc.today.push(task);
                } else if (isThisWeek(dueDate, { weekStartsOn: 1 })) {
                    acc.this_week.push(task);
                } else {
                    acc.future.push(task);
                }
            } catch(e) {
                // If date is invalid, put it in future
                acc.future.push(task);
            }
            return acc;
        }, initial);

    }, [tasks]);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (!over || active.id === over.id) return;
        if (!user) return;
        
        const overContainerId = over.data.current?.sortable.containerId || over.id as ColumnId;

        const task = tasks.find(t => t.id === active.id);
        if (!task) return;

        let newDueDate: Date | null = null;
        let newStatus: Task['status'] | null = null;

        if (overContainerId === 'completed') {
            newStatus = 'completed';
        } else {
            newStatus = 'open'; // Ensure it's open if moved from completed
            if (overContainerId === 'today') newDueDate = startOfToday();
            else if (overContainerId === 'this_week') newDueDate = endOfWeek(new Date(), { weekStartsOn: 1 });
            else if (overContainerId === 'future') newDueDate = addDays(endOfWeek(new Date(), { weekStartsOn: 1 }), 1);
        }

        const taskRef = doc(firestore, 'users', user.uid, 'tasks', task.id);
        const updateData: Partial<Task> = {};
        if (newStatus && task.status !== newStatus) updateData.status = newStatus;
        if (newDueDate) updateData.dueDate = newDueDate.toISOString().split('T')[0];

        if (Object.keys(updateData).length > 0) {
            updateDocumentNonBlocking(taskRef, updateData);
        }
    }

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full">
                {columns.map(col => <Skeleton key={col.id} className="h-full w-full" />)}
            </div>
        );
    }
    
    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 h-full">
                {columns.map(col => (
                    <TaskColumn key={col.id} id={col.id} title={col.title} tasks={categorizedTasks[col.id]} />
                ))}
            </div>
        </DndContext>
    );
}
