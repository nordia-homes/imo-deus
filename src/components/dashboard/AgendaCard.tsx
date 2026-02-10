'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckSquare, Eye, Calendar, Clock, Phone } from 'lucide-react';
import type { Task, Viewing, Contact, Property } from '@/lib/types';
import { parseISO, format } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '../ui/button';
import { WhatsappIcon } from '../icons/WhatsappIcon';

type AgendaItem = (
  | { type: 'task'; data: Task }
  | { type: 'viewing'; data: Viewing }
) & { sortTime: Date };

export function AgendaCard({ tasks, viewings, contacts, properties }: { tasks: Task[]; viewings: Viewing[]; contacts?: Contact[]; properties?: Property[] }) {

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
            const contact = contacts?.find(c => c.id === viewing.contactId);
            const property = properties?.find(p => p.id === viewing.propertyId);
            const contactPhone = contact?.phone?.replace(/\D/g, '');
            const ownerPhone = property?.ownerPhone?.replace(/\D/g, '');

            return (
              <div key={`viewing-${viewing.id}`} className="flex items-start gap-4 p-2 -m-2 rounded-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 shrink-0">
                  <Eye className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                   <div className="flex justify-between">
                    <Link href={`/properties/${viewing.propertyId}`} className="group">
                        <p className="font-medium text-sm group-hover:text-primary transition-colors truncate" title={viewing.propertyTitle}>{viewing.propertyTitle}</p>
                    </Link>
                     <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(viewing.viewingDate), 'HH:mm')}
                      </p>
                  </div>
                  <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate">Vizionare cu: {viewing.contactName}</p>
                      {contactPhone && (
                        <div className="flex items-center shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={`tel:${contactPhone}`}><Phone className="h-4 w-4 text-green-600" /></a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={`https://wa.me/${contactPhone}`} target="_blank"><WhatsappIcon className="h-4 w-4 text-green-600" /></a>
                          </Button>
                        </div>
                      )}
                  </div>
                  {property?.ownerName && (
                     <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate">Proprietar: {property.ownerName}</p>
                        {ownerPhone && (
                           <div className="flex items-center shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={`tel:${ownerPhone}`}><Phone className="h-4 w-4 text-gray-500" /></a>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={`https://wa.me/${ownerPhone}`} target="_blank"><WhatsappIcon className="h-4 w-4 text-gray-500" /></a>
                            </Button>
                            </div>
                        )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground truncate">{viewing.propertyAddress}</p>
                </div>
              </div>
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
