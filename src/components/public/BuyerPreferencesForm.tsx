
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { updateContactPreferences } from '@/ai/flows/update-buyer-preferences';
import { Loader2, Banknote, BedDouble, Ruler, MapPin, Map, MessageSquare, ChevronRight } from 'lucide-react';
import { locations, type City } from '@/lib/locations';
import { cn } from '@/lib/utils';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { BuyerPreferencesLink, Contact } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

const preferencesSchema = z.object({
  budget: z.coerce.number().optional(),
  desiredRooms: z.coerce.number().optional(),
  desiredSquareFootageMin: z.coerce.number().optional(),
  city: z.string().optional(),
  generalZone: z.enum(['Nord', 'Sud', 'Est', 'Vest', 'Central', 'Oricare', 'all']).nullable().optional(),
  mentiuni: z.string().optional(),
});

export function BuyerPreferencesForm({ linkId }: { linkId: string }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const firestore = useFirestore();
  
  const linkDocRef = useMemoFirebase(() => doc(firestore, 'buyer-preferences-links', linkId), [firestore, linkId]);
  const { data: linkData, isLoading: isLinkLoading } = useDoc<BuyerPreferencesLink>(linkDocRef);

  const contactDocRef = useMemoFirebase(() => {
    if (!linkData) return null;
    return doc(firestore, 'agencies', linkData.agencyId, 'contacts', linkData.contactId);
  }, [linkData, firestore]);
  const { data: contact, isLoading: isContactLoading } = useDoc<Contact>(contactDocRef);

  const form = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      generalZone: 'all',
      city: 'all',
    }
  });

  useEffect(() => {
    if (contact) {
      form.reset({
        budget: contact.budget,
        desiredRooms: contact.preferences?.desiredRooms,
        desiredSquareFootageMin: contact.preferences?.desiredSquareFootageMin,
        city: contact.city || 'all',
        generalZone: contact.generalZone || 'all',
        mentiuni: '',
      });
    }
  }, [contact, form]);
  

  async function onSubmit(values: z.infer<typeof preferencesSchema>) {
    setIsSubmitting(true);
    try {
      const result = await updateContactPreferences({
        ...values,
        linkId,
      });

      if (result.success) {
        setIsSuccess(true);
      } else {
        toast({
          variant: 'destructive',
          title: 'Eroare la trimitere',
          description: result.message || 'A apărut o problemă. Vă rugăm să reîncercați.',
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        variant: 'destructive',
        title: 'Eroare neașteptată',
        description: 'A apărut o eroare de server. Vă rugăm să reîncercați mai târziu.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLinkLoading || isContactLoading) {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 space-y-4 shadow-md">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
            </div>
             <div className="space-y-4">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-14 w-full" />
        </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Mulțumim!</h2>
        <p className="text-slate-600">Preferințele tale au fost salvate cu succes. Agentul tău va reveni cu cele mai bune oferte.</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* --- Top Card --- */}
        <div className="bg-white rounded-2xl p-4 space-y-4 shadow-md">
            {/* Buget */}
            <FormField control={form.control} name="budget" render={({ field }) => (
                <FormItem>
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-1.5"><Banknote className="h-5 w-5" /><label>Buget (€)</label></div>
                    <div className="relative">
                        <FormControl>
                            <Input type="number" {...field} className="h-14 w-full rounded-xl border-none bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-2xl font-bold pl-4 pr-12 placeholder:text-white/80" placeholder='150.000'/>
                        </FormControl>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 font-semibold">€</span>
                    </div>
                </FormItem>
            )}/>
            {/* Camere */}
            <FormField control={form.control} name="desiredRooms" render={({ field }) => (
                <FormItem>
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-1.5"><BedDouble className="h-5 w-5" /><label>Număr Camere</label></div>
                    <div className="relative">
                        <FormControl>
                             <Input type="number" {...field} className="h-14 w-full rounded-xl border-none bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-2xl font-bold pl-4 pr-12 placeholder:text-white/80" placeholder='2' />
                        </FormControl>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 h-6 w-6" />
                    </div>
                </FormItem>
            )}/>
             {/* Suprafata */}
            <FormField control={form.control} name="desiredSquareFootageMin" render={({ field }) => (
                <FormItem>
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-1.5"><Ruler className="h-5 w-5" /><label>Suprafață Minimă (mp)</label></div>
                    <div className="relative">
                        <FormControl>
                           <Input type="number" {...field} className="h-14 w-full rounded-xl border-none bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-2xl font-bold pl-4 pr-12 placeholder:text-white/80" placeholder='50'/>
                        </FormControl>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 font-semibold flex items-center gap-1">mp <ChevronRight className="h-5 w-5" /></span>
                    </div>
                </FormItem>
            )}/>
        </div>

        {/* --- Bottom Section --- */}
        <div className="space-y-4 pt-2">
            {/* Oras */}
            <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-1.5"><MapPin className="h-5 w-5" /><label>Oraș de Interes</label></div>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger className="h-14 rounded-xl border-slate-200 bg-white justify-between text-slate-500">
                                <SelectValue placeholder="Selectează orașul" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                             <SelectItem value="all">Toate</SelectItem>
                            {Object.keys(locations).map((city) => (
                                <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </FormItem>
            )}/>
            {/* Zona Generala */}
            <FormField control={form.control} name="generalZone" render={({ field }) => (
                <FormItem>
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-1.5"><Map className="h-5 w-5" /><label>Zonă Generală</label></div>
                     <Select onValueChange={field.onChange} value={field.value || 'all'}>
                        <FormControl>
                            <SelectTrigger className="h-14 rounded-xl border-slate-200 bg-white justify-between text-slate-500">
                                <SelectValue placeholder="Selectează zona generală" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                             <SelectItem value="all">Oricare</SelectItem>
                             <SelectItem value="Nord">Nord</SelectItem>
                             <SelectItem value="Sud">Sud</SelectItem>
                             <SelectItem value="Est">Est</SelectItem>
                             <SelectItem value="Vest">Vest</SelectItem>
                             <SelectItem value="Central">Central</SelectItem>
                        </SelectContent>
                    </Select>
                </FormItem>
            )}/>
             {/* Detalii */}
            <FormField control={form.control} name="mentiuni" render={({ field }) => (
                <FormItem>
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-1.5"><MessageSquare className="h-5 w-5" /><label>Detalii Suplimentare</label></div>
                    <FormControl>
                        <Textarea {...field} placeholder="Alte preferințe sau detalii: etaj, an construcție, apropiere de parc, etc." className="rounded-xl border-slate-200 bg-white min-h-[100px]" />
                    </FormControl>
                </FormItem>
            )}/>
        </div>
        
        <div className="pt-4">
            <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-xl text-lg font-semibold bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg">
            {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : 'Caută Proprietăți'}
            </Button>
        </div>
      </form>
    </Form>
  );
}
