'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Interaction, Task, Contact } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Phone, MoreHorizontal, Check, Calendar, Mail, FileText, CheckSquare } from 'lucide-react';
import React, { useMemo } from 'react';
import { AddInteractionPopover } from './AddInteractionPopover';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';

type TimelineItemData = (
  | ({ type: 'interaction' } & Interaction)
  | ({ type: 'task' } & Task)
) & { sortDate: Date };

const getInteractionIcon = (type: Interaction['type']) => {
    switch (type) {
        case 'Apel telefonic': return <Phone className="h-4 w-4" />;
        case 'WhatsApp': return <WhatsappIcon className="h-4 w-4" />;
        case 'Email': return <Mail className="h-4 w-4" />;
        case 'Ofertă': return <FileText className="h-4 w-4" />;
        default: return <Calendar className="h-4 w-4" />;
    }
};

const TimelineItem = ({ item }: { item: TimelineItemData }) => {
    return (
        <Card className="bg-background">
            <CardHeader className="p-3">
                <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2 text-sm font-semibold">
                        {item.type === 'interaction' ? getInteractionIcon(item.type as Interaction['type']) : <Check className="h-4 w-4" />}
                        <span>{item.type === 'interaction' ? item.type : item.description}</span>
                    </div>
                </div>
                 <CardDescription className="text-xs pt-1 whitespace-pre-wrap">
                    {item.type === 'interaction' ? item.notes : `Scadent: ${new Date(item.dueDate).toLocaleDateString('ro-RO')}`}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-xs text-muted-foreground flex justify-between">
                <span>{item.type === 'interaction' ? item.agent?.name || 'Sistem' : item.agentName || 'Nealocat'}</span>
                <span>{formatDistanceToNow(item.sortDate, { addSuffix: true, locale: ro })}</span>
            </CardContent>
        </Card>
    )
}


type LeadTimelineProps = {
  interactions: Interaction[];
  tasks: Task[];
  contact: Contact;
  onAddInteraction: (interactionData: Omit<Interaction, 'id' | 'date' | 'agent'>) => Promise<void>;
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => void;
};

export function LeadTimeline({ interactions, tasks, contact, onAddInteraction, onAddTask }: LeadTimelineProps) {
    const timelineItems = useMemo(() => {
        const combined: TimelineItemData[] = [];
        interactions.forEach(i => combined.push({ ...i, type: 'interaction', sortDate: new Date(i.date) }));
        tasks.forEach(t => combined.push({ ...t, type: 'task', sortDate: new Date(t.dueDate) }));
        return combined.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
    }, [interactions, tasks]);

    const today = new Date();
    const groupedItems = timelineItems.reduce((acc, item) => {
        const itemDate = item.sortDate;
        const diffDays = (today.setHours(0,0,0,0) - itemDate.setHours(0,0,0,0)) / (1000 * 3600 * 24);

        let groupKey = 'Mai vechi';
        if (diffDays < 1) groupKey = 'Azi';
        else if (diffDays < 2) groupKey = 'Ieri';
        else if (diffDays < 7) groupKey = 'Săptămâna aceasta';
        
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(item);
        return acc;
    }, {} as Record<string, TimelineItemData[]>);

    const handleSaveInteraction = (type: Interaction['type']) => async (notes: string) => {
        await onAddInteraction({ type, notes });
    };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-2 grid grid-cols-2 gap-2">
            <AddInteractionPopover type="Apel telefonic" onSave={handleSaveInteraction('Apel telefonic')}>
                <Button variant="outline" className="w-full"><Phone className="h-4 w-4 mr-2" />Apel</Button>
            </AddInteractionPopover>
            <AddInteractionPopover type="WhatsApp" onSave={handleSaveInteraction('WhatsApp')}>
                <Button variant="outline" className="w-full"><WhatsappIcon className="h-4 w-4 mr-2" />WhatsApp</Button>
            </AddInteractionPopover>
             <AddInteractionPopover type="Notiță" onSave={handleSaveInteraction('Notiță')}>
                <Button variant="outline" className="w-full"><FileText className="h-4 w-4 mr-2" />Notiță</Button>
            </AddInteractionPopover>
            <AddTaskDialog onAddTask={onAddTask} contacts={[contact]}>
                 <Button variant="outline" className="w-full"><CheckSquare className="h-4 w-4 mr-2" />Task</Button>
            </AddTaskDialog>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        <h2 className="font-semibold text-lg px-2">Cronologie</h2>

        <Accordion type="multiple" defaultValue={['Azi', 'Ieri']} className="w-full space-y-4">
            {Object.entries(groupedItems).map(([group, items]) => (
                 <AccordionItem key={group} value={group} className="border-none">
                    <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:no-underline p-2 rounded-lg hover:bg-muted">
                        {group} ({items.length})
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                       {items.map((item, index) => <TimelineItem key={`${item.type}-${item.id || index}`} item={item} />)}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>

      </div>

    </div>
  );
}
