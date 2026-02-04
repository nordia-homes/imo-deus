'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Property, Viewing, Contact, Task } from '@/lib/types';
import { Calendar, Eye, Phone, Box } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';
import { PropertyTimeline } from './PropertyTimeline';

type PropertyActionPanelProps = {
  property: Property;
  viewings: Viewing[];
  matchedLeads: Contact[];
  tasks: Task[];
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => void;
};

const StatCard = ({ icon, title, value }: { icon: React.ReactNode, title: string, value: number }) => (
    <Card className="shadow-none border-0 bg-secondary rounded-2xl">
        <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-background rounded-lg">{icon}</div>
                <p className="font-semibold text-sm">{title}</p>
            </div>
            <p className="font-bold text-lg">{value}</p>
        </CardContent>
    </Card>
);

export function PropertyActionPanel({ property, viewings, matchedLeads, tasks, onAddTask }: PropertyActionPanelProps) {

    const todayViewings = viewings.filter(v => isToday(parseISO(v.viewingDate)));
    
    return (
        <div className="space-y-4 sticky top-28">
            <StatCard icon={<Eye className="h-5 w-5 text-primary" />} title="Vizionări" value={viewings.length} />
            <StatCard icon={<Phone className="h-5 w-5 text-primary" />} title="Lead-uri" value={matchedLeads.length} />
            <StatCard icon={<Box className="h-5 w-5 text-primary" />} title="Task-uri" value={tasks.length} />

            {todayViewings.length > 0 && (
                <Card className="shadow-none border-0 bg-secondary rounded-2xl">
                    <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-background rounded-lg"><Calendar className="h-5 w-5 text-primary" /></div>
                                <p className="font-semibold text-sm">Vizionare azi</p>
                            </div>
                            <p className="font-bold text-lg">{todayViewings.length}</p>
                        </div>
                         <Link href="#" className="text-xs text-muted-foreground block text-right mt-1 hover:underline">
                            Azi la {format(parseISO(todayViewings[0].viewingDate), 'HH:mm')} >
                        </Link>
                    </CardContent>
                </Card>
            )}

            <PropertyTimeline property={property} viewings={viewings} tasks={tasks} onAddTask={onAddTask} />

        </div>
    );
}
