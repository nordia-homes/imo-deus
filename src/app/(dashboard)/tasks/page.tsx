'use client';

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import Link from 'next/link';
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { useUser, useFirestore, useCollection, useMemoFirebase, collection, doc, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import type { Task } from '@/lib/types';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// Dummy contacts data to be passed to the dialog
const contacts = [
    { id: '1', name: 'Alex Popescu' },
    { id: '2', name: 'Ana Ionescu' },
    { id: '3', name: 'Dan Georgescu' },
    { id: '4', name: 'Laura Mihai' },
];

export default function TasksPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const tasksQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'tasks');
    }, [firestore, user]);

    const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

    const handleToggleTask = (task: Task) => {
        if (!user) return;
        const taskRef = doc(firestore, 'users', user.uid, 'tasks', task.id);
        const newStatus = task.status === 'completed' ? 'open' : 'completed';
        updateDocumentNonBlocking(taskRef, { status: newStatus });
    };

    const handleAddTask = (newTask: Omit<Task, 'id' | 'status'>) => {
        if (!user) return;
        const tasksCollection = collection(firestore, 'users', user.uid, 'tasks');
        const taskToAdd = {
            ...newTask,
            status: 'open',
        };
        addDocumentNonBlocking(tasksCollection, taskToAdd);
         toast({
            title: "Task adăugat!",
            description: `Task-ul "${newTask.description}" a fost adăugat.`,
        });
    };

    const { upcomingTasks, completedTasks } = useMemo(() => {
        if (!tasks) return { upcomingTasks: [], completedTasks: [] };
        const upcoming = tasks.filter(task => task.status === 'open').sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        const completed = tasks.filter(task => task.status === 'completed');
        return { upcomingTasks: upcoming, completedTasks: completed };
    }, [tasks]);

    const renderTaskList = (taskList: Task[], isCompletedList = false) => {
      if (isLoading) {
        return (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )
      }
      if (taskList.length === 0) {
        return <p className="text-muted-foreground">{isCompletedList ? 'Niciun task completat.' : 'Niciun task. Ești la zi!'}</p>;
      }
      return taskList.map(task => (
        <Card key={task.id} className={cn(isCompletedList && "bg-muted")}>
            <CardContent className="p-4 flex items-center gap-4">
                <Checkbox 
                    id={`task-${task.id}`} 
                    checked={task.status === 'completed'}
                    onCheckedChange={() => handleToggleTask(task)}
                />
                <div className="flex-1">
                    <label htmlFor={`task-${task.id}`} className={cn("font-medium cursor-pointer", isCompletedList && "text-muted-foreground line-through")}>{task.description}</label>
                    <p className={cn("text-sm text-muted-foreground", isCompletedList && "line-through")}>
                        Scadent: {new Date(task.dueDate).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {task.startTime && ` la ${task.startTime}`}
                        {task.contactName && !isCompletedList && (
                            <>
                             {' | Pentru: '}
                             <Link href={`/leads/${task.contactId}`} className="text-primary hover:underline">
                                {task.contactName}
                             </Link>
                            </>
                        )}
                    </p>
                </div>
            </CardContent>
        </Card>
      ));
    }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-headline font-bold">Task-uri</h1>
            <p className="text-muted-foreground">
                Organizează-ți activitățile și nu rata niciun detaliu.
            </p>
        </div>
        <AddTaskDialog onAddTask={handleAddTask} contacts={contacts} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
            <h2 className="text-xl font-headline font-semibold mb-4">De făcut ({upcomingTasks.length})</h2>
            <div className="space-y-4">
                {renderTaskList(upcomingTasks)}
            </div>
        </section>
        <section>
            <h2 className="text-xl font-headline font-semibold mb-4">Completate ({completedTasks.length})</h2>
            <div className="space-y-4">
                 {renderTaskList(completedTasks, true)}
            </div>
        </section>
      </div>
    </div>
  );
}
