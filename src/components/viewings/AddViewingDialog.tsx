"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, UserPlus, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Viewing, Property, Contact } from '@/lib/types';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { useAgency } from '@/context/AgencyContext';
import { collection, addDoc } from 'firebase/firestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '../ui/card';


const viewingSchema = z.object({
  propertyId: z.string().min(1, 'Selectează o proprietate.'),
  contactId: z.string().optional(),
  viewingDate: z.date({ required_error: "Selectează data vizionării." }),
  viewingTime: z.string({ required_error: "Selectează ora vizionării."}),
  duration: z.number().min(15),
  notes: z.string().optional(),
  // New contact fields
  newContactName: z.string().optional(),
  newContactPhone: z.string().optional(),
  newContactEmail: z.string().email({ message: 'Adresă de email invalidă.'}).optional().or(z.literal('')),
});

type PropertyStub = {
  id: string;
  title: string;
  price?: number;
  city?: string;
  zone?: string;
};
type ContactStub = { id: string; name: string; };

type AddViewingDialogProps = {
    onAddViewing: (viewing: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => Promise<void>;
    properties: PropertyStub[];
    contacts: ContactStub[];
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddViewingDialog({ onAddViewing, properties, contacts, isOpen, onOpenChange }: AddViewingDialogProps) {
  const [isNewContact, setIsNewContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { agencyId } = useAgency();
  const { user } = useUser();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  const formKey = useMemo(() => `add-viewing-${isOpen}`, [isOpen]);

  const defaultContactId = useMemo(() => {
    if (contacts.length === 1) return contacts[0].id;
    return undefined;
  }, [contacts]);

  const defaultPropertyId = useMemo(() => {
    if (properties.length === 1) return properties[0].id;
    return undefined;
  }, [properties]);

  const form = useForm<z.infer<typeof viewingSchema>>({
    resolver: zodResolver(viewingSchema),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        propertyId: defaultPropertyId,
        contactId: defaultContactId,
        duration: 30,
        newContactName: '',
        newContactEmail: '',
        newContactPhone: '',
      });
      setIsNewContact(false); // Reset to existing contact view
    }
  }, [isOpen, defaultContactId, defaultPropertyId, form]);

  const timeSlots = useMemo(() => {
      const slots = [];
      for (let h = 8; h < 22; h++) {
          for (let m = 0; m < 60; m += 15) {
              const hour = h.toString().padStart(2, '0');
              const minute = m.toString().padStart(2, '0');
              slots.push(`${hour}:${minute}`);
          }
      }
      return slots;
  }, []);

  const durationOptions = useMemo(() => ([
      { value: 15, label: '15 minute' },
      { value: 30, label: '30 minute' },
      { value: 45, label: '45 minute' },
      { value: 60, label: '1 oră' },
      { value: 90, label: '1 oră 30 min' },
      { value: 120, label: '2 ore' },
  ]), []);

  async function onSubmit(values: z.infer<typeof viewingSchema>) {
    setIsSubmitting(true);
    try {
        if (!agencyId || !user) {
            throw new Error('Nu sunteți autentificat sau agenția nu este validă.');
        }

        let contactIdToUse = values.contactId;
        let contactNameToUse = '';

        if (isNewContact) {
            if (!values.newContactName || !values.newContactPhone || !values.newContactEmail) {
                toast({ variant: "destructive", title: "Date incomplete", description: "Numele, telefonul și emailul sunt obligatorii pentru un client nou." });
                return; // Early exit, finally will still run
            }

            const selectedProperty = properties.find((property) => property.id === values.propertyId);
            const contactsCollection = collection(firestore, 'agencies', agencyId, 'contacts');
            const newContactData: Omit<Contact, 'id'> = {
                name: values.newContactName,
                phone: values.newContactPhone,
                email: values.newContactEmail,
                description: selectedProperty
                    ? `Notita automata: client adaugat pentru vizionarea proprietatii ${selectedProperty.title}`
                    : undefined,
                source: 'Contact direct',
                status: 'Nou',
                contactType: 'Cumparator',
                createdAt: new Date().toISOString(),
                agentId: user.uid,
                agentName: user.displayName || user.email,
                sourcePropertyId: selectedProperty?.id,
                budget: selectedProperty?.price,
                city: selectedProperty?.city,
                zones: selectedProperty?.zone ? [selectedProperty.zone] : [],
            };
            const newContactRef = await addDoc(contactsCollection, newContactData);
            contactIdToUse = newContactRef.id;
            contactNameToUse = values.newContactName;
            toast({ title: "Client nou creat!", description: `${values.newContactName} a fost adăugat în CRM.` });
        } else {
            const selectedContact = contacts.find(c => c.id === values.contactId);
            if (!selectedContact) {
                toast({ variant: 'destructive', title: 'Client invalid', description: 'Te rugăm să selectezi un client valid din listă.' });
                return; // Early exit, finally will still run
            }
            contactIdToUse = selectedContact.id;
            contactNameToUse = selectedContact.name;
        }
        
        const [hours, minutes] = values.viewingTime.split(':').map(Number);
        const viewingDateTime = new Date(values.viewingDate);
        viewingDateTime.setHours(hours, minutes);

        await onAddViewing({
            propertyId: values.propertyId!,
            contactId: contactIdToUse!,
            contactName: contactNameToUse,
            viewingDate: viewingDateTime.toISOString(),
            duration: values.duration,
            notes: values.notes || '',
        });

        onOpenChange(false);

    } catch (error) {
        console.error("Failed to submit viewing:", error);
        toast({ variant: "destructive", title: "Eroare la salvare", description: "A apărut o problemă la salvarea vizionării. Încearcă din nou." });
    } finally {
        setIsSubmitting(false);
    }
  }

  const panelClassName = "agentfinder-add-viewing-dialog__panel rounded-2xl border-none bg-[#152A47] text-white shadow-xl";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("agentfinder-add-viewing-dialog flex flex-col gap-0 overflow-hidden border-none bg-[#0F1E33] p-0", isMobile ? "inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none" : "max-h-[85vh] sm:max-w-md")}>
        <DialogHeader className="agentfinder-add-viewing-dialog__header relative z-10 flex h-14 shrink-0 items-center justify-center border-b border-white/10 bg-[#0F1E33] p-2 shadow-md">
          <DialogTitle className="text-center text-xl text-white/90">Programează o Vizionare</DialogTitle>
        </DialogHeader>
        {isOpen && (
            <Form {...form}>
            <form key={formKey} onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                <div className="agentfinder-add-viewing-dialog__body flex-1 space-y-6 overflow-y-auto bg-[#0F1E33] px-4 py-4 md:px-6">
                    <Card className={panelClassName}>
                        <CardContent className="pt-6 space-y-4">
                            <FormField control={form.control} name="propertyId" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Proprietate</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează proprietatea" /></SelectTrigger></FormControl><SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            {isNewContact ? (
                                <div className="space-y-4 pt-4 border-t border-border">
                                    <h4 className="font-semibold text-sm">Detalii Client Nou</h4>
                                    <FormField control={form.control} name="newContactName" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nume</FormLabel><FormControl><Input className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="Nume client" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="newContactPhone" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Telefon</FormLabel><FormControl><Input className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="0712345678" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="newContactEmail" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Email</FormLabel><FormControl><Input className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} type="email" placeholder="client@email.com" /></FormControl><FormMessage /></FormItem> )} />
                                    <Button type="button" variant="link" size="sm" className="h-auto p-0 text-primary" onClick={() => setIsNewContact(false)}>
                                        Sau selectează un client existent
                                    </Button>
                                </div>
                            ) : (
                                <FormItem>
                                <FormLabel className="text-white/80">Client</FormLabel>
                                <div className="flex items-center gap-2">
                                        <FormField
                                            control={form.control}
                                            name="contactId"
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="flex-1 bg-white/10 border-white/20 text-white">
                                                            <SelectValue placeholder="Selectează clientul" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {contacts?.map(c => (
                                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        <Button type="button" variant="outline" size="icon" onClick={() => setIsNewContact(true)} className="bg-white/10 border-white/20 text-white">
                                            <UserPlus className="h-4 w-4"/>
                                        </Button>
                                </div>
                                <FormMessage />
                                </FormItem>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-xl">
                        <CardContent className="pt-6 space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                                <FormField
                                control={form.control}
                                name="viewingDate"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="text-white/80">Data</FormLabel>
                                    <Popover modal={true}>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground",
                                                "bg-white/10 border-white/20 text-white"
                                            )}
                                            >
                                            {field.value ? format(field.value, "PPP", { locale: ro }) : <span>Alege data</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            locale={ro}
                                            disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                                            initialFocus
                                        />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField control={form.control} name="viewingTime" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Ora</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Alege ora" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            </div>
                            <FormField control={form.control} name="duration" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Durată</FormLabel><Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value ?? 30)}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Alege durata" /></SelectTrigger></FormControl><SelectContent>{durationOptions.map(option => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                        </CardContent>
                    </Card>
                    
                    <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-xl">
                        <CardContent className="pt-6 space-y-4">
                            <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Notițe (Opțional)</FormLabel><FormControl><Textarea className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="Detalii despre vizionare..." /></FormControl><FormMessage /></FormItem> )} />
                        </CardContent>
                    </Card>
                </div>
                <DialogFooter className="shrink-0 border-t border-white/10 bg-[#0F1E33] p-3 shadow-md md:px-6 md:py-3">
                    <div className="flex justify-end gap-2 w-full">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="text-white/80 hover:bg-white/10 hover:text-white/90">Anulează</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Programează
                        </Button>
                    </div>
                </DialogFooter>
            </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
