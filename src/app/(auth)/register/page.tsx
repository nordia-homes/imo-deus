'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AuthError, User } from 'firebase/auth';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { arrayUnion, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Loader2,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { ImoDeusTextLogo } from '@/components/icons/ImoDeusTextLogo';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore, useUser } from '@/firebase';
import type { CompanyLookupResult } from '@/lib/infocui';
import type { Invite } from '@/lib/types';
import { setStoredRuntimeMode } from '@/lib/runtime-mode';

const entityTypeOptions = [
  {
    value: 'agency',
    label: 'Agentie imobiliara',
    description: 'Pentru SRL sau alta companie care va opera echipa si portofoliul.',
    icon: Building2,
  },
  {
    value: 'pfa',
    label: 'Agent independent / PFA',
    description: 'Pentru brokeri sau consultanti care lucreaza individual.',
    icon: UserRound,
  },
] as const;

const registerSchema = z.object({
  fullName: z.string().min(2, { message: 'Introdu numele complet.' }),
  email: z.string().email({ message: 'Adresa de email este invalida.' }),
  phone: z.string().optional(),
  password: z.string().min(6, { message: 'Parola trebuie sa aiba cel putin 6 caractere.' }),
  entityType: z.enum(['agency', 'pfa']),
  companyTaxId: z.string().optional(),
  legalCompanyName: z.string().optional(),
  tradeRegisterNumber: z.string().optional(),
  registeredOffice: z.string().optional(),
  legalRepresentative: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const isLoggedIn = !!user;
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showManualLegalFields, setShowManualLegalFields] = useState(false);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<{
    tone: 'success' | 'error' | 'neutral';
    message: string;
  } | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      entityType: 'agency',
      companyTaxId: '',
      legalCompanyName: '',
      tradeRegisterNumber: '',
      registeredOffice: '',
      legalRepresentative: '',
    },
  });

  const entityType = form.watch('entityType');
  const companyTaxIdValue = form.watch('companyTaxId');
  useEffect(() => {
    setStoredRuntimeMode('real');
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/dashboard');
    }
  }, [isLoggedIn, router]);

  const persistBaseProfile = async (newUser: User, values?: RegisterFormValues) => {
    if (!newUser.email) return;

    const userDocRef = doc(firestore, 'users', newUser.uid);
    const onboardingData = values
      ? {
          onboarding: {
            status: 'pending',
            entityType: values.entityType,
            companyTaxId: values.companyTaxId?.trim() || '',
            legalCompanyName: values.legalCompanyName?.trim() || '',
            tradeRegisterNumber: values.tradeRegisterNumber?.trim() || '',
            registeredOffice: values.registeredOffice?.trim() || '',
            legalRepresentative: values.legalRepresentative?.trim() || '',
            updatedAt: new Date().toISOString(),
          },
        }
      : {};

    await setDoc(
      userDocRef,
      {
        name: values?.fullName?.trim() || newUser.displayName || newUser.email,
        email: newUser.email,
        phone: values?.phone?.trim() || '',
        photoUrl: newUser.photoURL || '',
        ...onboardingData,
      },
      { merge: true }
    );
  };

  const handlePostRegistration = async (newUser: User, values?: RegisterFormValues) => {
    if (!newUser.email) return;

    try {
      const inviteRef = doc(firestore, 'invites', btoa(newUser.email));
      const inviteSnap = await getDoc(inviteRef);

      if (inviteSnap.exists()) {
        const inviteData = inviteSnap.data() as Invite;
        const userProfile = {
          name: values?.fullName?.trim() || newUser.displayName || newUser.email,
          email: newUser.email,
          phone: values?.phone?.trim() || '',
          agencyId: inviteData.agencyId,
          role: inviteData.role,
          agencyName: inviteData.agencyName,
          photoUrl: newUser.photoURL || '',
        };

        const userDocRef = doc(firestore, 'users', newUser.uid);
        await setDoc(userDocRef, userProfile, { merge: true });

        const agencyRef = doc(firestore, 'agencies', inviteData.agencyId);
        await updateDoc(agencyRef, {
          agentIds: arrayUnion(newUser.uid),
        });

        await deleteDoc(inviteRef);

        toast({ title: `Bun venit la ${inviteData.agencyName}!` });
        return;
      }

      await persistBaseProfile(newUser, values);
    } catch (error) {
      console.error('Post-registration process failed:', error);
      toast({
        variant: 'destructive',
        title: 'Eroare post-inregistrare',
        description: 'Nu am putut finaliza configurarea contului. Te rugam sa incerci din nou.',
      });
    }
  };

  const handleRegister = async (values: RegisterFormValues) => {
    setIsSubmitting(true);

    createUserWithEmailAndPassword(auth, values.email, values.password)
      .then(async (userCredential) => {
        await handlePostRegistration(userCredential.user, values);
      })
      .catch((error: AuthError) => {
        console.error('Registration failed:', error);

        let description = 'A aparut o eroare. Te rugam sa incerci din nou.';
        if (error.code === 'auth/email-already-in-use') {
          description = 'Adresa de email este deja folosita de alt cont.';
        }

        toast({
          variant: 'destructive',
          title: 'Inregistrare esuata',
          description,
        });
        setIsSubmitting(false);
      });
  };

  const handleCompanyLookup = async () => {
    const rawTaxId = companyTaxIdValue?.trim() || '';

    if (!rawTaxId) {
      form.setError('companyTaxId', {
        type: 'manual',
        message: 'Introdu CUI / CIF pentru preluarea automata a datelor.',
      });
      setLookupFeedback({
        tone: 'error',
        message: 'Introdu CUI / CIF pentru a putea prelua datele firmei sau ale PFA-ului.',
      });
      return;
    }

    setIsLookupLoading(true);
    setLookupFeedback({
      tone: 'neutral',
      message: 'Verificam datele firmei si pregatim completarea automata a formularului.',
    });
    form.clearErrors('companyTaxId');

    try {
      const response = await fetch(`/api/company-lookup?taxId=${encodeURIComponent(rawTaxId)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as
        | { ok: true; company: CompanyLookupResult }
        | { ok: false; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? 'Nu am putut prelua datele companiei acum.' : payload.message || 'Nu am putut prelua datele companiei acum.');
      }

      const { company } = payload;

      form.setValue('companyTaxId', company.companyTaxId || rawTaxId, { shouldDirty: true, shouldValidate: true });
      form.setValue('legalCompanyName', company.legalCompanyName || '', { shouldDirty: true });
      form.setValue('tradeRegisterNumber', company.tradeRegisterNumber || '', { shouldDirty: true });
      form.setValue('registeredOffice', company.registeredOffice || '', { shouldDirty: true });

      if (company.legalRepresentative) {
        form.setValue('legalRepresentative', company.legalRepresentative, { shouldDirty: true });
      }

      if (company.entityTypeHint && company.entityTypeHint !== entityType) {
        form.setValue('entityType', company.entityTypeHint, { shouldDirty: true });
      }

      setShowManualLegalFields(true);
      setLookupFeedback({
        tone: 'success',
        message: company.entityStatus
          ? `Am completat automat datele gasite. Status companie: ${company.entityStatus}.`
          : 'Am completat automat datele firmei sau ale PFA-ului in formular.',
      });

      toast({
        title: 'Date preluate automat',
        description: 'Am completat campurile juridice cu informatiile gasite pentru acest CUI / CIF.',
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Nu am putut prelua datele companiei acum.';

      setLookupFeedback({
        tone: 'error',
        message,
      });

      toast({
        variant: 'destructive',
        title: 'Preluare esuata',
        description: message,
      });
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();

    signInWithPopup(auth, provider)
      .then(async (userCredential) => {
        await handlePostRegistration(userCredential.user, form.getValues());
      })
      .catch((error: AuthError) => {
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
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1480px] gap-6 xl:grid-cols-[minmax(320px,0.95fr)_minmax(540px,1.05fr)]">
        <section className="relative hidden self-start overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(15,31,58,0.95),rgba(8,18,34,0.92))] p-6 shadow-[0_32px_90px_rgba(0,0,0,0.28)] sm:p-8 lg:p-7 xl:sticky xl:top-6 xl:block xl:h-[calc(100vh-3rem)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(111,161,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(94,234,212,0.12),transparent_24%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                Onboarding controlat
              </div>

              <div className="mt-5">
                <ImoDeusTextLogo className="w-56 text-white" />
              </div>

              <h1 className="mt-6 max-w-[30rem] text-[1.55rem] font-black leading-[0.98] tracking-[-0.04em] text-white sm:max-w-[34rem] sm:text-[1.95rem]">
                Platforma care iti misca agentia mai repede, mai clar si mai automatizat.
              </h1>

              <p className="mt-3.5 max-w-2xl text-[0.92rem] leading-6 text-slate-300">
                De la publicare automata si baza de date de cumparatori, pana la AI matching,
                vizionari confirmate automat si follow-up-uri mai rapide, ImoDeus.ai CRM iti aduna
                operarea intr-un singur loc.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-3 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Facebook</p>
                  <p className="mt-2 text-base font-semibold text-white">Publicare in grupuri</p>
                  <p className="mt-2 text-[13px] leading-5 text-slate-300">Pregatesti si distribui proprietatile mai rapid in grupurile Facebook relevante.</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-3 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Portaluri</p>
                  <p className="mt-2 text-base font-semibold text-white">Publicare multi-portal</p>
                  <p className="mt-2 text-[13px] leading-5 text-slate-300">Trimiti anunturile in portaluri precum Imobiliare.ro, Storia, OLX, HomeZZ si altele.</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-3 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">AI</p>
                  <p className="mt-2 text-base font-semibold text-white">AI matching</p>
                  <p className="mt-2 text-[13px] leading-5 text-slate-300">Potrivesti mai rapid proprietatile cu baza de date de cumparatori si oportunitati reale.</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-emerald-300/14 bg-emerald-300/[0.08] p-3">
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-5 w-5 text-emerald-200" />
                  <p className="text-sm font-semibold text-emerald-100">Cumparatori & proprietari</p>
                </div>
                <p className="mt-2 text-[13px] leading-5 text-emerald-50/78">
                  Lucrezi cu baza de date de cumparatori si cu proprietarii deja contactati de noi,
                  fara sa pierzi contextul discutiilor.
                </p>
              </div>
              <div className="rounded-[20px] border border-sky-300/14 bg-sky-300/[0.07] p-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-sky-200" />
                  <p className="text-sm font-semibold text-sky-100">Vizionari & automatizari</p>
                </div>
                <p className="mt-2 text-[13px] leading-5 text-sky-50/78">
                  Confirmarea automata a vizionarilor, task-urile si fluxurile de lucru tin echipa
                  in miscare fara follow-up manual inutil.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,249,255,0.94))] text-slate-950 shadow-[0_32px_90px_rgba(0,0,0,0.18)]">
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Inregistrare noua
              </div>
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-[2.35rem]">
              Creeaza contul si pregateste onboarding-ul agentiei tale.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              Pagina de mai jos este gandita pentru onboarding controlat. Contul se creeaza acum,
              iar datele juridice pot fi completate clar si organizat din primul pas.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-8">
                <section className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <CheckCircle2 className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">Acces in platforma</h3>
                      <p className="text-sm text-slate-500">Datele de baza pentru autentificare si contact.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                          <FormLabel>Nume complet</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Elena Popescu" className="mt-3 h-12 rounded-2xl border-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                          <FormLabel>Telefon</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+40 7xx xxx xxx" className="mt-3 h-12 rounded-2xl border-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
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
                          <FormLabel>Parola</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} className="mt-3 h-12 rounded-2xl border-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <p className="text-sm text-slate-500">
                    Folosim emailul, telefonul si parola pentru acces, activare si contactul initial.
                  </p>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Building2 className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">Tip de onboarding</h3>
                      <p className="text-sm text-slate-500">Alege tipul de cont cu care continui onboarding-ul.</p>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="entityType"
                    render={({ field }) => (
                      <FormItem>
                        <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#f1f6ff_100%)] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Selecteaza o singura optiune
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Alege tipul de cont care descrie cel mai bine modul in care vei folosi platforma.
                          </p>
                        </div>
                        <FormControl>
                          <div className="grid gap-4 md:grid-cols-2">
                            {entityTypeOptions.map((option) => {
                              const Icon = option.icon;
                              const isActive = field.value === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => field.onChange(option.value)}
                                  className={[
                                    'relative rounded-[26px] border-2 p-4 text-left transition-all',
                                    isActive
                                      ? 'border-slate-950 bg-slate-950 text-white shadow-[0_18px_38px_rgba(15,23,42,0.18)] ring-4 ring-slate-950/10'
                                      : 'border-slate-300 bg-white text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:border-slate-500 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]',
                                  ].join(' ')}
                                  aria-pressed={isActive}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className={[
                                      'flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset',
                                      isActive ? 'bg-white/10 ring-white/10' : 'bg-slate-50 ring-slate-200',
                                    ].join(' ')}>
                                      <Icon className="h-5 w-5" />
                                    </div>
                                    <div className={[
                                      'flex h-7 w-7 items-center justify-center rounded-full border transition-all',
                                      isActive
                                        ? 'border-white/18 bg-white text-slate-950'
                                        : 'border-slate-300 bg-white text-transparent',
                                    ].join(' ')}>
                                      <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                  </div>

                                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-current/12 bg-current/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                                    {isActive ? 'Optiune selectata' : 'Click pentru selectare'}
                                  </div>

                                  <p className="mt-4 text-base font-semibold">{option.label}</p>
                                  <p className={['mt-2 text-sm leading-6', isActive ? 'text-white/72' : 'text-slate-500'].join(' ')}>
                                    {option.description}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </section>

                <section className="space-y-5 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8ff_100%)] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)] sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-[1.25rem] font-semibold tracking-[-0.03em] text-slate-950">Identitate juridica</h3>
                      <p className="text-sm text-slate-600">Completezi datele firmei sau ale PFA-ului clar, din primul pas.</p>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="companyTaxId"
                    render={({ field }) => (
                      <FormItem className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <FormLabel className="text-[1.05rem] font-semibold text-slate-950">CUI / CIF</FormLabel>
                            <FormDescription className="mt-1 text-sm leading-6 text-slate-600">
                              Scrii codul fiscal, apoi preluam automat denumirea legala, numarul de inregistrare si adresa firmei sau a PFA-ului.
                            </FormDescription>
                          </div>
                          <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700">
                            Pas esential
                          </span>
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                          <div>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={entityType === 'pfa' ? 'Ex: 12345678' : 'Ex: RO12345678'}
                                className="h-14 rounded-[18px] border-slate-200 bg-slate-50 text-base"
                              />
                            </FormControl>
                            <FormMessage />
                          </div>

                          <div className="lg:min-w-[320px]">
                            <Button
                              type="button"
                              onClick={handleCompanyLookup}
                              disabled={isLookupLoading || !companyTaxIdValue?.trim()}
                              className={[
                                'h-14 w-full rounded-[18px] border-0 bg-[linear-gradient(135deg,#0f172a,#21407a)] px-6 text-base font-semibold text-white shadow-[0_20px_48px_rgba(33,64,122,0.28)] transition-all hover:scale-[1.01] hover:opacity-95',
                                !isLookupLoading && companyTaxIdValue?.trim()
                                  ? 'animate-pulse'
                                  : '',
                                'disabled:cursor-not-allowed disabled:bg-[linear-gradient(135deg,#94a3b8,#cbd5e1)] disabled:text-white disabled:shadow-none disabled:animate-none',
                              ].join(' ')}
                            >
                              {isLookupLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Preluam datele...
                                </>
                              ) : (
                                <>
                                  <SearchCheck className="mr-2 h-4 w-4" />
                                  {entityType === 'pfa' ? 'Preia automat datele PFA-ului' : 'Preia automat datele firmei'}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {lookupFeedback ? (
                          <div
                            className={[
                              'mt-4 rounded-[18px] border px-4 py-3 text-sm leading-6',
                              lookupFeedback.tone === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : lookupFeedback.tone === 'error'
                                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                                  : 'border-sky-200 bg-sky-50 text-sky-700',
                            ].join(' ')}
                          >
                            {lookupFeedback.message}
                          </div>
                        ) : null}
                      </FormItem>
                    )}
                  />

                  <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-950">Vrei sa completezi datele manual?</p>
                        <p className="mt-1.5 text-sm leading-6 text-slate-600">
                          Daca vrei, poti ajusta sau completa manual informatiile juridice deja preluate.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowManualLegalFields((current) => !current)}
                        className="rounded-full border-slate-300 bg-white px-6 text-slate-700 hover:bg-slate-50"
                      >
                        {showManualLegalFields ? 'Ascunde campurile manuale' : 'Completeaza manual'}
                      </Button>
                    </div>
                  </div>

                  {showManualLegalFields ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="legalCompanyName"
                          render={({ field }) => (
                            <FormItem className="rounded-[26px] border-2 border-slate-200 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                              <FormLabel>Denumire legala</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={entityType === 'pfa' ? 'Ex: Popescu Elena PFA' : 'Ex: Nordia Homes SRL'} className="mt-3 h-12 rounded-2xl border-slate-200" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="tradeRegisterNumber"
                          render={({ field }) => (
                            <FormItem className="rounded-[26px] border-2 border-slate-200 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                              <FormLabel>Nr. registrul comertului</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={entityType === 'pfa' ? 'Ex: F40/1234/2024' : 'Ex: J40/1234/2024'} className="mt-3 h-12 rounded-2xl border-slate-200" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="legalRepresentative"
                          render={({ field }) => (
                            <FormItem className="rounded-[26px] border-2 border-slate-200 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                              <FormLabel>Reprezentant legal</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Ex: Elena Popescu" className="mt-3 h-12 rounded-2xl border-slate-200" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="registeredOffice"
                          render={({ field }) => (
                            <FormItem className="rounded-[26px] border-2 border-slate-200 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                              <FormLabel>Sediu social</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Ex: Str. Exemplu nr. 1, Bucuresti" className="mt-3 min-h-[112px] rounded-2xl border-slate-200" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  ) : null}
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f7ff_100%)] p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)] sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Cont nou
                      </p>
                      <h4 className="mt-2 text-xl font-semibold text-slate-950">
                        Creeaza contul si porneste configurarea agentiei tale.
                      </h4>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                        Completezi rapid datele esentiale, iar apoi poti continua cu setarea
                        agentiei, echipei si modului in care vrei sa lucrezi in platforma.
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                      <span className="font-semibold text-slate-950">Configurezi usor:</span> cont, date firma si preferinte
                      <br />
                      <span className="font-semibold text-slate-950">Incepi clar:</span> totul este organizat intr-un singur loc
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
                          Cream contul...
                        </>
                      ) : (
                        <>
                          Creeaza contul
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
                      Continuă cu Google
                    </Button>

                    <p className="text-center text-sm text-slate-500">
                      Ai deja cont?{' '}
                      <Link href="/login" className="font-medium text-slate-950 underline underline-offset-4">
                        Autentifica-te
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
