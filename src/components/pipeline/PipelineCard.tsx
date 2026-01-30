'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Contact } from '@/lib/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function PipelineCard({ contact }: { contact: Contact }) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: contact.id,
    data: {
      type: 'Contact',
      contact,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab touch-none hover:shadow-md transition-shadow',
        isDragging && 'opacity-50 z-50 shadow-2xl ring-2 ring-primary',
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
            <Link href={`/leads/${contact.id}`} className="font-semibold text-sm hover:underline flex-1" onClick={stopPropagation}>
                {contact.name}
            </Link>
            <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Buget: €{contact.budget?.toLocaleString() || 'N/A'}
        </p>
        {typeof contact.leadScore === 'number' && (
            <Badge variant="outline" className="mt-2 text-xs font-normal">Scor AI: {contact.leadScore}</Badge>
        )}
      </CardContent>
    </Card>
  );
}
