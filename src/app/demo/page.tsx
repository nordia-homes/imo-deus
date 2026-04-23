'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, DatabaseZap, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { signInAnonymously } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { hasDemoFirebaseConfig } from "@/firebase/config";
import { useAuth, useUser } from "@/firebase";
import { setStoredRuntimeMode } from "@/lib/runtime-mode";

const INCLUDED_AREAS = [
  "aplicatia reala, cu paginile reale ale CRM-ului",
  "agentie demo izolata pentru fiecare utilizator",
  "backend demo separat de productie",
];

const SAFETY_POINTS = [
  "datele demo sunt scrise doar in backend-ul separat de demo",
  "nu se scrie nimic in proiectul Firebase real",
  "integrarile externe sensibile sunt blocate in demo",
];

export default function DemoEntryPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const demoConfigured = hasDemoFirebaseConfig();
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLaunching || !demoConfigured) return;
    if (isUserLoading) return;

    const launchDemo = async () => {
      const activeUser = user ?? (await signInAnonymously(auth).then((credential) => credential.user));
      await activeUser.getIdToken(true);

      const response = await fetch('/api/demo/provision', {
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
        throw new Error(payload?.error || payload?.message || 'Nu am putut porni demo-ul.');
      }

      if (payload?.agencyId && typeof window !== 'undefined') {
        window.localStorage.setItem('imodeus:lastAgencyId', payload.agencyId);
      }

      router.replace('/dashboard');
    };

    void launchDemo().catch((error) => {
      console.error(error);
      setLaunchError(error instanceof Error ? error.message : 'Nu am putut porni demo-ul.');
      setIsLaunching(false);
    });
  }, [auth, demoConfigured, isLaunching, isUserLoading, router, user]);

  return (
    <main
      data-app-theme="agentfinder"
      className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f7fafe_38%,#eef4fb_100%)] text-[var(--foreground)]"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="rounded-[32px] border border-[var(--app-surface-border)] bg-white/76 p-6 shadow-[0_22px_64px_rgba(37,55,88,0.08)] backdrop-blur-xl lg:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--app-surface-border)] bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            <Sparkles className="h-3.5 w-3.5" />
            Demo izolat
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <h1 className="font-headline text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                Intri intr-o agentie demo realista, fara niciun risc pentru aplicatia reala.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Aceasta este prima fundatie pentru mediul demo ImoDeus.ai CRM: o experienta separata,
                cu date mock coerente, stare locala pe sesiune si fara write-uri in Firebase-ul de productie.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 rounded-full border-0 bg-[var(--agentfinder-primary-button)] px-6 text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]"
                  disabled={!demoConfigured || isLaunching}
                  onClick={() => {
                    setLaunchError(null);
                    setStoredRuntimeMode('demo');
                    setIsLaunching(true);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    {isLaunching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Lansam demo-ul
                      </>
                    ) : (
                      <>
                        Intra in demo-ul real
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </span>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-[var(--app-surface-border)] bg-white/85 px-6 text-slate-700 hover:bg-white"
                  asChild
                >
                  <Link href="/register">Creeaza agentia ta</Link>
                </Button>
              </div>

              {!demoConfigured ? (
                <p className="mt-4 text-sm text-rose-600">
                  Demo-ul cu backend separat necesita variabilele `NEXT_PUBLIC_DEMO_FIREBASE_*` si credentialele server `DEMO_FIREBASE_*`.
                </p>
              ) : null}
              {launchError ? (
                <p className="mt-4 text-sm text-rose-600">
                  {launchError}
                </p>
              ) : null}

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {INCLUDED_AREAS.map((item) => (
                  <div
                    key={item}
                    className="rounded-[22px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] p-4 shadow-[var(--agentfinder-soft-shadow)]"
                  >
                    <CheckCircle2 className="h-5 w-5 text-[var(--app-highlight)]" />
                    <p className="mt-3 text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-blue)] p-5 shadow-[var(--agentfinder-card-shadow)]">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/80 p-3 text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                    <DatabaseZap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sesiune demo</p>
                    <p className="text-base font-semibold text-slate-950">Provisionare per utilizator</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Fiecare utilizator primeste propria agentie demo intr-un backend separat. Aplicatia reala ramane neatinsa.
                </p>
              </div>

              <div className="rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-green)] p-5 shadow-[var(--agentfinder-card-shadow)]">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/80 p-3 text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Protectii active</p>
                    <p className="text-base font-semibold text-slate-950">Zero impact asupra aplicatiei reale</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {SAFETY_POINTS.map((item) => (
                    <div key={item} className="rounded-[18px] bg-white/78 px-3.5 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
