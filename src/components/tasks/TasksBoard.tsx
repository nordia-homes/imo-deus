'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import type { Task } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import { TaskCard } from './TaskCard';
import { isToday, isPast, isThisWeek, endOfWeek, startOfToday, addDays } from 'date-fns';
import { useAgency } from '@/context/AgencyContext';

const columns = [
    { id: 'overdue', title: 'Scadente' },
    { id: 'today', title: 'Azi' },
    { id: 'this_week', title: 'Săptămâna aceasta' },
    { id: 'future', title: 'Viitor' },
    { id: 'completed', title: 'Completate' }
] as const;

type ColumnId = typeof columns[number]['id'];

function TaskColumn({ id, title, tasks }: { id: ColumnId, title: string, tasks: Task[] }) {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div className="bg-muted/50 rounded-lg p-2 flex flex-col h-full w-full">
            <h3 className="font-semibold text-sm mb-3 px-1 text-center">{title} ({tasks.length})</h3>
            <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div ref={setNodeRef} className="flex-1 overflow-y-auto space-y-2 min-h-24 p-1">
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
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
    const [tasks, setTasks] = useState<Task[]>([]);

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'tasks');
    }, [firestore, agencyId]);

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

        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        const activeContainer = active.data.current?.sortable?.containerId as ColumnId;
        const overContainer = over.data.current?.sortable?.containerId as ColumnId || overId as ColumnId;
        
        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        if (!agencyId) return;

        // Optimistic UI Update
        setTasks((prev) => {
            const activeTaskIndex = prev.findIndex((t) => t.id === activeId);
            if (activeTaskIndex === -1) return prev;
            
            const taskToMove = { ...prev[activeTaskIndex] };
            let newDueDate: Date | null = null;

            if (overContainer === 'completed') {
                taskToMove.status = 'completed';
            } else {
                taskToMove.status = 'open';
                if (overContainer === 'today') newDueDate = startOfToday();
                else if (overContainer === 'this_week') newDueDate = endOfWeek(new Date(), { weekStartsOn: 1 });
                else if (overContainer === 'future') newDueDate = addDays(endOfWeek(new Date(), { weekStartsOn: 1 }), 1);
            }
            
            if (newDueDate) {
                taskToMove.dueDate = newDueDate.toISOString().split('T')[0];
            }
            
            const newTasks = [...prev];
            newTasks[activeTaskIndex] = taskToMove;
            return newTasks;
        });

        // Backend Firestore Update
        const taskRef = doc(firestore, 'agencies', agencyId, 'tasks', activeId);
        const updateData: Partial<Task> = {};
        
        let backendNewDueDate: Date | null = null;

        if (overContainer === 'completed') {
            updateData.status = 'completed';
        } else {
            updateData.status = 'open';
            if (overContainer === 'today') backendNewDueDate = startOfToday();
            else if (overContainer === 'this_week') backendNewDueDate = endOfWeek(new Date(), { weekStartsOn: 1 });
            else if (overContainer === 'future') backendNewDueDate = addDays(endOfWeek(new Date(), { weekStartsOn: 1 }), 1);
        }

        if (backendNewDueDate) {
            updateData.dueDate = backendNewDueDate.toISOString().split('T')[0];
        }
        
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
