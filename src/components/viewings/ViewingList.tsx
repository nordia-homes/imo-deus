'use client';

import type { Viewing, UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Edit, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


interface ViewingListProps {
    title: string;
    viewings: Viewing[];
    agents: UserProfile[];
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

export function ViewingList({ title, viewings, agents, onEdit, onDelete }: ViewingListProps) {
    if (viewings.length === 0) {
        return (
            <Card className="shadow-2xl rounded-2xl bg-[#152A47] text-white border-none">
                <CardHeader>
                    <CardTitle className="text-white">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-white/70 text-center py-4">Nicio vizionare de afișat în această categorie.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-2xl rounded-2xl bg-[#152A47] text-white border-none">
            <CardHeader>
                <CardTitle className="text-white">{title} ({viewings.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {viewings.map(viewing => {
                    const agent = getAgentForViewing(viewing, agents);
                    return (
                        <Card key={viewing.id} className="bg-white/5 border border-white/10">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
                                            <Calendar className="h-4 w-4" />
                                            <span>{format(parseISO(viewing.viewingDate), 'd MMM yyyy, HH:mm', { locale: ro })}</span>
                                        </div>
                                        <Link href={`/properties/${viewing.propertyId}`} className="font-semibold text-base hover:underline">
                                            {viewing.propertyTitle}
                                        </Link>
                                        <p className="text-sm text-white/80">
                                            Client: <Link href={`/leads/${viewing.contactId}`} className="font-medium hover:underline">{viewing.contactName}</Link>
                                        </p>
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

                                <div className="border-t border-white/10 mt-3 pt-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={agent?.photoUrl || undefined} />
                                            <AvatarFallback className="text-xs bg-white/20">{agent?.name?.charAt(0) || 'A'}</AvatarFallback>
                                        </Avatar>
                                        <span>Agent: {agent?.name || 'N/A'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </CardContent>
        </Card>
    );
}
