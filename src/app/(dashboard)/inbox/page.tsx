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
  nou: 'border-emerald-300/30 bg-emerald-400/12 text-emerald-100',
  in_lucru: 'border-sky-300/30 bg-sky-400/12 text-sky-100',
  raspuns: 'border-violet-300/30 bg-violet-400/12 text-violet-100',
  inchis: 'border-white/15 bg-white/8 text-white/70',
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

  const { data: leads, isLoading } = useCollection<StoriaInboxLead>(inboxQuery);
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
    <div className="min-h-[calc(100vh-4rem)] bg-[#0F1E33] px-3 py-4 text-white sm:px-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="rounded-2xl border border-white/10 bg-[#152A47] px-5 py-5 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/10">
                <Inbox className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Inbox Storia</h1>
                  <Badge className="border border-emerald-300/30 bg-emerald-400/12 text-emerald-100 hover:bg-emerald-400/12">
                    leads scope
                  </Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/68">
                  Doar mesajele primite din Storia apar aici. Lead-urile create manual, din website sau din alte portaluri raman in afara acestui inbox.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
              <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-3">
                <p className="text-2xl font-semibold">{stats.total}</p>
                <p className="text-xs text-white/55">Total</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-3">
                <p className="text-2xl font-semibold">{stats.unread}</p>
                <p className="text-xs text-white/55">Necitite</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-3">
                <p className="text-2xl font-semibold">{stats.open}</p>
                <p className="text-xs text-white/55">Deschise</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid min-h-[650px] gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="overflow-hidden rounded-2xl border-white/10 bg-[#152A47] text-white">
            <CardContent className="p-0">
              <div className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Mesaje Storia</p>
                    <p className="text-xs text-white/50">Sortate dupa ultimul mesaj</p>
                  </div>
                  <RefreshCcw className="h-4 w-4 text-white/45" />
                </div>
              </div>

              <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
                {isLoading ? (
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-24 bg-white/10" />
                    <Skeleton className="h-24 bg-white/10" />
                    <Skeleton className="h-24 bg-white/10" />
                  </div>
                ) : sortedLeads.length === 0 ? (
                  <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                    <MessageSquare className="h-10 w-10 text-white/35" />
                    <p className="mt-4 text-base font-semibold">Nu exista mesaje Storia inca</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Cand webhook-ul `incoming_message` primeste lead-uri, conversatiile vor aparea automat aici.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/8">
                    {sortedLeads.map((lead) => {
                      const isSelected = selectedLead?.id === lead.id;
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          className={cn(
                            'block w-full px-4 py-4 text-left transition-colors hover:bg-white/7',
                            isSelected && 'bg-white/10'
                          )}
                          onClick={() => setSelectedId(lead.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold ring-1 ring-inset ring-white/10">
                              {getInitials(lead.senderName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate font-semibold">{lead.senderName}</p>
                                <span className="shrink-0 text-xs text-white/45">{formatDate(lead.lastMessageAt)}</span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/65">{lead.latestMessage}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {lead.unread && <span className="h-2 w-2 rounded-full bg-emerald-300" aria-label="Necitit" />}
                                <Badge className={cn('border text-[11px] hover:bg-transparent', STATUS_TONES[lead.status])}>
                                  {STATUS_LABELS[lead.status]}
                                </Badge>
                                <span className="truncate text-xs text-white/45">
                                  {lead.propertyTitle || `Anunt Storia ${lead.remoteAdId || ''}`}
                                </span>
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

          <Card className="overflow-hidden rounded-2xl border-white/10 bg-[#152A47] text-white">
            <CardContent className="p-0">
              {!selectedLead ? (
                <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
                  <Inbox className="h-12 w-12 text-white/35" />
                  <p className="mt-4 text-lg font-semibold">Selecteaza un mesaj</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-white/55">
                    Aici vei vedea detaliile clientului, proprietatea asociata si firul mesajelor venite din Storia.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-[650px] flex-col">
                  <div className="border-b border-white/10 px-5 py-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-2xl font-semibold">{selectedLead.senderName}</h2>
                          <Badge className={cn('border hover:bg-transparent', STATUS_TONES[selectedLead.status])}>
                            {STATUS_LABELS[selectedLead.status]}
                          </Badge>
                          {selectedLead.unread && (
                            <Badge className="border border-emerald-300/30 bg-emerald-400/12 text-emerald-100 hover:bg-emerald-400/12">
                              Necitit
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-white/55">
                          Conversatie Storia #{selectedLead.conversationId}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/15 bg-white/8 text-white hover:bg-white/14 hover:text-white"
                          onClick={() => updateLead(selectedLead, { unread: false })}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Marcheaza citit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/15 bg-white/8 text-white hover:bg-white/14 hover:text-white"
                          onClick={() => updateLead(selectedLead, { status: selectedLead.status === 'inchis' ? 'in_lucru' : 'inchis' })}
                        >
                          {selectedLead.status === 'inchis' ? 'Redeschide' : 'Inchide'}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <InfoTile icon={<Phone className="h-4 w-4" />} label="Telefon" value={selectedLead.senderPhone ? String(selectedLead.senderPhone) : 'Nedisponibil'} />
                      <InfoTile icon={<Mail className="h-4 w-4" />} label="Email" value={selectedLead.senderEmail || 'Nedisponibil'} />
                      <InfoTile icon={<Clock3 className="h-4 w-4" />} label="Ultimul mesaj" value={formatDate(selectedLead.lastMessageAt)} />
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-white/6 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/45">Proprietate</p>
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{selectedLead.propertyTitle || 'Anunt Storia neasociat local'}</p>
                          <p className="mt-1 text-sm text-white/55">
                            Remote ad: {selectedLead.remoteAdId || selectedLead.remoteAdvertUuid || 'necunoscut'}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {selectedLead.propertyId && (
                            <Button asChild size="sm" variant="outline" className="border-white/15 bg-white/8 text-white hover:bg-white/14 hover:text-white">
                              <Link href={`/properties/${selectedLead.propertyId}`}>
                                CRM
                                <ArrowUpRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          {selectedLead.propertyUrl && (
                            <Button asChild size="sm" variant="outline" className="border-white/15 bg-white/8 text-white hover:bg-white/14 hover:text-white">
                              <Link href={selectedLead.propertyUrl} target="_blank" rel="noopener noreferrer">
                                Storia
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                    {selectedLead.messages.map((message) => (
                      <div key={message.id} className="flex justify-start">
                        <div className="max-w-[760px] rounded-2xl border border-white/10 bg-white px-4 py-3 text-slate-950 shadow-lg shadow-black/10">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">{message.senderName || selectedLead.senderName}</span>
                            <span>{formatDate(message.createdAt)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/10 px-5 py-4">
                    <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                      Raspunsul direct in Storia ramane dezactivat pana cand endpoint-ul de trimitere mesaj este confirmat si testat pe contul tau. Pentru moment foloseste telefon, email sau WhatsApp din datele clientului.
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

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/6 px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/45">
        {icon}
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-medium text-white">{value}</p>
    </div>
  );
}
