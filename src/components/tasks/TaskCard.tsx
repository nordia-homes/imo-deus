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
        zIndex: isDragging ? 10 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Card className={cn(
                "shadow-lg hover:shadow-xl transition-shadow group relative bg-white/10 border-white/20 text-white",
                task.status === 'completed' && 'bg-white/5 opacity-60'
            )}>
                <CardContent className="p-3">
                    <div className="flex justify-between items-start">
                        <p className={cn("font-medium text-sm pr-6 text-white/90", task.status === 'completed' && 'line-through text-white/50')}>
                            {task.description}
                        </p>
                        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-white/50 hover:text-white opacity-20 group-hover:opacity-100 transition-opacity absolute top-2 right-2 touch-none">
                            <GripVertical className="h-5 w-5" />
                        </button>
                    </div>
                    {(task.contactId && task.contactName) && (
                        <p className={cn("text-xs mt-2", task.status === 'completed' ? "text-white/50" : "text-white/70")}>
                            Pentru: <Link href={`/leads/${task.contactId}`} className="text-primary hover:underline">{task.contactName}</Link>
                        </p>
                    )}
                    {task.startTime && (
                         <p className={cn("text-xs mt-1", task.status === 'completed' ? "text-white/50" : "text-white/70")}>
                            Ora: {task.startTime}
                         </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
