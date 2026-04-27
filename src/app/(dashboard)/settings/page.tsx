'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, updateDocumentNonBlocking, useStorage, useUser } from '@/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Camera, Globe, Building2, ShieldCheck, BriefcaseBusiness, UserRound, Palette } from 'lucide-react';
import Link from 'next/link';
import { useAgency } from '@/context/AgencyContext';
import { DesktopAppCard } from '@/components/settings/DesktopAppCard';
import { PushNotificationsCard } from '@/components/settings/PushNotificationsCard';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateEmail, updateProfile } from 'firebase/auth';
import { DEFAULT_THEME_PRESET, applyAgencyThemeToRoot, THEME_PRESET_OPTIONS } from '@/lib/theme';
import { locations, type City } from '@/lib/locations';

const profileSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu.'),
  email: z.string().email('Adresă de email invalidă.'),
  phone: z.string().optional(),
});

const agencySchema = z.object({
  name: z.string().min(1, 'Numele agenției este obligatoriu.'),
  agencyDescription: z.string().optional(),
  legalCompanyName: z.string().optional(),
  companyTaxId: z.string().optional(),
  tradeRegisterNumber: z.string().optional(),
  registeredOffice: z.string().optional(),
  legalRepresentative: z.string().optional(),
  termsAndConditions: z.string().optional(),
  privacyPolicy: z.string().optional(),
  customDomain: z.string().optional(),
  city: z.string().optional(),
  email: z.string().email('Adresă de email invalidă.').or(z.literal('')).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().url('URL invalid.').or(z.literal('')).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Culoarea trebuie să fie în format hex (ex: #22c55e).').optional(),
  themePreset: z.enum(['classic', 'forest', 'agentfinder']).optional(),
  facebookUrl: z.string().url('URL invalid.').or(z.literal('')).optional(),
  instagramUrl: z.string().url('URL invalid.').or(z.literal('')).optional(),
  linkedinUrl: z.string().url('URL invalid.').or(z.literal('')).optional(),
});

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, agency, isAgencyLoading } = useAgency();

  const [isCreatingAgency, setIsCreatingAgency] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [profileAutosaveState, setProfileAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [agencyIdentityAutosaveState, setAgencyIdentityAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSyncedPublicAgentRef = useRef(false);
  const profileAutosaveReadyRef = useRef(false);
  const agencyAutosaveReadyRef = useRef(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', phone: '' },
  });

  const agencyForm = useForm<z.infer<typeof agencySchema>>({
    resolver: zodResolver(agencySchema),
    defaultValues: { 
        name: '', 
        agencyDescription: '',
        legalCompanyName: '',
        companyTaxId: '',
        tradeRegisterNumber: '',
        registeredOffice: '',
        legalRepresentative: '',
        termsAndConditions: '',
        privacyPolicy: '',
        customDomain: '',
        city: '',
        email: '', 
        phone: '', 
        address: '', 
        logoUrl: '', 
        primaryColor: '#22c55e',
        themePreset: DEFAULT_THEME_PRESET,
        facebookUrl: '',
        instagramUrl: '',
        linkedinUrl: '',
    },
  });

  const watchedProfileName = useWatch({ control: profileForm.control, name: 'name' });
  const watchedProfileEmail = useWatch({ control: profileForm.control, name: 'email' });
  const watchedProfilePhone = useWatch({ control: profileForm.control, name: 'phone' });
  const watchedAgencyName = useWatch({ control: agencyForm.control, name: 'name' });
  const watchedAgencyThemePreset = useWatch({ control: agencyForm.control, name: 'themePreset' });
  const watchedAgencyPrimaryColor = useWatch({ control: agencyForm.control, name: 'primaryColor' });

  useEffect(() => {
    if (userProfile) {
      profileForm.reset({ 
        name: userProfile.name,
        email: userProfile.email || user?.email || '',
        phone: userProfile.phone || '',
      });
    } else if (user) {
      profileForm.reset({ name: user.displayName || '', email: user.email || '', phone: user.phoneNumber || '' });
    }
  }, [userProfile, user, profileForm]);

  useEffect(() => {
    if (agency) {
        agencyForm.reset({
            name: agency.name,
            agencyDescription: agency.agencyDescription || '',
            legalCompanyName: agency.legalCompanyName || '',
            companyTaxId: agency.companyTaxId || '',
            tradeRegisterNumber: agency.tradeRegisterNumber || '',
            registeredOffice: agency.registeredOffice || '',
            legalRepresentative: agency.legalRepresentative || '',
            termsAndConditions: agency.termsAndConditions || '',
            privacyPolicy: agency.privacyPolicy || '',
            customDomain: agency.customDomain || '',
            city: agency.city || '',
            email: agency.email || '',
            phone: agency.phone || '',
            address: agency.address || '',
            logoUrl: agency.logoUrl || '',
            primaryColor: agency.primaryColor || '#22c55e',
            themePreset: agency.themePreset || DEFAULT_THEME_PRESET,
            facebookUrl: agency.facebookUrl || '',
            instagramUrl: agency.instagramUrl || '',
            linkedinUrl: agency.linkedinUrl || '',
        });
    }
  }, [agency, agencyForm]);

  useEffect(() => {
    if (!user || !agency?.id || hasSyncedPublicAgentRef.current) return;
    hasSyncedPublicAgentRef.current = true;

    syncPublicAgentProfile({
      name: userProfile?.name || user.displayName || '',
      email: user.email || userProfile?.email || '',
      phone: userProfile?.phone || user.phoneNumber || '',
      photoUrl: userProfile?.photoUrl || user.photoURL || '',
    }).catch((error) => {
      console.error('Failed to sync public agent profile:', error);
      hasSyncedPublicAgentRef.current = false;
    });
  }, [agency?.id, user, userProfile]);

  const syncPublicAgentProfile = async (overrides?: Partial<UserProfile>) => {
    if (!user || !agency?.id) return;

    const publicAgentProfileRef = doc(firestore, 'publicAgentProfiles', user.uid);
    const nextProfile = {
      agencyId: agency.id,
      name: overrides?.name ?? profileForm.getValues('name') ?? userProfile?.name ?? user.displayName ?? '',
      email: overrides?.email ?? profileForm.getValues('email') ?? user.email ?? userProfile?.email ?? '',
      phone: overrides?.phone ?? profileForm.getValues('phone') ?? userProfile?.phone ?? '',
      photoUrl: overrides?.photoUrl ?? userProfile?.photoUrl ?? user.photoURL ?? '',
      updatedAt: new Date().toISOString(),
    };

    await setDoc(publicAgentProfileRef, nextProfile, { merge: true });
  };
  
  const handleProfileSave = async (values: z.infer<typeof profileSchema>, options?: { silent?: boolean }) => {
    if (!user) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    const normalizedEmail = values.email.trim();
    const dataToSave = { ...values, email: normalizedEmail };
    updateDocumentNonBlocking(userDocRef, dataToSave);
    if(user.displayName !== values.name) {
      updateProfile(user, { displayName: values.name });
    }
    if ((user.email || '') !== normalizedEmail) {
      await updateEmail(user, normalizedEmail);
    }
    await syncPublicAgentProfile({
      name: values.name,
      email: normalizedEmail,
      phone: values.phone,
      photoUrl: userProfile?.photoUrl || user.photoURL || undefined,
    });
    if (!options?.silent) {
      toast({ title: 'Profil salvat!', description: 'Informațiile profilului tău au fost actualizate.' });
    }
  };
  
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    toast({ title: 'Încărcare fotografie...', description: 'Acest proces poate dura câteva momente.' });

    try {
        const resizedBlob = await new Promise<Blob>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 512;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Could not get canvas context'));
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas to blob failed'));
                    }, 'image/jpeg', 0.8);
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });

        const photoRef = ref(storage, `users/${user.uid}/profile.jpg`);
        await uploadBytes(photoRef, resizedBlob);
        const photoURL = await getDownloadURL(photoRef);

        await updateProfile(user, { photoURL });

        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDocumentNonBlocking(userDocRef, { photoUrl: photoURL });
        await syncPublicAgentProfile({ photoUrl: photoURL });

        toast({ title: 'Fotografie actualizată!', description: 'Noua ta fotografie de profil a fost salvată.' });
    } catch (error) {
        console.error("Photo upload failed:", error);
        toast({ variant: 'destructive', title: 'Eroare la încărcare', description: 'Nu am putut salva fotografia. Încearcă din nou.' });
    } finally {
        setIsUploading(false);
    }
  };

  const normalizeAgencyFormValues = (values: z.infer<typeof agencySchema>) => ({
    name: values.name || '',
    agencyDescription: values.agencyDescription || '',
    legalCompanyName: values.legalCompanyName || '',
    companyTaxId: values.companyTaxId || '',
    tradeRegisterNumber: values.tradeRegisterNumber || '',
    registeredOffice: values.registeredOffice || '',
    legalRepresentative: values.legalRepresentative || '',
    termsAndConditions: values.termsAndConditions || '',
    privacyPolicy: values.privacyPolicy || '',
    customDomain: values.customDomain || '',
    city: values.city || '',
    email: values.email || '',
    phone: values.phone || '',
    address: values.address || '',
    logoUrl: values.logoUrl || '',
    primaryColor: values.primaryColor || '#22c55e',
    themePreset: values.themePreset || DEFAULT_THEME_PRESET,
    facebookUrl: values.facebookUrl || '',
    instagramUrl: values.instagramUrl || '',
    linkedinUrl: values.linkedinUrl || '',
  });

  const handleAgencySave = async (values: z.infer<typeof agencySchema>, options?: { silent?: boolean }) => {
    if (!agency?.id) return;
    const normalizedValues = normalizeAgencyFormValues(values);
    const nextValues = {
      ...normalizedValues,
      customDomain: agency.customDomain || '',
      customDomainStatus: agency.customDomainStatus,
      customDomainAliases: agency.customDomainAliases || [],
      customDomainResourceNames: agency.customDomainResourceNames || [],
      customDomainLastCheckedAt: agency.customDomainLastCheckedAt,
    };

    try {
      const agencyDocRef = doc(firestore, 'agencies', agency.id);
      updateDocumentNonBlocking(agencyDocRef, nextValues);

      if (!options?.silent) {
        toast({ title: 'Setări salvate!', description: 'Setările agenției tale au fost actualizate.' });
      }
    } catch (error) {
      console.error('Failed to save custom domain settings:', error);
      toast({ variant: 'destructive', title: 'Eroare', description: 'Nu am putut salva setările domeniului custom.' });
    }
  };

  const handleCreateAgency = async (values: z.infer<typeof agencySchema>) => {
      if (!user) return;
      setIsCreatingAgency(true);

      const agenciesCollection = collection(firestore, 'agencies');
      const userDocRef = doc(firestore, 'users', user.uid);
      const publicAgentProfileRef = doc(firestore, 'publicAgentProfiles', user.uid);

      try {
        const newAgencyRef = doc(agenciesCollection);
        const batch = writeBatch(firestore);

        batch.set(newAgencyRef, {
            ...values,
            ownerId: user.uid,
            agentIds: [user.uid],
            id: newAgencyRef.id,
        });
        
        batch.set(userDocRef, { 
            name: user.displayName || user.email,
            email: user.email,
            agencyId: newAgencyRef.id, 
            role: 'admin',
            photoUrl: user.photoURL,
        }, { merge: true });
        batch.set(publicAgentProfileRef, {
            agencyId: newAgencyRef.id,
            name: user.displayName || user.email,
            email: user.email,
            phone: user.phoneNumber || '',
            photoUrl: user.photoURL || '',
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        await batch.commit();
        
        toast({ title: 'Agenție creată!', description: `Bun venit la ${values.name}!` });
      } catch (error) {
          console.error("Failed to create agency:", error);
          toast({ variant: 'destructive', title: 'Creare eșuată', description: 'Nu am putut crea agenția.' });
      } finally {
          setIsCreatingAgency(false);
      }
  }

  useEffect(() => {
    if (!user || !userProfile) return;

    const initialName = userProfile.name || user.displayName || '';
    const initialEmail = userProfile.email || user.email || '';
    const initialPhone = userProfile.phone || user.phoneNumber || '';

    if (!profileAutosaveReadyRef.current) {
      if (
        watchedProfileName === initialName &&
        watchedProfileEmail === initialEmail &&
        watchedProfilePhone === initialPhone
      ) {
        profileAutosaveReadyRef.current = true;
      }
      return;
    }

    if (
      watchedProfileName === initialName &&
      watchedProfileEmail === initialEmail &&
      watchedProfilePhone === initialPhone
    ) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setProfileAutosaveState('saving');
        await handleProfileSave({
          name: watchedProfileName || '',
          email: watchedProfileEmail || '',
          phone: watchedProfilePhone || '',
        }, { silent: true });
        setProfileAutosaveState('saved');
      } catch (error) {
        console.error('Profile autosave failed:', error);
        setProfileAutosaveState('error');
      }
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [user, userProfile, watchedProfileEmail, watchedProfileName, watchedProfilePhone]);

  useEffect(() => {
    if (!agency?.id) return;
    const initialAgencyName = agency.name || '';

    if (!agencyAutosaveReadyRef.current) {
      if (watchedAgencyName === initialAgencyName) {
        agencyAutosaveReadyRef.current = true;
      }
      return;
    }

    if (watchedAgencyName === initialAgencyName) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        setAgencyIdentityAutosaveState('saving');
        await handleAgencySave(agencyForm.getValues(), { silent: true });
        setAgencyIdentityAutosaveState('saved');
      } catch (error) {
        console.error('Agency autosave failed:', error);
        setAgencyIdentityAutosaveState('error');
      }
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [agency, agencyForm, watchedAgencyName]);

  useEffect(() => {
    applyAgencyThemeToRoot(document.documentElement, {
      themePreset: watchedAgencyThemePreset || agency?.themePreset || DEFAULT_THEME_PRESET,
      primaryColor: watchedAgencyPrimaryColor || agency?.primaryColor || '#22c55e',
    });
  }, [agency?.primaryColor, agency?.themePreset, watchedAgencyPrimaryColor, watchedAgencyThemePreset]);
  
  if (!isAgencyLoading && !agency) {
      return (
          <div className="agentfinder-settings-page min-h-full bg-[var(--app-shell-bg)] px-4 py-10 text-white">
              <Card className="agentfinder-settings-card mx-auto w-full max-w-lg border border-white/10 [background:var(--app-surface-elevated)] text-white shadow-2xl shadow-black/30">
                <Form {...agencyForm}>
                    <form onSubmit={agencyForm.handleSubmit(handleCreateAgency)}>
                        <CardHeader className="space-y-4">
                            <Badge className="w-fit rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-100">Primul pas</Badge>
                            <div className="space-y-2">
                              <CardTitle className="text-3xl text-white">Creează-ți agenția</CardTitle>
                              <CardDescription className="text-white/70">Începem simplu: nume și culoare principală. Restul personalizărilor le poți face imediat după.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={agencyForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nume Agenție</FormLabel><FormControl><Input {...field} placeholder="Numele agenției tale" className="border-white/15 bg-white/10 text-white placeholder:text-white/45" /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={agencyForm.control} name="primaryColor" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Culoare Primară</FormLabel><FormControl><Input type="color" {...field} className="h-11 w-28 rounded-xl border border-white/10 bg-white/10 p-1" /></FormControl><FormMessage /></FormItem> )}/>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isCreatingAgency} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                                {isCreatingAgency && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Creează Agenția și Continuă
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
              </Card>
          </div>
      )
  }

  if (isAgencyLoading) {
    return (
      <div className="agentfinder-settings-page space-y-8 bg-[var(--app-shell-bg)] px-4 py-6 text-white md:px-6">
        <div className="agentfinder-settings-hero rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_42%),linear-gradient(180deg,_rgba(21,42,71,0.98)_0%,_rgba(11,24,41,1)_100%)] p-6">
          <Skeleton className="mb-3 h-6 w-32 bg-white/15" />
          <Skeleton className="mb-2 h-10 w-80 bg-white/15" />
          <Skeleton className="h-4 w-full max-w-xl bg-white/10" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="agentfinder-settings-card border border-white/10 bg-[var(--app-surface-solid)] text-white"><CardHeader><Skeleton className="h-6 w-1/2 bg-white/15" /></CardHeader><CardContent><div className="space-y-4"><Skeleton className="h-24 w-24 rounded-full bg-white/10" /><Skeleton className="h-10 bg-white/10" /><Skeleton className="h-10 bg-white/10" /><Skeleton className="h-24 bg-white/10" /></div></CardContent></Card>
          <Card className="agentfinder-settings-card border border-white/10 bg-[var(--app-surface-solid)] text-white"><CardHeader><Skeleton className="h-6 w-1/3 bg-white/15" /></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-10 bg-white/10" /><Skeleton className="h-10 bg-white/10" /><Skeleton className="h-10 bg-white/10" /><Skeleton className="h-10 bg-white/10" /><Skeleton className="h-28 md:col-span-2 bg-white/10" /><Skeleton className="h-28 md:col-span-2 bg-white/10" /></div></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="agentfinder-settings-page bg-[var(--app-shell-bg)] px-4 py-6 text-[var(--app-page-foreground)] md:px-6">
      <div className="agentfinder-form mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="agentfinder-settings-hero space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border border-[var(--app-surface-border)] bg-[var(--app-surface-soft)] px-3 py-1 text-[var(--app-page-foreground)]">Setări</Badge>
            <Badge className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-100">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              {userProfile?.role ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1) : 'Indisponibil'}
            </Badge>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-page-foreground)] md:text-3xl">Setările contului și ale agenției</h1>
            <p className="mt-1 text-sm text-[var(--app-page-muted)] md:text-base">O vedere unitară pentru profilul agentului, datele firmei, website-ul public și branding.</p>
          </div>
        </header>

        <Card className="agentfinder-settings-card agentfinder-surface overflow-hidden rounded-[32px] border border-[var(--app-surface-border)] bg-[var(--app-surface-elevated)] text-[var(--app-page-foreground)] shadow-2xl shadow-black/25">
          <CardContent className="p-6 md:p-7">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
              <div className="relative w-fit">
                <Avatar className="h-28 w-28 border border-[var(--app-surface-border)] bg-[var(--app-surface-soft)] md:h-32 md:w-32">
                  <AvatarImage src={userProfile?.photoUrl || user?.photoURL || undefined} alt={userProfile?.name} />
                  <AvatarFallback className="bg-[var(--app-surface-soft)] text-4xl">{userProfile?.name?.charAt(0) || user?.email?.charAt(0)}</AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  size="icon"
                  className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary hover:bg-primary/90"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png, image/jpeg"
                  onChange={handlePhotoUpload}
                />
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <p className="text-sm text-white/55">Profil agent</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-white">{profileForm.watch('name') || user?.displayName || 'Profil agent'}</p>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                      Completează detaliile agentului direct în cardurile de mai jos. Modificările se salvează automat.
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white/50">Rol</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {userProfile?.role ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1) : 'Indisponibil'}
                        </p>
                        <p className="mt-1 text-xs text-white/45">Nivelul tău curent de acces în platformă.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white/50">Agenție</p>
                        <p className="mt-2 text-lg font-semibold text-white">{agency?.name || 'Fără nume'}</p>
                        <p className="mt-1 text-xs text-white/45">Organizația la care este conectat acest profil.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/50">Nume agent</p>
                    <Input
                      value={profileForm.watch('name') || ''}
                      onChange={(event) => profileForm.setValue('name', event.target.value, { shouldDirty: true, shouldValidate: true })}
                      className="mt-3 h-11 border-white/10 bg-white/10 text-white placeholder:text-white/35"
                      placeholder="Nume agent"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/50">Număr de telefon</p>
                    <Input
                      value={profileForm.watch('phone') || ''}
                      onChange={(event) => profileForm.setValue('phone', event.target.value, { shouldDirty: true, shouldValidate: true })}
                      className="mt-3 h-11 border-white/10 bg-white/10 text-white placeholder:text-white/35"
                      placeholder="+40 123 456 789"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/50">Adresă de email</p>
                    <Input
                      type="email"
                      value={profileForm.watch('email') || ''}
                      onChange={(event) => profileForm.setValue('email', event.target.value, { shouldDirty: true, shouldValidate: true })}
                      className="mt-3 h-11 border-white/10 bg-white/10 text-white placeholder:text-white/35"
                      placeholder="email@agentie.ro"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                    <BriefcaseBusiness className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/50">Nume agenție</p>
                    <Input
                      value={agencyForm.watch('name') || ''}
                      onChange={(event) => agencyForm.setValue('name', event.target.value, { shouldDirty: true, shouldValidate: true })}
                      className="mt-3 h-11 border-white/10 bg-white/10 text-white placeholder:text-white/35"
                      placeholder="Nume agenție"
                    />
                  </div>
                </div>
              </div>
            </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-6 xl:sticky xl:top-6">
                <Card className="agentfinder-settings-card agentfinder-surface rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--app-surface-elevated)] text-[var(--app-page-foreground)] shadow-2xl shadow-black/25">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">Autosave profil agent</p>
                          <p className="mt-1 text-sm text-white/65">
                            {profileAutosaveState === 'saving'
                              ? 'Se salvează modificările agentului...'
                              : profileAutosaveState === 'saved'
                                ? 'Modificările agentului au fost salvate automat.'
                                : profileAutosaveState === 'error'
                                  ? 'Nu am putut salva automat modificările agentului.'
                                  : 'Modificările din cardurile de sus se salvează automat.'}
                          </p>
                          <p className="mt-2 text-xs text-white/50">
                            {agencyIdentityAutosaveState === 'saving'
                              ? 'Se salvează și numele agenției...'
                              : agencyIdentityAutosaveState === 'saved'
                                ? 'Numele agenției este sincronizat.'
                                : agencyIdentityAutosaveState === 'error'
                                  ? 'Numele agenției nu a putut fi salvat automat.'
                                  : 'Numele agenției din cardul de sus se salvează automat.'}
                          </p>
                        </div>
                        <Badge className={cn(
                          "rounded-full px-3 py-1",
                          profileAutosaveState === 'saving' && 'bg-amber-400/15 text-amber-100',
                          profileAutosaveState === 'saved' && 'bg-emerald-400/15 text-emerald-100',
                          profileAutosaveState === 'error' && 'bg-rose-400/15 text-rose-100',
                          profileAutosaveState === 'idle' && 'bg-white/10 text-white/80'
                        )}>
                          {profileAutosaveState === 'saving' ? 'Se salvează' : profileAutosaveState === 'saved' ? 'Salvat' : profileAutosaveState === 'error' ? 'Eroare' : 'Activ'}
                        </Badge>
                      </div>
                    </CardContent>
                </Card>
                <DesktopAppCard />
                <PushNotificationsCard />
            </div>
            <div className="space-y-6">
                 <Card className="agentfinder-settings-card agentfinder-surface overflow-hidden rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--app-surface-elevated)] text-[var(--app-page-foreground)] shadow-2xl shadow-black/25">
                    <Form {...agencyForm}>
                    <form onSubmit={agencyForm.handleSubmit((values) => handleAgencySave(values))}>
                        <CardHeader className="border-b border-[var(--app-surface-border)] bg-[var(--app-surface-soft)]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-200">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-2xl text-white">Setări agenție</CardTitle>
                              <CardDescription className="mt-1 text-white/65">Am împărțit informațiile în grupuri mai clare, ca să găsești mai repede ce ai de modificat.</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-8 p-6">
                          <div className="grid gap-6 xl:grid-cols-2">

                            <div className="order-2 space-y-5 xl:order-2 xl:col-span-2">
                              <section className="agentfinder-surface space-y-5 rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--app-surface-elevated)] p-5 shadow-2xl shadow-black/20 md:p-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                  <div className="space-y-2">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white/75">
                                      <Globe className="h-3.5 w-3.5" />
                                      Website public
                                    </div>
                                    <div className="space-y-1">
                                      <h4 className="text-xl font-semibold text-white">Identitate publică</h4>
                                      <p className="max-w-2xl text-sm text-white/65">Tot ce apare în site-ul agenției și în paginile publice principale.</p>
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/72">
                                    Numele și descrierea de aici controlează prima impresie din website-ul agenției.
                                  </div>
                                </div>
                                <div className="grid gap-4">
                                  <FormField control={agencyForm.control} name="name" render={({ field }) => ( <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"><FormLabel className="text-white">Nume agenție</FormLabel><FormDescription className="text-white/60">Apare în header, în paginile publice și în zonele principale de branding.</FormDescription><FormControl><Input {...field} className="mt-3 border-white/14 bg-white/10 text-white placeholder:text-white/40" /></FormControl><FormMessage /></FormItem> )}/>
                                  <FormField control={agencyForm.control} name="agencyDescription" render={({ field }) => ( <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"><FormLabel className="text-white">Descriere agenție</FormLabel><FormDescription className="text-white/60">Textul principal din secțiunea publică „Despre Noi”.</FormDescription><FormControl><Textarea rows={5} {...field} placeholder="Povestea, misiunea și valorile agenției tale..." className="mt-3 border-white/14 bg-white/10 text-white placeholder:text-white/40"/></FormControl><FormMessage /></FormItem> )}/>
                                </div>
                              </section>

                              <section className="agentfinder-soft space-y-5 rounded-[24px] border border-[var(--app-surface-border)] bg-[var(--app-surface-soft)] p-5 md:p-6">
                                <div className="space-y-1">
                                  <h4 className="text-lg font-semibold text-white">Domeniu și pagini legale</h4>
                                  <p className="text-sm text-white/65">Setările care influențează website-ul public și informațiile legale afișate acolo.</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-2">
                                      <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-200">
                                        <Globe className="h-4 w-4" />
                                        Domeniu custom website public
                                      </div>
                                      <p className="text-sm leading-7 text-white/70">
                                        Configurarea completă a domeniului custom se face din pagina dedicată, unde ai status și instrucțiuni separate.
                                      </p>
                                    </div>
                                    <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                                      <Link href="/custom-domain">Deschide pagina dedicată</Link>
                                    </Button>
                                  </div>
                                </div>
                                <FormField control={agencyForm.control} name="termsAndConditions" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Termeni și condiții</FormLabel><FormControl><Textarea rows={10} {...field} placeholder="Introdu textul pentru pagina publică Termeni și condiții..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormDescription className="text-white/70">Acest text va fi afișat în pagina publică "Termeni și condiții".</FormDescription><FormMessage /></FormItem> )}/>
                                <FormField control={agencyForm.control} name="privacyPolicy" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Clauze suplimentare pentru confidențialitate</FormLabel><FormControl><Textarea rows={8} {...field} placeholder="Introdu mențiuni suplimentare pentru pagina de confidențialitate..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormDescription className="text-white/70">Pagina de confidențialitate este generată automat din datele companiei. Acest câmp adaugă informații suplimentare.</FormDescription><FormMessage /></FormItem> )}/>
                              </section>
                            </div>

                            <div className="order-1 space-y-5 xl:order-1 xl:col-span-2">
                              <section className="agentfinder-surface space-y-6 rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--app-surface-elevated)] p-5 text-[var(--app-page-foreground)] shadow-2xl shadow-black/25 md:p-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                  <div className="space-y-1">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                                      <BriefcaseBusiness className="h-3.5 w-3.5" />
                                      Companie
                                    </div>
                                    <h4 className="text-xl font-semibold text-white">Date firmă</h4>
                                    <p className="max-w-2xl text-sm text-white/68">Informațiile juridice folosite în paginile publice și în identificarea oficială a agenției.</p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/72">
                                    Completează acest bloc ca bază pentru legal, contact și website public.
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                  <FormField control={agencyForm.control} name="legalCompanyName" render={({ field }) => ( <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-white/15 hover:bg-white/[0.06]"><FormLabel className="text-white">Denumire legală</FormLabel><FormDescription className="text-white/62">Va fi afișată automat în pagina publică de confidențialitate.</FormDescription><FormControl><Input {...field} placeholder="Ex: Nordia Homes SRL" className="mt-3 !border-white/14 !bg-white/10 !text-white placeholder:!text-white/40" /></FormControl><FormMessage /></FormItem> )}/>
                                  <FormField control={agencyForm.control} name="companyTaxId" render={({ field }) => ( <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-white/15 hover:bg-white/[0.06]"><FormLabel className="text-white">CUI</FormLabel><FormDescription className="text-white/62">Codul unic de identificare al agenției.</FormDescription><FormControl><Input {...field} placeholder="Ex: RO12345678" className="mt-3 !border-white/14 !bg-white/10 !text-white placeholder:!text-white/40" /></FormControl><FormMessage /></FormItem> )}/>
                                  <FormField control={agencyForm.control} name="tradeRegisterNumber" render={({ field }) => ( <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-white/15 hover:bg-white/[0.06]"><FormLabel className="text-white">Nr. înregistrare Registrul Comerțului</FormLabel><FormDescription className="text-white/62">Numărul de înregistrare al agenției.</FormDescription><FormControl><Input {...field} placeholder="Ex: J40/1234/2024" className="mt-3 !border-white/14 !bg-white/10 !text-white placeholder:!text-white/40" /></FormControl><FormMessage /></FormItem> )}/>
                                  <FormField control={agencyForm.control} name="legalRepresentative" render={({ field }) => ( <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-white/15 hover:bg-white/[0.06]"><FormLabel className="text-white">Reprezentant legal</FormLabel><FormDescription className="text-white/62">Numele reprezentantului legal al agenției.</FormDescription><FormControl><Input {...field} placeholder="Ex: Elena Popescu" className="mt-3 !border-white/14 !bg-white/10 !text-white placeholder:!text-white/40" /></FormControl><FormMessage /></FormItem> )}/>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                  <FormField control={agencyForm.control} name="registeredOffice" render={({ field }) => ( <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-white/15 hover:bg-white/[0.06]"><FormLabel className="text-white">Sediu social</FormLabel><FormDescription className="text-white/62">Adresa juridică ce va apărea în pagina de confidențialitate.</FormDescription><FormControl><Input {...field} placeholder="Ex: Str. Exemplu nr. 1, București" className="mt-3 !border-white/14 !bg-white/10 !text-white placeholder:!text-white/40" /></FormControl><FormMessage /></FormItem> )}/>
                                </div>
                                <div className="border-t border-white/10 pt-5">
                                  <div className="mb-4 space-y-1">
                                    <h5 className="text-base font-semibold text-white">Contact firmă</h5>
                                    <p className="text-sm text-white/60">Datele prin care clienții pot lua legătura cu agenția.</p>
                                  </div>
                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <FormField control={agencyForm.control} name="city" render={({ field }) => (
                                      <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-white/15 hover:bg-white/[0.06]">
                                        <FormLabel className="text-white">Oras de lucru pentru scraping</FormLabel>
                                        <FormControl>
                                          <Select onValueChange={field.onChange} value={field.value || ''}>
                                            <SelectTrigger className="mt-3 !border-white/14 !bg-white/10 !text-white">
                                              <SelectValue placeholder="Alege orasul" />
                                            </SelectTrigger>
                                            <SelectContent className="border-white/10 bg-[var(--app-surface-solid)] text-white">
                                              {(Object.keys(locations) as City[]).map((city) => (
                                                <SelectItem key={city} value={city} className="focus:bg-white/10 focus:text-white">
                                                  {city}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </FormControl>
                                        <FormDescription className="text-white/62">
                                          Momentan acest camp este folosit pentru owner listings doar pe Bucuresti-Ilfov, pe baza linkurilor dedicate de scraping.
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}/>
                                    <FormField control={agencyForm.control} name="email" render={({ field }) => ( <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-white/15 hover:bg-white/[0.06]"><FormLabel className="text-white">Email contact</FormLabel><FormControl><Input {...field} placeholder="contact@agentie.ro" className="mt-3 !border-white/14 !bg-white/10 !text-white placeholder:!text-white/40" /></FormControl><FormMessage /></FormItem> )}/>
                                    <FormField control={agencyForm.control} name="phone" render={({ field }) => ( <FormItem className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-white/15 hover:bg-white/[0.06]"><FormLabel className="text-white">Telefon contact</FormLabel><FormControl><Input {...field} placeholder="+40 123 456 789" className="mt-3 !border-white/14 !bg-white/10 !text-white placeholder:!text-white/40" /></FormControl><FormMessage /></FormItem> )}/>
                                  </div>
                                </div>
                              </section>
                            </div>

                            <div className="order-3 space-y-5 xl:order-3 xl:col-span-2">
                              <section className="agentfinder-soft space-y-5 rounded-[24px] border border-[var(--app-surface-border)] bg-[var(--app-surface-soft)] p-5 md:p-6">
                                <div className="space-y-1">
                                  <h4 className="text-lg font-semibold text-white">Identitate vizuală</h4>
                                  <p className="text-sm text-white/65">Elementele care definesc vizual agenția în produs și în website-ul public.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                  <FormField control={agencyForm.control} name="logoUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">URL logo</FormLabel><FormControl><Input {...field} placeholder="https://..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                                  <FormField control={agencyForm.control} name="themePreset" render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-white/80">Tema aplicației</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                            <SelectValue placeholder="Alege tema" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="border-white/10 bg-[var(--app-surface-solid)] text-white">
                                          {THEME_PRESET_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value} className="focus:bg-white/10 focus:text-white">
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormDescription className="text-white/65">
                                        {THEME_PRESET_OPTIONS.find((option) => option.value === field.value)?.description}
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}/>
                                  <FormField control={agencyForm.control} name="primaryColor" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Culoare primară</FormLabel><FormControl><Input type="color" {...field} className="h-10 w-24 p-1" /></FormControl><FormMessage /></FormItem> )}/>
                                </div>
                              </section>

                              <section className="agentfinder-soft space-y-5 rounded-[24px] border border-[var(--app-surface-border)] bg-[var(--app-surface-soft)] p-5 md:p-6">
                                <div className="space-y-1">
                                  <h4 className="text-lg font-semibold text-white">Social media</h4>
                                  <p className="text-sm text-white/65">Linkurile oficiale ale agenției, afișate acolo unde este cazul.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                  <FormField control={agencyForm.control} name="facebookUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Facebook URL</FormLabel><FormControl><Input {...field} placeholder="https://facebook.com/agentie" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                                  <FormField control={agencyForm.control} name="instagramUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Instagram URL</FormLabel><FormControl><Input {...field} placeholder="https://instagram.com/agentie" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                                  <FormField control={agencyForm.control} name="linkedinUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">LinkedIn URL</FormLabel><FormControl><Input {...field} placeholder="https://linkedin.com/company/agentie" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                                </div>
                              </section>
                            </div>
                          </div>
                        <Button type="submit" disabled={agencyForm.formState.isSubmitting || userProfile?.role !== 'admin'} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">{agencyForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvează Setări Agenție</Button>
                        {userProfile?.role !== 'admin' && <p className="text-xs text-muted-foreground mt-2 text-white/70">Doar administratorii agenției pot modifica aceste setări.</p>}
                        </CardContent>
                    </form>
                    </Form>
                </Card>
            </div>
      </div>
      </div>
      
    </div>
  );
}
