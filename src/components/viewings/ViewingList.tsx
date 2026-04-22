'use client';
import type { Viewing, UserProfile, Property, Contact } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { addMinutes, format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Edit, Trash2, MoreVertical, Phone, MapPin, UserRound, Clock3, Building2, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhatsappIcon } from '../icons/WhatsappIcon';
import { WazeIcon } from '../icons/WazeIcon';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import Image from 'next/image';

interface ViewingListProps {
    title: string;
    viewings: Viewing[];
    agents?: UserProfile[];
    properties?: Property[];
    contacts?: Contact[];
    onEdit: (viewing: Viewing) => void;
    onDelete: (viewing: Viewing) => void;
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

export function ViewingList({ title, viewings, agents = [], properties = [], contacts = [], onEdit, onDelete }: ViewingListProps) {
    
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

    const buildViewingConfirmationText = (viewing: Viewing) => {
        const hour = format(parseISO(viewing.viewingDate), 'HH:mm');
        const shortAddress = getStreetAndNumber(viewing.propertyAddress);
        return `Buna ziua! Numele meu este Ramona Ciolac si va contactez pentru a confirma vizionarea de astazi de la ora ${hour} pentru apartamentul din ${shortAddress}. Daca totul este in regula si pentru dvs., va astept la adresa si va rog sa ma sunati sau sa imi scrieti cand ajungeti. Multumesc, ne vedem mai tarziu!`;
    };

    const buildOwnerConfirmationText = (viewing: Viewing) => {
        const hour = format(parseISO(viewing.viewingDate), 'HH:mm');
        return `Buna ziua! Numele meu este Ramona Ciolac de la Nordia si ati vorbit cu colega mea Mirela pentru colaborarea cu agentia noastra. Va contactez pentru a confirma vizionarea de astazi de la ora ${hour}. Daca totul este in regula si pentru dvs., ne vedem la adresa si va sun sau va scriu cand ajung. Multumesc!`;
    };

    const formatViewingTimeRange = (viewingDate: string, duration?: number) => {
        const start = parseISO(viewingDate);
        const end = addMinutes(start, duration ?? 30);
        return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
    };

    if (!viewings || viewings.length === 0) {
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
                const agentPhone = sanitizeForWhatsapp(agent?.phone);
                const wazeUrl = buildWazeUrl(viewing.propertyAddress);
                const viewingConfirmationText = encodeURIComponent(buildViewingConfirmationText(viewing));
                const ownerConfirmationText = encodeURIComponent(buildOwnerConfirmationText(viewing));

                return (
                <Card key={viewing.id} className="agentfinder-viewing-card group w-full max-w-full overflow-hidden rounded-[26px] border border-white/10 bg-[#152A47] shadow-[0_18px_44px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_56px_rgba(0,0,0,0.24)]">
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
                                    <Badge variant={getStatusVariant(viewing.status)} className="text-sm">{viewing.status}</Badge>
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
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/75">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {format(parseISO(viewing.viewingDate), 'EEEE, d MMMM', { locale: ro })}
                                        </div>
                                        <Link href={`/properties/${viewing.propertyId}`} className="block max-w-full overflow-hidden text-xl font-semibold leading-tight text-white [overflow-wrap:anywhere] hover:underline sm:text-2xl">
                                            {viewing.propertyTitle}
                                        </Link>
                                        {viewing.propertyAddress && (
                                            <div className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden text-base text-white/65">
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
                                                <div className="agentfinder-viewing-person-label mb-0.5 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/45 sm:mb-3 sm:text-sm sm:tracking-[0.18em]">
                                                    <UserRound className="h-3.5 w-3.5" />
                                                    Client
                                                </div>
                                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                                    <Link href={`/leads/${viewing.contactId}`} className="agentfinder-viewing-person-name min-w-0 max-w-full flex-1 break-words text-base font-medium leading-tight text-white/90 hover:underline sm:text-lg">{viewing.contactName}</Link>
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
                                                    <div className="agentfinder-viewing-person-label mb-0.5 text-xs uppercase tracking-[0.16em] text-white/45 sm:mb-3 sm:text-sm sm:tracking-[0.18em]">Proprietar</div>
                                                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                                        <p className="agentfinder-viewing-person-name min-w-0 max-w-full break-words text-base font-medium leading-tight text-white/90 sm:text-lg">{property.ownerName}</p>
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
                                                <div className="agentfinder-viewing-person-label mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45 sm:mb-3 sm:text-sm">
                                                    <Building2 className="h-3.5 w-3.5" />
                                                    Agent
                                                </div>
                                                <div className="agentfinder-viewing-agent-row grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-base text-white/80">
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
                                            <div className="agentfinder-viewing-person-label mb-0.5 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/45 sm:mb-3 sm:text-sm sm:tracking-[0.18em]">
                                                <UserRound className="h-3.5 w-3.5" />
                                                Client
                                            </div>
                                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                                <Link href={`/leads/${viewing.contactId}`} className="agentfinder-viewing-person-name min-w-0 max-w-full flex-1 break-words text-base font-medium leading-tight text-white/90 hover:underline sm:text-lg">{viewing.contactName}</Link>
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
                                                <div className="agentfinder-viewing-person-label mb-0.5 text-xs uppercase tracking-[0.16em] text-white/45 sm:mb-3 sm:text-sm sm:tracking-[0.18em]">Proprietar</div>
                                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                                    <p className="agentfinder-viewing-person-name min-w-0 max-w-full break-words text-base font-medium leading-tight text-white/90 sm:text-lg">{property.ownerName}</p>
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
                                            <div className="agentfinder-viewing-person-label mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45 sm:mb-3 sm:text-sm">
                                                <Building2 className="h-3.5 w-3.5" />
                                                Agent
                                            </div>
                                            <div className="agentfinder-viewing-agent-row grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-base text-white/80">
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
                );
            })}
        </div>
    );

    return (
        <div className="min-w-0 w-full max-w-full space-y-6 overflow-x-hidden">
             <h2 className="px-2 text-center text-xl font-semibold text-white">{title} ({viewings.length})</h2>
             {content}
        </div>
    );
}
