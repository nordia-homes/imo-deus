'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { UserProfile, Agency } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { AgentManagementCard } from '@/components/settings/AgentManagementCard';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const profileSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu.'),
  agentBio: z.string().optional(),
  phone: z.string().optional(),
});

const agencySchema = z.object({
  name: z.string().min(1, 'Numele agenției este obligatoriu.'),
  agencyDescription: z.string().optional(),
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
  const { toast } = useToast();
  const { userProfile, agency, isAgencyLoading } = useAgency();

  const [isCreatingAgency, setIsCreatingAgency] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', agentBio: '', phone: '' },
  });

  const agencyForm = useForm<z.infer<typeof agencySchema>>({
    resolver: zodResolver(agencySchema),
    defaultValues: { 
        name: '', 
        agencyDescription: '',
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
  
  const handleProfileSave = (values: z.infer<typeof profileSchema>) => {
    if (!user) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    const dataToSave = {
      ...values,
      email: user.email,
    };
    setDocumentNonBlocking(userDocRef, dataToSave, { merge: true });
    toast({ title: 'Profil salvat!', description: 'Informațiile profilului tău au fost actualizate.' });
  };
  
  const handleAgencySave = (values: z.infer<typeof agencySchema>) => {
    if (!agency?.id) return;
    const agencyDocRef = doc(firestore, 'agencies', agency.id);
    updateDocumentNonBlocking(agencyDocRef, values);
    toast({ title: 'Setări salvate!', description: 'Setările agenției tale au fost actualizate.' });
  };

  const handleCreateAgency = async (values: z.infer<typeof agencySchema>) => {
      if (!user) return;
      setIsCreatingAgency(true);

      const agenciesCollection = collection(firestore, 'agencies');
      const userDocRef = doc(firestore, 'users', user.uid);

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
          <div className="flex items-center justify-center min-h-full bg-[#0F1E33] text-white p-4">
              <Card className="w-full max-w-lg shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
                <Form {...agencyForm}>
                    <form onSubmit={agencyForm.handleSubmit(handleCreateAgency)}>
                        <CardHeader>
                            <CardTitle className="text-white">Bun venit la Imoflux!</CardTitle>
                            <CardDescription className="text-white/70">Pentru a începe, creează-ți agenția. O poți personaliza mai târziu.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={agencyForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nume Agenție</FormLabel><FormControl><Input {...field} placeholder="Numele agenției tale" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={agencyForm.control} name="primaryColor" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Culoare Primară</FormLabel><FormControl><Input type="color" {...field} className="w-24 p-1 h-10" /></FormControl><FormMessage /></FormItem> )}/>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isCreatingAgency} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
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
      <div className="space-y-8 bg-[#0F1E33] p-4 lg:p-6">
        <div><Skeleton className="h-8 w-48 mb-2 bg-white/20" /><Skeleton className="h-4 w-72 bg-white/20" /></div>
        <Card className="bg-transparent border-none"><CardHeader><Skeleton className="h-6 w-32 bg-white/20" /></CardHeader><CardContent className="space-y-4 max-w-md"><div className="space-y-2"><Skeleton className="h-4 w-16 bg-white/20" /><Skeleton className="h-10 w-full bg-white/20" /></div><div className="space-y-2"><Skeleton className="h-4 w-16 bg-white/20" /><Skeleton className="h-10 w-full bg-white/20" /></div><Skeleton className="h-10 w-32 bg-white/20" /></CardContent></Card>
        <Card className="bg-transparent border-none"><CardHeader><Skeleton className="h-6 w-48 mb-2 bg-white/20" /><Skeleton className="h-4 w-80 bg-white/20" /></CardHeader><CardContent className="space-y-4 max-w-md"><div className="space-y-2"><Skeleton className="h-4 w-24 bg-white/20" /><Skeleton className="h-10 w-full bg-white/20" /></div><div className="space-y-2"><Skeleton className="h-4 w-24 bg-white/20" /><Skeleton className="h-10 w-full bg-white/20" /></div><div className="space-y-2"><Skeleton className="h-4 w-24 bg-white/20" /><Skeleton className="h-10 w-24 bg-white/20" /></div><Skeleton className="h-10 w-40 bg-white/20" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-[#0F1E33] text-white p-4 lg:p-6">
      <div><h1 className="text-3xl font-headline font-bold text-white">Setări</h1><p className="text-white/70">Configurează setările contului și ale agenției.</p></div>
      <Card className="shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(handleProfileSave)}>
            <CardHeader><CardTitle className="text-white">Profilul Tău</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <FormField control={profileForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nume</FormLabel><FormControl><Input {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
              <div className="space-y-2"><Label className="text-white/80" htmlFor="email">Email</Label><Input id="email" type="email" value={user?.email || ''} disabled className="bg-white/10 border-white/20 text-white/70" /></div>
              <FormField control={profileForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Telefon</FormLabel><FormControl><Input {...field} placeholder="+40 123 456 789" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
              <FormField control={profileForm.control} name="agentBio" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Scurtă Biografie</FormLabel><FormControl><Textarea {...field} rows={3} placeholder="Descrie-te pe scurt ca agent imobiliar..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50"/></FormControl><FormDescription className="text-white/70">Biografia ta va fi afișată pe pagina publică "Despre Noi".</FormDescription><FormMessage /></FormItem> )}/>
              <div className="space-y-2">
                <Label className="text-white/80">Rol</Label>
                <div>
                  {userProfile?.role ? (
                    <Badge variant={userProfile.role === 'admin' ? 'default' : 'secondary'} className={userProfile.role === 'admin' ? '' : 'bg-white/20 text-white border-none'}>{userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}</Badge>
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

      <Card className="shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
        <Form {...agencyForm}>
          <form onSubmit={agencyForm.handleSubmit(handleAgencySave)}>
            <CardHeader><CardTitle className="text-white">Setări Agenție</CardTitle><CardDescription className="text-white/70">Personalizează informațiile și aspectul platformei pentru agenția ta.</CardDescription></CardHeader>
            <CardContent className="space-y-4 max-w-md">
                <FormField control={agencyForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nume Agenție</FormLabel><FormControl><Input {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={agencyForm.control} name="agencyDescription" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Descriere Agenție (Despre Noi)</FormLabel><FormControl><Textarea rows={5} {...field} placeholder="Povestea, misiunea și valorile agenției tale..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50"/></FormControl><FormDescription className="text-white/70">Acest text va apărea pe pagina publică "Despre Noi".</FormDescription><FormMessage /></FormItem> )}/>
                <FormField control={agencyForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Email Contact</FormLabel><FormControl><Input {...field} placeholder="contact@agentie.ro" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={agencyForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Telefon Contact</FormLabel><FormControl><Input {...field} placeholder="+40 123 456 789" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={agencyForm.control} name="address" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Adresă Sediu</FormLabel><FormControl><Input {...field} placeholder="Str. Exemplu nr. 1, Oraș" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                
                <Separator className="my-6 bg-white/20"/>

                <h4 className="text-sm font-medium text-white">Branding & Social Media</h4>
                <FormField control={agencyForm.control} name="logoUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">URL Logo</FormLabel><FormControl><Input {...field} placeholder="https://..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={agencyForm.control} name="primaryColor" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Culoare Primară</FormLabel><FormControl><Input type="color" {...field} className="w-24 p-1 h-10" /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={agencyForm.control} name="facebookUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Facebook URL</FormLabel><FormControl><Input {...field} placeholder="https://facebook.com/agentie" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={agencyForm.control} name="instagramUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Instagram URL</FormLabel><FormControl><Input {...field} placeholder="https://instagram.com/agentie" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={agencyForm.control} name="linkedinUrl" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">LinkedIn URL</FormLabel><FormControl><Input {...field} placeholder="https://linkedin.com/company/agentie" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl><FormMessage /></FormItem> )}/>
              
              <Button type="submit" disabled={agencyForm.formState.isSubmitting || userProfile?.role !== 'admin'} className="bg-primary hover:bg-primary/90 text-primary-foreground">{agencyForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvează Setări Agenție</Button>
              {userProfile?.role !== 'admin' && <p className="text-xs text-white/70 mt-2">Doar administratorii agenției pot modifica aceste setări.</p>}
            </CardContent>
          </form>
        </Form>
      </Card>

      {userProfile?.role === 'admin' && agency && <AgentManagementCard agency={agency} />}
    </div>
  );
}
