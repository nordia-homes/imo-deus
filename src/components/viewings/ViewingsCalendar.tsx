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
import { ChevronLeft, ChevronRight, Phone, Calendar, MoreVertical, Edit, Trash2, Clock3, MapPin, UserRound, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { WhatsappIcon } from '../icons/WhatsappIcon';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from 'next/image';


interface ViewingsCalendarProps {
  viewings?: Viewing[];
  agents?: UserProfile[];
  properties?: Property[];
  contacts?: Contact[];
  onEdit: (viewing: Viewing) => void;
  onDelete: (viewing: Viewing) => void;
}

const getAgentForViewing = (viewing: Viewing, agents: UserProfile[]) => {
    if (!agents || agents.length === 0) return null;
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

const sanitizeForWhatsapp = (phone?: string | null) => {
    if (!phone) return '';
    let sanitized = phone.replace(/\D/g, '');
    if (sanitized.length === 10 && sanitized.startsWith('07')) {
        return `40${sanitized.substring(1)}`;
    }
    return sanitized;
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
      const property = properties?.find(p => p.id === viewing.propertyId);
      const contact = contacts?.find(c => c.id === viewing.contactId);
      const agent = agents?.find(a => a.id === viewing.agentId);
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
    <Card className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
      <CardContent className="min-w-0 w-full max-w-full overflow-x-hidden p-2 sm:p-4">
        {/* Header */}
        <header className="mb-4 flex w-full max-w-full flex-col gap-3 overflow-hidden px-1 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full min-w-0 items-center gap-3 overflow-hidden md:w-auto">
            <Button onClick={() => setSelectedDay(new Date())} variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              Astăzi
            </Button>
            <div className="flex shrink-0 items-center gap-2">
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
          <h2 className="w-full max-w-full overflow-hidden truncate whitespace-nowrap text-right text-lg font-semibold capitalize text-white sm:text-xl md:w-auto">
            {format(selectedDay, 'MMMM yyyy', { locale: ro })}
          </h2>
        </header>

        {/* Week Selector */}
        <div className="mb-6 grid w-full max-w-full grid-cols-7 gap-1 overflow-hidden">
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
                  'flex min-w-0 flex-col items-center rounded-lg p-1 transition-colors',
                  isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-white/10'
                )}
              >
                <span className={cn("mb-1 w-full overflow-hidden truncate whitespace-nowrap text-center text-[10px] uppercase font-medium text-white/70 sm:text-xs", isSelected && 'text-primary-foreground/70')} >
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
        <div className="min-w-0 w-full max-w-full">
          {selectedDayViewings.length > 0 ? (
            <div className="min-w-0 w-full max-w-full space-y-4">
              {selectedDayViewings.map((viewing) => {
                const { property, contact, agent } = viewing;
                const contactPhone = sanitizeForWhatsapp(contact?.phone);
                const ownerPhone = sanitizeForWhatsapp(property?.ownerPhone);

                return (
                    <Card key={viewing.id} className="group w-full max-w-full overflow-hidden rounded-[26px] border border-white/10 bg-[#152A47] shadow-[0_18px_44px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_56px_rgba(0,0,0,0.24)]">
                        <div className="flex flex-col md:flex-row">
                            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-[26px] md:aspect-[16/10] md:h-auto md:w-[320px] md:shrink-0 md:rounded-l-[26px] md:rounded-r-none">
                                {property?.images?.[0]?.url ? (
                                    <Image
                                        src={property.images[0].url}
                                        alt={property.title}
                                        fill
                                        className="[border-radius:inherit] object-cover transition-transform duration-300 will-change-transform group-hover:scale-[1.02]"
                                        sizes="(max-width: 768px) 100vw, 320px"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center [border-radius:inherit] bg-[#102238]">
                                        <p className="text-xs text-white/50">Imagine lipsă</p>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0F1E33]/55 via-transparent to-transparent" />
                                <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
                                    <Badge variant={getStatusVariant(viewing.status)}>{viewing.status}</Badge>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-black/25 text-white/85 backdrop-blur-sm hover:bg-black/40 hover:text-white">
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
                                <div className="absolute bottom-4 left-4 right-4">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0F1E33]/80 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                                        <Clock3 className="h-4 w-4 text-sky-300" />
                                        {format(parseISO(viewing.viewingDate), 'd MMM, HH:mm', { locale: ro })}
                                    </div>
                                </div>
                            </div>

                            <CardContent className="min-w-0 w-full max-w-full flex-1 overflow-hidden p-4 sm:p-6">
                                <div className="min-w-0 space-y-4 sm:space-y-5">
                                    <div className="min-w-0 space-y-2.5 sm:space-y-3">
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/75">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {format(parseISO(viewing.viewingDate), 'EEEE, d MMMM', { locale: ro })}
                                        </div>
                                        <Link href={`/properties/${viewing.propertyId}`} className="block max-w-full overflow-hidden text-xl font-semibold leading-tight text-white [overflow-wrap:anywhere] hover:underline sm:text-2xl">
                                            {viewing.propertyTitle}
                                        </Link>
                                        {viewing.propertyAddress && (
                                            <div className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden text-sm text-white/65">
                                                <MapPin className="h-4 w-4 shrink-0" />
                                                <span className="block min-w-0 max-w-full flex-1 truncate whitespace-nowrap">
                                                    {viewing.propertyAddress}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <Separator className="bg-white/10" />

                                    <div className={cn("grid max-w-full gap-3", property?.ownerName ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2")}>
                                        <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 sm:p-4">
                                            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45 sm:mb-3">
                                                <UserRound className="h-3.5 w-3.5" />
                                                Client
                                            </div>
                                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                                                <Link href={`/leads/${viewing.contactId}`} className="min-w-0 max-w-full flex-1 break-words font-medium text-white/90 hover:underline">{viewing.contactName}</Link>
                                                {contactPhone && (
                                                    <div className="ml-auto flex shrink-0 items-center gap-2 rounded-full bg-white/[0.04] px-1.5 py-1">
                                                        <a href={`tel:${contact?.phone}`} className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 transition-colors hover:bg-emerald-500/32 hover:text-emerald-200">
                                                            <Phone className="h-4 w-4" />
                                                        </a>
                                                        <a href={`https://wa.me/${contactPhone}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 transition-colors hover:bg-emerald-500/32 hover:text-emerald-200">
                                                            <WhatsappIcon className="h-4 w-4" />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {property?.ownerName && (
                                            <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 sm:p-4">
                                                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/45 sm:mb-3">Proprietar</div>
                                                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                                                    <p className="min-w-0 max-w-full flex-1 break-words font-medium text-white/90">{property.ownerName}</p>
                                                    {ownerPhone && (
                                                        <div className="ml-auto flex shrink-0 items-center gap-2 rounded-full bg-white/[0.04] px-1.5 py-1">
                                                            <a href={`tel:${property?.ownerPhone}`} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white">
                                                                <Phone className="h-4 w-4" />
                                                            </a>
                                                            <a href={`https://wa.me/${ownerPhone}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white">
                                                                <WhatsappIcon className="h-4 w-4" />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#132840] p-3 sm:p-4">
                                            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45 sm:mb-3">
                                                <Building2 className="h-3.5 w-3.5" />
                                                Agent
                                            </div>
                                            <div className="flex min-w-0 max-w-full items-center gap-3 text-sm text-white/80">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={agent?.photoUrl || undefined} />
                                                    <AvatarFallback className="text-xs bg-white/20">{agent?.name?.charAt(0) || 'A'}</AvatarFallback>
                                                </Avatar>
                                                <span className="min-w-0 max-w-full break-words">{agent?.name || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
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
