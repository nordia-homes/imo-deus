'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AuthError } from 'firebase/auth';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { ArrowRight, BadgeCheck, CheckCircle2, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { ImoDeusTextLogo } from '@/components/icons/ImoDeusTextLogo';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser } from '@/firebase';
import { setStoredRuntimeMode } from '@/lib/runtime-mode';

const loginSchema = z.object({
  email: z.string().email({ message: 'Adresa de email este invalida.' }),
  password: z.string().min(6, { message: 'Parola trebuie sa aiba cel putin 6 caractere.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const isLoggedIn = !!user;
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    setStoredRuntimeMode('real');
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/dashboard');
    }
  }, [isLoggedIn, router]);

  const handleLogin = (values: LoginFormValues) => {
    setIsSubmitting(true);

    signInWithEmailAndPassword(auth, values.email, values.password).catch((error: AuthError) => {
      console.error('Login failed:', error);
      toast({
        variant: 'destructive',
        title: 'Autentificare esuata',
        description: 'Adresa de email sau parola este incorecta. Te rugam sa incerci din nou.',
      });
      setIsSubmitting(false);
    });
  };

  const handleGoogleLogin = () => {
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();

    signInWithPopup(auth, provider).catch((error: AuthError) => {
      console.error('Google Login failed:', error);
      toast({
        variant: 'destructive',
        title: 'Autentificare esuata',
        description: 'Nu am putut finaliza autentificarea cu Google. Te rugam sa incerci din nou.',
      });
      setIsSubmitting(false);
    });
  };

  if (isUserLoading || isLoggedIn) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(82,132,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.12),transparent_28%),linear-gradient(180deg,#06111f_0%,#081a2c_54%,#0b1829_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1480px] gap-6 xl:grid-cols-[minmax(320px,0.95fr)_minmax(520px,0.9fr)]">
        <section className="relative hidden self-start overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(15,31,58,0.95),rgba(8,18,34,0.92))] p-6 shadow-[0_32px_90px_rgba(0,0,0,0.28)] sm:p-8 lg:p-7 xl:sticky xl:top-6 xl:block xl:h-[calc(100vh-3rem)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(111,161,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(94,234,212,0.12),transparent_24%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                Acces rapid in platforma
              </div>

              <div className="mt-5">
                <ImoDeusTextLogo className="w-56 text-white" />
              </div>

              <h1 className="mt-6 max-w-[31rem] text-[1.55rem] font-black leading-[0.98] tracking-[-0.04em] text-white sm:max-w-[35rem] sm:text-[2.05rem]">
                Intra in contul tau si continua lucrul exact de unde ai ramas.
              </h1>

              <p className="mt-4 max-w-2xl text-[0.94rem] leading-7 text-slate-300">
                Proprietati, cumparatori, publicare in portaluri, AI matching si automatizari:
                tot ce lucrezi in ImoDeus.ai CRM ramane organizat intr-un singur loc.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">CRM</p>
                  <p className="mt-2 text-base font-semibold text-white">Lead-uri & portofoliu</p>
                  <p className="mt-2 text-[13px] leading-5 text-slate-300">Revii rapid la cumparatori, proprietati si discutii active.</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Portaluri</p>
                  <p className="mt-2 text-base font-semibold text-white">Publicare rapida</p>
                  <p className="mt-2 text-[13px] leading-5 text-slate-300">Trimiti mai departe anunturile si update-urile fara sa reiei munca.</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">AI</p>
                  <p className="mt-2 text-base font-semibold text-white">Matching & follow-up</p>
                  <p className="mt-2 text-[13px] leading-5 text-slate-300">Vezi imediat oportunitatile si task-urile care conteaza azi.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-emerald-300/14 bg-emerald-300/[0.08] p-3.5">
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-5 w-5 text-emerald-200" />
                  <p className="text-sm font-semibold text-emerald-100">Acces simplu</p>
                </div>
                <p className="mt-2.5 text-sm leading-6 text-emerald-50/78">
                  Intri cu emailul sau cu Google si ajungi direct in contul tau, fara pasi inutili.
                </p>
              </div>
              <div className="rounded-[22px] border border-sky-300/14 bg-sky-300/[0.07] p-3.5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-sky-200" />
                  <p className="text-sm font-semibold text-sky-100">Totul sincronizat</p>
                </div>
                <p className="mt-2.5 text-sm leading-6 text-sky-50/78">
                  Echipa, pipeline-ul si activitatea ta raman pregatite pentru urmatoarea actiune.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,249,255,0.94))] text-slate-950 shadow-[0_32px_90px_rgba(0,0,0,0.18)]">
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Autentificare
              </div>
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-[2.35rem]">
              Intra in platforma si continua activitatea agentiei tale.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              Autentificarea este rapida si clara, astfel incat sa ajungi imediat la lead-uri,
              proprietati, task-uri si automatizarile pe care le folosesti zilnic.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-8">
                <section className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <CheckCircle2 className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">Date de acces</h3>
                      <p className="text-sm text-slate-500">Introdu emailul si parola contului tau.</p>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} placeholder="nume@agentie.ro" className="mt-3 h-12 rounded-2xl border-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                          <div className="flex items-center justify-between gap-3">
                            <FormLabel>Parola</FormLabel>
                            <Link
                              href="/forgot-password"
                              className="text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-slate-950"
                              tabIndex={-1}
                            >
                              Am uitat parola?
                            </Link>
                          </div>
                          <FormControl>
                            <Input type="password" {...field} className="mt-3 h-12 rounded-2xl border-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f7ff_100%)] p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)] sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Acces cont
                      </p>
                      <h4 className="mt-2 text-xl font-semibold text-slate-950">
                        Intra in cont si revino la fluxul tau de lucru.
                      </h4>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                        Dupa autentificare, continui exact de unde ai ramas: lead-uri, proprietati,
                        task-uri, vizionari si tot ce ai in lucru.
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                      <span className="font-semibold text-slate-950">Intrare rapida:</span> email sau Google
                      <br />
                      <span className="font-semibold text-slate-950">Flux clar:</span> intri si continui munca imediat
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-4">
                    <Button
                      className="h-14 rounded-full bg-[linear-gradient(135deg,#0f172a,#213b73)] text-base font-semibold text-white shadow-[0_24px_54px_rgba(33,59,115,0.28)] hover:opacity-95"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Intram in cont...
                        </>
                      ) : (
                        <>
                          Intra in cont
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase tracking-[0.14em]">
                        <span className="bg-[#f5f8ff] px-3 text-slate-400">sau continua cu</span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="h-14 rounded-full border-slate-200 bg-white text-base text-slate-800 hover:bg-slate-50"
                      onClick={handleGoogleLogin}
                      disabled={isSubmitting}
                      type="button"
                    >
                      <GoogleIcon className="mr-2 h-4 w-4" />
                      Continua cu Google
                    </Button>

                    <p className="text-center text-sm text-slate-500">
                      Nu ai cont?{' '}
                      <Link href="/register" className="font-semibold text-slate-950 underline underline-offset-4">
                        Creeaza unul acum
                      </Link>
                    </p>
                  </div>
                </section>
              </form>
            </Form>
          </div>
        </section>
      </div>
    </main>
  );
}
