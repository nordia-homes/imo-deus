'use client';
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@/lib/types";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import { cn } from "@/lib/utils";

export function TaskCard({ task }: { task: Task }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({id: task.id});

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Card className={cn("shadow-sm hover:shadow-md transition-shadow group relative", task.status === 'completed' && 'bg-muted/70')}>
                <CardContent className="p-3">
                    <div className="flex justify-between items-start">
                        <p className={cn("font-medium text-sm pr-6", task.status === 'completed' && 'line-through text-muted-foreground')}>
                            {task.description}
                        </p>
                        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-20 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                            <GripVertical className="h-5 w-5" />
                        </button>
                    </div>
                    {(task.contactId && task.contactName) && (
                        <p className="text-xs text-muted-foreground mt-2">
                            Pentru: <Link href={`/leads/${task.contactId}`} className="text-primary hover:underline">{task.contactName}</Link>
                        </p>
                    )}
                    {task.startTime && (
                         <p className="text-xs text-muted-foreground mt-1">
                            Ora: {task.startTime}
                         </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
