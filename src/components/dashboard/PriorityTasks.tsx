'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CheckSquare, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Task } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

export function PriorityTasks({ tasks, isLoading }: { tasks: Task[] | null, isLoading: boolean }) {
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            )
        }

        if (!tasks || tasks.length === 0) {
            return <p className="text-sm text-center text-muted-foreground py-4">Niciun task prioritar. Ești la zi!</p>
        }

        return (
            <div className="space-y-4">
                {tasks.map((task) => (
                    <Link href={`/tasks`} key={task.id} className="flex items-center gap-4 group p-2 rounded-md hover:bg-accent">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                           <CheckSquare className="text-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-sm truncate">{task.description}</p>
                             <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Scadent: {new Date(task.dueDate).toLocaleDateString('ro-RO')}
                                {task.contactName && ` | ${task.contactName}`}
                            </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </Link>
                ))}
            </div>
        )
    }
    
    return (
        <Card className="shadow-2xl rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between rounded-t-2xl bg-[#152a47] p-3 text-white md:rounded-none md:bg-transparent md:p-6 md:text-card-foreground">
                <CardTitle className="text-base font-semibold">Task-uri Prioritare</CardTitle>
                <Link href="/tasks" className="text-sm text-white hover:underline md:text-primary">
                    Vezi tot
                </Link>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
                {renderContent()}
            </CardContent>
        </Card>
    );
}
