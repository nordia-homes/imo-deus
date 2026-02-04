'use client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import type { Contact, Task, Interaction } from '@/lib/types';
import { Phone, Mail, FileText, CheckSquare, Calendar, Clock } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { AddInteractionPopover } from './AddInteractionPopover';

type LeadInfoCardProps = {
  contact: Contact;
  onAddInteraction: (interactionData: Omit<Interaction, 'id' | 'date' | 'agent'>) => Promise<void>;
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => void;
};

export function LeadInfoCard({ contact, onAddInteraction, onAddTask }: LeadInfoCardProps) {
    const creationDate = contact.createdAt ? new Date(contact.createdAt) : new Date(); // Fallback for demo
    const ageInDays = differenceInDays(new Date(), creationDate);

    let ageBadgeVariant: 'success' | 'warning' | 'destructive' = 'success';
    if (ageInDays > 30) {
        ageBadgeVariant = 'destructive';
    } else if (ageInDays >= 14) {
        ageBadgeVariant = 'warning';
    }

    const handleSaveInteraction = (type: Interaction['type']) => async (notes: string) => {
        await onAddInteraction({ type, notes });
    };

    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center gap-4">
                <Avatar className="h-14 w-14 text-lg">
                    <AvatarFallback>{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">{contact.name}</h2>
                        {contact.leadScore && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 text-sm">
                                Scor {contact.leadScore}
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">€{contact.budget?.toLocaleString() || 'N/A'} &bull; {contact.city || 'N/A'}</p>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1 text-xs font-normal">
                        <Calendar className="mr-2 h-3.5 w-3.5" />
                        {new Date(creationDate).toLocaleDateString('ro-RO')}
                    </Badge>
                    <Badge variant={ageBadgeVariant} className="px-3 py-1 text-xs">
                        <Clock className="mr-2 h-3.5 w-3.5" />
                        Vechime: {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}
                    </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <AddInteractionPopover type="WhatsApp" onSave={handleSaveInteraction('WhatsApp')}>
                        <Button variant="outline"><WhatsappIcon className="mr-2 h-4 w-4"/>Log WhatsApp</Button>
                    </AddInteractionPopover>
                    <Button variant="outline" asChild><a href={`tel:${contact.phone}`}><Phone className="mr-2 h-4 w-4"/>Apel</a></Button>
                     <AddInteractionPopover type="Notiță" onSave={handleSaveInteraction('Notiță')}>
                        <Button variant="outline"><FileText className="mr-2 h-4 w-4"/>Notiță</Button>
                    </AddInteractionPopover>
                     <AddTaskDialog onAddTask={onAddTask} contacts={[contact]}>
                        <Button variant="outline"><CheckSquare className="mr-2 h-4 w-4"/>Task</Button>
                     </AddTaskDialog>
                </div>
            </CardContent>
        </Card>
    );
}
