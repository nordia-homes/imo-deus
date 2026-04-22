'use client';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ArchiveRestore, ArrowRight, Clock3, User, Wand2, Calendar, MapPin, Phone, Wallet, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/lib/types';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { getContactAgeInDays, getContactFreshnessTone, isArchivedContact } from '@/lib/contact-aging';

function formatBudget(value?: number) {
    return typeof value === 'number' ? `€${value.toLocaleString('ro-RO')}` : 'Buget necompletat';
}

function formatCompactDate(value?: string) {
    if (!value) return 'Fără dată';
    return format(new Date(value), 'd MMM yyyy', { locale: ro });
}

function sanitizeForWhatsapp(phone?: string | null) {
    if (!phone) return '';
    let sanitized = phone.replace(/\D/g, '');
    if (sanitized.length === 10 && sanitized.startsWith('07')) {
        return `40${sanitized.substring(1)}`;
    }
    return sanitized;
}

function getAgeToneClasses(tone: ReturnType<typeof getContactFreshnessTone>) {
  switch (tone) {
    case 'green':
      return 'bg-emerald-500/15 text-emerald-200 ring-emerald-300/25';
    case 'orange':
      return 'bg-amber-500/15 text-amber-200 ring-amber-300/25';
    case 'red':
      return 'bg-rose-500/15 text-rose-200 ring-rose-300/25';
    case 'archived':
      return 'bg-white/10 text-white/70 ring-white/10';
    default:
      return 'bg-white/10 text-white/70 ring-white/10';
  }
}

export function LeadCard({
  lead: cumparator,
  onUnarchive,
  showArchivedState = false,
}: {
  lead: Contact;
  onUnarchive?: (lead: Contact) => void;
  showArchivedState?: boolean;
}) {
  const zonesPreview = cumparator.zones?.slice(0, 2) ?? [];
  const whatsappPhone = sanitizeForWhatsapp(cumparator.phone);
  const normalizedLeadScore = typeof cumparator.leadScore === 'number'
    ? Math.min(100, Math.max(0, cumparator.leadScore))
    : null;
  const scoreValue = normalizedLeadScore ?? 0;
  const locationLabel = cumparator.city && zonesPreview.length > 0
    ? `${cumparator.city} - ${zonesPreview[0]}`
    : cumparator.city || zonesPreview[0] || 'Nespecificat';
  const ageInDays = getContactAgeInDays(cumparator.createdAt);
  const freshnessTone = getContactFreshnessTone(cumparator);
  const archived = isArchivedContact(cumparator);

  return (
    <Card className={cn(
      "agentfinder-leads-list-card group overflow-hidden rounded-2xl border border-white/10 bg-[#152A47] text-white shadow-[0_10px_26px_rgba(2,8,18,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#19304f] hover:shadow-[0_16px_40px_rgba(2,8,18,0.22)]",
      archived && "bg-[#112238] opacity-95"
    )}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/leads/${cumparator.id}`} className="min-w-0">
                  <h3 className="truncate text-base font-semibold transition-colors group-hover:text-white/90">
                    {cumparator.name}
                  </h3>
                </Link>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                  getAgeToneClasses(freshnessTone)
                )}>
                  <Clock3 className="h-3 w-3" />
                  {archived
                    ? 'Arhivat'
                    : ageInDays === null
                      ? 'Nou'
                      : `${ageInDays} zile`}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/62">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatCompactDate(cumparator.createdAt)}
                </span>
                {cumparator.agentName && (
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <User className="h-3.5 w-3.5" />
                    {cumparator.agentName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {showArchivedState && archived && onUnarchive && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-white/15 bg-white/5 px-3 text-xs text-white hover:bg-white/10"
                  onClick={() => onUnarchive(cumparator)}
                >
                  <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                  Dezarhivează
                </Button>
              )}
              {cumparator.phone && (
                <>
                  <a
                    href={`tel:${cumparator.phone}`}
                    aria-label={`Apelează ${cumparator.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/18 text-emerald-200 transition-colors hover:bg-emerald-500/28"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                  {whatsappPhone && (
                    <a
                      href={`https://wa.me/${whatsappPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Contactează pe WhatsApp pe ${cumparator.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/18 text-emerald-200 transition-colors hover:bg-emerald-500/28"
                    >
                      <WhatsappIcon className="h-3.5 w-3.5" />
                    </a>
                  )}
                </>
              )}
              <Link href={`/leads/${cumparator.id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div className="rounded-xl border border-white/10 bg-[#102238] px-3.5 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                <Wallet className="h-3 w-3" />
                Buget
              </div>
              <p className="mt-1.5 truncate text-2xl font-bold leading-none text-white">{formatBudget(cumparator.budget)}</p>
            </div>

            <div className="min-w-[118px] rounded-xl border border-white/[0.08] bg-[#19304f] px-3.5 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                <Sparkles className="h-3 w-3" />
                Scor AI
              </div>
              {typeof cumparator.leadScore === 'number' ? (
                <>
                  <div className="mt-1.5 flex items-end justify-between gap-2">
                    <p className="text-2xl font-semibold leading-none text-white">{cumparator.leadScore}</p>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      scoreValue > 85
                        ? "bg-emerald-500/15 text-emerald-200"
                        : scoreValue > 60
                          ? "bg-amber-500/15 text-amber-200"
                          : "bg-rose-500/15 text-rose-200"
                    )}>
                      {scoreValue > 85 ? 'Ridicat' : scoreValue > 60 ? 'Mediu' : 'Scăzut'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((index) => {
                      const threshold = (index + 1) * 20;
                      const isActive = (normalizedLeadScore ?? 0) >= threshold;

                      return (
                        <span
                          key={index}
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-colors",
                            isActive
                              ? scoreValue > 85
                                ? "bg-emerald-300"
                                : scoreValue > 60
                                  ? "bg-amber-300"
                                  : "bg-rose-300"
                              : "bg-white/10"
                          )}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/70">
                  <Wand2 className="h-3.5 w-3.5" />
                  Fără scor
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-xl border border-white/[0.08] bg-[#19304f] px-3.5 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                <MapPin className="h-3 w-3" />
                Zonă / oraș
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold text-white">{locationLabel}</p>
            </div>

            {zonesPreview.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-[#132840] px-3 py-2.5">
                {zonesPreview.map((zone) => (
                  <span key={zone} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">
                    {zone}
                  </span>
                ))}
                {(cumparator.zones?.length ?? 0) > zonesPreview.length && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/60">
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
