'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getStoredRuntimeMode, RUNTIME_MODE_CHANGED_EVENT } from '@/lib/runtime-mode';

const DEMO_WELCOME_KEY = 'imodeus:demo-welcome-shown';
const DEMO_PAGE_PREFIX = 'imodeus:demo-page-modal:';

function getPageLabel(pathname: string) {
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/leads')) return 'Cumparatori';
  if (pathname.startsWith('/properties')) return 'Proprietati';
  if (pathname.startsWith('/viewings')) return 'Vizionari';
  if (pathname.startsWith('/tasks')) return 'Task-uri';
  if (pathname.startsWith('/agenti')) return 'Agenti';
  if (pathname.startsWith('/reports')) return 'Rapoarte';
  if (pathname.startsWith('/matching')) return 'Potrivire AI';
  if (pathname.startsWith('/ai-assistant')) return 'AI Assistant';
  if (pathname.startsWith('/contracts')) return 'Contracte';
  if (pathname.startsWith('/portal-sync')) return 'Integrari';
  if (pathname.startsWith('/settings')) return 'Setari';
  if (pathname.startsWith('/billing')) return 'Facturare';
  return 'platforma';
}

type ModalVariant = 'welcome' | 'conversion';

function getModalCopy(variant: ModalVariant, pageLabel: string) {
  if (variant === 'welcome') {
    return {
      badge: 'Cont Demo',
      eyebrow: 'Explorezi produsul complet',
      title: 'Vezi exact cum arata platforma in utilizare reala.',
      description:
        'Ai intrat intr-o agentie demo complet populata, construita pentru a-ti arata interfața, fluxurile si claritatea operationala pe care o poate avea echipa ta in ImoDeus.ai CRM.',
      panelTitle: 'Ce gasesti in demo',
      sideTitle: 'Un demo care arata produsul, nu doar il promite.',
      sideText:
        'Tot ce vezi aici este gandit sa te ajute sa intelegi rapid produsul si sa iti imaginezi cum ar lucra agentia ta in acelasi mediu.',
      highlights: [
        'Proprietati, cumparatori, vizionari si task-uri populate coerent',
        'Flux real de lucru, nu un simplu mockup static',
        'Mediu demo separat, fara impact asupra datelor reale',
      ],
      offerTitle: 'Cand esti pregatit',
      offerText:
        'Poti porni direct cu agentia ta si primesti 30 de zile gratuite pentru configurare, onboarding si validare interna.',
      dismissLabel: 'Continua in demo',
    };
  }

  return {
    badge: '30 Zile Gratuite',
    eyebrow: `Esti in ${pageLabel}`,
    title: `Daca iti place experienta din ${pageLabel}, urmatorul pas este contul real al agentiei tale.`,
    description:
      'Transforma ceea ce vezi acum intr-un spatiu de lucru real pentru echipa ta. Primeste 30 de zile gratuite pentru setup, branding, onboarding si testarea fluxului pe datele proprii.',
    panelTitle: 'Ce castigi imediat',
    sideTitle: 'Treci de la demo la operare reala.',
    sideText:
      'Nu ramai intr-un demo frumos, ci treci intr-un cont in care agentii tai, portofoliul tau si lead-urile tale lucreaza in acelasi sistem.',
    highlights: [
      'Onboarding si configurare fara presiune, timp de 30 de zile',
      'Branding, echipa si fluxuri adaptate agentiei tale',
      'Aceeasi experienta premium, dar pe portofoliul si lead-urile tale',
    ],
    offerTitle: 'Oferta activa',
    offerText:
      'Creezi contul agentiei tale si primesti 30 de zile gratuite pentru configurare, training si tranzitia echipei.',
    dismissLabel: 'Mai tarziu',
  };
}

export function DemoConversionModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<ModalVariant>('conversion');
  const evaluationFrameRef = useRef<number | null>(null);

  const pageLabel = useMemo(() => getPageLabel(pathname), [pathname]);
  const copy = useMemo(() => getModalCopy(variant, pageLabel), [pageLabel, variant]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const evaluateModal = () => {
      if (getStoredRuntimeMode() !== 'demo') {
        setOpen(false);
        return;
      }

      const hasWelcomeBeenSeen = window.sessionStorage.getItem(DEMO_WELCOME_KEY) === 'true';
      const pageKey = `${DEMO_PAGE_PREFIX}${pathname}`;
      const hasSeenPageModal = window.sessionStorage.getItem(pageKey) === 'true';
      const isDashboard = pathname.startsWith('/dashboard');

      if (isDashboard && !hasWelcomeBeenSeen) {
        setVariant('welcome');
        setOpen(true);
        window.sessionStorage.setItem(DEMO_WELCOME_KEY, 'true');
        window.sessionStorage.setItem(pageKey, 'true');
        return;
      }

      if (!isDashboard && hasWelcomeBeenSeen && !hasSeenPageModal) {
        setVariant('conversion');
        setOpen(true);
        window.sessionStorage.setItem(pageKey, 'true');
        return;
      }

      setOpen(false);
    };

    evaluationFrameRef.current = window.requestAnimationFrame(evaluateModal);

    const handleModeChange = () => evaluateModal();
    window.addEventListener(RUNTIME_MODE_CHANGED_EVENT, handleModeChange);

    return () => {
      if (evaluationFrameRef.current !== null) {
        window.cancelAnimationFrame(evaluationFrameRef.current);
      }
      window.removeEventListener(RUNTIME_MODE_CHANGED_EVENT, handleModeChange);
    };
  }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[min(96vw,1320px)] max-w-none overflow-hidden rounded-[36px] border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
        <div className="relative max-h-[92vh] overflow-auto rounded-[36px] border border-white/60 bg-[linear-gradient(180deg,rgba(244,248,255,0.98),rgba(234,242,252,0.98))] shadow-[0_40px_160px_rgba(37,55,88,0.28)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(129,161,255,0.20),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(126,224,185,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.36),rgba(255,255,255,0.06))]" />

          <div className="relative">
            <div className="grid min-h-[min(780px,92vh)] grid-cols-1 lg:grid-cols-[1.12fr_0.88fr]">
              <section className="flex flex-col justify-between border-b border-white/55 px-6 py-6 sm:px-8 sm:py-8 lg:border-b-0 lg:border-r lg:px-12 lg:py-12">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(144,165,205,0.22)] bg-white/84 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)] shadow-[0_10px_24px_rgba(49,73,118,0.06)]">
                        {variant === 'welcome' ? <ShieldCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {copy.badge}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(144,165,205,0.18)] bg-white/58 px-3.5 py-1.5 text-xs font-medium text-slate-600">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        {copy.eyebrow}
                      </div>
                    </div>

                    <DialogClose className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(144,165,205,0.16)] bg-white/84 text-slate-500 transition hover:bg-white hover:text-slate-900">
                      <X className="h-4.5 w-4.5" />
                      <span className="sr-only">Inchide</span>
                    </DialogClose>
                  </div>

                  <DialogHeader className="mt-8 max-w-[760px] space-y-5 text-left">
                    <DialogTitle className="font-headline text-[2.45rem] font-bold leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-[3.15rem] lg:text-[4.4rem]">
                      {copy.title}
                    </DialogTitle>
                    <DialogDescription className="max-w-[720px] text-base leading-8 text-slate-600 sm:text-lg">
                      {copy.description}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-10 grid gap-4 sm:grid-cols-3">
                    {copy.highlights.map((item) => (
                      <div
                        key={item}
                        className="rounded-[26px] border border-[rgba(146,166,206,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(246,249,255,0.8))] p-5 shadow-[0_16px_44px_rgba(49,73,118,0.06)]"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(236,246,255,0.92),rgba(224,241,255,0.9))] text-[var(--primary)] ring-1 ring-[rgba(146,166,206,0.18)]">
                          <Check className="h-4.5 w-4.5" />
                        </div>
                        <p className="mt-4 text-base leading-7 text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter className="mt-8 flex-col gap-3 sm:flex-row sm:justify-between sm:space-x-0">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="h-12 rounded-full border-[rgba(146,166,206,0.22)] bg-white/84 px-6 text-slate-700 hover:bg-white"
                  >
                    {copy.dismissLabel}
                  </Button>
                  <Button
                    asChild
                    className="h-12 rounded-full border-0 bg-[var(--agentfinder-primary-button)] px-6 text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]"
                  >
                    <Link href="/register">
                      <span className="inline-flex items-center gap-2">
                        Creeaza contul agentiei tale
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </Button>
                </DialogFooter>
              </section>

              <aside className="flex flex-col justify-between px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-12">
                <div className="rounded-[30px] border border-[rgba(142,163,205,0.16)] bg-[linear-gradient(180deg,rgba(24,41,73,0.97),rgba(34,53,93,0.96))] p-6 text-white shadow-[0_24px_70px_rgba(25,38,69,0.26)] sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                    Urmatorul pas
                  </p>
                  <h3 className="mt-4 font-headline text-3xl font-bold leading-[1.02] tracking-[-0.045em] text-white sm:text-[2.15rem]">
                    {copy.sideTitle}
                  </h3>
                  <p className="mt-4 text-base leading-8 text-white/76">
                    {copy.sideText}
                  </p>

                  <div className="mt-8 rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                    <p className="text-sm font-semibold text-white">{copy.offerTitle}</p>
                    <p className="mt-3 text-sm leading-7 text-white/74">{copy.offerText}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[30px] border border-[rgba(146,166,206,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(246,249,255,0.76))] p-5 shadow-[0_16px_44px_rgba(49,73,118,0.06)] sm:p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {copy.panelTitle}
                  </p>
                  <div className="mt-5 space-y-3">
                    {copy.highlights.map((item) => (
                      <div
                        key={`${item}-aside`}
                        className="flex items-start gap-3 rounded-[18px] bg-white/72 px-4 py-3 ring-1 ring-[rgba(146,166,206,0.14)]"
                      >
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(228,245,255,0.96),rgba(220,240,255,0.9))] text-[var(--primary)]">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm leading-6 text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
