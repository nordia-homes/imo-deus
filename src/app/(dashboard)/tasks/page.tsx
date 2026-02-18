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
import { TasksCalendar } from "@/components/tasks/TasksCalendar";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export default function TasksPage() {
    const { toast } = useToast();
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const isMobile = useIsMobile();

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
        <div className="space-y-6 h-full flex flex-col bg-[#0F1E33] text-white p-2 lg:p-4">
            <div className="flex items-center justify-between">
                <div className="hidden lg:block">
                    <h1 className="text-3xl font-headline font-bold text-white">Task-uri</h1>
                    <p className="text-white/70">
                        Organizează-ți activitățile și nu rata niciun detaliu.
                    </p>
                </div>
                 <AddTaskDialog onAddTask={handleAddTask} contacts={contacts || []}>
                    <Button variant="outline" className="w-full lg:w-auto h-12 lg:h-10 text-base lg:text-sm bg-white/10 border-white/20 hover:bg-white/20 hover:text-white">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adaugă Task
                    </Button>
                 </AddTaskDialog>
            </div>
            <Tabs defaultValue="board" className="flex-1 flex flex-col">
                <TabsList className={cn(
                    "mb-4 self-start grid w-full grid-cols-3 bg-white/10 text-white/70 lg:w-auto lg:inline-flex"
                )}>
                    <TabsTrigger value="board" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Panou</TabsTrigger>
                    <TabsTrigger value="list" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Listă</TabsTrigger>
                    <TabsTrigger value="calendar" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Calendar</TabsTrigger>
                </TabsList>
                <TabsContent value="board" className="flex-1">
                    <TasksBoard />
                </TabsContent>
                <TabsContent value="list" className="mt-0">
                    <TasksList />
                </TabsContent>
                <TabsContent value="calendar" className="mt-0 flex-1">
                    <TasksCalendar />
                </TabsContent>
            </Tabs>
        </div>
    );
}
