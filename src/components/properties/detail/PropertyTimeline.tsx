'use client';

import React, { useMemo } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type { Viewing, Task, Property } from '@/lib/types';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Calendar, CheckSquare, Eye, Clock, FileText } from 'lucide-react';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';

type TimelineItemData = (
  | ({ itemKind: 'viewing' } & Viewing)
  | ({ itemKind: 'task' } & Task)
) & { sortDate: Date };

const getTimelineIcon = (item: TimelineItemData) => {
    if (item.itemKind === 'viewing') {
        return <Eye className="h-4 w-4" />;
    }
    if (item.itemKind === 'task') {
        return <CheckSquare className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
};

const TimelineItem = ({ item }: { item: TimelineItemData }) => {
    const title = item.itemKind === 'viewing' ? `Vizionare: ${item.contactName}` : item.description;
    const details = item.itemKind === 'viewing' ? `Agent: ${item.agentName}` : `Asociat cu: ${item.contactName || 'Nespecificat'}`;

    return (
        <Card className="bg-background shadow-lg">
            <CardHeader className="p-3">
                <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2 text-sm font-semibold">
                        {getTimelineIcon(item)}
                        <span>{title}</span>
                    </div>
                </div>
                 <CardDescription className="text-xs pt-1 whitespace-pre-wrap">
                    {details}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-xs text-muted-foreground flex justify-between">
                <span>{item.agentName || 'Nealocat'}</span>
                <span>{formatDistanceToNow(item.sortDate, { addSuffix: true, locale: ro })}</span>
            </CardContent>
        </Card>
    );
};

type PropertyTimelineProps = {
  property: Property;
  viewings: Viewing[];
  tasks: Task[];
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => void;
};

export function PropertyTimeline({ property, viewings, tasks, onAddTask }: PropertyTimelineProps) {
    const timelineItems = useMemo(() => {
        const combined: TimelineItemData[] = [];
        viewings.forEach(v => combined.push({ ...v, itemKind: 'viewing', sortDate: new Date(v.viewingDate) }));
        tasks.forEach(t => combined.push({ ...t, itemKind: 'task', sortDate: new Date(t.dueDate) }));
        return combined.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
    }, [viewings, tasks]);

    const groupedItems = useMemo(() => {
        const today = new Date();
        const groups: Record<string, TimelineItemData[]> = {};

        for (const item of timelineItems) {
            const itemDate = item.sortDate;
            const diff = differenceInDays(today, itemDate);

            let groupKey: string;
            if (diff < 0) groupKey = 'Viitor';
            else if (diff === 0) groupKey = 'Azi';
            else if (diff === 1) groupKey = 'Ieri';
            else if (diff < 7) groupKey = 'Săptămâna aceasta';
            else groupKey = 'Mai vechi';

            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(item);
        }
        
        const groupOrder = ['Azi', 'Ieri', 'Săptămâna aceasta', 'Viitor', 'Mai vechi'];
        const sortedGroupedItems = Object.entries(groups).sort(([a], [b]) => {
            const indexA = groupOrder.indexOf(a);
            const indexB = groupOrder.indexOf(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        return Object.fromEntries(sortedGroupedItems);
    }, [timelineItems]);


  return (
    <div className="space-y-4">
      <Card className="rounded-2xl shadow-2xl">
        <CardContent className="p-2 grid grid-cols-2 gap-2">
            <Button variant="outline" className="w-full"><Eye className="h-4 w-4" />Adaugă Vizionare</Button>
            <AddTaskDialog onAddTask={onAddTask} contacts={[]} property={property}>
                 <Button variant="outline" className="w-full"><CheckSquare className="h-4 w-4" />Adaugă Task</Button>
            </AddTaskDialog>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        <h2 className="font-semibold text-lg px-2">Cronologie</h2>
        
        {timelineItems.length === 0 && (
             <div className="text-center text-sm text-muted-foreground py-8">
                <Clock className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2">Niciun eveniment în cronologie.</p>
                <p>Adaugă o vizionare sau un task pentru a începe.</p>
            </div>
        )}

        <Accordion type="multiple" defaultValue={['Azi', 'Ieri']} className="w-full space-y-4">
            {Object.entries(groupedItems).map(([group, items]) => (
                 <AccordionItem key={group} value={group} className="border-none">
                    <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:no-underline p-2 rounded-lg hover:bg-muted">
                        {group} ({items.length})
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                       {items.map((item, index) => <TimelineItem key={`${item.itemKind}-${item.id || index}`} item={item} />)}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      </div>
    </div>
  );
}
