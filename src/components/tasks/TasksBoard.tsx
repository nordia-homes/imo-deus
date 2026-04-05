'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import type { Task, Contact } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import { TaskCard } from './TaskCard';
import { isToday, isPast, isThisWeek } from 'date-fns';
import { useAgency } from '@/context/AgencyContext';
import { AlertTriangle, CalendarClock, CalendarRange, Rocket, CheckCircle2 } from 'lucide-react';
import { EditTaskDialog } from './EditTaskDialog';
import { useToast } from "@/hooks/use-toast";

const columns = [
    { id: 'overdue', title: 'Întârziate', description: 'Ce trebuia rezolvat deja', icon: AlertTriangle, accent: 'from-rose-400/20 to-transparent', badge: 'text-rose-100' },
    { id: 'today', title: 'Astăzi', description: 'Focus pentru ziua curentă', icon: CalendarClock, accent: 'from-sky-400/20 to-transparent', badge: 'text-sky-100' },
    { id: 'this_week', title: 'Săptămâna asta', description: 'Lucruri planificate curând', icon: CalendarRange, accent: 'from-indigo-400/20 to-transparent', badge: 'text-indigo-100' },
    { id: 'future', title: 'Mai încolo', description: 'Planifică perioada următoare', icon: Rocket, accent: 'from-cyan-400/20 to-transparent', badge: 'text-cyan-100' },
    { id: 'completed', title: 'Finalizate', description: 'Task-uri deja închise', icon: CheckCircle2, accent: 'from-emerald-400/20 to-transparent', badge: 'text-emerald-100' }
] as const;

type ColumnId = typeof columns[number]['id'];

function TaskColumn({
    title,
    description,
    tasks,
    icon: Icon,
    accent,
    badge,
    onEdit,
    onToggleComplete,
}: {
    title: string;
    description: string;
    tasks: Task[];
    icon: typeof AlertTriangle;
    accent: string;
    badge: string;
    onEdit: (task: Task) => void;
    onToggleComplete: (task: Task) => void;
}) {
    return (
        <div className="flex h-full min-h-[22rem] w-full flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]">
            <div className={`border-b border-white/10 bg-gradient-to-br ${accent} px-4 py-4`}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{title}</p>
                        <h3 className="mt-1 text-lg font-semibold text-white">{tasks.length} task-uri</h3>
                        <p className="mt-1 whitespace-nowrap text-sm text-white/60">{description}</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08]">
                        <Icon className={`h-4 w-4 ${badge}`} />
                    </div>
                </div>
            </div>
            <div className="flex-1 p-3">
                <div className="h-full rounded-[22px] bg-[#1A2944]/70 p-3">
                    <div className="h-full space-y-3 overflow-y-auto">
                        {tasks.length > 0 ? tasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onEdit={onEdit}
                                onToggleComplete={onToggleComplete}
                            />
                        )) : (
                            <div className="flex h-full min-h-40 items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] px-4 text-center">
                                <p className="max-w-[13rem] text-sm text-white/55">Nu există task-uri în această categorie momentan.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function TasksBoard() {
    const { agencyId } = useAgency();
    const { toast } = useToast();
    const firestore = useFirestore();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'tasks');
    }, [firestore, agencyId]);

    const { data: fetchedTasks, isLoading } = useCollection<Task>(tasksQuery);

    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);

    const { data: contacts } = useCollection<Contact>(contactsQuery);

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

    const handleToggleTask = (task: Task) => {
        if (!agencyId) return;
        const taskRef = doc(firestore, 'agencies', agencyId, 'tasks', task.id);
        const nextStatus = task.status === 'completed' ? 'open' : 'completed';
        updateDocumentNonBlocking(taskRef, { status: nextStatus });
        toast({
            title: nextStatus === 'completed' ? 'Task finalizat' : 'Task redeschis',
            description: task.description,
        });
    };

    const handleUpdateTask = (updatedTask: Omit<Task, 'status'>) => {
        if (!agencyId || !editingTask) return;
        const taskRef = doc(firestore, 'agencies', agencyId, 'tasks', editingTask.id);
        const { id, ...dataToUpdate } = updatedTask;
        updateDocumentNonBlocking(taskRef, dataToUpdate);
        toast({
            title: "Task actualizat!",
            description: updatedTask.description,
        });
        setEditingTask(null);
    };


    if (isLoading) {
        return (
            <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                {columns.map(col => <Skeleton key={col.id} className="h-full w-full bg-white/10" />)}
            </div>
        );
    }
    
    return (
        <>
            <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                {columns.map(col => (
                    <TaskColumn
                        key={col.id}
                        title={col.title}
                        description={col.description}
                        tasks={categorizedTasks[col.id]}
                        icon={col.icon}
                        accent={col.accent}
                        badge={col.badge}
                        onEdit={setEditingTask}
                        onToggleComplete={handleToggleTask}
                    />
                ))}
            </div>
            <EditTaskDialog
                isOpen={!!editingTask}
                onOpenChange={(isOpen) => !isOpen && setEditingTask(null)}
                task={editingTask}
                onUpdateTask={handleUpdateTask}
                contacts={contacts || []}
            />
        </>
    );
}
