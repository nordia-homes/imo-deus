'use client';

import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '../ui/card';
import { ArrowUpRight, CheckCircle2, XCircle, AlertTriangle, Radio } from 'lucide-react';

interface PortalStatusCardProps {
  id?: string;
  name: string;
  connected: boolean;
  lastSync: string;
  listings: number;
  leads: number;
  errors: number;
}

const PORTAL_LOGOS: Record<string, { src: string; alt: string }> = {
  storia: { src: '/storia-official-logo.svg', alt: 'Storia.ro' },
  publi24: { src: '/publi24-logo.svg', alt: 'Publi24.ro' },
};

function PortalLogo({ id, name }: { id?: string; name: string }) {
  if (id === 'homezz') {
    return (
      <span className="inline-flex items-baseline text-lg font-black tracking-[-0.05em] text-emerald-950">
        Home<span className="text-emerald-500">ZZ</span><small className="ml-1 text-xs font-bold text-slate-500">.ro</small>
      </span>
    );
  }

  if (id === 'trimbitasu') {
    return (
      <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3 py-2">
        <img src="/trimbitasu-logo.png" alt="" aria-hidden="true" className="h-5 w-auto object-contain" />
        <span className="font-serif text-[10px] font-bold tracking-wide text-amber-400">TRÎMBIȚAȘU.RO</span>
      </span>
    );
  }

  const logo = id ? PORTAL_LOGOS[id] : undefined;
  if (!logo) return <span className="text-xl font-extrabold tracking-[-0.03em] text-slate-950">{name}</span>;

  return <img src={logo.src} alt={logo.alt} className="h-8 w-auto object-contain" />;
}

export default function PortalStatusCard({ id, name, connected, lastSync, listings, leads, errors }: PortalStatusCardProps) {
  return (
    <Card className="group relative isolate flex h-full flex-col overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(236,253,245,0.9))] text-slate-950 shadow-[0_30px_80px_-38px_rgba(15,23,42,0.6),inset_0_1px_0_rgba(255,255,255,0.95)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_42px_90px_-38px_rgba(16,185,129,0.55)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1.5 bg-[linear-gradient(90deg,#10b981,#2dd4bf,#38bdf8)]" />
      <div className="pointer-events-none absolute -right-20 -top-24 z-0 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl transition-all duration-500 group-hover:scale-110 group-hover:bg-emerald-300/30" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 z-0 h-56 w-56 rounded-full bg-cyan-300/15 blur-3xl" />

      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-16 min-w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-white/90 bg-white/85 px-3 py-2 shadow-[0_16px_34px_-22px_rgba(15,23,42,0.5)] ${id === 'trimbitasu' ? 'max-w-[170px]' : 'max-w-[120px]'}`}>
              <PortalLogo id={id} name={name} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Portal</p>
            </div>
          </div>

          <div className="shrink-0">
            {connected ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Conectat
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                <XCircle className="mr-1 h-4 w-4" />
                Deconectat
              </span>
            )}
          </div>
        </div>
        <CardDescription className="text-slate-500">
          Ultima sincronizare: {lastSync}
        </CardDescription>
      </CardHeader>

      <CardContent className="relative z-10 flex flex-1 flex-col">
        <div className="grid grid-cols-[1.2fr_.8fr] gap-2">
          <div className="rounded-3xl border border-white/90 bg-white/85 p-4 shadow-[0_16px_38px_-26px_rgba(16,185,129,0.55)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Anunțuri live</p>
            <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950">{listings}</p>
          </div>
          <div className="rounded-3xl border border-white/90 bg-white/70 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Lead-uri</p>
            <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950">{leads}</p>
          </div>
        </div>

        {errors > 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Necesită atenție</span>
            <span>{errors} erori</span>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-sm font-semibold text-slate-500">
            <span className="flex items-center gap-2"><Radio className="h-4 w-4 text-emerald-500" /> Flux sănătos</span>
            <span>0 erori</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="relative z-10">
        <Button
          variant="outline"
          className="group/cta flex w-full items-center justify-between rounded-[18px] border-2 border-emerald-500 bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-[0_20px_44px_-22px_rgba(16,185,129,0.9)] transition-all hover:-translate-y-0.5 hover:bg-emerald-400"
        >
          <span>{connected ? 'Deschide setările' : 'Conectează portalul'}</span>
          <ArrowUpRight className="h-5 w-5 transition-transform group-hover/cta:translate-x-1 group-hover/cta:-translate-y-0.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
