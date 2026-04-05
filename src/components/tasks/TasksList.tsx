"use client";

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import Link from 'next/link';

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Task, Contact } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CheckCircle2, Clock3 } from "lucide-react";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { DeleteTaskAlert } from "@/components/tasks/DeleteTaskAlert";
import { useAgency } from '@/context/AgencyContext';

export function TasksList() {
    const { toast } = useToast();
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'tasks');
    }, [firestore, agencyId]);

    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);

    const { data: contacts } = useCollection<Contact>(contactsQuery);
    
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [deletingTask, setDeletingTask] = useState<Task | null>(null);

    const handleToggleTask = (task: Task) => {
        if (!agencyId) return;
        const taskRef = doc(firestore, 'agencies', agencyId, 'tasks', task.id);
        const newStatus = task.status === 'completed' ? 'open' : 'completed';
        updateDocumentNonBlocking(taskRef, { status: newStatus });
    };
    
    const handleUpdateTask = (updatedTask: Omit<Task, 'status'>) => {
        if (!agencyId || !editingTask) return;
        const taskRef = doc(firestore, 'agencies', agencyId, 'tasks', editingTask.id);
        const { id, ...dataToUpdate } = updatedTask;
        updateDocumentNonBlocking(taskRef, dataToUpdate);
        toast({
            title: "Task actualizat!",
            description: `Task-ul a fost actualizat.`,
        });
        setEditingTask(null);
    };

    const handleDeleteTask = () => {
        if (!agencyId || !deletingTask) return;
        const taskRef = doc(firestore, 'agencies', agencyId, 'tasks', deletingTask.id);
        deleteDocumentNonBlocking(taskRef);
        toast({
            variant: 'destructive',
            title: "Task șters!",
            description: `Task-ul a fost șters.`,
        });
        setDeletingTask(null);
    };

    const { upcomingTasks, completedTasks } = useMemo(() => {
        if (!tasks) return { upcomingTasks: [], completedTasks: [] };
        const upcoming = tasks.filter(task => task.status === 'open').sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        const completed = tasks.filter(task => task.status === 'completed');
        return { upcomingTasks: upcoming, completedTasks: completed };
    }, [tasks]);

    const renderTaskList = (taskList: Task[], isCompletedList = false) => {
      if (areTasksLoading) {
        return (
          <>
            <Skeleton className="h-16 w-full bg-white/10" />
            <Skeleton className="h-16 w-full bg-white/10" />
            <Skeleton className="h-16 w-full bg-white/10" />
          </>
        )
      }
      if (taskList.length === 0) {
        return <p className="text-white/70 text-center">{isCompletedList ? 'Niciun task completat.' : 'Niciun task. Ești la zi!'}</p>;
      }
      return taskList.map(task => (
        <Card key={task.id} className={cn(
            "rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] text-white shadow-[0_16px_40px_rgba(0,0,0,0.16)]",
            isCompletedList && "opacity-65"
        )}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className='flex min-w-0 flex-1 items-center gap-4'>
                    <Checkbox 
                        id={`task-list-${task.id}`} 
                        checked={task.status === 'completed'}
                        onCheckedChange={() => handleToggleTask(task)}
                        className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/[0.65]">
                                {isCompletedList ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                                {isCompletedList ? 'Finalizat' : 'Activ'}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-white/[0.65]">
                                {format(new Date(task.dueDate), "d MMMM yyyy", { locale: ro })}
                            </span>
                        </div>
                        <label htmlFor={`task-list-${task.id}`} className={cn("block cursor-pointer truncate text-sm font-semibold sm:text-base", isCompletedList && "text-white/50 line-through")}>{task.description}</label>
                        <p className={cn("mt-1 text-sm truncate", isCompletedList ? "text-white/50 line-through" : "text-white/70")}>
                            Scadent:
                            {' '}
                            {new Date(task.dueDate).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            {task.startTime && ` la ${task.startTime}`}
                            {task.contactName && (
                                <>
                                 {' | Pentru: '}
                                 <Link href={`/leads/${task.contactId}`} className="text-primary hover:underline">
                                    {task.contactName}
                                 </Link>
                                </>
                            )}
                        </p>
                    </div>
                </div>
                {!isCompletedList && (
                    <div className="flex gap-2">
                         <Button variant="ghost" size="icon" onClick={() => setEditingTask(task)} className="text-white/80 hover:bg-white/20 hover:text-white">
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/20 focus:text-destructive" onClick={() => setDeletingTask(task)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                )}
            </CardContent>
        </Card>
      ));
    }


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-white/10 bg-[#12213E]/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">În lucru</p>
                    <h2 className="text-2xl font-semibold text-white">De făcut</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-sm font-medium text-white/75">{upcomingTasks.length}</span>
            </div>
            <div className="space-y-4">
                {renderTaskList(upcomingTasks)}
            </div>
        </section>
        <section className="rounded-[28px] border border-white/10 bg-[#12213E]/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Arhivă recentă</p>
                    <h2 className="text-2xl font-semibold text-white">Completate</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-sm font-medium text-white/75">{completedTasks.length}</span>
            </div>
            <div className="space-y-4">
                 {renderTaskList(completedTasks, true)}
            </div>
        </section>
      </div>
       <EditTaskDialog 
            isOpen={!!editingTask}
            onOpenChange={(isOpen) => !isOpen && setEditingTask(null)}
            task={editingTask}
            onUpdateTask={handleUpdateTask}
            contacts={contacts || []}
        />
        <DeleteTaskAlert 
            isOpen={!!deletingTask}
            onOpenChange={(isOpen) => !isOpen && setDeletingTask(null)}
            task={deletingTask}
            onDelete={handleDeleteTask}
        />
    </div>
  );
}
