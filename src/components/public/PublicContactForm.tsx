'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Numele este obligatoriu.'),
  email: z.string().email('Adresa de email este invalidă.'),
  phone: z.string().min(10, 'Numărul de telefon este invalid.'),
  message: z.string().min(10, 'Mesajul trebuie să aibă cel puțin 10 caractere.'),
});

type PublicContactFormProps = {
  agencyId: string;
};

export function PublicContactForm({ agencyId }: PublicContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      message: '',
    },
  });

  async function onSubmit(values: z.infer<typeof contactFormSchema>) {
    setIsSubmitting(true);
    const contactsCollection = collection(firestore, 'agencies', agencyId, 'contacts');

    try {
      const newLeadData = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        notes: values.message,
        source: 'Website',
        status: 'Nou' as const,
        contactType: 'Lead' as const,
        createdAt: new Date().toISOString(),
        interactionHistory: [],
      };
      
      await addDocumentNonBlocking(contactsCollection, newLeadData);

      toast({
        title: 'Mesaj trimis!',
        description: 'Vă mulțumim! Un reprezentant vă va contacta în cel mai scurt timp.',
      });
      setIsSuccess(true);
    } catch (error) {
      console.error('Failed to submit contact form:', error);
      toast({
        variant: 'destructive',
        title: 'Eroare',
        description: 'A apărut o problemă la trimiterea mesajului. Vă rugăm să încercați din nou.',
      });
      setIsSubmitting(false);
    }
  }
  
  if (isSuccess) {
      return (
          <div className="flex flex-col items-center justify-center text-center p-8 border rounded-lg bg-background">
                <h3 className="text-xl font-semibold mb-2">Vă mulțumim!</h3>
                <p className="text-muted-foreground">Mesajul dumneavoastră a fost trimis cu succes. Un consultant vă va contacta în cel mai scurt timp posibil.</p>
          </div>
      )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nume și Prenume</FormLabel>
              <FormControl>
                <Input placeholder="Numele dumneavoastră" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="email@exemplu.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefon</FormLabel>
              <FormControl>
                <Input placeholder="0712 345 678" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mesajul dumneavoastră</FormLabel>
              <FormControl>
                <Textarea placeholder="Scrieți aici mesajul..." {...field} rows={4} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Trimite Mesaj
        </Button>
      </form>
    </Form>
  );
}
