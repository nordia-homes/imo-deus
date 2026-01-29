'use client';

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import Link from 'next/link';
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";

// Dummy contacts data to be passed to the dialog
const contacts = [
    { id: '1', name: 'Alex Popescu' },
    { id: '2', name: 'Ana Ionescu' },
    { id: '3', name: 'Dan Georgescu' },
    { id: '4', name: 'Laura Mihai' },
];

export type Task = {
    id: string;
    title: string;
    dueDate: string;
    completed: boolean;
    startTime?: string;
    duration?: number;
    contactId?: string;
    contactName?: string;
};

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([
        { id: 't1', title: 'Follow up cu Alex Popescu', dueDate: '2024-06-05', completed: false, contactId: '1', contactName: 'Alex Popescu', startTime: '14:30' },
        { id: 't2', title: 'Programează vizionare pentru Ana Ionescu', dueDate: '2024-06-02', completed: false, contactId: '2', contactName: 'Ana Ionescu', startTime: '11:00' },
        { id: 't3', title: 'Pregătește acte vânzare proprietate #P345', dueDate: '2024-05-30', completed: true },
    ]);

    const handleToggleTask = (taskId: string) => {
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
            )
        );
    };

    const handleAddTask = (newTask: Omit<Task, 'id' | 'completed'>) => {
        const taskToAdd: Task = {
            ...newTask,
            id: `task_${Date.now()}`,
            completed: false,
        };
        setTasks(prevTasks => [...prevTasks, taskToAdd]);
    };

    const upcomingTasks = tasks.filter(task => !task.completed).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const completedTasks = tasks.filter(task => task.completed);

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
                {upcomingTasks.length > 0 ? upcomingTasks.map(task => (
                    <Card key={task.id}>
                        <CardContent className="p-4 flex items-center gap-4">
                            <Checkbox 
                                id={`task-${task.id}`} 
                                checked={task.completed}
                                onCheckedChange={() => handleToggleTask(task.id)}
                            />
                            <div className="flex-1">
                                <label htmlFor={`task-${task.id}`} className="font-medium cursor-pointer">{task.title}</label>
                                <p className="text-sm text-muted-foreground">
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
                        </CardContent>
                    </Card>
                )) : <p className="text-muted-foreground">Niciun task. Ești la zi!</p>}
            </div>
        </section>
        <section>
            <h2 className="text-xl font-headline font-semibold mb-4">Completate ({completedTasks.length})</h2>
            <div className="space-y-4">
                 {completedTasks.map(task => (
                    <Card key={task.id} className="bg-muted">
                        <CardContent className="p-4 flex items-center gap-4">
                            <Checkbox 
                                id={`task-${task.id}`} 
                                checked={task.completed}
                                onCheckedChange={() => handleToggleTask(task.id)}
                            />
                            <div className="flex-1">
                                <label htmlFor={`task-${task.id}`} className="font-medium text-muted-foreground line-through cursor-pointer">{task.title}</label>
                                 <p className="text-sm text-muted-foreground line-through">
                                    Scadent: {new Date(task.dueDate).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    {task.startTime && ` la ${task.startTime}`}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
      </div>
    </div>
  );
}
