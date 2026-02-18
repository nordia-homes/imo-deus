
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
        case 'Apel telefonic': return <Phone className="h-4 w-4 text-white/70" />;
        case 'WhatsApp': return <WhatsappIcon className="h-4 w-4 text-white/70" />;
        case 'Email': return <Mail className="h-4 w-4 text-white/70" />;
        case 'Notiță': return <FileText className="h-4 w-4 text-white/70" />;
        case 'Întâlnire': return <Users className="h-4 w-4 text-white/70" />;
        case 'Ofertă': return <FileText className="h-4 w-4 text-white/70" />;
        default: return <Activity className="h-4 w-4 text-white/70" />;
    }
};

const getTimelineIcon = (item: TimelineItemData) => {
    switch (item.itemKind) {
        case 'interaction': return getInteractionIcon(item.type);
        case 'task': return <CheckSquare className="h-4 w-4 text-white/70" />;
        default: return <Activity className="h-4 w-4 text-white/70" />;
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
             <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                {isTask ? (
                    <Checkbox
                        checked={isCompleted}
                        onCheckedChange={() => onToggleTask(item as Task)}
                        aria-label="Toggle task"
                        className="size-5 border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                ) : (
                    getTimelineIcon(item)
                )}
            </div>
            <div className="flex-1">
                <div className="flex items-baseline justify-between text-sm">
                    <p className={cn("font-semibold text-white", isCompleted && "line-through text-white/50")}>{title}</p>
                    <p className="text-xs text-white/70">
                        {formatDistanceToNow(dateToShow, { addSuffix: true, locale: ro })}
                    </p>
                </div>
                 <p className="text-xs text-white/70 whitespace-pre-wrap">{details}</p>
            </div>
        </div>
    );
};

  return (
    <Card className="rounded-2xl shadow-2xl flex flex-col bg-[#152A47] border-none text-white">
      <CardHeader className="p-4 space-y-3">
        <CardTitle className="text-base text-white">Cronologie</CardTitle>
        <div className="grid grid-cols-2 gap-2">
            <AddInteractionPopover type="Apel telefonic" onSave={(notes) => handleInteractionSave('Apel telefonic', notes)}>
                <Button variant="outline" size="sm" className="w-full bg-white/10 border-white/20 hover:bg-white/20"><Phone className="mr-2 h-4 w-4" /> Apel</Button>
            </AddInteractionPopover>
            <AddInteractionPopover type="WhatsApp" onSave={(notes) => handleInteractionSave('WhatsApp', notes)}>
                <Button variant="outline" size="sm" className="w-full bg-white/10 border-white/20 hover:bg-white/20"><WhatsappIcon className="mr-2 h-4 w-4" /> WhatsApp</Button>
            </AddInteractionPopover>
            <AddInteractionPopover type="Notiță" onSave={(notes) => handleInteractionSave('Notiță', notes)}>
                <Button variant="outline" size="sm" className="w-full bg-white/10 border-white/20 hover:bg-white/20"><FileText className="mr-2 h-4 w-4" /> Notiță</Button>
            </AddInteractionPopover>
            <AddTaskDialog onAddTask={onAddTask} contacts={contacts}>
                 <Button variant="outline" size="sm" className="w-full bg-white/10 border-white/20 hover:bg-white/20"><CheckSquare className="mr-2 h-4 w-4" /> Task</Button>
            </AddTaskDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto flex-1 p-4 pt-0">
        {timelineItems.length > 0 ? (
          timelineItems.map((item, index) => <TimelineItem key={`${item.itemKind}-${item.id || index}`} item={item} />)
        ) : (
          <div className="text-center text-sm text-white/70 py-8">
            <Activity className="mx-auto h-8 w-8 text-white/50" />
            <p className="mt-2">Niciun istoric.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
