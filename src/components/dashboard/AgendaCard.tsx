'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckSquare, Eye, Calendar, Clock } from 'lucide-react';
import type { Task, Viewing } from '@/lib/types';
import { parseISO, format } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';

type AgendaItem = (
  | { type: 'task'; data: Task }
  | { type: 'viewing'; data: Viewing }
) & { sortTime: Date };

export function AgendaCard({ tasks, viewings }: { tasks: Task[]; viewings: Viewing[] }) {

  const agendaItems: AgendaItem[] = [
    ...tasks.map(t => ({
      type: 'task' as const,
      data: t,
      sortTime: t.startTime ? parseISO(`${t.dueDate}T${t.startTime}`) : parseISO(t.dueDate)
    })),
    ...viewings.map(v => ({
      type: 'viewing' as const,
      data: v,
      sortTime: parseISO(v.viewingDate)
    }))
  ].sort((a, b) => a.sortTime.getTime() - b.sortTime.getTime());

  const renderContent = () => {
    if (agendaItems.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="font-semibold">Nicio activitate programată</h3>
          <p className="text-sm">Bucură-te de o zi liberă!</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {agendaItems.map(item => {
          if (item.type === 'task') {
            const task = item.data;
            return (
              <Link href={`/tasks`} key={`task-${task.id}`} className="flex items-start gap-4 group p-2 -m-2 rounded-md hover:bg-accent">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{task.description}</p>
                    {task.startTime && (
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.startTime}
                      </p>
                    )}
                  </div>
                  {task.contactName && (
                    <p className="text-xs text-muted-foreground">
                      Client: {task.contactName}
                    </p>
                  )}
                </div>
              </Link>
            );
          }

          if (item.type === 'viewing') {
            const viewing = item.data;
            return (
              <Link href={`/properties/${viewing.propertyId}`} key={`viewing-${viewing.id}`} className="flex items-start gap-4 group p-2 -m-2 rounded-md hover:bg-accent">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                  <Eye className="h-5 w-5" />
                </div>
                <div className="flex-1">
                   <div className="flex justify-between">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{viewing.propertyTitle}</p>
                     <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(viewing.viewingDate), 'HH:mm')}
                      </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Vizionare cu: {viewing.contactName}</p>
                  <p className="text-xs text-muted-foreground">{viewing.propertyAddress}</p>
                </div>
              </Link>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <Card className="shadow-2xl rounded-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Agenda Zilei - {format(new Date(), 'eeee, d MMMM', {locale: ro})}</CardTitle>
        <CardDescription>Sarcinile și vizionările programate pentru astăzi.</CardDescription>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}
