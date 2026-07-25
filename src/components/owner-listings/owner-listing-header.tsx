'use client';

import Link from 'next/link';
import { LayoutGrid, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

type OwnerListingHeaderProps = {
  title: string;
  subtitle: string;
  currentScopeLabel?: string | null;
  activeTab: 'listings' | 'prospecting';
  favoriteCount?: number;
  listingCount?: number | null;
  adminClassic?: boolean;
};

export function OwnerListingHeader({
  title,
  subtitle,
  currentScopeLabel,
  activeTab,
  favoriteCount = 0,
  listingCount,
  adminClassic = false,
}: OwnerListingHeaderProps) {
  const formattedListingCount =
    typeof listingCount === 'number'
      ? new Intl.NumberFormat('ro-RO').format(listingCount)
      : null;
  const tabs = [
    {
      href: '/owner-listings',
      label: `Anunturi${formattedListingCount ? ` (${formattedListingCount})` : ''}`,
      icon: LayoutGrid,
      active: activeTab === 'listings',
    },
    {
      href: '/owner-listings/prospecting',
      label: `Prospectare (${favoriteCount})`,
      icon: Target,
      active: activeTab === 'prospecting',
    },
  ];

  return (
    <div
      className={cn(
        "rounded-[1.5rem] px-5 py-4 backdrop-blur-xl sm:px-6",
        adminClassic
          ? "agentfinder-properties-hero-card overflow-hidden border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_28%),linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(18,38,63,1)_52%,_rgba(11,26,45,1)_100%)] text-white shadow-[0_28px_70px_-34px_rgba(0,0,0,0.55)]"
          : "border border-white/75 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_28%),linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(18,38,63,1)_52%,_rgba(11,26,45,1)_100%)] shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24)]",
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.14)]" />
              <span className={cn("text-[11px] font-semibold uppercase tracking-[0.24em]", adminClassic ? "text-emerald-100/85" : "text-slate-500")}>Owner Listings</span>
              {currentScopeLabel ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                    adminClassic
                      ? "border border-white/14 bg-white/10 text-white/88"
                      : "border border-slate-200/90 bg-slate-50 text-slate-700",
                  )}
                >
                  {currentScopeLabel}
                </span>
              ) : null}
            </div>

            <h1 className={cn("text-[1.8rem] font-semibold tracking-[-0.055em] sm:text-[2rem]", adminClassic ? "text-white" : "text-slate-950")}>{title}</h1>
            {subtitle ? <p className={cn("mt-2 max-w-3xl text-[15px] leading-6", adminClassic ? "text-white/68" : "text-slate-600")}>{subtitle}</p> : null}
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-1 self-start rounded-full p-1 xl:self-auto",
              adminClassic
                ? "border border-white/14 bg-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                : "border border-white/80 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]",
            )}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all',
                    tab.active
                      ? adminClassic
                        ? 'border-white/12 bg-white text-slate-950 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.38)]'
                        : 'border-white bg-white text-slate-950 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.38)]'
                      : adminClassic
                        ? 'border-white/12 bg-white/10 text-white/72 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.35)] hover:border-white/18 hover:bg-white/16 hover:text-white'
                        : 'border-slate-200/70 bg-white/55 text-slate-700 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.35)] hover:border-white hover:bg-white/92 hover:text-slate-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
