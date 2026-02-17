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
} from 'date-fns';
import { ro } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Phone, Calendar, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { WhatsappIcon } from '../icons/WhatsappIcon';
import Image from 'next/image';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface ViewingsCalendarProps {
  viewings?: Viewing[];
  agents?: UserProfile[];
  properties?: Property[];
  contacts?: Contact[];
  onEdit: (viewing: Viewing) => void;
  onDelete: (viewing: Viewing) => void;
}

const getAgentForViewing = (viewing: Viewing, agents: UserProfile[]) => {
  return agents.find(agent => agent.id === viewing.agentId);
};

const getStatusVariant = (status: Viewing['status']) => {
    switch (status) {
        case 'completed': return 'success';
        case 'cancelled': return 'destructive';
        case 'scheduled': return 'default';
        default: return 'outline';
    }
};

export function ViewingsCalendar({ viewings = [], agents = [], properties = [], contacts = [], onEdit, onDelete }: ViewingsCalendarProps) {
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
    <Card className="shadow-2xl rounded-2xl bg-[#152A47] text-white border-none">
      <CardContent className="p-4">
        {/* Header */}
        <header className="flex items-center justify-between px-2 mb-4">
          <div className="flex items-center gap-4">
            <Button onClick={() => setSelectedDay(new Date())} variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              Astăzi
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek('prev')}
                className="hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek('next')}
                className="hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <h2 className="text-xl font-semibold capitalize text-white">
            {format(selectedDay, 'MMMM yyyy', { locale: ro })}
          </h2>
        </header>

        {/* Week Selector */}
        <div className="grid grid-cols-7 gap-1 mb-6">
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
                  'flex flex-col items-center p-1 rounded-lg transition-colors',
                  isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-white/10'
                )}
              >
                <span className={cn("text-xs uppercase font-medium text-white/70 mb-1", isSelected && 'text-primary-foreground/70')} >
                  {format(day, 'eee', { locale: ro })}
                </span>
                <span
                  className={cn(
                    'text-base font-bold w-7 h-7 flex items-center justify-center rounded-full',
                    isCurrent && !isSelected && 'bg-white/20 text-white'
                  )}
                >
                  {format(day, 'd')}
                </span>
                <div className="flex items-center mt-2 h-4">
                  {dayViewings.slice(0, 3).map((v, i) => {
                    const agent = getAgentForViewing(v, agents);
                    return (
                        <Avatar key={i} className={cn("h-4 w-4 border-[#152A47]", i > 0 && "-ml-1.5")}>
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
              {selectedDayViewings.map((viewing) => {
                const { property, contact, agent } = viewing;
                const contactPhone = contact?.phone?.replace(/\D/g, '');
                const ownerPhone = property?.ownerPhone?.replace(/\D/g, '');

                return (
                    <Card key={viewing.id} className="bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-sm overflow-hidden">
                        <div className="md:flex">
                             <div className="md:w-1/3 relative aspect-video md:aspect-auto">
                                {property?.images?.[0]?.url ? (
                                    <Image
                                        src={property.images[0].url}
                                        alt={property.title}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 100vw, 33vw"
                                    />
                                ) : (
                                    <div className="bg-white/5 h-full flex items-center justify-center">
                                        <p className="text-xs text-white/50">Imagine lipsă</p>
                                    </div>
                                )}
                                <div className="absolute bottom-2 left-2">
                                    <Button variant="secondary" className="bg-background/70 text-white backdrop-blur-sm pointer-events-none h-auto py-1 px-3 text-sm">
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {format(parseISO(viewing.viewingDate), 'd MMM, HH:mm', { locale: ro })}
                                    </Button>
                                </div>
                            </div>
                            <div className="p-4 flex-1">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1">
                                        <Link href={`/properties/${viewing.propertyId}`} className="font-semibold text-lg text-white hover:underline">
                                            {viewing.propertyTitle}
                                        </Link>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={getStatusVariant(viewing.status)}>{viewing.status}</Badge>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:bg-white/20 hover:text-white">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => onEdit(viewing)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Editează
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => onDelete(viewing)} className="text-destructive focus:bg-destructive/20 focus:text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Șterge
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                
                                <Separator className="my-3 bg-white/10" />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    {/* Client Info */}
                                    <div className="space-y-1">
                                        <p className="text-xs text-white/60">Client</p>
                                        <div className="flex items-center justify-between">
                                            <Link href={`/leads/${viewing.contactId}`} className="font-medium hover:underline text-white/90">{viewing.contactName}</Link>
                                            {contactPhone && (
                                                <div className="flex items-center">
                                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:bg-white/10" asChild>
                                                        <a href={`tel:${contactPhone}`}><Phone className="h-4 w-4 text-green-400" /></a>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:bg-white/10" asChild>
                                                        <a href={`https://wa.me/${contactPhone}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon className="h-4 w-4 text-green-400" /></a>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Owner Info */}
                                    {property?.ownerName && (
                                        <div className="space-y-1">
                                            <p className="text-xs text-white/60">Proprietar</p>
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium text-white/90">{property.ownerName}</p>
                                                {ownerPhone && (
                                                     <div className="flex items-center">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:bg-white/10" asChild>
                                                            <a href={`tel:${ownerPhone}`}><Phone className="h-4 w-4 text-gray-400" /></a>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:bg-white/10" asChild>
                                                            <a href={`https://wa.me/${ownerPhone}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon className="h-4 w-4 text-gray-400" /></a>
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="mt-3 pt-3 border-t border-white/10">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={agent?.photoUrl || undefined} />
                                            <AvatarFallback className="text-xs bg-white/20">{agent?.name?.charAt(0) || 'A'}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-white/70">Agent: {agent?.name || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-white/70">
              Nicio vizionare programată pentru această zi.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
