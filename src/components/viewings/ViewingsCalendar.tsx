'use client';

import React, { useMemo, useState } from 'react';
import type { Viewing, UserProfile, Property, Contact } from '@/lib/types';
import {
  format,
  startOfWeek,
  addDays,
  isToday,
  isSameMonth,
  parseISO,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { ro } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { WhatsappIcon } from '../icons/WhatsappIcon';

interface ViewingsCalendarProps {
  viewings: Viewing[];
  agents: UserProfile[];
  properties: Property[];
  contacts: Contact[];
}

const getAgentForViewing = (viewing: Viewing, agents: UserProfile[]) => {
  return agents.find(agent => agent.id === viewing.agentId);
};

export function ViewingsCalendar({ viewings, agents, properties, contacts }: ViewingsCalendarProps) {
  const [selectedDay, setSelectedDay] = useState(new Date());

  const viewingsByDay = useMemo(() => {
    const grouped: { [key: string]: Viewing[] } = {};
    if (!viewings) return grouped;

    viewings.forEach((viewing) => {
      const dayKey = format(parseISO(viewing.viewingDate), 'yyyy-MM-dd');
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(viewing);
    });
    return grouped;
  }, [viewings]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDay, { weekStartsOn: 1 }); // Start week on Monday
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [selectedDay]);

  const selectedDayViewings = useMemo(() => {
    const dayKey = format(selectedDay, 'yyyy-MM-dd');
    const dayViewings = (viewingsByDay[dayKey] || []);
    
    const enrichedViewings = dayViewings.map(viewing => {
      const property = properties.find(p => p.id === viewing.propertyId);
      const contact = contacts.find(c => c.id === viewing.contactId);
      const agent = agents.find(a => a.id === viewing.agentId);
      return { ...viewing, property, contact, agent };
    });

    return enrichedViewings.sort((a, b) =>
      parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime()
    );
  }, [selectedDay, viewingsByDay, properties, contacts, agents]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const amount = direction === 'prev' ? -7 : 7;
    setSelectedDay(current => addDays(current, amount));
  };

  return (
    <Card className="shadow-2xl rounded-2xl">
      <CardContent className="p-4">
        {/* Header */}
        <header className="flex items-center justify-between px-2 mb-4">
          <div className="flex items-center gap-4">
            <Button onClick={() => setSelectedDay(new Date())} variant="outline">
              Astăzi
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek('prev')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek('next')}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <h2 className="text-xl font-semibold capitalize">
            {format(selectedDay, 'MMMM yyyy', { locale: ro })}
          </h2>
        </header>

        {/* Week Selector */}
        <div className="grid grid-cols-7 gap-2 mb-6">
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayViewings = viewingsByDay[dayKey] || [];
            const isSelected = isSameDay(day, selectedDay);
            const isCurrent = isToday(day);

            return (
              <button
                key={dayKey}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'flex flex-col items-center p-2 rounded-lg transition-colors',
                  isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                <span className={cn("text-xs uppercase font-medium text-muted-foreground mb-1", isSelected && 'text-primary-foreground/70')} >
                  {format(day, 'eee', { locale: ro })}
                </span>
                <span
                  className={cn(
                    'text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full',
                    isCurrent && !isSelected && 'bg-accent text-accent-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
                <div className="flex items-center mt-2 h-4">
                  {dayViewings.slice(0, 3).map((v, i) => {
                    const agent = getAgentForViewing(v, agents);
                    return (
                        <Avatar key={i} className={cn("h-4 w-4 border-background", i > 0 && "-ml-1.5")}>
                            <AvatarImage src={agent?.photoUrl || `https://i.pravatar.cc/32?u=${v.agentId}`} alt={agent?.name || 'Agent'} />
                            <AvatarFallback className="text-[8px]">{agent?.name?.charAt(0) || 'A'}</AvatarFallback>
                        </Avatar>
                    )
                  })}
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Timeline for selected day */}
        <div>
          {selectedDayViewings.length > 0 ? (
            <div className="space-y-4">
              {selectedDayViewings.map((viewing, index) => (
                <div key={viewing.id} className="flex items-start gap-4">
                  <div className="w-16 text-right text-sm font-medium text-muted-foreground">
                    {format(parseISO(viewing.viewingDate), 'HH:mm')}
                  </div>
                  <div className="relative flex-1 pb-4">
                      {index < selectedDayViewings.length - 1 && (
                        <div className="absolute left-[9px] top-5 h-full w-px bg-border"></div>
                      )}
                      <div className="absolute left-0 top-0 h-5 w-5 rounded-full bg-primary ring-4 ring-background flex items-center justify-center">
                         <div className="h-2 w-2 rounded-full bg-primary-foreground"></div>
                      </div>
                      <div className="pl-8 space-y-1">
                          <p className="font-semibold">{viewing.propertyTitle}</p>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="w-16">Client:</span>
                              <span>{viewing.contactName} {viewing.contact?.phone && `(${viewing.contact.phone})`}</span>
                              {viewing.contact?.phone && (
                                  <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                          <a href={`tel:${viewing.contact.phone}`}><Phone className="h-4 w-4 text-green-600" /></a>
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                          <a href={`https://wa.me/${viewing.contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon className="h-4 w-4 text-green-600" /></a>
                                      </Button>
                                  </div>
                              )}
                          </div>

                          {(viewing.agent?.name || viewing.agentName) && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span className="w-16">Agent:</span>
                                  <span>{viewing.agent?.name || viewing.agentName}</span>
                              </div>
                          )}

                          {viewing.property?.ownerName && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span className="w-16">Proprietar:</span>
                                  <span>{viewing.property.ownerName} {viewing.property.ownerPhone && `(${viewing.property.ownerPhone})`}</span>
                                  {viewing.property.ownerPhone && (
                                      <div className="flex items-center gap-1">
                                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                              <a href={`tel:${viewing.property.ownerPhone}`}><Phone className="h-4 w-4 text-green-600" /></a>
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                              <a href={`https://wa.me/${viewing.property.ownerPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon className="h-4 w-4 text-green-600" /></a>
                                          </Button>
                                      </div>
                                  )}
                              </div>
                          )}

                          <Link href={`/properties/${viewing.propertyId}`}>
                            <Button variant="link" className="p-0 h-auto text-xs">Vezi proprietate</Button>
                          </Link>
                      </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nicio vizionare programată pentru această zi.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
