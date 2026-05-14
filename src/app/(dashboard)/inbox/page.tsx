'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { collection, doc, getDoc, orderBy, query } from 'firebase/firestore';
import {
  ArrowUpRight,
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
import type { Property, StoriaInboxLead } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
    let sourceProperty: Property | null = null;

    if (lead.propertyId) {
      const propertySnapshot = await getDoc(doc(firestore, 'agencies', agencyId, 'properties', lead.propertyId));
      sourceProperty = propertySnapshot.exists() ? ({ id: propertySnapshot.id, ...propertySnapshot.data() } as Property) : null;
    }

    const propertyCity = sourceProperty?.city?.trim() || '';
    const propertyZone = sourceProperty?.zone?.trim() || '';
    const description = [
      lead.latestMessage ? `Mesaj Storia: ${lead.latestMessage}` : null,
      lead.propertyTitle ? `Proprietate: ${lead.propertyTitle}` : null,
      propertyCity ? `Localitate: ${propertyCity}` : null,
      propertyZone ? `Zona: ${propertyZone}` : null,
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
      city: propertyCity || null,
      zones: propertyZone ? [propertyZone] : [],
      locationPreferences: propertyCity || '',
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
        <section className="overflow-hidden rounded-[22px] border border-white bg-white text-slate-950 shadow-[0_26px_70px_-46px_rgba(15,23,42,0.95)] ring-1 ring-slate-900/[0.04] lg:hidden">
          <div className="relative px-5 py-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_7%_0%,rgba(16,185,129,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.95)_100%)]" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]">
                  <Inbox className="h-5 w-5" />
                </span>
                <h1 className="truncate text-xl font-semibold tracking-normal">Inbox</h1>
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-semibold leading-none text-slate-700 shadow-sm">
                  {stats.total}
                </span>
              </div>
              <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold leading-none text-emerald-800 shadow-[0_16px_38px_-28px_rgba(16,185,129,0.8)]">
                <span>{stats.unread}</span>
                <span className="text-emerald-700/75">necitite</span>
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
            <div className="space-y-2.5">
              {sortedLeads.map((lead) => (
                <MobileLeadCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => {
                    setSelectedId(lead.id);
                    setMobileLeadId(lead.id);
                    if (lead.unread) {
                      updateLead(lead, { unread: false });
                    }
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
                  <div className="space-y-2 bg-slate-50/70 p-2">
                    {sortedLeads.map((lead) => {
                      const isSelected = selectedLead?.id === lead.id;
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          className={cn(
                            'relative block w-full overflow-hidden rounded-[16px] border px-3 py-3 text-left transition-all',
                            'border-slate-200/80 bg-white shadow-[0_16px_38px_-34px_rgba(15,23,42,0.9)] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_22px_48px_-36px_rgba(15,23,42,0.9)]',
                            lead.unread && 'border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_62%)] before:absolute before:left-0 before:top-3 before:h-[calc(100%-1.5rem)] before:w-1 before:rounded-r-full before:bg-emerald-400',
                            isSelected && 'border-slate-300 bg-[linear-gradient(135deg,#f8fafc_0%,#eef7f3_100%)] shadow-[0_24px_55px_-38px_rgba(15,23,42,0.95)]'
                          )}
                          onClick={() => setSelectedId(lead.id)}
                        >
                          <div className="flex items-start gap-3">
                            <PropertyThumb lead={lead} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className={cn('truncate text-sm font-semibold', lead.unread && 'text-emerald-950')}>{lead.senderName}</p>
                                <span className="shrink-0 text-xs text-slate-500">{formatDate(lead.lastMessageAt)}</span>
                              </div>
                              <p className={cn('mt-0.5 truncate text-xs', lead.unread ? 'font-medium text-slate-700' : 'text-slate-500')}>
                                {lead.propertyTitle || `Anunt Storia ${lead.remoteAdId || ''}`}
                              </p>
                              <p className={cn('mt-2 line-clamp-2 text-sm leading-5', lead.unread ? 'font-semibold text-slate-950' : 'text-slate-700')}>{lead.latestMessage}</p>
                              <div className="mt-2 flex items-center gap-2">
                                {lead.unread && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]" aria-label="Necitit" />}
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
            <StoriaLeadDetailCard
              lead={selectedLead}
              onUpdate={updateLead}
              onAddLead={addLeadToApp}
              isAdded={addedLeadIds.has(selectedLead.id)}
              className="min-h-[calc(100vh-184px)]"
            />
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
      className={cn(
        'relative block w-full overflow-hidden rounded-[22px] border px-3.5 py-3 text-left transition active:scale-[0.99]',
        lead.unread
          ? 'border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_58%)] shadow-[0_20px_55px_-34px_rgba(16,185,129,0.85)]'
          : 'border-slate-200/80 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.9)] active:bg-slate-50'
      )}
    >
      {lead.unread && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-emerald-400" />}
      <div className="flex items-center gap-3.5">
        <PropertyThumb lead={lead} size="chat" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {lead.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]" aria-label="Necitit" />}
              <p className={cn('truncate text-[15px] font-semibold', lead.unread ? 'text-emerald-950' : 'text-slate-700')}>{lead.senderName}</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-400">{formatDate(lead.lastMessageAt)}</span>
          </div>
          <p className={cn('mt-1 truncate text-[15px] font-semibold leading-5', lead.unread ? 'text-slate-950' : 'text-slate-950')}>
            {lead.propertyTitle || `Anunt Storia ${lead.remoteAdId || ''}`}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <p className={cn('min-w-0 flex-1 truncate text-sm leading-5', lead.unread ? 'font-semibold text-slate-800' : 'text-slate-500')}>{lead.latestMessage}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function MobileLeadModal({
  lead,
  onAddLead,
  isAdded,
}: {
  lead: StoriaInboxLead;
  onAddLead: (lead: StoriaInboxLead) => void;
  isAdded: boolean;
}) {
  const telUrl = normalizePhone(lead.senderPhone);
  const whatsappUrl = getWhatsAppUrl(lead.senderPhone);

  return (
    <div className="max-h-[94dvh] overflow-y-auto bg-slate-50">
      <div className="bg-white">
        <div className="relative h-48 bg-slate-950">
          <PropertyModalHeroImage lead={lead} />
          <div className="absolute bottom-4 right-4 flex gap-2">
            {lead.propertyId && (
              <Button asChild size="sm" variant="outline" className="h-8 rounded-full border-white/35 bg-white/88 px-3 text-slate-900 shadow-sm backdrop-blur hover:bg-white">
                <Link href={`/properties/${lead.propertyId}`}>
                  CRM
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            {lead.propertyUrl && (
              <Button asChild size="sm" variant="outline" className="h-8 rounded-full border-white/35 bg-white/88 px-3 text-slate-900 shadow-sm backdrop-blur hover:bg-white">
                <Link href={lead.propertyUrl} target="_blank" rel="noopener noreferrer">
                  Storia
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="bg-[linear-gradient(180deg,#ffffff_0%,#f3f8f6_100%)] px-4 pb-5 pt-4">
          <div className="rounded-[22px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(239,247,243,0.92)_100%)] px-4 py-4 shadow-[0_22px_55px_-38px_rgba(15,23,42,0.9)] ring-1 ring-slate-900/[0.03]">
            <h2 className="text-3xl font-semibold leading-tight text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]">{lead.senderName}</h2>
            <p className="mt-2 line-clamp-2 text-base leading-6 text-slate-600">{lead.propertyTitle || `Anunt Storia ${lead.remoteAdId || ''}`}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-[1fr_0.72fr_1.32fr] gap-2">
          <Button asChild disabled={!whatsappUrl} variant="outline" className="h-16 rounded-[18px] border-slate-200 bg-white px-1">
            <a href={whatsappUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-1">
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs leading-none">WhatsApp</span>
            </a>
          </Button>
          <Button asChild disabled={!telUrl} variant="outline" className="h-16 rounded-[18px] border-slate-200 bg-white px-1">
            <a href={telUrl ? `tel:${telUrl}` : '#'} className="flex flex-col gap-1">
              <Phone className="h-4 w-4" />
              <span className="text-xs leading-none">Suna</span>
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-16 flex-col gap-1 rounded-[18px] border-slate-200 bg-white px-1"
            onClick={() => onAddLead(lead)}
            disabled={isAdded}
          >
            <UserPlus className="h-4 w-4" />
            <span className="whitespace-nowrap text-[11px] leading-none">{isAdded ? 'Adaugat' : 'Adauga in CRM'}</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <InfoPill icon={<Phone className="h-4 w-4" />} label="Telefon" value={lead.senderPhone ? String(lead.senderPhone) : 'Indisponibil'} />
          <InfoPill icon={<Mail className="h-4 w-4" />} label="Email" value={lead.senderEmail || 'Indisponibil'} />
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

function PropertyModalHeroImage({ lead }: { lead: StoriaInboxLead }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950">
      {lead.propertyImageUrl ? (
        <img
          src={lead.propertyImageUrl}
          alt={lead.propertyTitle || 'Proprietate Storia'}
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#10231f,#dff5ea)]">
          <Home className="h-12 w-12 text-white/75" />
        </div>
      )}
    </div>
  );
}

function StoriaLeadDetailCard({
  lead,
  onUpdate,
  onAddLead,
  isAdded,
  className,
}: {
  lead: StoriaInboxLead;
  onUpdate: (lead: StoriaInboxLead, data: Partial<Pick<StoriaInboxLead, 'status' | 'unread'>>) => void;
  onAddLead: (lead: StoriaInboxLead) => void;
  isAdded: boolean;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden rounded-[18px] border-slate-200 bg-white text-slate-950 shadow-[0_26px_80px_-58px_rgba(15,23,42,0.85)]', className)}>
      <CardContent className="flex min-h-[calc(100vh-184px)] flex-col p-0">
        <div className="bg-[linear-gradient(135deg,#0f241f_0%,#18372f_48%,#f8fafc_48%,#ffffff_100%)] px-5 py-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)] xl:items-center">
            <div className="flex min-w-0 items-center gap-4 text-white">
              <PropertyThumb lead={lead} size="desktopHero" />
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <h2 className="min-w-0 truncate text-3xl font-semibold leading-tight">{lead.senderName}</h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 rounded-full border-white/25 bg-white/12 px-3 text-white shadow-[0_12px_30px_-22px_rgba(0,0,0,0.8)] backdrop-blur hover:bg-white/20"
                    onClick={() => onAddLead(lead)}
                    disabled={isAdded}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {isAdded ? 'Adaugat' : 'Adauga in CRM'}
                  </Button>
                </div>
                <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-5 text-white/72">
                  {lead.propertyTitle || `Anunt Storia ${lead.remoteAdId || lead.remoteAdvertUuid || ''}`}
                </p>
                <p className="mt-2 truncate text-xs text-white/45">Conversatie #{lead.conversationId}</p>
              </div>
            </div>

            <div className="rounded-[16px] border border-slate-200 bg-white/92 p-4 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.8)] backdrop-blur">
              <div className="flex min-w-0 items-center gap-3">
                <PropertyThumb lead={lead} size="lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    <Home className="h-4 w-4" />
                    Proprietate
                  </div>
                  <p className="mt-1 truncate text-base font-semibold">{lead.propertyTitle || 'Anunt Storia neasociat local'}</p>
                  <p className="mt-0.5 text-sm text-slate-500">Remote ad: {lead.remoteAdId || lead.remoteAdvertUuid || 'necunoscut'}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
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
                {getWhatsAppUrl(lead.senderPhone) && (
                  <Button asChild size="sm" variant="outline" className="h-9 rounded-full border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
                    <a href={getWhatsAppUrl(lead.senderPhone)} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                      <MessageSquare className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailTile icon={<Phone className="h-4 w-4" />} label="Telefon" value={lead.senderPhone ? String(lead.senderPhone) : 'Indisponibil'} />
            <DetailTile icon={<Mail className="h-4 w-4" />} label="Email" value={lead.senderEmail || 'Indisponibil'} />
            <DetailTile icon={<Clock3 className="h-4 w-4" />} label="Ultimul mesaj" value={formatDate(lead.lastMessageAt)} />
            <DetailTile icon={<MessageSquare className="h-4 w-4" />} label="Mesaje" value={String(lead.messages.length)} />
          </div>

        </div>

        <MessageThread lead={lead} />
      </CardContent>
    </Card>
  );
}

function DetailTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-slate-200 bg-white/92 p-4 shadow-[0_16px_42px_-36px_rgba(15,23,42,0.85)] backdrop-blur">
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

function MessageThread({ lead }: { lead: StoriaInboxLead }) {
  return (
    <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Mesaje primite</p>
        <p className="text-xs text-slate-500">{lead.messages.length} mesaje</p>
      </div>
      <div className="space-y-3">
        {lead.messages.map((message) => (
          <div key={message.id} className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-[0_18px_45px_-38px_rgba(15,23,42,0.9)]">
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

function PropertyThumb({ lead, size }: { lead: StoriaInboxLead; size: 'sm' | 'md' | 'lg' | 'xl' | 'modal' | 'chat' | 'desktopHero' }) {
  const sizeClass =
    size === 'desktopHero'
      ? 'h-24 w-24 rounded-[22px] border-white/20 shadow-[0_20px_45px_-24px_rgba(0,0,0,0.7)]'
      : size === 'chat'
      ? 'h-14 w-14 rounded-full'
      : size === 'modal'
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
