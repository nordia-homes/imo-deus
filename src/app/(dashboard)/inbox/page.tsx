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
} from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { updateDocumentNonBlocking, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { StoriaInboxLead } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

export default function StoriaInboxPage() {
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-3 text-slate-950 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
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

        <div className="grid min-h-[calc(100vh-184px)] gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
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

          <Card className="overflow-hidden rounded-lg border-slate-200 bg-white text-slate-950 shadow-sm">
            <CardContent className="p-0">
              {!selectedLead ? (
                <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
                  <Inbox className="h-12 w-12 text-slate-300" />
                  <p className="mt-4 text-lg font-semibold">Selecteaza un mesaj</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Aici vei vedea detaliile clientului, proprietatea asociata si firul mesajelor venite din Storia.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-[calc(100vh-180px)] flex-col">
                  <div className="border-b border-slate-200 bg-white px-4 py-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Conversatie Storia</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">{selectedLead.senderName}</h2>
                          <Badge className={cn('border px-2 py-0 text-[10px] uppercase hover:bg-transparent', STATUS_TONES[selectedLead.status])}>
                            {STATUS_LABELS[selectedLead.status]}
                          </Badge>
                          {selectedLead.unread && (
                            <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Necitit</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          onClick={() => updateLead(selectedLead, { unread: false })}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Marcheaza citit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          onClick={() => updateLead(selectedLead, { status: selectedLead.status === 'inchis' ? 'in_lucru' : 'inchis' })}
                        >
                          {selectedLead.status === 'inchis' ? 'Redeschide' : 'Inchide'}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[310px_minmax(0,1fr)]">
                      <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Client</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <InlineMeta icon={<Clock3 className="h-3.5 w-3.5" />} value={formatDate(selectedLead.lastMessageAt)} />
                          <InlineMeta icon={<Phone className="h-3.5 w-3.5" />} value={selectedLead.senderPhone ? String(selectedLead.senderPhone) : 'Telefon indisponibil'} />
                          <InlineMeta icon={<Mail className="h-3.5 w-3.5" />} value={selectedLead.senderEmail || 'Email indisponibil'} />
                        </div>
                        <p className="mt-3 truncate text-xs text-slate-400">#{selectedLead.conversationId}</p>
                      </section>

                      <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <PropertyThumb lead={selectedLead} size="lg" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Proprietate</p>
                            <p className="mt-1 truncate text-base font-semibold">{selectedLead.propertyTitle || 'Anunt Storia neasociat local'}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Remote ad: {selectedLead.remoteAdId || selectedLead.remoteAdvertUuid || 'necunoscut'}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {selectedLead.propertyId && (
                            <Button asChild size="sm" variant="outline" className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                              <Link href={`/properties/${selectedLead.propertyId}`}>
                                CRM
                                <ArrowUpRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          {selectedLead.propertyUrl && (
                            <Button asChild size="sm" variant="outline" className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                              <Link href={selectedLead.propertyUrl} target="_blank" rel="noopener noreferrer">
                                Storia
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Mesaje primite</p>
                      <p className="text-xs text-slate-500">{selectedLead.messages.length} mesaje</p>
                    </div>
                    <div className="space-y-3">
                    {selectedLead.messages.map((message) => (
                      <div key={message.id} className="flex justify-start">
                        <div className="max-w-[820px] rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">{message.senderName || selectedLead.senderName}</span>
                            <span>{formatDate(message.createdAt)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
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

function InlineMeta({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {icon}
      <span className="truncate">{value}</span>
    </span>
  );
}

function PropertyThumb({ lead, size }: { lead: StoriaInboxLead; size: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-12 w-12' : size === 'md' ? 'h-11 w-11' : 'h-12 w-12';

  return (
    <div className={cn('shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100', sizeClass)}>
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
