'use client';

import PortalStatusCard from "@/components/portal/PortalStatusCard";
import ImobiliareIntegrationCard from "@/components/portal/ImobiliareIntegrationCard";
import StoriaIntegrationCard from "@/components/portal/StoriaIntegrationCard";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Property } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { useMemo, useState, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from "@/context/AgencyContext";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlugZap, Sparkles, CreditCard, ReceiptText, Share2, Megaphone } from 'lucide-react';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import '@/components/marketing/tiktok-ads/tiktok-workspace.css';
import { cn } from '@/lib/utils';

const PORTALS = [
    { id: 'imobiliare', name: 'Imobiliare.ro' },
    { id: 'storia', name: 'Storia.ro' },
    { id: 'publi24', name: 'Publi24.ro' },
    { id: 'homezz', name: 'HomeZZ.ro' },
    { id: 'trimbitasu', name: 'Trîmbițașu.ro' },
];

export default function PortalSyncPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const [activeTab, setActiveTab] = useState<'portals' | 'social' | 'financial'>('portals');

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);

    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    const portalStats = useMemo(() => {
        if (!properties) {
            return PORTALS.map(portal => ({
                id: portal.id,
                name: portal.name,
                connected: false,
                lastSync: '-',
                listings: 0,
                leads: 0,
                errors: 0
            }));
        }

        return PORTALS.map(portal => {
            let listings = 0;
            let errors = 0;
            let mostRecentSync: string | null = null;
            let connected = false;

            for (const prop of properties) {
                const promo = prop.promotions?.[portal.id];
                if (promo) {
                    connected = true; // If any property has a promotion for this portal, we consider it "connected"
                    if (promo.status === 'published') {
                        listings++;
                    }
                    if (promo.status === 'error') {
                        errors++;
                    }
                    if (promo.lastSync) {
                        if (!mostRecentSync || new Date(promo.lastSync) > new Date(mostRecentSync)) {
                            mostRecentSync = promo.lastSync;
                        }
                    }
                }
            }

            const formatLastSync = (syncDate: string | null) => {
                if (!syncDate) return '-';
                const date = new Date(syncDate);
                const now = new Date();
                const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
                
                if (diffSeconds < 2) return 'chiar acum';
                if (diffSeconds < 60) return `acum ${diffSeconds} secunde`;
                
                const diffMinutes = Math.round(diffSeconds / 60);
                if (diffMinutes < 60) return `acum ${diffMinutes} minute`;

                const diffHours = Math.round(diffMinutes / 60);
                if (diffHours < 24) return `acum ${diffHours} ore`;
                
                return date.toLocaleDateString('ro-RO');
            };

            return {
                id: portal.id,
                name: portal.name,
                connected,
                lastSync: formatLastSync(mostRecentSync),
                listings,
                leads: 0, // Not tracked yet
                errors,
            };
        });

    }, [properties]);


  return (
    <div className="tt-design tt-workspace settings-tiktok space-y-6 p-4 lg:p-6">
        <style>{`
          .settings-tiktok [class*="text-white"] { color: #182b40 !important; -webkit-text-fill-color: currentColor !important; }
        `}</style>
        <div className="tt-design settings-tiktok">
            <style>{`
                .settings-tiktok .tt-hero { min-height: 0 !important; padding: 24px 28px !important; }
            `}</style>
            <header className="tt-hero">
                <div>
                    <div className="tt-hero-kicker">
                        <PlugZap size={17} />
                        <span className="tt-eyebrow">HUB INTEGRĂRI</span>
                    </div>
                    <h1>Integrări <em>agenție</em></h1>
                    <p className="tt-hero-lead">
                        Portaluri, social media și plăți.
                        <br />
                        <strong>Conectează și administrează toate canalele agenției.</strong>
                    </p>
                    <p>
                        Publicare imobiliară, campanii sociale și instrumente financiare într-un singur loc.
                    </p>
                </div>
                <div className="tt-scene" aria-hidden="true">
                    <div className="tt-scene-halo" />
                    <div className="tt-scene-sheet tt-scene-sheet--back">
                        <span>PUBLICARE</span>
                        <div className="flex h-full items-center justify-center">
                            <div className="rounded-2xl border border-white/60 bg-white/80 p-4 text-slate-700">
                                <PlugZap size={30} />
                            </div>
                        </div>
                    </div>
                    <div className="tt-scene-sheet tt-scene-sheet--front">
                        <span className="tt-scene-brand">
                            <Sparkles size={12} /> PORTALURI
                        </span>
                        <div className="flex h-full items-center justify-center">
                            <div className="w-28 rounded-[2rem] border border-white bg-white/85 p-4 text-center shadow-xl">
                                <Sparkles className="mx-auto text-emerald-700" size={28} />
                                <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    Sincronizat
                                </span>
                                <strong className="block text-sm text-slate-900">Anunțuri live</strong>
                            </div>
                        </div>
                        <div className="tt-scene-caption">
                            <strong className="text-sm leading-tight">Publicare fără duplicare manuală.</strong>
                            <span>Imobiliare, Storia, Publi24 și altele</span>
                        </div>
                    </div>
                    <div className="tt-scene-tag tt-scene-tag--video">
                        <PlugZap size={16} />
                        <span>
                            Integrare
                            <br />
                            <strong>activă</strong>
                        </span>
                    </div>
                    <div className="tt-scene-tag tt-scene-tag--spark">
                        <Sparkles size={16} />
                        <span>Sincronizare portaluri</span>
                    </div>
                </div>
            </header>
        </div>

        <nav className="inline-flex flex-wrap gap-2" aria-label="Categorii integrări">
          <Button
            type="button"
            variant={activeTab === 'portals' ? 'default' : 'ghost'}
            className={cn(
              'rounded-lg border-2 px-5 py-2 font-bold shadow-sm transition',
              activeTab === 'portals'
                ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950'
            )}
            onClick={() => setActiveTab('portals')}
          >
            <PlugZap className="mr-2 h-4 w-4" />
            Portaluri
          </Button>
          <Button
            type="button"
            variant={activeTab === 'social' ? 'default' : 'ghost'}
            className={cn(
              'rounded-lg border-2 px-5 py-2 font-bold shadow-sm transition',
              activeTab === 'social'
                ? 'border-violet-500 bg-violet-500 text-white shadow-lg shadow-violet-200'
                : 'border-violet-200 bg-white text-violet-800 hover:bg-violet-50 hover:text-violet-950'
            )}
            onClick={() => setActiveTab('social')}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Social Media
          </Button>
          <Button
            type="button"
            variant={activeTab === 'financial' ? 'default' : 'ghost'}
            className={cn(
              'rounded-lg border-2 px-5 py-2 font-bold shadow-sm transition',
              activeTab === 'financial'
                ? 'border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-200'
                : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50 hover:text-amber-950'
            )}
            onClick={() => setActiveTab('financial')}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Financiar
          </Button>
        </nav>

        {activeTab === 'portals' ? (
        <div className="agentfinder-integrations-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
                [...Array(PORTALS.length)].map((_, i) => (
                    <Skeleton key={i} className="h-[250px] w-full bg-white/10" />
                ))
            ) : (
                portalStats.map(portal => (
                    portal.id === 'imobiliare' ? (
                        <ImobiliareIntegrationCard
                            key={portal.name}
                            listings={portal.listings}
                            errors={portal.errors}
                            lastSync={portal.lastSync}
                        />
                    ) : portal.id === 'storia' ? (
                        <StoriaIntegrationCard
                            key={portal.name}
                            listings={portal.listings}
                            errors={portal.errors}
                            lastSync={portal.lastSync}
                        />
                    ) : (
                        <PortalStatusCard key={portal.name} {...portal} />
                    )
                ))
            )}
        </div>
        ) : activeTab === 'social' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <IntegrationLinkCard
              icon={<Megaphone />}
              title="Meta Ads"
              description="Campanii plătite Meta pentru proprietăți."
              href="/marketing/meta-advertising"
              accent="violet"
            />
            <IntegrationLinkCard
              icon={<Share2 />}
              title="Meta Organic"
              description="Postări organice Meta pentru agenție."
              href="/marketing/meta-advertising"
              accent="pink"
            />
            <IntegrationLinkCard
              icon={<TikTokIcon />}
              title="TikTok Ads"
              description="Campanii plătite TikTok for Business."
              href="/marketing/tiktok-ads"
              accent="cyan"
            />
            <IntegrationLinkCard
              icon={<TikTokIcon />}
              title="TikTok Organic"
              description="TikTok Studio pentru videoclipuri organice."
              href="/marketing/tiktok-studio"
              accent="emerald"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <IntegrationLinkCard
              icon={<CreditCard />}
              title="Stripe"
              description="Plăți și abonamente pentru agenție."
              href="/billing"
              accent="violet"
            />
            <IntegrationLinkCard
              icon={<ReceiptText />}
              title="SmartBill"
              description="Facturare și documente financiare."
              href="/billing"
              accent="amber"
            />
          </div>
        )}
    </div>
  );
}

function IntegrationLinkCard({
  icon,
  title,
  description,
  href,
  accent,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  accent: 'violet' | 'pink' | 'cyan' | 'emerald' | 'amber';
}) {
  const toneClass = {
    violet: 'border-violet-200 bg-gradient-to-br from-violet-200 via-fuchsia-100 to-violet-100 text-violet-950',
    pink: 'border-pink-200 bg-gradient-to-br from-pink-200 via-rose-100 to-pink-100 text-pink-950',
    cyan: 'border-cyan-200 bg-gradient-to-br from-cyan-200 via-sky-100 to-cyan-100 text-cyan-950',
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-200 via-teal-100 to-emerald-100 text-emerald-950',
    amber: 'border-amber-200 bg-gradient-to-br from-amber-200 via-orange-100 to-amber-100 text-amber-950',
  }[accent];

  return (
    <Link
      href={href}
      className={cn('group flex items-center gap-4 rounded-[22px] border p-5 shadow-[0_16px_38px_-26px_rgba(15,23,42,0.45)] ring-1 ring-white/60 transition-all duration-300 hover:-translate-y-1', toneClass)}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/[.04] transition-transform duration-300 group-hover:scale-110">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-extrabold tracking-[-0.02em]">{title}</span>
        <span className="mt-1 block text-sm leading-5 opacity-75">{description}</span>
      </span>
      <span className="ml-auto text-2xl opacity-40 transition-transform duration-300 group-hover:translate-x-1">→</span>
    </Link>
  );
}
