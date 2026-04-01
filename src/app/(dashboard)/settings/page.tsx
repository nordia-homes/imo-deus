'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, useStorage } from '@/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import type { UserProfile, Agency } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Camera, Globe } from 'lucide-react';
import Link from 'next/link';
import { useAgency } from '@/context/AgencyContext';
import { AgentManagementCard } from '@/components/settings/AgentManagementCard';
import { PushNotificationsCard } from '@/components/settings/PushNotificationsCard';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';

const profileSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu.'),
  agentBio: z.string().optional(),
  phone: z.string().optional(),
});

const agencySchema = z.object({
  name: z.string().min(1, 'Numele agenției este obligatoriu.'),
  agencyDescription: z.string().optional(),
  legalCompanyName: z.string().optional(),
  companyTaxId: z.string().optional(),
  registeredOffice: z.string().optional(),
  legalRepresentative: z.string().optional(),
  termsAndConditions: z.string().optional(),
  privacyPolicy: z.string().optional(),
  customDomain: z.string().optional(),
  email: z.string().email('Adresă de email invalidă.').or(z.literal('')).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().url('URL invalid.').or(z.literal('')).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Culoarea trebuie să fie în format hex (ex: #22c55e).').optional(),
  facebookUrl: z.string().url('URL invalid.').or(z.literal('')).optional(),
  instagramUrl: z.string().url('URL invalid.').or(z.literal('')).optional(),
  linkedinUrl: z.string().url('URL invalid.').or(z.literal('')).optional(),
});

export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, agency, isAgencyLoading } = useAgency();

  const [isCreatingAgency, setIsCreatingAgency] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSyncedPublicAgentRef = useRef(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', agentBio: '', phone: '' },
  });

  const agencyForm = useForm<z.infer<typeof agencySchema>>({
    resolver: zodResolver(agencySchema),
    defaultValues: { 
        name: '', 
        agencyDescription: '',
        legalCompanyName: '',
        companyTaxId: '',
        registeredOffice: '',
        legalRepresentative: '',
        termsAndConditions: '',
        privacyPolicy: '',
        customDomain: '',
        email: '', 
        phone: '', 
        address: '', 
        logoUrl: '', 
        primaryColor: '#22c55e',
        facebookUrl: '',
        instagramUrl: '',
        linkedinUrl: '',
    },
  });

  useEffect(() => {
    if (userProfile) {
      profileForm.reset({ 
        name: userProfile.name,
        agentBio: userProfile.agentBio || '',
        phone: userProfile.phone || '',
      });
    } else if (user) {
      profileForm.reset({ name: user.displayName || '', phone: user.phoneNumber || '' });
    }
  }, [userProfile, user, profileForm]);

  useEffect(() => {
    if (agency) {
        agencyForm.reset({
            name: agency.name,
            agencyDescription: agency.agencyDescription || '',
            legalCompanyName: agency.legalCompanyName || '',
            companyTaxId: agency.companyTaxId || '',
            registeredOffice: agency.registeredOffice || '',
            legalRepresentative: agency.legalRepresentative || '',
            termsAndConditions: agency.termsAndConditions || '',
            privacyPolicy: agency.privacyPolicy || '',
            customDomain: agency.customDomain || '',
            email: agency.email || '',
            phone: agency.phone || '',
            address: agency.address || '',
            logoUrl: agency.logoUrl || '',
            primaryColor: agency.primaryColor || '#22c55e',
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
      email: overrides?.email ?? user.email ?? userProfile?.email ?? '',
      phone: overrides?.phone ?? profileForm.getValues('phone') ?? userProfile?.phone ?? '',
      photoUrl: overrides?.photoUrl ?? userProfile?.photoUrl ?? user.photoURL ?? '',
      updatedAt: new Date().toISOString(),
    };

    await setDoc(publicAgentProfileRef, nextProfile, { merge: true });
  };
  
  const handleProfileSave = async (values: z.infer<typeof profileSchema>) => {
    if (!user) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    const dataToSave = {
      ...values,
      email: user.email,
    };
    updateDocumentNonBlocking(userDocRef, dataToSave);
    if(user.displayName !== values.name) {
      updateProfile(user, { displayName: values.name });
    }
    await syncPublicAgentProfile({
      name: values.name,
      email: user.email || undefined,
      phone: values.phone,
      photoUrl: userProfile?.photoUrl || user.photoURL || undefined,
    });
    toast({ title: 'Profil salvat!', description: 'Informațiile profilului tău au fost actualizate.' });
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

  const handleAgencySave = async (values: z.infer<typeof agencySchema>) => {
    if (!agency?.id) return;
    const nextValues = {
      ...values,
      customDomain: agency.customDomain || '',
      customDomainStatus: agency.customDomainStatus,
      customDomainAliases: agency.customDomainAliases || [],
      customDomainResourceNames: agency.customDomainResourceNames || [],
      customDomainLastCheckedAt: agency.customDomainLastCheckedAt,
    };

    try {
      const agencyDocRef = doc(firestore, 'agencies', agency.id);
      updateDocumentNonBlocking(agencyDocRef, nextValues);

      toast({ title: 'Setări salvate!', description: 'Setările agenției tale au fost actualizate.' });
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
  
  if (!isAgencyLoading && !agency) {
      return (
          <div className="flex items-center justify-center min-h-full p-4">
              <Card className="w-full max-w-lg">
                <Form {...agencyForm}>
                    <form onSubmit={agencyForm.handleSubmit(handleCreateAgency)}>
                        <CardHeader>
                            <CardTitle>Bun venit la Imoflux!</CardTitle>
                            <CardDescription>Pentru a începe, creează-ți agenția. O poți personaliza mai târziu.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={agencyForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nume Agenție</FormLabel><FormControl><Input {...field} placeholder="Numele agenției tale" /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={agencyForm.control} name="primaryColor" render={({ field }) => ( <FormItem><FormLabel>Culoare Primară</FormLabel><FormControl><Input type="color" {...field} className="w-24 p-1 h-10" /></FormControl><FormMessage /></FormItem> )}/>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isCreatingAgency} className="w-full">
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
      <div className="space-y-8 p-4 bg-[#0F1E33] text-white">
        <div><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-72" /></div>
        <Card className="bg-[#152A47]"><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div></CardContent></Card>
        <Card className="bg-[#152A47]"><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 bg-[#0F1E33] text-white">
      <div><h1 className="text-3xl font-bold">Setări</h1><p className="text-white/70">Configurează setările contului și ale agenției.</p></div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            <div className="xl:col-span-1 space-y-8">
                <Card className="shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
                    <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(handleProfileSave)}>
                        <CardHeader><CardTitle className="text-white">Profilul Tău</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative group">
                                    <Avatar className="h-24 w-24 border-2 border-primary/50">
                                        <AvatarImage src={userProfile?.photoUrl || user?.photoURL || undefined} alt={userProfile?.name} />
                                        <AvatarFallback className="text-3xl bg-white/10">{userProfile?.name?.charAt(0) || user?.email?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <Button
                                        type="button"
                                        size="icon"
                                        className="absolute bottom-0 right-0 rounded-full h-8 w-8 bg-primary hover:bg-primary/90"
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
                            </div>
                        <FormField control={profileForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nume</FormLabel><FormControl><Input {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                        <div className="space-y-2"><Label htmlFor="email" className="text-white/80">Email</Label><Input id="email" type="email" value={user?.email || ''} disabled className="bg-white/10 border-white/20 text-white" /></div>
                        <FormField control={profileForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Telefon</FormLabel><FormControl><Input {...field} placeholder="+40 123 456 789" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={profileForm.control} name="agentBio" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Scurtă Biografie</FormLabel><FormControl><Textarea {...field} rows={3} placeholder="Descrie-te pe scurt ca agent imobiliar..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50"/></FormControl><FormDescription className="text-white/70">Biografia ta va fi afișată pe pagina publică "Despre Noi".</FormDescription><FormMessage /></FormItem> )}/>
                        <div className="space-y-2">
                            <Label className="text-white/80">Rol</Label>
                            <div>
                            {userProfile?.role ? (
                                <Badge variant={userProfile.role === 'admin' ? 'default' : 'secondary'} className={cn(userProfile.role !== 'admin' && 'bg-white/20 text-white border-none')}>{userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}</Badge>
                            ) : (
                                <Badge variant="outline">Indisponibil</Badge>
                            )}
                            </div>
                        </div>
                        <Button type="submit" disabled={profileForm.formState.isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">{profileForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvează Profil</Button>
                        </CardContent>
                    </form>
                    </Form>
                </Card>
                <PushNotificationsCard />
            </div>
            <div className="xl:col-span-2">
                 <Card className="shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
                    <Form {...agencyForm}>
                    <form onSubmit={agencyForm.handleSubmit(handleAgencySave)}>
                        <CardHeader><CardTitle className="text-white">Setări Agenție</CardTitle><CardDescription className="text-white/70">Personalizează informațiile și aspectul platformei pentru agenția ta.</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={agencyForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nume Agenție</FormLabel><FormControl><Input {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={agencyForm.control} name="agencyDescription" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Descriere Agenție (Despre Noi)</FormLabel><FormControl><Textarea rows={5} {...field} placeholder="Povestea, misiunea și valorile agenției tale..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50"/></FormControl><FormDescription className="text-white/70">Acest text va apărea pe pagina publică "Despre Noi".</FormDescription><FormMessage /></FormItem> )}/>
                            <Separator className="my-6 bg-white/10"/>

                            <h4 className="text-lg font-semibold text-white">Pagini legale publice</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={agencyForm.control} name="legalCompanyName" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Denumire legala</FormLabel><FormControl><Input {...field} placeholder="Ex: Nordia Homes SRL" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormDescription className="text-white/70">Va fi afisata automat in pagina publica de Confidentialitate.</FormDescription><FormMessage /></FormItem> )}/>
                                <FormField control={agencyForm.control} name="companyTaxId" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">CUI</FormLabel><FormControl><Input {...field} placeholder="Ex: RO12345678" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormDescription className="text-white/70">Codul unic de identificare al agentiei.</FormDescription><FormMessage /></FormItem> )}/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={agencyForm.control} name="registeredOffice" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Sediu social</FormLabel><FormControl><Input {...field} placeholder="Ex: Str. Exemplu nr. 1, Bucuresti" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormDescription className="text-white/70">Adresa juridica ce va aparea in pagina de Confidentialitate.</FormDescription><FormMessage /></FormItem> )}/>
                                <FormField control={agencyForm.control} name="legalRepresentative" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Reprezentant legal</FormLabel><FormControl><Input {...field} placeholder="Ex: Elena Popescu" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormDescription className="text-white/70">Numele reprezentantului legal al agentiei.</FormDescription><FormMessage /></FormItem> )}/>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-2">
                                        <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-200">
                                            <Globe className="h-4 w-4" />
                                            Domeniu custom website public
                                        </div>
                                        <p className="text-sm leading-7 text-white/70">
                                            Configurarea completa a domeniului custom se face acum din pagina dedicata, unde ai status, instructiuni si configurare separata.
                                        </p>
                                    </div>
                                    <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                                        <Link href="/custom-domain">Deschide pagina dedicata</Link>
                                    </Button>
                                </div>
                            </div>
                            <FormField control={agencyForm.control} name="customDomain" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Domeniu custom website public</FormLabel><FormControl><Input {...field} disabled placeholder="example.ro" className="bg-white/10 border-white/20 text-white placeholder:text-white/50 disabled:cursor-not-allowed disabled:opacity-70" /></FormControl><FormDescription className="text-white/70">Administrarea domeniului custom se face din pagina dedicata, unde poti vedea si instructiunile DNS exacte din Firebase App Hosting.</FormDescription><FormMessage /></FormItem> )}/>
                            <FormField control={agencyForm.control} name="termsAndConditions" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Termeni si conditii</FormLabel><FormControl><Textarea rows={10} {...field} placeholder="Introdu textul pentru pagina publica Termeni si conditii..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormDescription className="text-white/70">Acest text va fi afisat in pagina publica "Termeni si conditii" a agentiei.</FormDescription><FormMessage /></FormItem> )}/>
                            <FormField control={agencyForm.control} name="privacyPolicy" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Clauze suplimentare pentru Confidentialitate</FormLabel><FormControl><Textarea rows={8} {...field} placeholder="Introdu eventuale mentiuni suplimentare pe care vrei sa le adaugi la finalul paginii de Confidentialitate..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormDescription className="text-white/70">Pagina de Confidentialitate este generata automat din datele agentiei. Acest camp adauga doar informatii suplimentare la final.</FormDescription><FormMessage /></FormItem> )}/>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={agencyForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Email Contact</FormLabel><FormControl><Input {...field} placeholder="contact@agentie.ro" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={agencyForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Telefon Contact</FormLabel><FormControl><Input {...field} placeholder="+40 123 456 789" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                            </div>
                            <FormField control={agencyForm.control} name="address" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Adresă Sediu</FormLabel><FormControl><Input {...field} placeholder="Str. Exemplu nr. 1, Oraș" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                            
                            <Separator className="my-6 bg-white/10"/>

                            <h4 className="text-lg font-semibold text-white">Branding & Social Media</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={agencyForm.control} name="logoUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">URL Logo</FormLabel><FormControl><Input {...field} placeholder="https://..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={agencyForm.control} name="primaryColor" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Culoare Primară</FormLabel><FormControl><Input type="color" {...field} className="w-24 p-1 h-10" /></FormControl><FormMessage /></FormItem> )}/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={agencyForm.control} name="facebookUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Facebook URL</FormLabel><FormControl><Input {...field} placeholder="https://facebook.com/agentie" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={agencyForm.control} name="instagramUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Instagram URL</FormLabel><FormControl><Input {...field} placeholder="https://instagram.com/agentie" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={agencyForm.control} name="linkedinUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">LinkedIn URL</FormLabel><FormControl><Input {...field} placeholder="https://linkedin.com/company/agentie" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                            </div>
                        <Button type="submit" disabled={agencyForm.formState.isSubmitting || userProfile?.role !== 'admin'} className="bg-primary hover:bg-primary/90 text-primary-foreground">{agencyForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvează Setări Agenție</Button>
                        {userProfile?.role !== 'admin' && <p className="text-xs text-muted-foreground mt-2 text-white/70">Doar administratorii agenției pot modifica aceste setări.</p>}
                        </CardContent>
                    </form>
                    </Form>
                </Card>
            </div>
      </div>
      

      {userProfile?.role === 'admin' && agency && <AgentManagementCard agency={agency} />}
    </div>
  );
}
