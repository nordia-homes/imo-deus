'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import type { Contact, Task } from '@/lib/types';
import { Phone, Mail, Plus, MapPin, Building, DollarSign } from 'lucide-react';
import { AddTaskDialog } from '../../tasks/AddTaskDialog';

type LeadHeaderProps = {
  contact: Contact;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => void;
};

export function LeadHeader({ contact, onUpdateContact, onAddTask }: LeadHeaderProps) {
  
  return (
    <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mx-8 px-8 py-4 border-b">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 text-lg">
            <AvatarFallback>{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{contact.name}</h1>
              {contact.leadScore && (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 text-sm">
                  Scor {contact.leadScore}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm mt-1">
              <Badge variant="outline">{contact.status}</Badge>
              {contact.budget && (
                <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />€{contact.budget.toLocaleString()}</span>
              )}
              {contact.city && (
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{contact.city}</span>
              )}
               <span className="flex items-center gap-1.5"><Building className="h-3.5 w-3.5" />{contact.source}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="lg" variant="outline" asChild>
            <a href={`tel:${contact.phone}`}>
              <Phone className="h-4 w-4" />
              Sună
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank">
                <WhatsappIcon className="h-4 w-4" />
                WhatsApp
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
             <a href={`mailto:${contact.email}`}>
                <Mail className="h-4 w-4" />
                Trimite Email
             </a>
          </Button>
          <AddTaskDialog onAddTask={onAddTask} contacts={[contact]}>
             <Button size="lg" variant="outline">
                <Plus className="h-4 w-4" />
                Creează Task
             </Button>
           </AddTaskDialog>
          <Button size="lg" onClick={() => onUpdateContact({ status: 'Câștigat' })}>
            Marchează Vândut
          </Button>
        </div>
      </div>
    </header>
  );
}
