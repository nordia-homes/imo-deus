'use client';

import Link from 'next/link';
import { Heart, LayoutGrid, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/components/marketing/tiktok-ads/tiktok-workspace.css';

type OwnerListingHeaderProps = {
  title: string;
  subtitle: string;
  currentScopeLabel?: string | null;
  activeTab: 'listings' | 'prospecting' | 'favorites';
  prospectingCount?: number;
  favoriteCount?: number;
  listingCount?: number | null;
  adminClassic?: boolean;
};

export function OwnerListingHeader({
  title,
  subtitle,
  currentScopeLabel,
  activeTab,
  prospectingCount = 0,
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
      mobileCount: null,
      tone: {
        active: 'border-slate-200 bg-white text-slate-950 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.5)] ring-2 ring-emerald-300 ring-offset-2',
        inactive: 'border-slate-200 bg-white/75 text-slate-700 hover:bg-white hover:shadow-[0_16px_36px_-26px_rgba(15,23,42,0.45)]',
        icon: 'bg-emerald-100 text-emerald-700',
      },
    },
    {
      href: '/owner-listings/prospecting',
      label: `Prospectare (${prospectingCount})`,
      icon: Target,
      active: activeTab === 'prospecting',
      mobileCount: prospectingCount,
      tone: {
        active: 'border-slate-200 bg-white text-slate-950 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.5)] ring-2 ring-violet-300 ring-offset-2',
        inactive: 'border-slate-200 bg-white/75 text-slate-700 hover:bg-white hover:shadow-[0_16px_36px_-26px_rgba(15,23,42,0.45)]',
        icon: 'bg-violet-100 text-violet-700',
      },
    },
    {
      href: '/owner-listings/favorites',
      label: `Favorite (${favoriteCount})`,
      icon: Heart,
      active: activeTab === 'favorites',
      mobileCount: favoriteCount,
      tone: {
        active: 'border-slate-200 bg-white text-slate-950 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.5)] ring-2 ring-pink-300 ring-offset-2',
        inactive: 'border-slate-200 bg-white/75 text-slate-700 hover:bg-white hover:shadow-[0_16px_36px_-26px_rgba(15,23,42,0.45)]',
        icon: 'bg-pink-100 text-pink-700',
      },
    },
  ];

  return (
    <div className="tt-design settings-tiktok">
      <style>{`
        .settings-tiktok .tt-hero { min-height: 0 !important; padding: 24px 28px !important; }
        .settings-tiktok .tt-hero { grid-template-columns: minmax(0,1fr) auto !important; }
      `}</style>
      <header className="tt-hero">
        <div>
          <div className="tt-hero-kicker">
            <LayoutGrid size={17} />
            <span className="tt-eyebrow">OWNER LISTINGS</span>
          </div>
          <h1>{title}</h1>
          {subtitle ? <p className="tt-hero-lead">{subtitle}</p> : null}
          {currentScopeLabel ? (
            <p>
              Domeniu activ: <strong>{currentScopeLabel}</strong>
            </p>
          ) : null}
        </div>

        <div className="inline-flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className={cn('tt-button inline-flex items-center gap-2 whitespace-nowrap rounded-[16px] px-4', tab.active ? tab.tone.active : tab.tone.inactive)}
              >
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', tab.tone.icon)}>
                  <Icon className="h-4 w-4" />
                </span>
                {tab.mobileCount === null ? (
                  <span>{tab.label}</span>
                ) : (
                  <>
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">({tab.mobileCount})</span>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </header>
    </div>
  );
}
