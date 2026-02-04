'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Contact, Task } from '@/lib/types';
import { Phone, Mail, Plus } from 'lucide-react';
import { AddTaskDialog } from '../../tasks/AddTaskDialog';

type LeadHeaderProps = {
  contact: Contact;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => void;
};

export function LeadHeader({ contact, onUpdateContact, onAddTask }: LeadHeaderProps) {
  
  return (
    <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mx-8 px-8 py-3 border-b">
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
          <Button size="sm" onClick={() => onUpdateContact({ status: 'Câștigat' })}>
            Marchează Vândut
          </Button>
        </div>
      </div>
    </header>
  );
}
