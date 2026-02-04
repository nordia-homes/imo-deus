'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Contact, Property, Task, Viewing } from '@/lib/types';
import { Phone, Mail, Plus, CalendarCheck } from 'lucide-react';
import { AddTaskDialog } from '../../tasks/AddTaskDialog';
import { AddViewingDialog } from '../../viewings/AddViewingDialog';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';

type LeadHeaderProps = {
  contact: Contact;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => void;
  onAddViewing: (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => void;
  properties: Property[];
};

export function LeadHeader({ contact, onUpdateContact, onAddTask, onAddViewing, properties }: LeadHeaderProps) {
  
  return (
    <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mt-4 md:-mt-6 lg:-mt-8 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-3 border-b">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{contact.name}</h1>
              <Badge variant="outline">{contact.status}</Badge>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${contact.phone}`}>
              <Phone className="mr-2 h-4 w-4" />
              {contact.phone}
            </a>
          </Button>
           <Button size="sm" variant="outline" asChild>
             <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                <WhatsappIcon className="mr-2 h-4 w-4" />
                WhatsApp
             </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
             <a href={`mailto:${contact.email}`}>
                <Mail className="mr-2 h-4 w-4" />
                Trimite Email
             </a>
          </Button>
          <AddTaskDialog onAddTask={onAddTask} contacts={[contact]}>
             <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Creează Task
             </Button>
           </AddTaskDialog>
          <AddViewingDialog onAddViewing={onAddViewing} contacts={[contact]} properties={properties}>
            <Button size="sm" variant="outline">
                <CalendarCheck className="mr-2 h-4 w-4" />
                Adaugă Vizionare
            </Button>
          </AddViewingDialog>
          <Button size="sm" onClick={() => onUpdateContact({ status: 'Câștigat' })}>
            Marchează Vândut
          </Button>
        </div>
      </div>
    </header>
  );
}
