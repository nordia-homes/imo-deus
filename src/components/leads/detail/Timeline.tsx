'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Interaction, Task, Contact } from '@/lib/types';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Phone, MoreHorizontal, Check, Calendar, Mail, FileText, CheckSquare, Clock } from 'lucide-react';
import React, { useMemo } from 'react';
import { AddInteractionPopover } from './AddInteractionPopover';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { Badge } from '@/components/ui/badge';

type TimelineItemData = (
  | ({ itemKind: 'interaction' } & Interaction)
  | ({ itemKind: 'task' } & Task)
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
                        {item.itemKind === 'interaction' ? getInteractionIcon(item.type) : <Check className="h-4 w-4" />}
                        <span>{item.itemKind === 'interaction' ? item.type : item.description}</span>
                    </div>
                </div>
                 <CardDescription className="text-xs pt-1 whitespace-pre-wrap">
                    {item.itemKind === 'interaction' ? item.notes : `Scadent: ${new Date(item.dueDate).toLocaleDateString('ro-RO')}`}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-xs text-muted-foreground flex justify-between">
                <span>{item.itemKind === 'interaction' ? item.agent?.name || 'Sistem' : item.agentName || 'Nealocat'}</span>
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
        interactions.forEach(i => combined.push({ ...i, itemKind: 'interaction', sortDate: new Date(i.date) }));
        tasks.forEach(t => combined.push({ ...t, itemKind: 'task', sortDate: new Date(t.dueDate) }));
        return combined.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
    }, [interactions, tasks]);

    const groupedItems = useMemo(() => {
        const today = new Date();
        const groups: Record<string, TimelineItemData[]> = {};

        for (const item of timelineItems) {
            const itemDate = item.sortDate;
            const diff = differenceInDays(today, itemDate);

            let groupKey: string;

            if (diff < 0) {
                groupKey = 'Viitor';
            } else if (diff === 0) {
                groupKey = 'Azi';
            } else if (diff === 1) {
                groupKey = 'Ieri';
            } else if (diff < 7) {
                groupKey = 'Săptămâna aceasta';
            } else {
                groupKey = 'Mai vechi';
            }

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
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


    const handleSaveInteraction = (type: Interaction['type']) => async (notes: string) => {
        await onAddInteraction({ type, notes });
    };

    const creationDate = contact.createdAt ? new Date(contact.createdAt) : null;
    const ageInDays = creationDate ? differenceInDays(new Date(), creationDate) : null;

    let ageBadgeVariant: 'success' | 'warning' | 'destructive' = 'success';
    if (ageInDays !== null) {
        if (ageInDays > 30) {
            ageBadgeVariant = 'destructive';
        } else if (ageInDays >= 14) {
            ageBadgeVariant = 'warning';
        }
    }

  return (
    <div className="space-y-4">
        {creationDate && (
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="px-3 py-1 text-xs font-normal">
                    <Calendar className="mr-2 h-3.5 w-3.5" />
                    Creat: {format(creationDate, 'd MMM yyyy', { locale: ro })}
                </Badge>
                {ageInDays !== null && (
                     <Badge variant={ageBadgeVariant} className="px-3 py-1 text-xs">
                        <Clock className="mr-2 h-3.5 w-3.5" />
                        Vechime: {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}
                    </Badge>
                )}
            </div>
        )}

      <Card className="rounded-2xl">
        <CardContent className="p-2 grid grid-cols-2 gap-2">
            <AddInteractionPopover type="Apel telefonic" onSave={handleSaveInteraction('Apel telefonic')}>
                <Button variant="outline" className="w-full"><Phone className="h-4 w-4" />Apel</Button>
            </AddInteractionPopover>
            <AddInteractionPopover type="WhatsApp" onSave={handleSaveInteraction('WhatsApp')}>
                <Button variant="outline" className="w-full"><WhatsappIcon className="h-4 w-4" />WhatsApp</Button>
            </AddInteractionPopover>
             <AddInteractionPopover type="Notiță" onSave={handleSaveInteraction('Notiță')}>
                <Button variant="outline" className="w-full"><FileText className="h-4 w-4" />Notiță</Button>
            </AddInteractionPopover>
            <AddTaskDialog onAddTask={onAddTask} contacts={[contact]}>
                 <Button variant="outline" className="w-full"><CheckSquare className="h-4 w-4" />Task</Button>
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
                       {items.map((item, index) => <TimelineItem key={`${item.itemKind}-${item.id || index}`} item={item} />)}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>

      </div>

    </div>
  );
}
