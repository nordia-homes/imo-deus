'use client';

import Link from 'next/link';
import { Heart, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

type OwnerListingHeaderProps = {
  title: string;
  subtitle: string;
  currentScopeLabel?: string | null;
  activeTab: 'listings' | 'favorite';
  stats: Array<{ label: string; value: string }>;
};

export function OwnerListingHeader({
  title,
  subtitle,
  currentScopeLabel,
  activeTab,
  stats,
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
      label: 'Favorite',
      icon: Heart,
      active: activeTab === 'favorite',
    },
  ];

  return (
    <div className="rounded-[1.5rem] border border-white/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(247,250,255,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.34)] backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.14)]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Owner Listings</span>
              {currentScopeLabel ? (
                <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {currentScopeLabel}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-2.5">
              <h1 className="text-[1.65rem] font-semibold tracking-[-0.055em] text-slate-950 sm:text-[1.95rem]">{title}</h1>
              <p className="max-w-3xl text-[15px] leading-7 text-slate-600">{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:max-w-[44%] xl:justify-end">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-full border border-slate-200/90 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
              >
                <span className="text-slate-500">{stat.label}</span>{' '}
                <span className="font-semibold text-slate-950">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 p-1 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.32)]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all',
                    tab.active
                      ? 'bg-slate-950 text-white shadow-[0_12px_26px_-18px_rgba(15,23,42,0.62)]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Feed proprietari
          </div>
        </div>
      </div>
    </div>
  );
}
