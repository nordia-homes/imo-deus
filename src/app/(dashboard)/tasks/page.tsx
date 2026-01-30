'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TasksBoard } from "@/components/tasks/TasksBoard";
import { TasksList } from "@/components/tasks/TasksList";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Task, Contact } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/context/AgencyContext";

export default function TasksPage() {
    const { toast } = useToast();
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: contacts } = useCollection<Contact>(contactsQuery);

    const handleAddTask = (newTask: Omit<Task, 'id' | 'status'>) => {
        if (!agencyId) return;
        const tasksCollection = collection(firestore, 'agencies', agencyId, 'tasks');
        const taskToAdd = { ...newTask, status: 'open' };
        addDocumentNonBlocking(tasksCollection, taskToAdd);
         toast({
            title: "Task adăugat!",
            description: `Task-ul "${newTask.description}" a fost adăugat.`,
        });
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Task-uri</h1>
                    <p className="text-muted-foreground">
                        Organizează-ți activitățile și nu rata niciun detaliu.
                    </p>
                </div>
                 <AddTaskDialog onAddTask={handleAddTask} contacts={contacts || []} />
            </div>
            <Tabs defaultValue="board" className="flex-1 flex flex-col">
                <TabsList className="mb-4 self-start">
                    <TabsTrigger value="board">Panou</TabsTrigger>
                    <TabsTrigger value="list">Listă</TabsTrigger>
                </TabsList>
                <TabsContent value="board" className="flex-1 -m-1">
                    <TasksBoard />
                </TabsContent>
                <TabsContent value="list" className="mt-0">
                    <TasksList />
                </TabsContent>
            </Tabs>
        </div>
    );
}
