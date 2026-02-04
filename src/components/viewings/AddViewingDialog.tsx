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
import { Calendar as CalendarIcon, PlusCircle, CalendarCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Viewing, Property, Contact } from '@/lib/types';
import { Textarea } from '../ui/textarea';

const viewingSchema = z.object({
  propertyId: z.string().min(1, 'Selectează o proprietate.'),
  contactId: z.string().min(1, 'Selectează un client.'),
  viewingDate: z.date({ required_error: "Selectează data vizionării." }),
  viewingTime: z.string({ required_error: "Selectează ora vizionării."}),
  notes: z.string().optional(),
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

  // default contactId if only one is passed
  const defaultContactId = useMemo(() => {
    if (contacts.length === 1) return contacts[0].id;
    return undefined;
  }, [contacts]);

  // default propertyId if only one is passed
  const defaultPropertyId = useMemo(() => {
    if (properties.length === 1) return properties[0].id;
    return undefined;
  }, [properties]);

  const form = useForm<z.infer<typeof viewingSchema>>({
    resolver: zodResolver(viewingSchema),
    defaultValues: {
      propertyId: defaultPropertyId,
      contactId: defaultContactId,
    },
  });

  // Reset form when dialog opens/closes or defaults change
  useEffect(() => {
    if (isOpen) {
      form.reset({
        propertyId: defaultPropertyId,
        contactId: defaultContactId,
      });
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

  function onSubmit(values: z.infer<typeof viewingSchema>) {
    const selectedContact = contacts.find(c => c.id === values.contactId);
    const selectedProperty = properties.find(p => p.id === values.propertyId);
    
    if (!selectedContact || !selectedProperty) return;

    const [hours, minutes] = values.viewingTime.split(':').map(Number);
    const viewingDateTime = new Date(values.viewingDate);
    viewingDateTime.setHours(hours, minutes);

    onAddViewing({
        propertyId: selectedProperty.id,
        contactId: selectedContact.id,
        contactName: selectedContact.name,
        viewingDate: viewingDateTime.toISOString(),
        notes: values.notes,
    });

    setIsOpen(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || <Button><PlusCircle className="mr-2 h-4 w-4" />Adaugă Vizionare</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Programează o Vizionare Nouă</DialogTitle>
          <DialogDescription>
            Completează detaliile pentru noua vizionare.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField control={form.control} name="propertyId" render={({ field }) => ( <FormItem><FormLabel>Proprietate</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează proprietatea" /></SelectTrigger></FormControl><SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="contactId" render={({ field }) => ( <FormItem><FormLabel>Client</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează clientul" /></SelectTrigger></FormControl><SelectContent>{contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="viewingDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Data</FormLabel><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "d MMM yyyy", { locale: ro }) : <span>Alege data</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="viewingTime" render={({ field }) => ( <FormItem><FormLabel>Ora</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Alege ora" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notițe (Opțional)</FormLabel><FormControl><Textarea {...field} placeholder="Detalii despre vizionare..." /></FormControl><FormMessage /></FormItem> )} />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Anulează</Button>
              <Button type="submit">Programează</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
