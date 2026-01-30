'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

const contactSchema = z.object({
    name: z.string().min(2, { message: 'Numele este obligatoriu.' }),
    email: z.string().email({ message: 'Adresa de email este invalidă.' }),
    phone: z.string().optional(),
    message: z.string().min(10, { message: 'Mesajul trebuie să aibă cel puțin 10 caractere.' }),
});

export function PublicContactForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', phone: '', message: '' },
  });

  function onSubmit(values: z.infer<typeof contactSchema>) {
    setIsSubmitting(true);
    // Placeholder for submission logic (e.g., send to an API endpoint)
    console.log(values);
    setTimeout(() => {
        setIsSubmitting(false);
        toast({
            title: 'Mesaj Trimis!',
            description: 'Vă mulțumim! Vă vom contacta în cel mai scurt timp.',
        });
        form.reset();
    }, 1500);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nume Complet</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Adresă Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Telefon (Opțional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel>Mesajul Dvs.</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem> )} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Trimite Mesajul
        </Button>
      </form>
    </Form>
  );
}
