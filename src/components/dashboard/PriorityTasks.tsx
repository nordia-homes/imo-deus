import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Calendar, CheckCircle2, FileText, MessageSquare } from 'lucide-react';
import Link from 'next/link';

const tasks = [
    { title: 'Follow-ups', date: 'Apr 1', progress: '3/4 completat', icon: <MessageSquare className="text-blue-500" />, description: 'Reminders AI pentru follow-ups și check-ins.' },
    { title: 'Revizuire Contract', date: 'Apr 1', progress: '1/2 completat', icon: <FileText className="text-orange-500" />, description: 'Revizuire și aprobare AI a contractelor.' },
    { title: 'Facturi', date: 'Apr 2', progress: '1/5 plătit', icon: <CheckCircle2 className="text-green-500" />, description: 'Notifică clienții despre plată.' },
];

export function PriorityTasks() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Task-uri Prioritare</CardTitle>
                <Link href="/tasks" className="text-sm text-primary hover:underline">Vezi tot</Link>
            </CardHeader>
            <CardContent className="space-y-4">
                {tasks.map((task, index) => (
                    <div key={index} className="flex items-center gap-4 group">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            {task.icon}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-muted-foreground">{task.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">{task.date} &middot; {task.progress}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
