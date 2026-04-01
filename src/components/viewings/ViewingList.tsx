'use client';

import { useState } from 'react';
import type { Viewing, UserProfile, Property, Contact } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Edit, Trash2, MoreVertical, Phone, MapPin, UserRound, Clock3, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhatsappIcon } from '../icons/WhatsappIcon';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';

interface ViewingListProps {
    title: string;
    viewings: Viewing[];
    agents?: UserProfile[];
    properties?: Property[];
    contacts?: Contact[];
    onEdit: (viewing: Viewing) => void;
    onDelete: (viewing: Viewing) => void;
    collapsible?: boolean;
    defaultOpen?: boolean;
}

const getStatusVariant = (status: Viewing['status']) => {
    switch (status) {
        case 'completed': return 'success';
        case 'cancelled': return 'destructive';
        case 'scheduled': return 'default';
        default: return 'outline';
    }
};

const getAgentForViewing = (viewing: Viewing, agents: UserProfile[]) => {
    if (!agents || agents.length === 0) return null;
    return agents.find(agent => agent.id === viewing.agentId);
};

export function ViewingList({ title, viewings, agents = [], properties = [], contacts = [], onEdit, onDelete, collapsible = false, defaultOpen = true }: ViewingListProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    const sanitizeForWhatsapp = (phone?: string | null) => {
        if (!phone) return '';
        let sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 && sanitized.startsWith('07')) {
            return `40${sanitized.substring(1)}`;
        }
        return sanitized;
    };

    if (!viewings || viewings.length === 0) {
        if (collapsible) {
            return (
                <div className="min-w-0 w-full max-w-full overflow-x-hidden">
                    <button
                        type="button"
                        onClick={() => setIsOpen((current) => !current)}
                        className="group flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#152A47] px-4 py-4 text-left transition-colors hover:bg-[#19304f]"
                    >
                        <span className="text-xl font-semibold text-white">{title} (0)</span>
                        <ChevronDown className={cn("h-5 w-5 text-white/70 transition-transform duration-200", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                        <Card className="mt-4 rounded-2xl border-none bg-[#152A47] text-white shadow-2xl backdrop-blur-sm">
                            <CardContent className="p-6">
                                <p className="py-4 text-center text-white/70">Nicio vizionare de afișat în această categorie.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            );
        }
        return (
            <Card className="shadow-2xl rounded-2xl bg-[#152A47] text-white border-none backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-white text-center text-xl">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-white/70 text-center py-4">Nicio vizionare de afișat în această categorie.</p>
                </CardContent>
            </Card>
        );
    }

    const content = (
        <div className="space-y-6 pt-4">
            {viewings.map(viewing => {
                const agent = getAgentForViewing(viewing, agents);
                const property = properties?.find(p => p.id === viewing.propertyId);
                const contact = contacts?.find(c => c.id === viewing.contactId);

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
                );
            })}
        </div>
    );

    if (collapsible) {
        return (
            <div className="min-w-0 w-full max-w-full overflow-x-hidden">
                <button
                    type="button"
                    onClick={() => setIsOpen((current) => !current)}
                    className="group flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#152A47] px-4 py-4 text-left transition-colors hover:bg-[#19304f]"
                >
                    <span className="text-xl font-semibold text-white">{title} ({viewings.length})</span>
                    <ChevronDown className={cn("h-5 w-5 text-white/70 transition-transform duration-200", isOpen && "rotate-180")} />
                </button>
                {isOpen && content}
            </div>
        );
    }

    return (
        <div className="min-w-0 w-full max-w-full space-y-6 overflow-x-hidden">
             <h2 className="px-2 text-center text-xl font-semibold text-white">{title} ({viewings.length})</h2>
             {content}
        </div>
    );
}
