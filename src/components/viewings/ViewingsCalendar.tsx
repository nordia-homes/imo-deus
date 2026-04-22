'use client';

import React, { useMemo, useState } from 'react';
import type { Viewing, UserProfile, Property, Contact } from '@/lib/types';
import {
  format,
  startOfWeek,
  addDays,
  addMinutes,
  isToday,
  isSameMonth,
  parseISO,
  isSameDay,
} from 'date-fns';
import { ro } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Phone, Calendar, MoreVertical, Edit, Trash2, Clock3, MapPin, UserRound, Building2, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { WhatsappIcon } from '../icons/WhatsappIcon';
import { WazeIcon } from '../icons/WazeIcon';
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

const buildWazeUrl = (address?: string | null) => {
    if (!address?.trim()) return null;
    return `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
};

const getStreetAndNumber = (address?: string | null) => {
    if (!address?.trim()) return '';
    return address.split(',')[0]?.trim() || address.trim();
};

const formatViewingTimeRange = (viewingDate: string, duration?: number) => {
    const start = parseISO(viewingDate);
    const end = addMinutes(start, duration ?? 30);
    return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
};

const buildViewingConfirmationText = (viewing: Viewing) => {
    const hour = format(parseISO(viewing.viewingDate), 'HH:mm');
    const shortAddress = getStreetAndNumber(viewing.propertyAddress);
    return `Buna ziua! Numele meu este Ramona Ciolac si va contactez pentru a confirma vizionarea de astazi de la ora ${hour} pentru apartamentul din ${shortAddress}. Daca totul este in regula si pentru dvs., va astept la adresa si va rog sa ma sunati sau sa imi scrieti cand ajungeti. Multumesc, ne vedem mai tarziu!`;
};

const buildOwnerConfirmationText = (viewing: Viewing) => {
    const hour = format(parseISO(viewing.viewingDate), 'HH:mm');
    return `Buna ziua! Numele meu este Ramona Ciolac de la Nordia si ati vorbit cu colega mea Mirela pentru colaborarea cu agentia noastra. Va contactez pentru a confirma vizionarea de astazi de la ora ${hour}. Daca totul este in regula si pentru dvs., ne vedem la adresa si va sun sau va scriu cand ajung. Multumesc!`;
};

const VIEWING_DAY_START_HOUR = 8;
const VIEWING_DAY_END_HOUR = 21;

const getDayBoundary = (day: Date, hour: number) => {
    const boundary = new Date(day);
    boundary.setHours(hour, 0, 0, 0);
    return boundary;
};

const formatFreeTimeRange = (start: Date, end: Date) => `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
const VIEWING_DAY_TOTAL_MINUTES = (VIEWING_DAY_END_HOUR - VIEWING_DAY_START_HOUR) * 60;
const formatAvailabilityDuration = (minutes: number) => {
    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
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

  const timelineEntries = useMemo(() => {
    const dayStart = getDayBoundary(selectedDay, VIEWING_DAY_START_HOUR);
    const dayEnd = getDayBoundary(selectedDay, VIEWING_DAY_END_HOUR);
    const entries: Array<
      | { type: 'free'; key: string; start: Date; end: Date; minutes: number }
      | { type: 'viewing'; key: string; viewing: (typeof selectedDayViewings)[number] }
    > = [];

    let cursor = dayStart;

    for (const viewing of selectedDayViewings) {
      const start = parseISO(viewing.viewingDate);
      const end = addMinutes(start, viewing.duration ?? 30);

      if (start > cursor) {
        const freeMinutes = Math.max(0, Math.round((start.getTime() - cursor.getTime()) / 60000));
        if (freeMinutes > 0) {
          entries.push({
            type: 'free',
            key: `free-before-${viewing.id}-${cursor.toISOString()}`,
            start: cursor,
            end: start,
            minutes: freeMinutes,
          });
        }
      }

      entries.push({
        type: 'viewing',
        key: viewing.id,
        viewing,
      });

      if (end > cursor) {
        cursor = end;
      }
    }

    if (cursor < dayEnd) {
      const freeMinutes = Math.max(0, Math.round((dayEnd.getTime() - cursor.getTime()) / 60000));
      if (freeMinutes > 0) {
        entries.push({
          type: 'free',
          key: `free-end-${cursor.toISOString()}`,
          start: cursor,
          end: dayEnd,
          minutes: freeMinutes,
        });
      }
    }

    if (entries.length === 0) {
      entries.push({
        type: 'free',
        key: `free-full-${format(selectedDay, 'yyyy-MM-dd')}`,
        start: dayStart,
        end: dayEnd,
        minutes: Math.round((dayEnd.getTime() - dayStart.getTime()) / 60000),
      });
    }

    return entries;
  }, [selectedDay, selectedDayViewings]);

  const daySummaryViewings = useMemo(() => {
    return selectedDayViewings.map((viewing) => {
      const start = parseISO(viewing.viewingDate);
      const end = addMinutes(start, viewing.duration ?? 30);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const offsetMinutes = startMinutes - VIEWING_DAY_START_HOUR * 60;
      const durationMinutes = Math.max(15, endMinutes - startMinutes);

      return {
        id: viewing.id,
        start,
        end,
        label: formatViewingTimeRange(viewing.viewingDate, viewing.duration),
        title: viewing.propertyTitle,
        leftPercent: Math.max(0, Math.min(100, (offsetMinutes / VIEWING_DAY_TOTAL_MINUTES) * 100)),
        widthPercent: Math.max(2.5, Math.min(100, (durationMinutes / VIEWING_DAY_TOTAL_MINUTES) * 100)),
      };
    });
  }, [selectedDayViewings]);

  const daySummaryItems = useMemo(() => {
    const items: Array<
      | {
          type: 'free';
          key: string;
          label: string;
          minutes: number;
        }
      | {
          type: 'viewing';
          key: string;
          label: string;
          title: string;
        }
    > = [];

    const dayStart = getDayBoundary(selectedDay, VIEWING_DAY_START_HOUR);
    const dayEnd = getDayBoundary(selectedDay, VIEWING_DAY_END_HOUR);
    let cursor = dayStart;

    for (const viewing of selectedDayViewings) {
      const start = parseISO(viewing.viewingDate);
      const end = addMinutes(start, viewing.duration ?? 30);

      if (start > cursor) {
        const freeMinutes = Math.round((start.getTime() - cursor.getTime()) / 60000);
        if (freeMinutes > 0) {
          items.push({
            type: 'free',
            key: `summary-free-${cursor.toISOString()}-${start.toISOString()}`,
            label: formatFreeTimeRange(cursor, start),
            minutes: freeMinutes,
          });
        }
      }

      items.push({
        type: 'viewing',
        key: viewing.id,
        label: formatViewingTimeRange(viewing.viewingDate, viewing.duration),
        title: viewing.propertyTitle,
      });

      if (end > cursor) {
        cursor = end;
      }
    }

    if (cursor < dayEnd) {
      const freeMinutes = Math.round((dayEnd.getTime() - cursor.getTime()) / 60000);
      if (freeMinutes > 0) {
        items.push({
          type: 'free',
          key: `summary-free-end-${cursor.toISOString()}`,
          label: formatFreeTimeRange(cursor, dayEnd),
          minutes: freeMinutes,
        });
      }
    }

    if (items.length === 0) {
      items.push({
        type: 'free',
        key: `summary-free-full-${format(selectedDay, 'yyyy-MM-dd')}`,
        label: formatFreeTimeRange(dayStart, dayEnd),
        minutes: VIEWING_DAY_TOTAL_MINUTES,
      });
    }

    return items;
  }, [selectedDay, selectedDayViewings]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const amount = direction === 'prev' ? -7 : 7;
    setSelectedDay(current => addDays(current, amount));
  };

  const scrollToViewingCard = (viewingId: string) => {
    const element = document.getElementById(`viewing-card-${viewingId}`);
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Card className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
      <CardContent className="min-w-0 w-full max-w-full overflow-x-hidden p-2 sm:p-4">
        {/* Header */}
        <header className="mb-4 grid w-full max-w-full grid-cols-[auto,minmax(0,1fr)] items-center gap-2 overflow-hidden px-1">
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden sm:gap-2">
            <Button onClick={() => setSelectedDay(new Date())} variant="outline" className="h-11 shrink-0 bg-white/10 px-4 text-base text-white border-white/20 hover:bg-white/20">
              Astăzi ({selectedDayViewings.length})
            </Button>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek('prev')}
                className="h-10 w-10 shrink-0 hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek('next')}
                className="h-10 w-10 shrink-0 hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <h2 className="min-w-0 justify-self-end truncate whitespace-nowrap text-right text-base font-semibold capitalize text-white sm:text-xl">
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
                  'agentfinder-calendar-day flex min-w-0 flex-col items-center rounded-lg p-1 transition-colors',
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

        <div className="agentfinder-viewing-summary-card mb-6 overflow-hidden rounded-[24px] border border-white/10 bg-[#132840] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-white sm:text-xl">Rezumat Ore Vizionări</p>
              <p className="text-sm text-white/55 sm:text-base">Programul zilei 08:00 - 21:00</p>
            </div>
            <div className="agentfinder-viewing-summary-count mt-0.5 shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white/75">
              {selectedDayViewings.length} vizionări
            </div>
          </div>

          <div className="mt-5">
            <div className="agentfinder-viewing-summary-timeline relative h-7 rounded-2xl border border-white/10 bg-[#0F1E33]/90 px-2">
              <div className="agentfinder-viewing-summary-axis absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/10" />
              {daySummaryViewings.map((viewing) => (
                <div
                  key={viewing.id}
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{
                    left: `calc(${viewing.leftPercent}% + 0.5rem)`,
                    width: `calc(${viewing.widthPercent}% - 0.25rem)`,
                  }}
                >
                  <div className="agentfinder-viewing-summary-bar h-3 rounded-full bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_18px_rgba(34,197,94,0.35)]" />
                </div>
              ))}
              {daySummaryViewings.length === 0 && (
                <div className="agentfinder-viewing-summary-empty absolute inset-0 flex items-center justify-center text-xs text-white/45">
                  Nicio vizionare în ziua selectată
                </div>
              )}
            </div>

            <div className="agentfinder-viewing-summary-ticks mt-1 flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-white/45 sm:text-sm">
              <span>08:00</span>
              <span>11:00</span>
              <span>14:00</span>
              <span>17:00</span>
              <span>21:00</span>
            </div>

            {daySummaryItems.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-2">
                {daySummaryItems.map((item) =>
                  item.type === 'viewing' ? (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => scrollToViewingCard(item.key)}
                      className="agentfinder-viewing-summary-item flex min-h-12 w-full min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-white/80 transition-colors hover:bg-white/10 sm:min-h-0 sm:py-2"
                    >
                      <span className="agentfinder-viewing-summary-dot h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                      <span className="agentfinder-viewing-summary-item-time shrink-0 font-medium text-white sm:text-base">{item.label}</span>
                      <span className="agentfinder-viewing-summary-item-title min-w-0 truncate text-white/55 sm:text-base">{item.title}</span>
                    </button>
                  ) : (
                    <div key={item.key} className="agentfinder-viewing-summary-free w-full px-1 py-1.5">
                      <div className="flex items-center gap-3">
                        <span className="agentfinder-viewing-summary-free-label text-xs font-medium uppercase tracking-[0.16em] text-emerald-200/80 sm:text-sm">Timp liber</span>
                        <div className="h-px flex-1 bg-white/10">
                          <div
                            className="agentfinder-viewing-summary-free-line h-px bg-gradient-to-r from-emerald-400 via-emerald-500 to-lime-400"
                            style={{ width: `${Math.max(12, Math.min(100, (item.minutes / VIEWING_DAY_TOTAL_MINUTES) * 100))}%` }}
                          />
                        </div>
                        <span className="agentfinder-viewing-summary-free-range text-xs text-white/45 sm:text-sm">
                          {item.label} / {formatAvailabilityDuration(item.minutes)}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-r from-[#132840] via-[#17304d] to-[#132840] px-5 py-4 shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">Următorul Nivel</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Vizualizare detaliată</h3>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
          </div>
        </div>
        
        {/* Timeline for selected day */}
        <div className="min-w-0 w-full max-w-full">
            <div className="min-w-0 w-full max-w-full space-y-4">
              {timelineEntries.map((entry) => {
                if (entry.type === 'free') {
                  const heightClass =
                    entry.minutes >= 180
                      ? 'min-h-[104px]'
                      : entry.minutes >= 90
                        ? 'min-h-[84px]'
                        : 'min-h-[68px]';

                  return (
                    <div
                      key={entry.key}
                      className={cn(
                        'overflow-hidden rounded-[24px] border border-dashed border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                        heightClass
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/18 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-emerald-200">
                          <Clock3 className="h-3.5 w-3.5" />
                          Timp disponibil
                        </div>
                        <span className="text-xs font-medium text-emerald-200/80">
                          {Math.floor(entry.minutes / 60)}h {entry.minutes % 60}m
                        </span>
                      </div>
                      <div className="agentfinder-available-time-track mt-4 h-3 overflow-hidden rounded-full bg-[#0F1E33]/85">
                        <div
                          className="agentfinder-available-time-fill h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-lime-400"
                          style={{
                            width: `${Math.max(12, Math.min(100, (entry.minutes / VIEWING_DAY_TOTAL_MINUTES) * 100))}%`,
                            marginLeft: `${Math.max(
                              0,
                              Math.min(
                                100,
                                ((entry.start.getHours() * 60 + entry.start.getMinutes() - VIEWING_DAY_START_HOUR * 60) /
                                  VIEWING_DAY_TOTAL_MINUTES) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/70">
                        <span>{formatFreeTimeRange(entry.start, entry.end)}</span>
                        <span>Liber pentru programare</span>
                      </div>
                    </div>
                  );
                }

                const viewing = entry.viewing;
                const { property, contact, agent } = viewing;
                const contactPhone = sanitizeForWhatsapp(contact?.phone);
                const ownerPhone = sanitizeForWhatsapp(property?.ownerPhone);
                const agentPhone = sanitizeForWhatsapp(agent?.phone);
                const wazeUrl = buildWazeUrl(viewing.propertyAddress);
                const viewingConfirmationText = encodeURIComponent(buildViewingConfirmationText(viewing));
                const ownerConfirmationText = encodeURIComponent(buildOwnerConfirmationText(viewing));

                return (
                    <Card id={`viewing-card-${viewing.id}`} key={entry.key} className="agentfinder-viewing-card group w-full max-w-full overflow-hidden rounded-[26px] border border-white/10 bg-[#152A47] shadow-[0_18px_44px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_56px_rgba(0,0,0,0.24)]">
                        <div className="flex flex-col md:max-lg:grid md:max-lg:grid-cols-[200px_minmax(0,1fr)] lg:flex-row">
                            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-[26px] md:h-auto md:w-[200px] md:max-lg:col-start-1 md:max-lg:row-start-1 md:max-lg:aspect-square md:max-lg:w-[200px] md:shrink-0 md:rounded-l-[26px] md:rounded-r-none lg:aspect-[16/10] lg:w-[320px]">
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
                                <div
                                    className="absolute inset-0"
                                    style={{ background: 'linear-gradient(to top, rgba(15, 30, 51, 0.55), transparent 58%)' }}
                                />
                                <div className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-3">
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
                                <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-2">
                                    <div className="rounded-2xl border border-white/20 bg-[#0B1728]/96 px-3 py-2.5 text-white shadow-[0_14px_30px_rgba(0,0,0,0.38)] backdrop-blur-md md:max-lg:px-2.5 md:max-lg:py-2">
                                        <div className="text-lg font-semibold leading-none text-white md:max-lg:text-[0.9rem] md:max-lg:tracking-tight md:max-lg:whitespace-nowrap sm:text-xl">
                                            {formatViewingTimeRange(viewing.viewingDate, viewing.duration)}
                                        </div>
                                    </div>
                                    {wazeUrl && (
                                        <a
                                            href={wazeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`Deschide directii Waze pentru ${viewing.propertyAddress}`}
                                            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#33CCFF]/25 bg-white/90 px-3 text-xs font-semibold text-[#33CCFF] shadow-[0_10px_22px_rgba(51,204,255,0.16)] backdrop-blur-sm transition-colors hover:bg-white hover:text-[#00A9E8] sm:text-sm"
                                        >
                                            <WazeIcon className="h-4 w-4 shrink-0" />
                                            Vezi pe Waze
                                        </a>
                                    )}
                                </div>
                            </div>

                            <CardContent className="min-w-0 w-full max-w-full flex-1 overflow-hidden p-4 sm:p-6 md:max-lg:col-start-2 md:max-lg:row-start-1 md:max-lg:pb-3">
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

                                    <div className="block md:max-lg:hidden">
                                        <Separator className="bg-white/10" />

                                        <div
                                            className={cn(
                                                "mt-4 grid max-w-full gap-3",
                                                property?.ownerName ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2"
                                            )}
                                        >
                                             <div className="agentfinder-viewing-person-card agentfinder-viewing-person-card--client min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 sm:p-4">
                                                 <div className="agentfinder-viewing-person-label mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/45 sm:mb-3 sm:text-[11px] sm:tracking-[0.18em]">
                                                    <UserRound className="h-3.5 w-3.5" />
                                                    Client
                                                </div>
                                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                                     <Link href={`/leads/${viewing.contactId}`} className="agentfinder-viewing-person-name min-w-0 max-w-full flex-1 break-words text-[15px] font-medium leading-tight text-white/90 hover:underline sm:text-base">{viewing.contactName}</Link>
                                                    {contactPhone && (
                                                         <div className="agentfinder-viewing-person-actions ml-auto flex shrink-0 items-center gap-1.5 self-center rounded-full bg-white/[0.04] px-1 py-0 sm:gap-2 sm:px-1.5 sm:py-1">
                                                            <a href={`https://wa.me/${contactPhone}?text=${viewingConfirmationText}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 transition-colors hover:bg-emerald-500/32 hover:text-emerald-200 sm:h-10 sm:w-10" aria-label="Trimite mesaj de confirmare pe WhatsApp">
                                                                <MessageSquareText className="h-4 w-4" />
                                                            </a>
                                                            <a href={`tel:${contact?.phone}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 transition-colors hover:bg-emerald-500/32 hover:text-emerald-200 sm:h-10 sm:w-10">
                                                                <Phone className="h-4 w-4" />
                                                            </a>
                                                            <a href={`https://wa.me/${contactPhone}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 transition-colors hover:bg-emerald-500/32 hover:text-emerald-200 sm:h-10 sm:w-10">
                                                                <WhatsappIcon className="h-4 w-4" />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {property?.ownerName && (
                                                <div className="agentfinder-viewing-person-card agentfinder-viewing-person-card--owner min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 sm:p-4">
                                                    <div className="agentfinder-viewing-person-label mb-0.5 text-[10px] uppercase tracking-[0.16em] text-white/45 sm:mb-3 sm:text-[11px] sm:tracking-[0.18em]">Proprietar</div>
                                                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                                        <p className="agentfinder-viewing-person-name min-w-0 max-w-full break-words text-[15px] font-medium leading-tight text-white/90 sm:text-base">{property.ownerName}</p>
                                                        {ownerPhone && (
                                                            <div className="agentfinder-viewing-person-actions ml-auto flex shrink-0 items-center gap-1.5 self-center rounded-full bg-white/[0.04] px-1 py-0 sm:gap-2 sm:px-1.5 sm:py-1">
                                                                <a href={`https://wa.me/${ownerPhone}?text=${ownerConfirmationText}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10" aria-label="Trimite mesaj de confirmare proprietarului pe WhatsApp">
                                                                    <MessageSquareText className="h-4 w-4" />
                                                                </a>
                                                                <a href={`tel:${property?.ownerPhone}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10">
                                                                    <Phone className="h-4 w-4" />
                                                                </a>
                                                                <a href={`https://wa.me/${ownerPhone}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10">
                                                                    <WhatsappIcon className="h-4 w-4" />
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                             <div className="agentfinder-viewing-person-card agentfinder-viewing-person-card--agent min-w-0 rounded-2xl border border-white/[0.08] bg-[#132840] p-3 sm:p-4">
                                                 <div className="agentfinder-viewing-person-label mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45 sm:mb-3">
                                                    <Building2 className="h-3.5 w-3.5" />
                                                    Agent
                                                </div>
                                             <div className="agentfinder-viewing-agent-row grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm text-white/80">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <Avatar className="h-8 w-8 shrink-0">
                                                            <AvatarImage src={agent?.photoUrl || undefined} />
                                                            <AvatarFallback className="text-xs bg-white/20">{agent?.name?.charAt(0) || 'A'}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="agentfinder-viewing-person-name min-w-0 max-w-full break-words">{agent?.name || 'N/A'}</span>
                                                    </div>
                                                    {agentPhone && (
                                                        <div className="agentfinder-viewing-person-actions ml-auto flex shrink-0 items-center gap-1.5 self-center rounded-full bg-white/[0.04] px-1 py-0 sm:gap-2 sm:px-1.5 sm:py-1">
                                                            <a href={`tel:${agent?.phone}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10" aria-label="Sună agentul">
                                                                <Phone className="h-4 w-4" />
                                                            </a>
                                                            <a href={`https://wa.me/${agentPhone}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10" aria-label="Scrie agentului pe WhatsApp">
                                                                <WhatsappIcon className="h-4 w-4" />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>

                            <div className="hidden px-4 pb-4 sm:px-6 sm:pb-6 md:max-lg:col-span-2 md:max-lg:row-start-2 md:max-lg:block md:max-lg:pt-0">
                                <Separator className="bg-white/10" />

                                <div
                                    className={cn(
                                        "mt-4 grid max-w-full gap-3",
                                        property?.ownerName
                                            ? "sm:grid-cols-2 md:max-lg:grid-cols-3 xl:grid-cols-3"
                                            : "sm:grid-cols-2 md:max-lg:grid-cols-2"
                                    )}
                                >
                                        <div className="agentfinder-viewing-person-card agentfinder-viewing-person-card--client min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 sm:p-4">
                                            <div className="agentfinder-viewing-person-label mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/45 sm:mb-3 sm:text-[11px] sm:tracking-[0.18em]">
                                                <UserRound className="h-3.5 w-3.5" />
                                                Client
                                            </div>
                                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                                <Link href={`/leads/${viewing.contactId}`} className="agentfinder-viewing-person-name min-w-0 max-w-full flex-1 break-words text-[15px] font-medium leading-tight text-white/90 hover:underline sm:text-base">{viewing.contactName}</Link>
                                                {contactPhone && (
                                                    <div className="agentfinder-viewing-person-actions ml-auto flex shrink-0 items-center gap-1.5 self-center rounded-full bg-white/[0.04] px-1 py-0 sm:gap-2 sm:px-1.5 sm:py-1">
                                                        <a href={`https://wa.me/${contactPhone}?text=${viewingConfirmationText}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 transition-colors hover:bg-emerald-500/32 hover:text-emerald-200 sm:h-10 sm:w-10" aria-label="Trimite mesaj de confirmare pe WhatsApp">
                                                            <MessageSquareText className="h-4 w-4" />
                                                        </a>
                                                        <a href={`tel:${contact?.phone}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 transition-colors hover:bg-emerald-500/32 hover:text-emerald-200 sm:h-10 sm:w-10">
                                                            <Phone className="h-4 w-4" />
                                                        </a>
                                                        <a href={`https://wa.me/${contactPhone}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 transition-colors hover:bg-emerald-500/32 hover:text-emerald-200 sm:h-10 sm:w-10">
                                                            <WhatsappIcon className="h-4 w-4" />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {property?.ownerName && (
                                            <div className="agentfinder-viewing-person-card agentfinder-viewing-person-card--owner min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 sm:p-4">
                                                <div className="agentfinder-viewing-person-label mb-0.5 text-[10px] uppercase tracking-[0.16em] text-white/45 sm:mb-3 sm:text-[11px] sm:tracking-[0.18em]">Proprietar</div>
                                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                                    <p className="agentfinder-viewing-person-name min-w-0 max-w-full break-words text-[15px] font-medium leading-tight text-white/90 sm:text-base">{property.ownerName}</p>
                                                    {ownerPhone && (
                                                        <div className="agentfinder-viewing-person-actions ml-auto flex shrink-0 items-center gap-1.5 self-center rounded-full bg-white/[0.04] px-1 py-0 sm:gap-2 sm:px-1.5 sm:py-1">
                                                            <a href={`https://wa.me/${ownerPhone}?text=${ownerConfirmationText}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10" aria-label="Trimite mesaj de confirmare proprietarului pe WhatsApp">
                                                                <MessageSquareText className="h-4 w-4" />
                                                            </a>
                                                            <a href={`tel:${property?.ownerPhone}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10">
                                                                <Phone className="h-4 w-4" />
                                                            </a>
                                                            <a href={`https://wa.me/${ownerPhone}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10">
                                                                <WhatsappIcon className="h-4 w-4" />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="agentfinder-viewing-person-card agentfinder-viewing-person-card--agent min-w-0 rounded-2xl border border-white/[0.08] bg-[#132840] p-3 sm:p-4">
                                            <div className="agentfinder-viewing-person-label mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45 sm:mb-3">
                                                <Building2 className="h-3.5 w-3.5" />
                                                Agent
                                            </div>
                                            <div className="agentfinder-viewing-agent-row grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm text-white/80">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Avatar className="h-8 w-8 shrink-0">
                                                        <AvatarImage src={agent?.photoUrl || undefined} />
                                                        <AvatarFallback className="text-xs bg-white/20">{agent?.name?.charAt(0) || 'A'}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="agentfinder-viewing-person-name min-w-0 max-w-full break-words">{agent?.name || 'N/A'}</span>
                                                </div>
                                                {agentPhone && (
                                                    <div className="agentfinder-viewing-person-actions ml-auto flex shrink-0 items-center gap-1.5 self-center rounded-full bg-white/[0.04] px-1 py-0 sm:gap-2 sm:px-1.5 sm:py-1">
                                                        <a href={`tel:${agent?.phone}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10" aria-label="Sună agentul">
                                                            <Phone className="h-4 w-4" />
                                                        </a>
                                                        <a href={`https://wa.me/${agentPhone}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white sm:h-10 sm:w-10" aria-label="Scrie agentului pe WhatsApp">
                                                            <WhatsappIcon className="h-4 w-4" />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )
              })}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
