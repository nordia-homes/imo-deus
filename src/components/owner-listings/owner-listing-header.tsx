'use client';

import Link from 'next/link';
import { Heart, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

type OwnerListingHeaderProps = {
  title: string;
  subtitle: string;
  currentScopeLabel?: string | null;
  activeTab: 'listings' | 'favorite';
  favoriteCount?: number;
};

export function OwnerListingHeader({
  title,
  subtitle,
  currentScopeLabel,
  activeTab,
  favoriteCount = 0,
}: OwnerListingHeaderProps) {
  const tabs = [
    {
      href: '/owner-listings',
      label: 'Anunturi',
      icon: LayoutGrid,
      active: activeTab === 'listings',
    },
    {
      href: '/owner-listings/favorite',
      label: `Favorite (${favoriteCount})`,
      icon: Heart,
      active: activeTab === 'favorite',
    },
  ];

  return (
    <div className="rounded-[1.5rem] border border-white/75 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_28%),linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(18,38,63,1)_52%,_rgba(11,26,45,1)_100%)] px-5 py-4 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24)] backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.14)]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Owner Listings</span>
              {currentScopeLabel ? (
                <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {currentScopeLabel}
                </span>
              ) : null}
            </div>

            <h1 className="text-[1.8rem] font-semibold tracking-[-0.055em] text-slate-950 sm:text-[2rem]">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-3xl text-[15px] leading-6 text-slate-600">{subtitle}</p> : null}
          </div>

          <div className="inline-flex items-center gap-1 self-start rounded-full border border-white/80 bg-white/72 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] xl:self-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                    tab.active
                      ? 'bg-white text-slate-950 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.38)]'
                      : 'text-slate-600 hover:bg-white/92 hover:text-slate-900',
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
