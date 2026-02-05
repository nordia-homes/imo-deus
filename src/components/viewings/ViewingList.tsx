'use client';

import type { Viewing, UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
            <Card className="shadow-2xl rounded-2xl">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-4">Nicio vizionare de afișat în această categorie.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-2xl rounded-2xl">
            <CardHeader>
                <CardTitle>{title} ({viewings.length})</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Dată și Oră</TableHead>
                            <TableHead>Proprietate</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Acțiuni</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {viewings.map(viewing => {
                            const agent = getAgentForViewing(viewing, agents);
                            return (
                                <TableRow key={viewing.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{format(parseISO(viewing.viewingDate), 'd MMM yyyy, HH:mm', { locale: ro })}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/properties/${viewing.propertyId}`} className="hover:underline font-medium">
                                            {viewing.propertyTitle}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                         <Link href={`/leads/${viewing.contactId}`} className="hover:underline">
                                            {viewing.contactName}
                                         </Link>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={agent?.photoUrl || undefined} />
                                                <AvatarFallback className="text-xs">{agent?.name?.charAt(0) || 'A'}</AvatarFallback>
                                            </Avatar>
                                            <span>{agent?.name || 'N/A'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(viewing.status)}>{viewing.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(viewing)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(viewing)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
