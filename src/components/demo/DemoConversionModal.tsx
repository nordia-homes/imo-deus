'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
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
  const pathname = usePathname() ?? '';
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
      <DialogContent className="w-[min(94vw,760px)] max-w-none overflow-hidden rounded-[32px] border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
        <div className="demo-conversion-modal relative max-h-[88vh] overflow-hidden rounded-[28px] sm:rounded-[32px]">
          <DialogClose className="demo-conversion-modal__close">
            <X className="h-4.5 w-4.5" />
            <span className="sr-only">Inchide</span>
          </DialogClose>

          <div className="relative flex max-h-[88vh] flex-col overflow-hidden">
            <div className="overflow-y-auto px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-7">
            <div className="demo-conversion-modal__badge-row">
              <div className="demo-conversion-modal__badge">
                {variant === 'welcome' ? <ShieldCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {copy.badge}
              </div>
            </div>

            <div className="demo-conversion-modal__content mt-7 flex flex-col items-center gap-5 text-center sm:mt-8">
              <DialogHeader className="space-y-4 text-center">
                <p className="demo-conversion-modal__eyebrow">{copy.eyebrow}</p>
                <DialogTitle className="demo-conversion-modal__title">
                  Devino un <span className="demo-conversion-modal__title-accent">SuperAgent</span>
                  <br />
                  <span className="demo-conversion-modal__title-inline">Incepe cu 30 de zile gratuite!</span>
                </DialogTitle>
                <DialogDescription className="demo-conversion-modal__description">
                  Primeste 30 de zile gratuite si descopera cum lucreaza impreuna publicarea automata in grupurile Facebook si in portale (Imobiliare.ro, Storia, OLX, HomeZZ, Publi24, Trimbitasu Estate etc.), proprietarii deja contactati de noi, baza de date de cumparatori, AI matching, confirmarea automata a vizionarilor si multe altele.
                </DialogDescription>
              </DialogHeader>
            </div>
            </div>

            <div className="demo-conversion-modal__footer-shell">
            <DialogFooter className="flex-col items-center gap-3 sm:flex-row sm:justify-center sm:space-x-0">
              <Button asChild className="demo-conversion-modal__primary-button">
                <Link href="/register">
                  <span className="inline-flex items-center gap-2">
                    Creeaza contul agentiei tale
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="demo-conversion-modal__secondary-button"
              >
                {copy.dismissLabel}
              </Button>
            </DialogFooter>

            <p className="mt-3 text-center text-xs text-slate-400">
              Fara presiune. Fara configurari complicate. Intri direct in contul real al agentiei tale.
            </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
