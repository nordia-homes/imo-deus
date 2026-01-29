
"use client";

import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const leadSchema = z.object({
  name: z.string().min(1, { message: "Numele este obligatoriu." }),
  phone: z.string().min(1, { message: "Telefonul este obligatoriu." }),
  email: z.string().email({ message: "Adresă de email invalidă." }),
  source: z.string().min(1, { message: "Sursa este obligatorie." }),
  budget: z.coerce.number().positive({ message: "Bugetul trebuie să fie un număr pozitiv." }),
  status: z.string().min(1, { message: "Statusul este obligatoriu." }),
  notes: z.string().optional(),
});

export function AddLeadDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<z.infer<typeof leadSchema>>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      source: '',
      budget: 0,
      status: 'Nou',
      notes: '',
    },
  });

  function onSubmit(values: z.infer<typeof leadSchema>) {
    console.log(values);
    // Here you would typically call a function to save the data to Firestore
    setIsOpen(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adaugă Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adaugă Lead Nou</DialogTitle>
          <DialogDescription>
            Completează informațiile despre noul potențial client.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nume</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="budget" render={({ field }) => ( <FormItem><FormLabel>Buget (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sursă</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selectează sursa" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Website">Website</SelectItem>
                          <SelectItem value="Recomandare">Recomandare</SelectItem>
                          <SelectItem value="Portal">Portal</SelectItem>
                          <SelectItem value="Telefon">Telefon</SelectItem>
                           <SelectItem value="Altul">Altul</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selectează statusul" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Nou">Nou</SelectItem>
                          <SelectItem value="Contactat">Contactat</SelectItem>
                          <SelectItem value="Vizionare">Vizionare</SelectItem>
                          <SelectItem value="În negociere">În negociere</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notițe</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem> )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Anulează</Button>
              <Button type="submit">Salvează Lead</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
