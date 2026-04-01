'use client';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '../ui/badge';
import { ArrowRight, User, Wand2, Calendar, MapPin, Phone, Mail, Wallet, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/lib/types';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';

function getScoreBadgeVariant(score: number) {
    if (score > 85) return 'success';
    if (score > 60) return 'warning';
    return 'destructive';
}

function getPriorityBadgeVariant(priority: Contact['priority']) {
    switch (priority) {
        case 'Ridicată': return 'destructive';
        case 'Medie': return 'warning';
        case 'Scăzută': return 'secondary';
        default: return 'outline';
    }
}

function getStatusTone(status: Contact['status']) {
    switch (status) {
        case 'Nou':
            return 'bg-sky-400/15 text-sky-100 ring-1 ring-inset ring-sky-300/25';
        case 'Contactat':
            return 'bg-indigo-400/15 text-indigo-100 ring-1 ring-inset ring-indigo-300/25';
        case 'Vizionare':
            return 'bg-amber-400/15 text-amber-100 ring-1 ring-inset ring-amber-300/25';
        case 'În negociere':
            return 'bg-fuchsia-400/15 text-fuchsia-100 ring-1 ring-inset ring-fuchsia-300/25';
        case 'Câștigat':
            return 'bg-emerald-400/15 text-emerald-100 ring-1 ring-inset ring-emerald-300/25';
        case 'Pierdut':
            return 'bg-rose-400/15 text-rose-100 ring-1 ring-inset ring-rose-300/25';
        default:
            return 'bg-white/10 text-white ring-1 ring-inset ring-white/10';
    }
}

function formatBudget(value?: number) {
    return typeof value === 'number' ? `€${value.toLocaleString('ro-RO')}` : 'Buget necompletat';
}

function sanitizeForWhatsapp(phone?: string | null) {
    if (!phone) return '';
    let sanitized = phone.replace(/\D/g, '');
    if (sanitized.length === 10 && sanitized.startsWith('07')) {
        return `40${sanitized.substring(1)}`;
    }
    return sanitized;
}

export function LeadCard({ lead: cumparator }: { lead: Contact }) {
  const zonesPreview = cumparator.zones?.slice(0, 3) ?? [];
  const whatsappPhone = sanitizeForWhatsapp(cumparator.phone);
  const normalizedLeadScore = typeof cumparator.leadScore === 'number'
    ? Math.min(100, Math.max(0, cumparator.leadScore))
    : null;
  const locationLabel = cumparator.city && zonesPreview.length > 0
    ? `${cumparator.city} - ${zonesPreview[0]}`
    : cumparator.city || zonesPreview[0] || 'Nespecificat';

  return (
    <Card className="group overflow-hidden rounded-2xl border border-white/10 bg-[#152A47] text-white shadow-[0_10px_26px_rgba(2,8,18,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#19304f] hover:shadow-[0_16px_40px_rgba(2,8,18,0.22)]">
      <CardContent className="relative p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pl-1 sm:pl-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/leads/${cumparator.id}`} className="min-w-0">
                  <h3 className="truncate text-lg font-semibold transition-colors group-hover:text-white/90">
                    {cumparator.name}
                  </h3>
                </Link>
                <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium", getStatusTone(cumparator.status))}>
                  {cumparator.status}
                </span>
                {cumparator.priority && <Badge variant={getPriorityBadgeVariant(cumparator.priority)}>{cumparator.priority}</Badge>}
              </div>
            </div>

            <div className="shrink-0 self-start">
              <Link href={`/leads/${cumparator.id}`}>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                  <ArrowRight className="h-4.5 w-4.5" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.55fr)]">
            <div className="rounded-2xl border border-white/10 bg-[#102238] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                <Wallet className="h-3.5 w-3.5" />
                Buget
              </div>
              <p className="text-3xl font-bold leading-none text-white sm:text-[2rem]">{formatBudget(cumparator.budget)}</p>
              <p className="mt-2 text-sm text-white/60">Buget estimat al cumpărătorului</p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#19304f] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                <Sparkles className="h-3.5 w-3.5" />
                Scor AI
              </div>
              {typeof cumparator.leadScore === 'number' ? (
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-3xl font-semibold leading-none text-white">{cumparator.leadScore}</p>
                    <p className="mt-1 text-sm text-white/60">Scor de potrivire</p>
                    <div className="mt-3 flex items-center gap-1.5">
                      {[0, 1, 2, 3, 4].map((index) => {
                        const threshold = (index + 1) * 20;
                        const isActive = (normalizedLeadScore ?? 0) >= threshold;

                        return (
                          <span
                            key={index}
                            className={cn(
                              "h-1.5 flex-1 rounded-full transition-colors",
                              isActive
                                ? cumparator.leadScore > 85
                                  ? "bg-emerald-300"
                                  : cumparator.leadScore > 60
                                    ? "bg-amber-300"
                                    : "bg-rose-300"
                                : "bg-white/10"
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    cumparator.leadScore > 85
                      ? "bg-emerald-500/15 text-emerald-200"
                      : cumparator.leadScore > 60
                        ? "bg-amber-500/15 text-amber-200"
                        : "bg-rose-500/15 text-rose-200"
                  )}>
                    {cumparator.leadScore > 85 ? 'Ridicat' : cumparator.leadScore > 60 ? 'Mediu' : 'Scăzut'}
                  </span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm text-white/70">
                  <Wand2 className="h-3.5 w-3.5" />
                  Fără scor
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-[#19304f] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                Număr de telefon
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold tracking-[0.02em] text-white">
                    {cumparator.phone || 'Nespecificat'}
                  </p>
                </div>
                {cumparator.phone && (
                  <div className="flex items-center gap-2 rounded-full bg-white/[0.04] px-1.5 py-1">
                    <a
                      href={`tel:${cumparator.phone}`}
                      aria-label={`Apelează ${cumparator.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 shadow-[0_8px_18px_rgba(16,185,129,0.18)] transition-colors hover:bg-emerald-500/32 hover:text-emerald-200"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    {whatsappPhone && (
                      <a
                        href={`https://wa.me/${whatsappPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Contactează pe WhatsApp pe ${cumparator.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/22 text-emerald-300 shadow-[0_8px_18px_rgba(16,185,129,0.18)] transition-colors hover:bg-emerald-500/32 hover:text-emerald-200"
                      >
                        <WhatsappIcon className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#19304f] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                <MapPin className="h-3.5 w-3.5" />
                Zone de interes
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2.5">
                <p className="truncate text-base font-semibold text-white">
                  {locationLabel}
                </p>
                {zonesPreview.length > 1 && (
                  <p className="mt-1 truncate text-xs text-white/55">
                    + încă {zonesPreview.length - 1} zonă{zonesPreview.length - 1 === 1 ? '' : 'e'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#132840] px-3 py-3 text-sm text-white/70">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {cumparator.createdAt && (
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Adăugat {format(new Date(cumparator.createdAt), 'd MMM yyyy', { locale: ro })}
                </span>
              )}

              {cumparator.agentName && (
                <span className="inline-flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {cumparator.agentName}
                </span>
              )}
            </div>

            {zonesPreview.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2">
                {zonesPreview.map((zone) => (
                  <span key={zone} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                    {zone}
                  </span>
                ))}
                {(cumparator.zones?.length ?? 0) > zonesPreview.length && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                    +{(cumparator.zones?.length ?? 0) - zonesPreview.length}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
