'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Interaction, Task } from '@/lib/types';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Phone, Mail, FileText, CheckSquare, Activity, Users, Eye } from 'lucide-react';
import React, { useMemo } from 'react';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { InteractionLogger } from './InteractionLogger';

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


const TimelineItem = ({ item }: { item: TimelineItemData }) => {
    const isCompleted = item.itemKind === 'task' && item.status === 'completed';
    
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
             <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                {getTimelineIcon(item)}
            </div>
            <div className="flex-1">
                <div className="flex items-baseline justify-between text-sm">
                    <p className="font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(dateToShow, { addSuffix: true, locale: ro })}
                    </p>
                </div>
                 <p className="text-xs text-muted-foreground whitespace-pre-wrap">{details}</p>
            </div>
        </div>
    )
}

type LeadTimelineProps = {
  interactions: Interaction[];
  tasks: Task[];
  onAddInteraction: (interactionData: Omit<Interaction, 'id' | 'date' | 'agent'>) => Promise<void>;
};

export function LeadTimeline({ interactions, tasks, onAddInteraction }: LeadTimelineProps) {
  const timelineItems = React.useMemo(() => {
    const combined: TimelineItemData[] = [];
    interactions.forEach(i => combined.push({ ...i, itemKind: 'interaction', sortDate: new Date(i.date) }));
    tasks.forEach(t => combined.push({ ...t, itemKind: 'task', sortDate: new Date(t.dueDate) }));
    return combined.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
  }, [interactions, tasks]);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Cronologie & Notițe</CardTitle>
        <CardDescription className="text-xs">Adaugă o notiță sau înregistrează un apel/email.</CardDescription>
        <div className="pt-2">
            <InteractionLogger onAddInteraction={onAddInteraction} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
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
