'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { FileText, Mail, MapPin, Phone, Search, Shield, Users } from 'lucide-react';
import { useUser } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type LeadItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  agencyName: string;
  agentName: string;
  status: string;
  source: string;
  budget: number;
  city: string;
  zone: string;
  notes: string;
};

function formatCurrency(value: number) {
  return `€${Math.round(value || 0).toLocaleString('ro-RO')}`;
}

export default function MasterAdminLeadsPage() {
  const { user } = useUser();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [selectedLeadForNotes, setSelectedLeadForNotes] = useState<LeadItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLeads([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const activeUser = user;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const token = await activeUser.getIdToken(true);
        const response = await fetch('/api/master-admin/leads', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut încărca lead-urile.');
        }
        if (!isMounted) return;
        setLeads(Array.isArray(payload?.leads) ? payload.leads : []);
      } catch (error) {
        if (!isMounted) return;
        setLeads([]);
        setErrorMessage(error instanceof Error ? error.message : 'Nu am putut încărca lead-urile.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const availableStatuses = useMemo(() => {
    return Array.from(new Set(leads.map((entry) => entry.status).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ro'));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return leads.filter((entry) => {
      const matchesStatus = statusFilter === 'all' ? true : entry.status === statusFilter;
      const matchesQuery = normalizedQuery
        ? [entry.name, entry.email, entry.phone, entry.agencyName, entry.agentName, entry.source, entry.city, entry.zone, entry.notes].join(' ').toLowerCase().includes(normalizedQuery)
        : true;
      return matchesStatus && matchesQuery;
    });
  }, [leads, query, statusFilter]);

  return (
    <div className="space-y-6 text-white">
      <Card className="border-none bg-[#10213A] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-200" /> Leads și cumpărători</CardTitle>
          <CardDescription className="text-white/68">
            Vizibilitate globală asupra lead-urilor salvate de toate agențiile din platformă.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Caută după nume, email, telefon, agenție, agent, sursă, oraș sau zonă..."
                className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/45"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all' ? 'border-emerald-300/30 bg-emerald-400/10 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}
              >
                Toate
              </Button>
              {availableStatuses.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant="outline"
                  onClick={() => setStatusFilter(status)}
                  className={statusFilter === status ? 'border-emerald-300/30 bg-emerald-400/10 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
          {errorMessage ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>
          ) : null}
          {isLoading ? (
            [...Array(6)].map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl bg-white/10" />)
          ) : filteredLeads.length ? (
            filteredLeads.map((lead) => (
              <div key={lead.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-white">{lead.name}</p>
                      <Badge className="border-none bg-white/12 text-white">{lead.status}</Badge>
                      {lead.notes ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedLeadForNotes(lead)}
                          className="h-8 border-white/10 bg-white/5 px-2 text-white/80 hover:bg-white/10 hover:text-white"
                        >
                          <FileText className="h-4 w-4 text-emerald-200" />
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-sm text-white/62">Agenție: {lead.agencyName} · Agent: {lead.agentName}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-white/70">
                      <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-200" /> {lead.email}</span>
                      <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-200" /> {lead.phone}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-white/70">
                      <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-200" /> Oraș: {lead.city}</span>
                      <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-200" /> Zonă: {lead.zone}</span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoPill label="Sursă" value={lead.source} />
                    <InfoPill label="Buget" value={formatCurrency(lead.budget)} icon={<Shield className="h-4 w-4 text-emerald-200" />} />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Nu există lead-uri care corespund filtrului curent.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedLeadForNotes)} onOpenChange={(open) => (!open ? setSelectedLeadForNotes(null) : undefined)}>
        <DialogContent className="border-white/10 bg-[#10213A] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notițe lead</DialogTitle>
            <DialogDescription className="text-white/65">
              {selectedLeadForNotes ? `${selectedLeadForNotes.name} · ${selectedLeadForNotes.agencyName}` : 'Detaliile notițelor'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-white/80">
              {selectedLeadForNotes?.notes || 'Nu există notițe pentru acest lead.'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoPill({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
