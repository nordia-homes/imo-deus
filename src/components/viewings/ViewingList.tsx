'use client';

import type { Viewing, UserProfile, Property, Contact } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Edit, Trash2, MoreVertical, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from 'next/image';
import { WhatsappIcon } from '../icons/WhatsappIcon';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

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
    return agents.find(agent => agent.id === viewing.agentId);
};

export function ViewingList({ title, viewings, agents = [], properties = [], contacts = [], onEdit, onDelete }: ViewingListProps) {
    if (viewings.length === 0) {
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

    return (
        <div className="space-y-6">
             <h2 className="text-xl font-semibold text-white px-2 text-center">{title} ({viewings.length})</h2>
            {viewings.map(viewing => {
                const agent = getAgentForViewing(viewing, agents);
                const property = properties.find(p => p.id === viewing.propertyId);
                const contact = contacts.find(c => c.id === viewing.contactId);

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
                );
            })}
        </div>
    );
}
