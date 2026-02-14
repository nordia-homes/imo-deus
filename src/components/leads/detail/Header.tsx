
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Contact, Property, Task, Viewing } from '@/lib/types';
import { Phone, Mail, Plus, CalendarCheck, Wand2 } from 'lucide-react';
import { AddTaskDialog } from '../../tasks/AddTaskDialog';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';

type LeadHeaderProps = {
  contact: Contact;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => void;
  onTriggerAddViewing: () => void;
  properties: Property[];
  onTriggerEditPreferences: () => void;
};

export function LeadHeader({ contact, onUpdateContact, onAddTask, onTriggerAddViewing, properties, onTriggerEditPreferences }: LeadHeaderProps) {
  
  return (
    <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mt-4 md:-mt-6 lg:-mt-8 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-3 border-b">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{contact.name}</h1>
              <Badge variant="outline">{contact.status}</Badge>
            </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${contact.phone}`}>
              <Phone className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{contact.phone}</span>
              <span className="sm:hidden">Apel</span>
            </a>
          </Button>
           <Button size="sm" variant="outline" asChild>
             <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                <WhatsappIcon className="mr-2 h-4 w-4" />
                WhatsApp
             </a>
          </Button>
          <Button size="sm" variant="secondary" onClick={onTriggerEditPreferences}>
              <Wand2 className="mr-2 h-4 w-4" />
              Actualizare Preferințe
          </Button>
          <Button size="sm" variant="outline" onClick={onTriggerAddViewing}>
              <CalendarCheck className="mr-2 h-4 w-4" />
              Vizionare
          </Button>
          <Button size="sm" onClick={() => onUpdateContact({ status: 'Câștigat' })} className="col-span-2">
            Marchează Vândut
          </Button>
        </div>
      </div>
    </header>
  );
}
