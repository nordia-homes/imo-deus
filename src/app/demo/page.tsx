'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { hasDemoFirebaseConfig } from '@/firebase/config';
import { initializeFirebase } from '@/firebase/init';
import { setStoredRuntimeMode } from '@/lib/runtime-mode';

const DEMO_WELCOME_KEY = 'imodeus:demo-welcome-shown';
const DEMO_PAGE_PREFIX = 'imodeus:demo-page-modal:';

function resetDemoModalSession() {
  if (typeof window === 'undefined') return;

  const keysToRemove = Object.keys(window.sessionStorage).filter(
    (key) => key === DEMO_WELCOME_KEY || key.startsWith(DEMO_PAGE_PREFIX)
  );

  keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
}

export default function DemoEntryPage() {
  const demoConfigured = hasDemoFirebaseConfig();
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    if (!demoConfigured) return;

    let isCancelled = false;

    const launchDemo = async () => {
      setLaunchError(null);
      resetDemoModalSession();
      setStoredRuntimeMode('demo');

      const { auth } = initializeFirebase('demo');
      const activeUser = auth.currentUser ?? (await signInAnonymously(auth).then((credential) => credential.user));
      await activeUser.getIdToken(true);

      const response = await fetch('/api/demo/provision-fallback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid: activeUser.uid }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { agencyId?: string; error?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            payload?.message ||
            `Nu am putut porni demo-ul. (${response.status})`
        );
      }

      if (payload?.agencyId && typeof window !== 'undefined') {
        window.localStorage.setItem('imodeus:lastAgencyId', payload.agencyId);
      }

      if (!isCancelled && typeof window !== 'undefined') {
        window.location.replace('/dashboard');
      }
    };

    void launchDemo().catch((error) => {
      if (isCancelled) return;
      console.error(error);
      setLaunchError(error instanceof Error ? error.message : 'Nu am putut porni demo-ul.');
    });

    return () => {
      isCancelled = true;
    };
  }, [demoConfigured]);

  return (
    <main
      data-app-theme="agentfinder"
      className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f7fafe_38%,#eef4fb_100%)] text-[var(--foreground)]"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[920px] items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-[32px] border border-[var(--app-surface-border)] bg-white/80 p-8 text-center shadow-[0_22px_64px_rgba(37,55,88,0.08)] backdrop-blur-xl sm:p-10">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--app-surface-border)] bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            <Sparkles className="h-3.5 w-3.5" />
            Lansăm demo-ul
          </div>

          <h1 className="mt-6 font-headline text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Pregătim agenția demo.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Intri direct în aplicația reală, pe un backend demo separat, fără niciun impact asupra conturilor reale.
          </p>

          <div className="mx-auto mt-8 flex w-fit items-center gap-3 rounded-full border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-blue)] px-5 py-3 text-sm font-medium text-slate-700 shadow-[var(--agentfinder-soft-shadow)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
            Redirecționăm către dashboard-ul demo
          </div>

          {!demoConfigured ? (
            <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50/90 p-5 text-left">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-rose-600" />
                <div>
                  <p className="text-sm font-semibold text-rose-700">Configurația demo lipsește</p>
                  <p className="mt-2 text-sm leading-6 text-rose-700/90">
                    Demo-ul cu backend separat necesită variabilele `NEXT_PUBLIC_DEMO_FIREBASE_*` și credențialele server `DEMO_FIREBASE_*`.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {launchError ? (
            <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50/90 p-5 text-left">
              <p className="text-sm font-semibold text-rose-700">Nu am putut porni demo-ul</p>
              <p className="mt-2 text-sm leading-6 text-rose-700/90">{launchError}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="h-11 rounded-full border-0 bg-[var(--agentfinder-primary-button)] px-5 text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]"
                  onClick={() => window.location.reload()}
                >
                  Reîncearcă
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="h-11 rounded-full border-[var(--app-surface-border)] bg-white/90 px-5 text-slate-700 hover:bg-white"
                >
                  <Link href="/register">
                    <span className="inline-flex items-center gap-2">
                      Creează contul agenției tale
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
