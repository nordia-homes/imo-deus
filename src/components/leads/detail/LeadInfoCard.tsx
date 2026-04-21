'use client';

import { useEffect, useRef, useState } from 'react';
import { differenceInDays } from 'date-fns';
import { Calendar, Clock, Edit, FileText, MapPin, MapPinned } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Contact, PortalRecommendation, Property, Task, Viewing } from '@/lib/types';

import { AiLeadScoreCard } from './AiLeadScoreCard';
import { SourcePropertyCard } from './SourcePropertyCard';

type LeadInfoCardProps = {
  contact: Contact;
  onEdit: () => void;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  sourceProperty: Property | null;
  isSourcePropertyLoading: boolean;
  allProperties: Property[];
  viewings?: Viewing[] | null;
  tasks?: Task[] | null;
  recommendations?: PortalRecommendation[] | null;
};

export function LeadInfoCard({
  contact,
  onEdit,
  onUpdateContact,
  sourceProperty,
  isSourcePropertyLoading,
  allProperties,
  viewings,
  tasks,
  recommendations,
}: LeadInfoCardProps) {
  const creationDate = contact.createdAt ? new Date(contact.createdAt) : new Date();
  const ageInDays = differenceInDays(new Date(), creationDate);

  const [description, setDescription] = useState(contact.description || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDescription(contact.description || '');
  }, [contact]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [description]);

  const handleBlur = () => {
    if (description !== (contact.description || '')) {
      onUpdateContact({ description });
    }
  };

  let ageBadgeVariant: 'success' | 'warning' | 'destructive' = 'success';
  if (ageInDays > 30) {
    ageBadgeVariant = 'destructive';
  } else if (ageInDays >= 14) {
    ageBadgeVariant = 'warning';
  }

  return (
    <Card className="agentfinder-lead-info-card relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#132844_0%,#0f2036_58%,#0b1727_100%)] text-white shadow-[0_30px_80px_-38px_rgba(0,0,0,0.9)]">
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        className="agentfinder-sidebar-button agentfinder-sidebar-button--icon agentfinder-lead-info-edit absolute top-3 right-3 z-10 h-8 w-8"
      >
        <Edit className="h-4 w-4" />
      </Button>

      <CardContent className="space-y-5 p-5 pt-6">
        <div className="space-y-4">
          <div className="agentfinder-lead-info-hero">
            <p className="agentfinder-lead-info-eyebrow text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
              Profil cumpărător
            </p>
            <p className="agentfinder-lead-info-label mt-3 text-xs text-white/55">Buget</p>
            <p className="agentfinder-lead-info-budget mt-1 text-4xl font-black leading-none text-white">
              {contact.budget ? `€${contact.budget.toLocaleString()}` : 'Nespecificat'}
            </p>
          </div>

          <AiLeadScoreCard
            contact={contact}
            viewings={viewings}
            tasks={tasks}
            sourceProperty={sourceProperty}
            recommendations={recommendations}
            onUpdateContact={onUpdateContact}
            variant="inline"
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="agentfinder-lead-info-stat rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                <Calendar className="h-3.5 w-3.5" />
                Adăugat
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {new Date(creationDate).toLocaleDateString('ro-RO')}
              </p>
            </div>

            <div
              className={cn(
                'agentfinder-lead-info-stat rounded-2xl border px-3 py-3',
                ageBadgeVariant === 'success' && 'border-green-500/20 bg-green-500/8',
                ageBadgeVariant === 'warning' && 'border-yellow-500/20 bg-yellow-500/8',
                ageBadgeVariant === 'destructive' && 'border-red-500/20 bg-red-500/8'
              )}
            >
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                <Clock className="h-3.5 w-3.5" />
                Vechime
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}
              </p>
            </div>
          </div>

          <div className="agentfinder-lead-info-stat rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                <MapPinned className="h-3.5 w-3.5" />
                Oraș
              </p>
            <p className="mt-2 truncate whitespace-nowrap text-sm font-semibold text-white">
              {contact.city || 'N/A'}
            </p>
          </div>

          {contact.zones && contact.zones.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white/72">
                <MapPin className="h-4 w-4" />
                Zone preferate
              </h4>
              <div className="space-y-2">
                {contact.zones.map((zone) => (
                  <div
                    key={zone}
                    className="agentfinder-lead-info-stat agentfinder-lead-info-zone rounded-2xl border border-white/10 bg-white/6 px-3 py-3"
                  >
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                      <MapPin className="h-3.5 w-3.5" />
                      Zona preferata
                    </p>
                    <p className="mt-2 truncate whitespace-nowrap text-sm font-semibold text-white">
                      {zone}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white/72">
            <FileText className="h-4 w-4" />
            Observații
          </h4>
          <Textarea
            ref={textareaRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleBlur}
            placeholder="Adaugă o descriere detaliată a cumpărătorului, preferințe și cerințe speciale."
            className="agentfinder-lead-info-textarea min-h-[104px] resize-none overflow-hidden rounded-2xl border-white/10 bg-white text-sm text-slate-900 placeholder:text-slate-500"
            rows={4}
          />
        </div>

      </CardContent>

      <div className="hidden lg:block px-5 pb-5">
        <Separator className="mb-5 mt-0 bg-white/10" />
        <SourcePropertyCard
          property={sourceProperty}
          isLoading={isSourcePropertyLoading}
          allProperties={allProperties}
          onUpdateContact={onUpdateContact}
        />
      </div>
    </Card>
  );
}
