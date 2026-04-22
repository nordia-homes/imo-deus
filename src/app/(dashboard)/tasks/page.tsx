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
import { PlusCircle, LayoutGrid, ListTodo, CalendarDays, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export default function TasksPage() {
    const { toast } = useToast();
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: contacts } = useCollection<Contact>(contactsQuery);

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'tasks');
    }, [firestore, agencyId]);
    const { data: tasks } = useCollection<Task>(tasksQuery);

    const stats = useMemo(() => {
        const allTasks = tasks || [];
        const openTasks = allTasks.filter((task) => task.status === 'open');
        const completedTasks = allTasks.filter((task) => task.status === 'completed');
        const overdueTasks = openTasks.filter((task) => {
            const dueDate = new Date(task.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return !Number.isNaN(dueDate.getTime()) && dueDate < today;
        });

        return {
            total: allTasks.length,
            open: openTasks.length,
            completed: completedTasks.length,
            overdue: overdueTasks.length,
        };
    }, [tasks]);

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
        <div className="agentfinder-tasks-page flex h-full flex-col gap-5 overflow-hidden bg-[#0B1730] p-2 text-white lg:gap-6 lg:p-4">
            <section className="agentfinder-tasks-hero relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_35%),linear-gradient(135deg,_rgba(14,31,56,0.98),_rgba(11,23,48,0.94)_55%,_rgba(17,57,100,0.88))] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] lg:px-7 lg:py-7">
                <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(96,165,250,0.22),_transparent_65%)] lg:block" />
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <span className="agentfinder-tasks-eyebrow inline-flex rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">
                            Workspace task-uri
                        </span>
                        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white lg:whitespace-nowrap lg:text-4xl">
                            O pagină mai clară pentru ce ai de făcut astăzi
                        </h1>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-white/70 lg:text-base">
                            Vezi rapid ce e urgent, ce ai în lucru și ce ai închis, fără să te lupți cu un ecran monoton.
                        </p>
                    </div>
                    <AddTaskDialog onAddTask={handleAddTask} contacts={contacts || []}>
                        <Button className="agentfinder-tasks-primary-button h-12 rounded-2xl border border-sky-300/20 bg-sky-400/[0.15] px-5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(59,130,246,0.18)] hover:bg-sky-400/[0.25]">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Adaugă Task
                        </Button>
                    </AddTaskDialog>
                </div>
                <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        { label: 'Deschise', value: stats.open, icon: Clock3, tone: 'text-sky-200' },
                        { label: 'Întârziate', value: stats.overdue, icon: AlertTriangle, tone: 'text-amber-200' },
                        { label: 'Finalizate', value: stats.completed, icon: CheckCircle2, tone: 'text-emerald-200' },
                        { label: 'Total', value: stats.total, icon: ListTodo, tone: 'text-white' },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="agentfinder-tasks-stat rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-4 backdrop-blur-sm"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                                <item.icon className={cn("h-4 w-4", item.tone)} />
                            </div>
                            <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <Tabs defaultValue="board" className="flex flex-1 flex-col overflow-hidden">
                <div className="agentfinder-tasks-tabs-shell rounded-[28px] border border-white/10 bg-[#12213E]/90 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
                    <TabsList className={cn(
                        "agentfinder-tasks-tabs-list grid h-auto w-full grid-cols-3 rounded-[20px] bg-white/5 p-1 text-white/60"
                    )}>
                        <TabsTrigger value="board" className="agentfinder-tasks-tab flex items-center gap-2 rounded-2xl py-3 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-950">
                            <LayoutGrid className="h-4 w-4" />
                            Panou
                        </TabsTrigger>
                        <TabsTrigger value="list" className="agentfinder-tasks-tab flex items-center gap-2 rounded-2xl py-3 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-950">
                            <ListTodo className="h-4 w-4" />
                            Listă
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="agentfinder-tasks-tab flex items-center gap-2 rounded-2xl py-3 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-950">
                            <CalendarDays className="h-4 w-4" />
                            Calendar
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="board" className="mt-5 flex-1">
                    <TasksBoard />
                </TabsContent>
                <TabsContent value="list" className="mt-5">
                    <TasksList />
                </TabsContent>
                <TabsContent value="calendar" className="mt-5 flex-1 overflow-hidden">
                    <TasksCalendar />
                </TabsContent>
            </Tabs>
        </div>
    );
}
