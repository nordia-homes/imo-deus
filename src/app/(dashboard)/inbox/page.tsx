'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Home,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  RefreshCcw,
  UserPlus,
} from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { addDocumentNonBlocking, updateDocumentNonBlocking, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { StoriaInboxLead } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<StoriaInboxLead['status'], string> = {
  nou: 'Nou',
  in_lucru: 'In lucru',
  raspuns: 'Raspuns',
  inchis: 'Inchis',
};

const STATUS_TONES: Record<StoriaInboxLead['status'], string> = {
  nou: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  in_lucru: 'border-sky-200 bg-sky-50 text-sky-700',
  raspuns: 'border-violet-200 bg-violet-50 text-violet-700',
  inchis: 'border-slate-200 bg-slate-100 text-slate-600',
};

function formatDate(value?: string | null) {
  if (!value) return 'Fara data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fara data';

  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ST';
}

function normalizePhone(value?: string | number | null) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

function getWhatsAppUrl(value?: string | number | null) {
  const phone = normalizePhone(value).replace(/^\+/, '');
  return phone ? `https://wa.me/${phone}` : '';
}

export default function StoriaInboxPage() {
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileLeadId, setMobileLeadId] = useState<string | null>(null);
  const [addedLeadIds, setAddedLeadIds] = useState<Set<string>>(() => new Set());

  const inboxQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(
      collection(firestore, 'agencies', agencyId, 'storiaInboxLeads'),
      orderBy('lastMessageAt', 'desc')
    );
  }, [agencyId, firestore]);

  const { data: leads, isLoading, error } = useCollection<StoriaInboxLead>(inboxQuery);
  const sortedLeads = useMemo(() => leads || [], [leads]);
  const selectedLead = useMemo(
    () => sortedLeads.find((lead) => lead.id === selectedId) || sortedLeads[0] || null,
    [selectedId, sortedLeads]
  );
  const mobileLead = useMemo(
    () => sortedLeads.find((lead) => lead.id === mobileLeadId) || null,
    [mobileLeadId, sortedLeads]
  );

  const stats = useMemo(() => {
    const unread = sortedLeads.filter((lead) => lead.unread).length;
    const open = sortedLeads.filter((lead) => lead.status !== 'inchis').length;
    return { unread, open, total: sortedLeads.length };
  }, [sortedLeads]);

  const updateLead = (lead: StoriaInboxLead, data: Partial<Pick<StoriaInboxLead, 'status' | 'unread'>>) => {
    if (!agencyId) return;
    updateDocumentNonBlocking(doc(firestore, 'agencies', agencyId, 'storiaInboxLeads', lead.id), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  };

  const addLeadToApp = async (lead: StoriaInboxLead) => {
    if (!agencyId || addedLeadIds.has(lead.id)) return;
    const now = new Date().toISOString();
    const phone = lead.senderPhone ? String(lead.senderPhone) : '';
    const email = lead.senderEmail || '';
    const description = [
      lead.latestMessage ? `Mesaj Storia: ${lead.latestMessage}` : null,
      lead.propertyTitle ? `Proprietate: ${lead.propertyTitle}` : null,
      lead.remoteAdId ? `Remote ad: ${lead.remoteAdId}` : null,
      lead.conversationId ? `Conversatie Storia: ${lead.conversationId}` : null,
    ].filter(Boolean).join('\n');

    await addDocumentNonBlocking(collection(firestore, 'agencies', agencyId, 'contacts'), {
      name: lead.senderName || 'Lead Storia',
      phone,
      email,
      source: 'Storia',
      status: 'Nou',
      contactType: 'Cumparator',
      description,
      sourcePropertyId: lead.propertyId || null,
      createdAt: now,
      tags: ['Storia'],
    });

    setAddedLeadIds((current) => new Set(current).add(lead.id));
    updateLead(lead, { unread: false, status: 'in_lucru' });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-3 text-slate-950 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <section className="overflow-hidden rounded-[22px] bg-[#10231f] text-white shadow-[0_24px_70px_-45px_rgba(15,35,31,0.8)] lg:hidden">
          <div className="relative px-5 py-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(52,211,153,0.34),transparent_34%),radial-gradient(circle_at_95%_10%,rgba(125,211,252,0.22),transparent_30%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/70">Storia inbox</p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-normal">Mesaje noi</h1>
                  <p className="mt-2 max-w-[260px] text-sm leading-5 text-white/68">Lead-uri conectate direct la proprietatea publicata.</p>
                </div>
                <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold leading-none backdrop-blur">
                  <span>{stats.unread}</span>
                  <span className="text-white/72">necitite</span>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <MobileStat label="Total" value={stats.total} />
                <MobileStat label="Deschise" value={stats.open} />
              </div>
            </div>
          </div>
        </section>

        <header className="hidden flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm lg:flex lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-slate-500" />
              <h1 className="text-xl font-semibold tracking-normal">Inbox Storia</h1>
              <Badge className="h-7 border border-emerald-200 bg-emerald-50 px-3 text-[11px] uppercase tracking-[0.16em] text-emerald-700 hover:bg-emerald-50">
                {stats.unread} necitite
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">Lead-uri din Storia, grupate dupa client si proprietate.</p>
          </div>
          <div className="flex gap-2 text-sm">
            <StatChip label="Total" value={stats.total} />
            <StatChip label="Deschise" value={stats.open} />
          </div>
        </header>

        <div className="lg:hidden">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-36 rounded-lg bg-slate-100" />
              <Skeleton className="h-36 rounded-lg bg-slate-100" />
            </div>
          ) : error ? (
            <MobileEmptyState
              icon={<MessageSquare className="h-10 w-10 text-amber-500" />}
              title="Inbox-ul Storia nu poate fi citit"
              text="Verifica permisiunile Firestore sau indexurile pentru colectia storiaInboxLeads."
            />
          ) : sortedLeads.length === 0 ? (
            <MobileEmptyState
              icon={<MessageSquare className="h-10 w-10 text-slate-300" />}
              title="Nu exista mesaje Storia inca"
              text="Cand webhook-ul incoming_message primeste lead-uri, conversatiile vor aparea automat aici."
            />
          ) : (
            <div className="space-y-3">
              {sortedLeads.map((lead) => (
                <MobileLeadCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => {
                    setSelectedId(lead.id);
                    setMobileLeadId(lead.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="hidden min-h-[calc(100vh-184px)] gap-4 lg:grid lg:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="overflow-hidden rounded-lg border-slate-200 bg-white text-slate-950 shadow-sm">
            <CardContent className="p-0">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Conversatii</p>
                    <p className="text-xs text-slate-500">Cele mai recente primele</p>
                  </div>
                  <RefreshCcw className="h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="max-h-[calc(100vh-230px)] overflow-y-auto">
                {isLoading ? (
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-20 bg-slate-100" />
                    <Skeleton className="h-20 bg-slate-100" />
                    <Skeleton className="h-20 bg-slate-100" />
                  </div>
                ) : error ? (
                  <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                    <MessageSquare className="h-10 w-10 text-amber-500" />
                    <p className="mt-4 text-base font-semibold">Inbox-ul Storia nu poate fi citit</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Verifica permisiunile Firestore sau indexurile pentru colectia `storiaInboxLeads`.
                    </p>
                  </div>
                ) : sortedLeads.length === 0 ? (
                  <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                    <MessageSquare className="h-10 w-10 text-slate-300" />
                    <p className="mt-4 text-base font-semibold">Nu exista mesaje Storia inca</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Cand webhook-ul `incoming_message` primeste lead-uri, conversatiile vor aparea automat aici.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sortedLeads.map((lead) => {
                      const isSelected = selectedLead?.id === lead.id;
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          className={cn('block w-full px-3 py-3 text-left transition-colors hover:bg-slate-50', isSelected && 'bg-slate-100')}
                          onClick={() => setSelectedId(lead.id)}
                        >
                          <div className="flex items-start gap-3">
                            <PropertyThumb lead={lead} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold">{lead.senderName}</p>
                                <span className="shrink-0 text-xs text-slate-500">{formatDate(lead.lastMessageAt)}</span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {lead.propertyTitle || `Anunt Storia ${lead.remoteAdId || ''}`}
                              </p>
                              <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-700">{lead.latestMessage}</p>
                              <div className="mt-2 flex items-center gap-2">
                                {lead.unread && <span className="h-2 w-2 rounded-full bg-emerald-300" aria-label="Necitit" />}
                                <Badge className={cn('shrink-0 border px-2 py-0 text-[10px] uppercase hover:bg-transparent', STATUS_TONES[lead.status])}>
                                  {STATUS_LABELS[lead.status]}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedLead ? (
            <StoriaLeadDetailCard lead={selectedLead} onUpdate={updateLead} className="min-h-[calc(100vh-184px)]" />
          ) : (
            <Card className="rounded-lg border-slate-200 bg-white text-slate-950 shadow-sm">
              <CardContent className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
                <Inbox className="h-12 w-12 text-slate-300" />
                <p className="mt-4 text-lg font-semibold">Selecteaza un mesaj</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Aici vei vedea detaliile clientului, proprietatea asociata si firul mesajelor venite din Storia.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={Boolean(mobileLead)} onOpenChange={(open) => !open && setMobileLeadId(null)}>
        <DialogContent className="max-h-[94dvh] w-[calc(100vw-0.75rem)] overflow-hidden rounded-[26px] border-0 bg-white p-0 text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.32)] sm:max-w-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Mesaj Storia</DialogTitle>
            <DialogDescription>Detalii lead Storia si mesajele primite.</DialogDescription>
          </DialogHeader>
          {mobileLead && (
            <MobileLeadModal
              lead={mobileLead}
              onUpdate={updateLead}
              onAddLead={addLeadToApp}
              isAdded={addedLeadIds.has(mobileLead.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function MobileEmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
      <div className="flex justify-center">{icon}</div>
      <p className="mt-4 text-base font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function MobileLeadCard({ lead, onOpen }: { lead: StoriaInboxLead; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full rounded-[24px] border border-slate-200 bg-white p-4 text-left shadow-[0_18px_50px_-34px_rgba(15,23,42,0.75)] transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge className={cn('border px-2 py-0 text-[10px] uppercase backdrop-blur hover:bg-transparent', STATUS_TONES[lead.status])}>
            {STATUS_LABELS[lead.status]}
          </Badge>
          <p className="mt-3 line-clamp-2 text-base font-semibold leading-5">{lead.propertyTitle || `Anunt Storia ${lead.remoteAdId || ''}`}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="truncate text-lg font-semibold">{lead.senderName}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">{lead.latestMessage}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5" />
          {formatDate(lead.lastMessageAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {lead.messages.length} mesaje
        </span>
        {lead.unread && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Nou</span>}
      </div>
    </button>
  );
}

function MobileLeadModal({
  lead,
  onUpdate,
  onAddLead,
  isAdded,
}: {
  lead: StoriaInboxLead;
  onUpdate: (lead: StoriaInboxLead, data: Partial<Pick<StoriaInboxLead, 'status' | 'unread'>>) => void;
  onAddLead: (lead: StoriaInboxLead) => void;
  isAdded: boolean;
}) {
  const telUrl = normalizePhone(lead.senderPhone);
  const whatsappUrl = getWhatsAppUrl(lead.senderPhone);

  return (
    <div className="max-h-[94dvh] overflow-y-auto bg-slate-50">
      <div className="bg-[#10231f] px-4 pb-5 pt-5 text-white">
        <div className="flex items-start gap-4">
          <PropertyThumb lead={lead} size="modal" />
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <Badge className={cn('border px-2 py-0 text-[10px] uppercase backdrop-blur hover:bg-transparent', STATUS_TONES[lead.status])}>
                {STATUS_LABELS[lead.status]}
              </Badge>
              {lead.unread && <span className="rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-950">Necitit</span>}
            </div>
            <h2 className="text-2xl font-semibold text-white">{lead.senderName}</h2>
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-white/76">{lead.propertyTitle || `Anunt Storia ${lead.remoteAdId || ''}`}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Button asChild disabled={!whatsappUrl} variant="outline" className="h-12 rounded-[18px] border-slate-200 bg-white">
            <a href={whatsappUrl || '#'} target="_blank" rel="noopener noreferrer">
              <MessageSquare className="mr-2 h-4 w-4" />
              WhatsApp
            </a>
          </Button>
          <Button asChild disabled={!telUrl} variant="outline" className="h-12 rounded-[18px] border-slate-200 bg-white">
            <a href={telUrl ? `tel:${telUrl}` : '#'}>
              <Phone className="mr-2 h-4 w-4" />
              Sună
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-[18px] border-slate-200 bg-white"
            onClick={() => onAddLead(lead)}
            disabled={isAdded}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {isAdded ? 'Adăugat' : 'Adaugă'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <InfoPill icon={<Phone className="h-4 w-4" />} label="Telefon" value={lead.senderPhone ? String(lead.senderPhone) : 'Indisponibil'} />
          <InfoPill icon={<Mail className="h-4 w-4" />} label="Email" value={lead.senderEmail || 'Indisponibil'} />
          <InfoPill icon={<Clock3 className="h-4 w-4" />} label="Ultimul mesaj" value={formatDate(lead.lastMessageAt)} />
          <InfoPill icon={<MessageSquare className="h-4 w-4" />} label="Mesaje" value={String(lead.messages.length)} />
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Proprietate</p>
          <p className="mt-2 text-base font-semibold leading-5">{lead.propertyTitle || 'Anunt Storia neasociat local'}</p>
          <p className="mt-1 text-sm text-slate-500">Remote ad: {lead.remoteAdId || lead.remoteAdvertUuid || 'necunoscut'}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {lead.propertyId && (
              <Button asChild size="sm" variant="outline" className="rounded-full border-slate-200 bg-white">
                <Link href={`/properties/${lead.propertyId}`}>
                  CRM
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            {lead.propertyUrl && (
              <Button asChild size="sm" variant="outline" className="rounded-full border-slate-200 bg-white">
                <Link href={lead.propertyUrl} target="_blank" rel="noopener noreferrer">
                  Storia
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-slate-200 bg-white"
            onClick={() => onUpdate(lead, { unread: false })}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Citit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-slate-200 bg-white"
            onClick={() => onUpdate(lead, { status: lead.status === 'inchis' ? 'in_lucru' : 'inchis' })}
          >
            {lead.status === 'inchis' ? 'Redeschide' : 'Inchide'}
          </Button>
        </div>

        <div className="space-y-3 pb-3">
          <p className="pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mesaje primite</p>
          {lead.messages.map((message) => (
            <div key={message.id} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{message.senderName || lead.senderName}</span>
                <span>{formatDate(message.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function StoriaLeadDetailCard({
  lead,
  onUpdate,
  className,
}: {
  lead: StoriaInboxLead;
  onUpdate: (lead: StoriaInboxLead, data: Partial<Pick<StoriaInboxLead, 'status' | 'unread'>>) => void;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden rounded-lg border-slate-200 bg-white text-slate-950 shadow-sm', className)}>
      <CardContent className="flex min-h-[calc(100vh-184px)] flex-col p-0">
        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <PropertyThumb lead={lead} size="xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-semibold">{lead.senderName}</h2>
                  <Badge className={cn('border px-2 py-0 text-[10px] uppercase hover:bg-transparent', STATUS_TONES[lead.status])}>
                    {STATUS_LABELS[lead.status]}
                  </Badge>
                  {lead.unread && (
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Necitit</Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                  {lead.propertyTitle || `Anunt Storia ${lead.remoteAdId || lead.remoteAdvertUuid || ''}`}
                </p>
                <p className="mt-1 truncate text-xs text-slate-400">Conversatie #{lead.conversationId}</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => onUpdate(lead, { unread: false })}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Marcheaza citit
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => onUpdate(lead, { status: lead.status === 'inchis' ? 'in_lucru' : 'inchis' })}
              >
                {lead.status === 'inchis' ? 'Redeschide' : 'Inchide'}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailTile icon={<Phone className="h-4 w-4" />} label="Telefon" value={lead.senderPhone ? String(lead.senderPhone) : 'Indisponibil'} />
            <DetailTile icon={<Mail className="h-4 w-4" />} label="Email" value={lead.senderEmail || 'Indisponibil'} />
            <DetailTile icon={<Clock3 className="h-4 w-4" />} label="Ultimul mesaj" value={formatDate(lead.lastMessageAt)} />
            <DetailTile icon={<MessageSquare className="h-4 w-4" />} label="Mesaje" value={String(lead.messages.length)} />
          </div>

          <PropertyInfoCard lead={lead} />
        </div>

        <MessageThread lead={lead} />
      </CardContent>
    </Card>
  );
}

function DetailTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-3 truncate text-base font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}

function PropertyInfoCard({ lead }: { lead: StoriaInboxLead }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <PropertyThumb lead={lead} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              <Home className="h-4 w-4" />
              Proprietate
            </div>
            <p className="mt-2 truncate text-base font-semibold">{lead.propertyTitle || 'Anunt Storia neasociat local'}</p>
            <p className="mt-1 text-sm text-slate-500">Remote ad: {lead.remoteAdId || lead.remoteAdvertUuid || 'necunoscut'}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {lead.propertyId && (
            <Button asChild size="sm" variant="outline" className="h-9 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Link href={`/properties/${lead.propertyId}`}>
                CRM
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          {lead.propertyUrl && (
            <Button asChild size="sm" variant="outline" className="h-9 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Link href={lead.propertyUrl} target="_blank" rel="noopener noreferrer">
                Storia
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageThread({ lead }: { lead: StoriaInboxLead }) {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Mesaje primite</p>
        <p className="text-xs text-slate-500">{lead.messages.length} mesaje</p>
      </div>
      <div className="space-y-3">
        {lead.messages.map((message) => (
          <div key={message.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{message.senderName || lead.senderName}</span>
              <span>{formatDate(message.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyThumb({ lead, size }: { lead: StoriaInboxLead; size: 'sm' | 'md' | 'lg' | 'xl' | 'modal' }) {
  const sizeClass =
    size === 'modal'
      ? 'h-24 w-24 rounded-[22px]'
      : size === 'xl'
        ? 'h-14 w-14 rounded-lg'
        : size === 'lg'
          ? 'h-12 w-12 rounded-lg'
          : size === 'md'
            ? 'h-11 w-11 rounded-lg'
            : 'h-12 w-12 rounded-lg';

  return (
    <div className={cn('shrink-0 overflow-hidden border border-slate-200 bg-slate-100', sizeClass)}>
      {lead.propertyImageUrl ? (
        <img
          src={lead.propertyImageUrl}
          alt={lead.propertyTitle || 'Proprietate Storia'}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-500">
          {lead.propertyTitle ? <Home className="h-5 w-5" /> : <span className="text-sm font-semibold">{getInitials(lead.senderName)}</span>}
        </div>
      )}
    </div>
  );
}
