'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Building2, Headphones, MapPinned, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { getAgencyThemePreset } from '@/lib/theme';

const statCardClassName =
  'rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,21,23,0.9)_0%,rgba(11,13,14,0.96)_100%)] px-4 py-4 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.8)] backdrop-blur-xl';

export function Hero() {
  const { agency } = usePublicAgency();
  const publicPath = usePublicPath();
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero');
  const isAgentfinderTheme = getAgencyThemePreset(agency) === 'agentfinder';

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={
            heroImage?.imageUrl ||
            'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1920&q=80'
          }
          alt={agency?.name || 'Real estate agency'}
          fill
          priority
          className="object-cover object-center"
          data-ai-hint={heroImage?.imageHint || 'modern house'}
        />
        <div
          className={cn(
            'absolute inset-0',
            isAgentfinderTheme
              ? 'bg-[radial-gradient(circle_at_top_right,rgba(191,219,254,0.2),transparent_26%),linear-gradient(110deg,rgba(248,251,255,0.92)_0%,rgba(239,246,255,0.82)_32%,rgba(232,240,251,0.62)_55%,rgba(232,240,251,0.32)_100%)]'
              : 'bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.18),transparent_28%),linear-gradient(110deg,rgba(5,7,7,0.92)_0%,rgba(8,10,10,0.86)_32%,rgba(10,12,12,0.7)_55%,rgba(10,12,12,0.38)_100%)]'
          )}
        />
      </div>

      <div className={cn('relative container mx-auto px-4 py-10 md:py-14 lg:py-16', isAgentfinderTheme && 'px-4 sm:px-5 lg:px-6 xl:px-8')}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_360px] lg:items-end">
          <div
            className={cn(
              'max-w-3xl rounded-[2rem] p-6 md:p-8 lg:p-10',
              isAgentfinderTheme
                ? 'border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.92),rgba(236,253,245,0.9))] shadow-[0_32px_100px_rgba(37,55,88,0.1)]'
                : 'border border-white/10 bg-[linear-gradient(180deg,rgba(15,17,18,0.78)_0%,rgba(11,13,14,0.88)_100%)] shadow-[0_32px_90px_-42px_rgba(0,0,0,0.82)] backdrop-blur-xl'
            )}
          >
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
                isAgentfinderTheme
                  ? 'border border-sky-300/30 bg-sky-100/80 text-sky-800 shadow-[0_10px_30px_rgba(59,130,246,0.10)]'
                  : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              )}
            >
              <Sparkles className="h-4 w-4" />
              0% comision pentru cumparator
            </div>

            <h1
              className={cn(
                'mt-5 max-w-2xl text-[clamp(2.1rem,5vw,4.75rem)] font-semibold tracking-[-0.04em]',
                isAgentfinderTheme ? 'font-[family-name:var(--font-space-grotesk)] text-slate-950' : 'text-white'
              )}
            >
              {agency?.name || 'Agentia ta imobiliara'}
            </h1>

            <p className={cn('mt-4 max-w-2xl text-base leading-7 md:text-lg', isAgentfinderTheme ? 'text-slate-600' : 'text-stone-200/88')}>
              Gasesti proprietati prezentate detaliat, cu fotografii clare, informatii utile si un mod simplu de a
              intra in legatura cu noi atunci cand ceva iti atrage atentia.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className={cn(
                  'rounded-full px-7',
                  isAgentfinderTheme
                    ? 'landing-button-pulse border border-white/40 bg-[linear-gradient(135deg,#ffffff_0%,#e2e8f0_45%,#bfdbfe_100%)] text-slate-950 shadow-[0_20px_60px_rgba(59,130,246,0.22)] hover:opacity-100'
                    : 'bg-emerald-400 text-black shadow-[0_18px_42px_-16px_rgba(74,222,128,0.7)] hover:bg-emerald-300'
                )}
              >
                <Link href={publicPath('/properties')}>
                  Vezi proprietatile
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className={cn(
                  'rounded-full px-7',
                  isAgentfinderTheme
                    ? 'border-slate-200 bg-white/82 text-slate-700 hover:bg-white hover:text-slate-950'
                    : 'border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.1]'
                )}
              >
                <Link href={publicPath('/contact')}>Contacteaza un consultant</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div
              className={cn(
                statCardClassName,
                isAgentfinderTheme &&
                  'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.92))] shadow-[0_18px_48px_rgba(37,55,88,0.08)]'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl',
                    isAgentfinderTheme
                      ? 'border border-sky-200/70 bg-sky-50 text-sky-700'
                      : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  )}
                >
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className={cn('text-sm font-medium', isAgentfinderTheme ? 'text-slate-700' : 'text-stone-100')}>Portofoliu activ</p>
                  <p className={cn('text-sm', isAgentfinderTheme ? 'text-slate-500' : 'text-stone-300')}>Anunturi disponibile acum, pregatite sa fie descoperite</p>
                </div>
              </div>
            </div>

            <div
              className={cn(
                statCardClassName,
                isAgentfinderTheme &&
                  'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.92))] shadow-[0_18px_48px_rgba(37,55,88,0.08)]'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl',
                    isAgentfinderTheme
                      ? 'border border-sky-200/70 bg-sky-50 text-sky-700'
                      : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  )}
                >
                  <MapPinned className="h-5 w-5" />
                </div>
                <div>
                  <p className={cn('text-sm font-medium', isAgentfinderTheme ? 'text-slate-700' : 'text-stone-100')}>Zone relevante</p>
                  <p className={cn('text-sm', isAgentfinderTheme ? 'text-slate-500' : 'text-stone-300')}>Proprietati din zone cautate, usor de comparat</p>
                </div>
              </div>
            </div>

            <div
              className={cn(
                statCardClassName,
                isAgentfinderTheme &&
                  'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.92))] shadow-[0_18px_48px_rgba(37,55,88,0.08)]'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl',
                    isAgentfinderTheme
                      ? 'border border-sky-200/70 bg-sky-50 text-sky-700'
                      : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  )}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className={cn('text-sm font-medium', isAgentfinderTheme ? 'text-slate-700' : 'text-stone-100')}>Experienta curata</p>
                  <p className={cn('text-sm', isAgentfinderTheme ? 'text-slate-500' : 'text-stone-300')}>Un site aerisit, gandit sa-ti arate repede ce conteaza</p>
                </div>
              </div>
            </div>

            <div
              className={cn(
                statCardClassName,
                isAgentfinderTheme &&
                  'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.92))] shadow-[0_18px_48px_rgba(37,55,88,0.08)]'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl',
                    isAgentfinderTheme
                      ? 'border border-sky-200/70 bg-sky-50 text-sky-700'
                      : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  )}
                >
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <p className={cn('text-sm font-medium', isAgentfinderTheme ? 'text-slate-700' : 'text-stone-100')}>Asistenta dedicata</p>
                  <p className={cn('text-sm', isAgentfinderTheme ? 'text-slate-500' : 'text-stone-300')}>Suntem aici pentru intrebari, recomandari si vizionari</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
