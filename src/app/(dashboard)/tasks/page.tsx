'use client';

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import Link from 'next/link';
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Task, Contact } from '@/lib/types';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { DeleteTaskAlert } from "@/components/tasks/DeleteTaskAlert";

export default function TasksPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const tasksQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'tasks');
    }, [firestore, user]);

    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    const contactsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'contacts');
    }, [firestore, user]);

    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);
    
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [deletingTask, setDeletingTask] = useState<Task | null>(null);

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
    
    const handleUpdateTask = (updatedTask: Omit<Task, 'status'>) => {
        if (!user || !editingTask) return;
        const taskRef = doc(firestore, 'users', user.uid, 'tasks', editingTask.id);
        // We need to remove the id from the object before updating
        const { id, ...dataToUpdate } = updatedTask;
        updateDocumentNonBlocking(taskRef, dataToUpdate);
        toast({
            title: "Task actualizat!",
            description: `Task-ul a fost actualizat.`,
        });
        setEditingTask(null);
    };

    const handleDeleteTask = () => {
        if (!user || !deletingTask) return;
        const taskRef = doc(firestore, 'users', user.uid, 'tasks', deletingTask.id);
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
            <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className='flex items-center gap-4 flex-1'>
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
                         <Button variant="ghost" size="icon" onClick={() => setEditingTask(task)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingTask(task)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                )}
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
        <AddTaskDialog onAddTask={handleAddTask} contacts={contacts || []} />
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
