
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
    <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mt-4 md:-mt-6 lg:-mt-8 -mx-4 md:-mx-6 lg:mx-0 px-4 md:px-6 lg:px-6 py-3 lg:py-0 border-b lg:bg-[#0F1E33]/95 lg:border-white/10 lg:h-16">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 h-full">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{contact.name}</h1>
              <Badge variant="outline" className="lg:bg-white/10 lg:border-none">{contact.status}</Badge>
            </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" asChild className="lg:bg-white/10 lg:border-white/20 lg:text-white lg:hover:bg-white/20">
            <a href={`tel:${contact.phone}`}>
              <Phone className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{contact.phone}</span>
              <span className="sm:hidden">Apel</span>
            </a>
          </Button>
           <Button size="sm" variant="outline" asChild className="lg:bg-white/10 lg:border-white/20 lg:text-white lg:hover:bg-white/20">
             <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                <WhatsappIcon className="mr-2 h-4 w-4" />
                WhatsApp
             </a>
          </Button>
          <Button size="sm" variant="secondary" onClick={onTriggerEditPreferences} className="lg:bg-[#0B1319] lg:text-white lg:hover:bg-[#0B1319]/90">
              <Wand2 className="mr-2 h-4 w-4" />
              Actualizare Preferințe
          </Button>
          <Button size="sm" variant="outline" onClick={onTriggerAddViewing} className="lg:bg-white/10 lg:border-white/20 lg:text-white lg:hover:bg-white/20">
              <CalendarCheck className="mr-2 h-4 w-4" />
              Vizionare
          </Button>
          <Button size="sm" onClick={() => onUpdateContact({ status: 'Câștigat' })} className="col-span-2 lg:bg-primary lg:text-primary-foreground">
            Marchează Vândut
          </Button>
        </div>
      </div>
    </header>
  );
}
