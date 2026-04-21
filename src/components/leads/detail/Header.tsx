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
  
  const sanitizeForWhatsapp = (phone?: string | null) => {
    if (!phone) return '';
    let sanitized = phone.replace(/\D/g, '');
    if (sanitized.length === 10 && sanitized.startsWith('07')) {
        return `40${sanitized.substring(1)}`;
    }
    return sanitized;
  };
  const sanitizedPhone = sanitizeForWhatsapp(contact.phone);

  return (
    <header className="agentfinder-lead-detail-topbar sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mt-4 md:-mt-6 lg:-mt-8 px-0 py-0 border-b lg:bg-[#0F1E33]/95 lg:border-white/10 lg:h-16">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 h-full">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#173255_0%,#10233b_100%)] px-5 py-2.5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)]">
                <h1 className="text-3xl font-bold tracking-tight text-white">{contact.name}</h1>
              </div>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/8 px-3 py-1 lg:text-white">{contact.status}</Badge>
            </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 flex-wrap">
          {contact.phone && (
            <>
              <Button size="sm" variant="outline" asChild className="agentfinder-button-secondary lg:bg-white/10 lg:border-white/20 lg:text-white lg:hover:bg-white/20">
                <a href={`tel:${contact.phone}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{contact.phone}</span>
                  <span className="sm:hidden">Apel</span>
                </a>
              </Button>
               <Button size="sm" variant="outline" asChild className="agentfinder-button-secondary lg:bg-white/10 lg:border-white/20 lg:text-white lg:hover:bg-white/20">
                 <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer">
                    <WhatsappIcon className="mr-2 h-4 w-4" />
                    WhatsApp
                 </a>
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={onTriggerEditPreferences} className="agentfinder-button-tertiary lg:bg-[#0B1319] lg:text-white lg:hover:bg-[#0B1319]/90">
              <Wand2 className="mr-2 h-4 w-4" />
              Actualizare Preferințe
          </Button>
          <Button size="sm" variant="outline" onClick={onTriggerAddViewing} className="agentfinder-button-secondary lg:bg-white/10 lg:border-white/20 lg:text-white lg:hover:bg-white/20">
              <CalendarCheck className="mr-2 h-4 w-4" />
              Vizionare
          </Button>
          <Button size="sm" onClick={() => onUpdateContact({ status: 'Câștigat' })} className="agentfinder-button-primary col-span-2 lg:bg-primary lg:text-primary-foreground">
            Marchează Vândut
          </Button>
        </div>
      </div>
    </header>
  );
}
