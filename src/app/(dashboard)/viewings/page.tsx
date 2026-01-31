'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, where } from 'firebase/firestore';
import type { Property, Contact, Viewing } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarIcon, Check, PlusCircle, Trash2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const viewingSchema = z.object({
  propertyId: z.string().min(1, 'Selectează o proprietate.'),
  contactId: z.string().min(1, 'Selectează un client.'),
  viewingDate: z.date({ required_error: "Selectează data vizionării." }),
  viewingTime: z.string({ required_error: "Selectează ora vizionării."}),
  notes: z.string().optional(),
});

export default function ViewingsPage() {
    const { agencyId } = useAgency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // Data fetching
    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'properties'), where('status', '==', 'Activ'));
    }, [firestore, agencyId]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

    const viewingsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'viewings'), orderBy('viewingDate', 'desc'));
    }, [firestore, agencyId]);
    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

    const form = useForm<z.infer<typeof viewingSchema>>({
        resolver: zodResolver(viewingSchema),
    });
    
    const timeSlots = useMemo(() => {
      const slots = [];
      for (let h = 8; h < 21; h++) {
          for (let m = 0; m < 60; m += 30) {
              const hour = h.toString().padStart(2, '0');
              const minute = m.toString().padStart(2, '0');
              slots.push(`${hour}:${minute}`);
          }
      }
      return slots;
    }, []);

    const isLoading = arePropertiesLoading || areContactsLoading || areViewingsLoading;

    async function onSubmit(values: z.infer<typeof viewingSchema>) {
        if (!agencyId || !user) return;

        const selectedProperty = properties?.find(p => p.id === values.propertyId);
        const selectedContact = contacts?.find(c => c.id === values.contactId);

        if (!selectedProperty || !selectedContact) {
            toast({ variant: 'destructive', title: 'Date invalide', description: 'Proprietatea sau clientul nu a fost găsit.' });
            return;
        }
        
        const [hours, minutes] = values.viewingTime.split(':').map(Number);
        const viewingDateTime = new Date(values.viewingDate);
        viewingDateTime.setHours(hours, minutes);

        const newViewing: Omit<Viewing, 'id'> = {
            propertyId: selectedProperty.id,
            propertyTitle: selectedProperty.title,
            propertyAddress: selectedProperty.address,
            contactId: selectedContact.id,
            contactName: selectedContact.name,
            agentId: user.uid,
            agentName: user.displayName || user.email,
            viewingDate: viewingDateTime.toISOString(),
            notes: values.notes,
            status: 'scheduled',
            createdAt: new Date().toISOString(),
        };
        
        await addDocumentNonBlocking(collection(firestore, `agencies/${agencyId}/viewings`), newViewing);

        toast({ title: 'Vizionare programată!', description: 'Vizionarea a fost adăugată în calendar.' });
        form.reset();
    }

    const handleUpdateStatus = (viewing: Viewing, status: 'completed' | 'cancelled') => {
        if (!agencyId) return;
        const viewingRef = doc(firestore, `agencies/${agencyId}/viewings`, viewing.id);
        updateDocumentNonBlocking(viewingRef, { status });
        toast({ title: `Vizionare marcată ca ${status === 'completed' ? 'finalizată' : 'anulată'}` });
    };

    const { upcomingViewings, pastViewings } = useMemo(() => {
        const now = new Date();
        const upcoming = viewings?.filter(v => parseISO(v.viewingDate) >= now && v.status === 'scheduled') || [];
        const past = viewings?.filter(v => parseISO(v.viewingDate) < now || v.status !== 'scheduled') || [];
        return { upcomingViewings: upcoming.sort((a,b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime()), pastViewings: past };
    }, [viewings]);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Vizionări</h1>
                    <p className="text-muted-foreground">
                        Programează și gestionează vizionările pentru proprietăți.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Programează o Vizionare</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {arePropertiesLoading || areContactsLoading ? <Skeleton className="h-64"/> : (
                             <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                     <FormField control={form.control} name="propertyId" render={({ field }) => ( <FormItem><FormLabel>Proprietate</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează proprietatea" /></SelectTrigger></FormControl><SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                     <FormField control={form.control} name="contactId" render={({ field }) => ( <FormItem><FormLabel>Client</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează clientul" /></SelectTrigger></FormControl><SelectContent>{contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                     <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="viewingDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "d MMM yyyy", { locale: ro }) : <span>Alege data</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="viewingTime" render={({ field }) => ( <FormItem><FormLabel>Ora</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Alege ora" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                     </div>
                                     <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notițe (Opțional)</FormLabel><FormControl><Textarea {...field} placeholder="Detalii despre vizionare..." /></FormControl><FormMessage /></FormItem> )} />
                                     <Button type="submit" disabled={form.formState.isSubmitting}><PlusCircle className="mr-2 h-4 w-4" />Programează</Button>
                                </form>
                            </Form>
                        )}
                    </CardContent>
                </Card>

                 <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Vizionări Programate</CardTitle></CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-48"/> : (
                                <div className="space-y-4">
                                {upcomingViewings.length > 0 ? upcomingViewings.map(v => (
                                    <div key={v.id} className="p-3 border rounded-lg flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold">{v.propertyTitle}</p>
                                            <p className="text-sm text-muted-foreground">Client: {v.contactName}</p>
                                            <p className="text-sm text-primary font-medium">{format(parseISO(v.viewingDate), "eeee, d MMM, HH:mm", { locale: ro })}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(v, 'completed')}><Check className="h-4 w-4 mr-2"/>Finalizat</Button>
                                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleUpdateStatus(v, 'cancelled')}><X className="h-4 w-4 mr-2"/>Anulat</Button>
                                        </div>
                                    </div>
                                )) : <p className="text-center text-muted-foreground p-4">Nicio vizionare viitoare.</p>}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>Istoric Vizionări</CardTitle></CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-48"/> : (
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                {pastViewings.length > 0 ? pastViewings.map(v => (
                                    <div key={v.id} className="p-3 border rounded-lg">
                                        <p className="font-semibold">{v.propertyTitle}</p>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Client: {v.contactName}</span>
                                            <span className={cn('font-semibold capitalize', v.status === 'completed' && 'text-green-600', v.status === 'cancelled' && 'text-red-600')}>
                                                {v.status === 'completed' ? 'Finalizat' : v.status === 'cancelled' ? 'Anulat' : format(parseISO(v.viewingDate), "d MMM yyyy", { locale: ro })}
                                            </span>
                                        </div>
                                    </div>
                                )) : <p className="text-center text-muted-foreground p-4">Niciun istoric.</p>}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
