"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Offer, Property } from '@/lib/types';

const offerSchema = z.object({
  propertyId: z.string().min(1, 'Selectează o proprietate.'),
  price: z.coerce.number().positive({ message: "Prețul trebuie să fie un număr pozitiv." }),
});

type PropertyStub = { id: string; title: string; };

type AddOfferDialogProps = {
    onAddOffer: (offerData: Omit<Offer, 'id' | 'date' | 'status'>) => void;
    properties: PropertyStub[];
    children?: React.ReactNode;
}

export function AddOfferDialog({ onAddOffer, properties, children }: AddOfferDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof offerSchema>>({
    resolver: zodResolver(offerSchema),
  });

  function onSubmit(values: z.infer<typeof offerSchema>) {
    const selectedProperty = properties.find(p => p.id === values.propertyId);
    if (!selectedProperty) return;

    onAddOffer({
        propertyId: selectedProperty.id,
        propertyTitle: selectedProperty.title,
        price: values.price,
    });

    setIsOpen(false);
    form.reset();
  }
  
  useEffect(() => {
    if (!isOpen) {
        form.reset();
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || <Button><PlusCircle className="mr-2 h-4 w-4" />Adaugă Ofertă</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adaugă Ofertă Nouă</DialogTitle>
          <DialogDescription>
            Înregistrează o ofertă formală din partea clientului.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField control={form.control} name="propertyId" render={({ field }) => ( <FormItem><FormLabel>Proprietate</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează proprietatea" /></SelectTrigger></FormControl><SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Preț Oferit (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Anulează</Button>
              <Button type="submit">Salvează Ofertă</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
