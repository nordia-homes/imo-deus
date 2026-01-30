'use client';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { Contact } from '@/lib/types';
import { PipelineCard } from './PipelineCard';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';

interface PipelineColumnProps {
  status: Contact['status'];
  contacts: Contact[];
}

function getStatusColor(status: Contact['status']) {
    switch(status) {
        case 'Nou': return 'bg-blue-500';
        case 'Contactat': return 'bg-cyan-500';
        case 'Vizionare': return 'bg-purple-500';
        case 'În negociere': return 'bg-yellow-500';
        case 'Câștigat': return 'bg-green-500';
        case 'Pierdut': return 'bg-gray-500';
        default: return 'bg-gray-400';
    }
}

export function PipelineColumn({ status, contacts }: PipelineColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
    data: {
        type: 'Column',
        status,
    }
  });

  return (
    <div
      className="h-[calc(100vh-14rem)] flex flex-col"
    >
      <div className="flex items-center justify-between p-2 rounded-t-lg bg-muted border-b sticky top-0 z-10">
         <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${getStatusColor(status)}`}></span>
            <h3 className="font-semibold text-sm">{status}</h3>
         </div>
         <Badge variant="secondary">{contacts.length}</Badge>
      </div>

      <ScrollArea ref={setNodeRef} className="flex-1 bg-muted/50 rounded-b-lg">
        <div className="p-2 space-y-2">
            <SortableContext items={contacts.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {contacts.map((contact) => (
                <PipelineCard key={contact.id} contact={contact} />
            ))}
            </SortableContext>
        </div>
      </ScrollArea>
    </div>
  );
}
