
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import type { Interaction, Task } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Phone, Mail, FileText, CheckSquare, Activity, Users, Eye } from 'lucide-react';
import React, { useMemo } from 'react';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { AddInteractionPopover } from './AddInteractionPopover';
import { Button } from '@/components/ui/button';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';


type TimelineItemData = (
  | ({ itemKind: 'interaction' } & Interaction)
  | ({ itemKind: 'task' } & Task)
) & { sortDate: Date };

const getInteractionIcon = (type: Interaction['type']) => {
    switch (type) {
        case 'Apel telefonic': return <Phone className="h-4 w-4 text-muted-foreground" />;
        case 'WhatsApp': return <WhatsappIcon className="h-4 w-4 text-muted-foreground" />;
        case 'Email': return <Mail className="h-4 w-4 text-muted-foreground" />;
        case 'Notiță': return <FileText className="h-4 w-4 text-muted-foreground" />;
        case 'Întâlnire': return <Users className="h-4 w-4 text-muted-foreground" />;
        case 'Ofertă': return <FileText className="h-4 w-4 text-muted-foreground" />;
        default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
};

const getTimelineIcon = (item: TimelineItemData) => {
    switch (item.itemKind) {
        case 'interaction': return getInteractionIcon(item.type);
        case 'task': return <CheckSquare className="h-4 w-4 text-muted-foreground" />;
        default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
};


type LeadTimelineProps = {
  interactions: Interaction[];
  tasks: Task[];
  onAddInteraction: (interactionData: Omit<Interaction, 'id' | 'date' | 'agent'>) => Promise<void>;
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => void;
  contacts: { id: string; name: string; }[];
  onToggleTask: (task: Task) => void;
};

export function LeadTimeline({ interactions, tasks, onAddInteraction, onAddTask, contacts, onToggleTask }: LeadTimelineProps) {
  const timelineItems = React.useMemo(() => {
    const combined: TimelineItemData[] = [];
    interactions.forEach(i => combined.push({ ...i, itemKind: 'interaction', sortDate: new Date(i.date) }));
    tasks.forEach(t => combined.push({ ...t, itemKind: 'task', sortDate: new Date(t.dueDate) }));
    return combined.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
  }, [interactions, tasks]);

  const handleInteractionSave = async (type: Interaction['type'], notes: string) => {
    await onAddInteraction({ type, notes });
  };
  
  const TimelineItem = ({ item }: { item: TimelineItemData }) => {
    const isTask = item.itemKind === 'task';
    const isCompleted = isTask && item.status === 'completed';
    
    let title: string;
    let details: string | React.ReactNode;
    let dateToShow = item.sortDate;

    switch (item.itemKind) {
        case 'interaction':
            title = item.type;
            details = item.notes;
            break;
        case 'task':
            title = `Task: ${item.description}`;
            details = `Agent: ${item.agentName || 'Nealocat'}`;
            break;
        default:
            title = 'Eveniment';
            details = '';
    }

    return (
        <div className="flex gap-3">
             <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                {isTask ? (
                    <Checkbox
                        checked={isCompleted}
                        onCheckedChange={() => onToggleTask(item as Task)}
                        aria-label="Toggle task"
                        className="size-5"
                    />
                ) : (
                    getTimelineIcon(item)
                )}
            </div>
            <div className="flex-1">
                <div className="flex items-baseline justify-between text-sm">
                    <p className={cn("font-semibold", isCompleted && "line-through text-muted-foreground")}>{title}</p>
                    <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(dateToShow, { addSuffix: true, locale: ro })}
                    </p>
                </div>
                 <p className="text-xs text-muted-foreground whitespace-pre-wrap">{details}</p>
            </div>
        </div>
    );
};

  return (
    <Card className="rounded-2xl shadow-2xl flex flex-col">
      <CardHeader className="p-4 space-y-3">
        <CardTitle className="text-base">Cronologie</CardTitle>
        <div className="grid grid-cols-2 gap-2">
            <AddInteractionPopover type="Apel telefonic" onSave={(notes) => handleInteractionSave('Apel telefonic', notes)}>
                <Button variant="outline" size="sm" className="w-full"><Phone className="mr-2 h-4 w-4" /> Apel</Button>
            </AddInteractionPopover>
            <AddInteractionPopover type="WhatsApp" onSave={(notes) => handleInteractionSave('WhatsApp', notes)}>
                <Button variant="outline" size="sm" className="w-full"><WhatsappIcon className="mr-2 h-4 w-4" /> WhatsApp</Button>
            </AddInteractionPopover>
            <AddInteractionPopover type="Notiță" onSave={(notes) => handleInteractionSave('Notiță', notes)}>
                <Button variant="outline" size="sm" className="w-full"><FileText className="mr-2 h-4 w-4" /> Notiță</Button>
            </AddInteractionPopover>
            <AddTaskDialog onAddTask={onAddTask} contacts={contacts}>
                 <Button variant="outline" size="sm" className="w-full"><CheckSquare className="mr-2 h-4 w-4" /> Task</Button>
            </AddTaskDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto flex-1 p-4 pt-0">
        {timelineItems.length > 0 ? (
          timelineItems.map((item, index) => <TimelineItem key={`${item.itemKind}-${item.id || index}`} item={item} />)
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            <Activity className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2">Niciun istoric.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
