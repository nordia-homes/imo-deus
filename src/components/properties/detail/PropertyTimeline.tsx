'use client';
import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Viewing, Task, Property } from '@/lib/types';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Calendar, CheckSquare, Eye, Clock, FileText } from 'lucide-react';

type TimelineItemData = (
  | ({ itemKind: 'viewing' } & Viewing)
  | ({ itemKind: 'task' } & Task)
) & { sortDate: Date };

const getTimelineIcon = (item: TimelineItemData) => {
    if (item.itemKind === 'viewing') {
        return <Eye className="h-4 w-4 text-muted-foreground" />;
    }
    if (item.itemKind === 'task') {
        return <CheckSquare className="h-4 w-4 text-muted-foreground" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
};

const TimelineItem = ({ item }: { item: TimelineItemData }) => {
    const title = item.itemKind === 'viewing' ? `Vizionare nouă: ${item.contactName}` : `Task: ${item.description}`;
    const details = item.itemKind === 'viewing' ? `Adresă: ${item.propertyAddress}` : `Agent: ${item.agentName}`;

    return (
         <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-1">
                {getTimelineIcon(item)}
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{details}</p>
                <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(item.sortDate, { addSuffix: true, locale: ro })}
                </p>
            </div>
        </div>
    );
};

export function PropertyTimeline({ property, viewings, tasks, onAddTask }: {
    property: Property;
    viewings: Viewing[];
    tasks: Task[];
    onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => void;
}) {
    const timelineItems = useMemo(() => {
        const combined: TimelineItemData[] = [];
        viewings.forEach(v => combined.push({ ...v, itemKind: 'viewing', sortDate: new Date(v.viewingDate) }));
        tasks.forEach(t => combined.push({ ...t, itemKind: 'task', sortDate: new Date(t.dueDate) }));
        return combined.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime()).slice(0, 4); // show latest 4
    }, [viewings, tasks]);

  return (
    <Card className="shadow-none border-0 bg-secondary rounded-2xl">
      <CardHeader className="p-3">
        <CardTitle className="text-base">Cronologie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-3 pt-0">
        {timelineItems.length > 0 ? (
          timelineItems.map((item, index) => <TimelineItem key={`${item.itemKind}-${item.id || index}`} item={item} />)
        ) : (
          <div className="text-center text-sm text-muted-foreground py-4">
            <Clock className="mx-auto h-6 w-6 text-gray-400" />
            <p className="mt-2">Niciun eveniment.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
