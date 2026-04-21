'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Contact, Property, Task } from '@/lib/types';
import { BadgeCheck, Phone, CalendarCheck, Wand2 } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';

type LeadHeaderProps = {
  contact: Contact;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => void;
  onTriggerAddViewing: () => void;
  properties: Property[];
  onTriggerEditPreferences: () => void;
};

export function LeadHeader({
  contact,
  onUpdateContact,
  onAddTask,
  onTriggerAddViewing,
  properties,
  onTriggerEditPreferences,
}: LeadHeaderProps) {
  void onAddTask;
  void properties;

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
    <header className="agentfinder-lead-detail-topbar sticky top-16 z-20 bg-background/95 backdrop-blur-sm -mt-4 border-b px-0 py-0 md:-mt-6 lg:-mt-8 lg:border-white/10 lg:bg-[#0F1E33]/95">
      <div className="agentfinder-lead-detail-topbar__inner flex flex-col gap-3 px-4 py-4 md:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="agentfinder-lead-detail-topbar__identity flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="agentfinder-lead-detail-topbar__title truncate text-[2.05rem] font-bold leading-none tracking-tight text-white">
            {contact.name}
          </h1>
          <Badge
            variant="outline"
            className="agentfinder-lead-detail-topbar__status rounded-full px-3 py-1 lg:text-white"
          >
            {contact.status}
          </Badge>
        </div>

        <div className="agentfinder-lead-detail-topbar__actions grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end lg:flex-nowrap">
          {contact.phone && (
            <>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="agentfinder-button-secondary agentfinder-lead-detail-topbar__action"
              >
                <a href={`tel:${contact.phone}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{contact.phone}</span>
                  <span className="sm:hidden">Apel</span>
                </a>
              </Button>

              <Button
                size="sm"
                variant="outline"
                asChild
                className="agentfinder-button-secondary agentfinder-lead-detail-topbar__action"
              >
                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer">
                  <WhatsappIcon className="mr-2 h-4 w-4" />
                  WhatsApp
                </a>
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={onTriggerEditPreferences}
            className="agentfinder-button-tertiary agentfinder-lead-detail-topbar__action agentfinder-lead-detail-topbar__action--preferences"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Actualizare Preferințe
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onTriggerAddViewing}
            className="agentfinder-button-secondary agentfinder-lead-detail-topbar__action"
          >
            <CalendarCheck className="mr-2 h-4 w-4" />
            Vizionare
          </Button>

          <Button
            size="sm"
            onClick={() => onUpdateContact({ status: 'Câștigat' })}
            className="agentfinder-button-primary agentfinder-lead-detail-topbar__action agentfinder-lead-detail-topbar__action--primary col-span-2"
          >
            <BadgeCheck className="mr-2 h-4 w-4" />
            Marchează Vândut
          </Button>
        </div>
      </div>
    </header>
  );
}
