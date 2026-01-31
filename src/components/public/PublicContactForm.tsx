'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Send, CheckCircle } from 'lucide-react';

const contactSchema = z.object({
  name: z.string().min(2, { message: 'Numele este obligatoriu.' }),
  email: z.string().email({ message: 'Adresa de email este invalidă.' }),
  phone: z.string().min(1, { message: 'Telefonul este obligatoriu.' }),
  message: z.string().min(10, { message: 'Mesajul trebuie să aibă cel puțin 10 caractere.' }),
});

export function PublicContactForm({ agencyId }: { agencyId: string }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', phone: '', message: '' },
  });

  async function onSubmit(values: z.infer<typeof contactSchema>) {
    setIsSubmitting(true);

    try {
      const contactsCollection = collection(firestore, 'agencies', agencyId, 'contacts');
      
      const newLeadData = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        notes: `Mesaj de pe site-ul public:\n---\n${values.message}`,
        source: 'Website',
        status: 'Nou',
        priority: 'Medie',
        contactType: 'Lead',
        createdAt: new Date().toISOString(),
      };

      await addDocumentNonBlocking(contactsCollection, newLeadData);
      
      setIsSuccess(true);

    } catch (error) {
      console.error("Failed to submit contact form:", error);
      toast({
        variant: 'destructive',
        title: 'Eroare la trimitere',
        description: 'A apărut o problemă. Vă rugăm să încercați din nou mai târziu.',
      });
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-green-50 rounded-lg border border-green-200">
        <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
        <h3 className="text-xl font-semibold">Mesaj Trimis!</h3>
        <p className="text-muted-foreground mt-2">Vă mulțumim. Unul dintre agenții noștri vă va contacta în cel mai scurt timp.</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nume Complet</FormLabel><FormControl><Input {...field} placeholder="Numele dvs." /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Adresă Email</FormLabel><FormControl><Input {...field} placeholder="email@exemplu.ro" /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Număr Telefon</FormLabel><FormControl><Input {...field} placeholder="0712 345 678" /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel>Mesajul Dvs.</FormLabel><FormControl><Textarea {...field} placeholder="Scrieți aici mesajul dvs..." rows={5} /></FormControl><FormMessage /></FormItem> )} />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Trimite Mesajul
        </Button>
      </form>
    </Form>
  );
}
