

'use client';

import { useEffect } from 'react';
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
import type { Contact } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const editCumparatorSchema = z.object({
  name: z.string().min(1, { message: "Numele este obligatoriu." }),
  phone: z.string().min(1, { message: "Telefonul este obligatoriu." }),
  email: z.string().email({ message: "Adresă de email invalidă." }),
  budget: z.coerce.number().positive({ message: "Bugetul trebuie să fie un număr pozitiv." }),
});

interface EditLeadInfoDialogProps {
    contact: Contact;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
}

export function EditLeadInfoDialog({ contact, isOpen, onOpenChange, onUpdateContact }: EditLeadInfoDialogProps) {
  
  const form = useForm<z.infer<typeof editCumparatorSchema>>({
    resolver: zodResolver(editCumparatorSchema),
  });

  useEffect(() => {
    if (contact && isOpen) {
      form.reset({
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        budget: contact.budget,
      });
    }
  }, [contact, isOpen, form]);

  const onSubmit = (values: z.infer<typeof editCumparatorSchema>) => {
    onUpdateContact(values);
    onOpenChange(false);
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editează Detalii Cumpărător</DialogTitle>
          <DialogDescription>
            Actualizează informațiile de contact și bugetul pentru {contact.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
             <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nume</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="budget" render={({ field }) => ( <FormItem><FormLabel>Buget (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anulează</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvează Modificări
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
