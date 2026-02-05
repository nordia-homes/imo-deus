"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, PlusCircle, UserPlus, Loader2 } from 'lucide-react';
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


const viewingSchema = z.object({
  propertyId: z.string().min(1, 'Selectează o proprietate.'),
  contactId: z.string().optional(),
  viewingDate: z.date({ required_error: "Selectează data vizionării." }),
  viewingTime: z.string({ required_error: "Selectează ora vizionării."}),
  notes: z.string().optional(),
  // New contact fields
  newContactName: z.string().optional(),
  newContactPhone: z.string().optional(),
  newContactEmail: z.string().email({ message: 'Adresă de email invalidă.'}).optional().or(z.literal('')),
});

type PropertyStub = { id: string; title: string; };
type ContactStub = { id: string; name: string; };

type AddViewingDialogProps = {
    onAddViewing: (viewing: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => void;
    properties: PropertyStub[];
    contacts: ContactStub[];
    children?: React.ReactNode;
}

export function AddViewingDialog({ onAddViewing, properties, contacts, children }: AddViewingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNewContact, setIsNewContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { agencyId } = useAgency();
  const { user } = useUser();
  const firestore = useFirestore();

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
          for (let m = 0; m < 60; m += 30) {
              const hour = h.toString().padStart(2, '0');
              const minute = m.toString().padStart(2, '0');
              slots.push(`${hour}:${minute}`);
          }
      }
      return slots;
  }, []);

  async function onSubmit(values: z.infer<typeof viewingSchema>) {
    setIsSubmitting(true);
    if (!agencyId || !user) {
        toast({ variant: 'destructive', title: 'Eroare', description: 'Nu sunteți autentificat sau agenția nu este validă.' });
        setIsSubmitting(false);
        return;
    }

    let contactIdToUse = values.contactId;
    let contactNameToUse = '';

    if (isNewContact) {
        if (!values.newContactName || !values.newContactPhone || !values.newContactEmail) {
            toast({ variant: "destructive", title: "Date incomplete", description: "Numele, telefonul și emailul sunt obligatorii pentru un client nou." });
            setIsSubmitting(false);
            return;
        }

        try {
            const contactsCollection = collection(firestore, 'agencies', agencyId, 'contacts');
            const newContactData: Omit<Contact, 'id'> = {
                name: values.newContactName,
                phone: values.newContactPhone,
                email: values.newContactEmail,
                source: 'Contact direct',
                status: 'Nou',
                contactType: 'Cumparator',
                createdAt: new Date().toISOString(),
                agentId: user.uid,
                agentName: user.displayName || user.email,
            };
            const newContactRef = await addDoc(contactsCollection, newContactData);
            if (!newContactRef) throw new Error("Failed to get new contact reference");
            contactIdToUse = newContactRef.id;
            contactNameToUse = values.newContactName;
            toast({ title: "Client nou creat!", description: `${values.newContactName} a fost adăugat în CRM.` });
        } catch (error) {
            console.error("Failed to create new contact:", error);
            toast({ variant: "destructive", title: "Eroare creare client", description: "Nu s-a putut crea clientul nou. Încearcă din nou." });
            setIsSubmitting(false);
            return;
        }

    } else {
        const selectedContact = contacts.find(c => c.id === values.contactId);
        if (!selectedContact) {
            toast({ variant: 'destructive', title: 'Client invalid', description: 'Te rugăm să selectezi un client valid din listă.' });
            setIsSubmitting(false);
            return;
        }
        contactIdToUse = selectedContact.id;
        contactNameToUse = selectedContact.name;
    }
    
    const [hours, minutes] = values.viewingTime.split(':').map(Number);
    const viewingDateTime = new Date(values.viewingDate);
    viewingDateTime.setHours(hours, minutes);

    onAddViewing({
        propertyId: values.propertyId!,
        contactId: contactIdToUse!,
        contactName: contactNameToUse,
        viewingDate: viewingDateTime.toISOString(),
        notes: values.notes || '',
    });

    setIsSubmitting(false);
    setIsOpen(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || <Button><PlusCircle className="mr-2 h-4 w-4" />Adaugă Vizionare</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>Programează o Vizionare Nouă</DialogTitle>
          <DialogDescription>
            Completează detaliile pentru noua vizionare.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
              <FormField control={form.control} name="propertyId" render={({ field }) => ( <FormItem><FormLabel>Proprietate</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează proprietatea" /></SelectTrigger></FormControl><SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              
              {isNewContact ? (
                 <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold text-sm">Detalii Client Nou</h4>
                    <FormField control={form.control} name="newContactName" render={({ field }) => ( <FormItem><FormLabel>Nume</FormLabel><FormControl><Input {...field} placeholder="Nume client" /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="newContactPhone" render={({ field }) => ( <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input {...field} placeholder="0712345678" /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="newContactEmail" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="client@email.com" /></FormControl><FormMessage /></FormItem> )} />
                     <Button type="button" variant="link" size="sm" className="p-0 h-auto" onClick={() => setIsNewContact(false)}>
                        Sau selectează un client existent
                    </Button>
                </div>
              ) : (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                   <div className="flex items-center gap-2">
                        <FormField
                            control={form.control}
                            name="contactId"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="flex-1">
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
                        <Button type="button" variant="outline" size="icon" onClick={() => setIsNewContact(true)}>
                            <UserPlus className="h-4 w-4"/>
                        </Button>
                   </div>
                   <FormMessage />
                </FormItem>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="viewingDate" render={({ field }) => ( <FormItem><FormLabel>Data</FormLabel><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: ro }) : <span>Alege data</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ro} disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="viewingTime" render={({ field }) => ( <FormItem><FormLabel>Ora</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Alege ora" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notițe (Opțional)</FormLabel><FormControl><Textarea {...field} placeholder="Detalii despre vizionare..." /></FormControl><FormMessage /></FormItem> )} />
            </div>
            
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Anulează</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Programează
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
