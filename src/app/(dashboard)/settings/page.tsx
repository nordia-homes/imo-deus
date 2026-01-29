'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu.'),
});

const agencySchema = z.object({
  agencyName: z.string().optional(),
  agencyLogoUrl: z.string().url('URL invalid.').or(z.literal('')).optional(),
  agencyPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Culoarea trebuie să fie în format hex (ex: #1E3A8A).').optional(),
});

export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '' },
  });

  const agencyForm = useForm<z.infer<typeof agencySchema>>({
    resolver: zodResolver(agencySchema),
    defaultValues: { agencyName: '', agencyLogoUrl: '', agencyPrimaryColor: '#1E3A8A' },
  });

  useEffect(() => {
    if (userProfile) {
      profileForm.reset({ name: userProfile.name });
      agencyForm.reset({
        agencyName: userProfile.agencyName || '',
        agencyLogoUrl: userProfile.agencyLogoUrl || '',
        agencyPrimaryColor: userProfile.agencyPrimaryColor || '#1E3A8A',
      });
    } else if (user && !isProfileLoading) {
      // If profile doesn't exist, pre-fill with auth data
      profileForm.reset({ name: user.displayName || '' });
    }
  }, [userProfile, user, isProfileLoading, profileForm, agencyForm]);
  
  const handleProfileSave = (values: z.infer<typeof profileSchema>) => {
    if (!userDocRef || !user) return;

    const dataToSave = {
      ...values,
      email: user.email, // ensure email is always present
    };
    
    // Use set with merge to create if not exists, or update if it does.
    setDocumentNonBlocking(userDocRef, dataToSave, { merge: true });
    
    toast({
      title: 'Profil salvat!',
      description: 'Informațiile profilului tău au fost actualizate.',
    });
  };
  
  const handleAgencySave = (values: z.infer<typeof agencySchema>) => {
    if (!userDocRef) return;
    updateDocumentNonBlocking(userDocRef, values);
    toast({
      title: 'Setări salvate!',
      description: 'Setările agenției tale au fost actualizate.',
    });
  };

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full" /></div>
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-24" /></div>
            <Skeleton className="h-10 w-40" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold">Setări</h1>
        <p className="text-muted-foreground">
          Configurează setările contului și ale agenției.
        </p>
      </div>

      <Card>
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(handleProfileSave)}>
            <CardHeader>
              <CardTitle>Profilul Tău</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nume</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user?.email || ''} disabled />
              </div>
              <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                {profileForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvează Profil
              </Button>
            </CardContent>
          </form>
        </Form>
      </Card>

      <Card>
        <Form {...agencyForm}>
          <form onSubmit={agencyForm.handleSubmit(handleAgencySave)}>
            <CardHeader>
              <CardTitle>Setări Agenție (White-Label)</CardTitle>
              <CardDescription>Personalizează aspectul platformei pentru agenția ta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <FormField
                control={agencyForm.control}
                name="agencyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nume Agenție</FormLabel>
                    <FormControl><Input {...field} placeholder="Numele agenției tale" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={agencyForm.control}
                name="agencyLogoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Logo</FormLabel>
                    <FormControl><Input {...field} placeholder="https://..." /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={agencyForm.control}
                name="agencyPrimaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Culoare Primară</FormLabel>
                    <FormControl><Input type="color" {...field} className="w-24 p-1 h-10" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={agencyForm.formState.isSubmitting}>
                {agencyForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvează Setări Agenție
              </Button>
            </CardContent>
          </form>
        </Form>
      </Card>
    </div>
  );
}
