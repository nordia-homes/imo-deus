"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Viewing, Property, Contact } from '@/lib/types';
import { Textarea } from '../ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '../ui/card';

const viewingSchema = z.object({
  propertyId: z.string().min(1, 'Selectează o proprietate.'),
  contactId: z.string().min(1, 'Selectează un client.'),
  viewingDate: z.date({ required_error: "Selectează data vizionării." }),
  viewingTime: z.string({ required_error: "Selectează ora vizionării."}),
  duration: z.number().min(15),
  status: z.enum(['scheduled', 'completed', 'cancelled']),
  notes: z.string().optional(),
});

type PropertyStub = { id: string; title: string; };
type ContactStub = { id: string; name: string; };

type EditViewingDialogProps = {
    viewing: Viewing | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdateViewing: (viewing: Omit<Viewing, 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress'>) => void;
    properties: PropertyStub[];
    contacts: ContactStub[];
}

export function EditViewingDialog({ viewing, isOpen, onOpenChange, onUpdateViewing, properties, contacts }: EditViewingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useIsMobile();
  
  const form = useForm<z.infer<typeof viewingSchema>>({
    resolver: zodResolver(viewingSchema),
  });

  useEffect(() => {
    if (viewing) {
        const viewingDate = parseISO(viewing.viewingDate);
        form.reset({
            propertyId: viewing.propertyId,
            contactId: viewing.contactId,
            viewingDate: viewingDate,
            viewingTime: format(viewingDate, 'HH:mm'),
            duration: viewing.duration ?? 30,
            status: viewing.status,
            notes: viewing.notes,
        });
    }
  }, [viewing, form]);

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

  function onSubmit(values: z.infer<typeof viewingSchema>) {
    if (!viewing) return;
    setIsSubmitting(true);
    
    const selectedContact = contacts.find(c => c.id === values.contactId);
    const selectedProperty = properties.find(p => p.id === values.propertyId);

    if (!selectedContact || !selectedProperty) {
      setIsSubmitting(false);
      return;
    }
    
    const [hours, minutes] = values.viewingTime.split(':').map(Number);
    const viewingDateTime = new Date(values.viewingDate);
    viewingDateTime.setHours(hours, minutes);

    onUpdateViewing({
        id: viewing.id,
        propertyId: values.propertyId,
        propertyTitle: selectedProperty.title,
        contactId: values.contactId,
        contactName: selectedContact.name,
        viewingDate: viewingDateTime.toISOString(),
        duration: values.duration,
        notes: values.notes,
        status: values.status,
    });

    onOpenChange(false);
    setIsSubmitting(false);
  }

  if (!isOpen || !viewing) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex flex-col gap-0 overflow-hidden border-none bg-[#0F1E33] p-0", isMobile ? "inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none" : "max-h-[85vh] sm:max-w-md")}>
        <DialogHeader className="relative z-10 flex h-14 shrink-0 items-center justify-center border-b border-white/10 bg-[#0F1E33] p-2 shadow-md">
          <DialogTitle className="text-center text-xl text-white/90">Editează Vizionare</DialogTitle>
        </DialogHeader>
        {isOpen && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto bg-[#0F1E33] px-4 py-4 md:px-6">
                <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-xl">
                  <CardContent className="space-y-4 pt-6">
                    <FormField control={form.control} name="propertyId" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Proprietate</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează proprietatea" /></SelectTrigger></FormControl><SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="contactId" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Client</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează clientul" /></SelectTrigger></FormControl><SelectContent>{contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-xl">
                  <CardContent className="space-y-4 pt-6">
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
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80">Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="scheduled">Programată</SelectItem>
                              <SelectItem value="completed">Completată</SelectItem>
                              <SelectItem value="cancelled">Anulată</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-none bg-[#152A47] text-white shadow-xl">
                  <CardContent className="space-y-4 pt-6">
                    <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Notițe (Opțional)</FormLabel><FormControl><Textarea className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="Detalii despre vizionare..." /></FormControl><FormMessage /></FormItem> )} />
                  </CardContent>
                </Card>
              </div>
              <DialogFooter className="shrink-0 border-t border-white/10 bg-[#0F1E33] p-3 shadow-md md:px-6 md:py-3">
                <div className="flex w-full justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="text-white/80 hover:bg-white/10 hover:text-white/90">Anulează</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvează Modificări
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
