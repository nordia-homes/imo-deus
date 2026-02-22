'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import { Card, CardContent } from '@/components/ui/card';

const contactSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu.'),
  phone: z.string().min(1, 'Telefonul este obligatoriu.'),
  email: z.string().email('Email invalid.'),
  message: z.string().optional(),
});

interface PublicContactFormProps {
  propertyId: string;
  agencyId: string;
}

export function PublicContactForm({ propertyId, agencyId }: PublicContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', phone: '', email: '', message: '' },
  });

  async function onSubmit(values: z.infer<typeof contactSchema>) {
    setIsSubmitting(true);
    try {
      const result = await scheduleViewing({ ...values, propertyId, agencyId });
      if (result.success) {
        setIsSuccess(true);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Eroare',
        description: error.message || 'Nu am putut trimite solicitarea. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
        <div className="p-6 text-center bg-green-500/10 rounded-lg border border-green-500/20">
          <h3 className="text-lg font-semibold text-white">Mulțumim!</h3>
          <p className="text-white/80">Solicitarea ta a fost trimisă. Un agent te va contacta în curând.</p>
        </div>
    );
  }

  return (
    <div className="space-y-4">
        <h3 className="text-lg font-semibold text-center">Programează o Vizionare</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="sr-only">Nume</FormLabel><FormControl><Input {...field} placeholder="Nume" className="bg-white/10 border-white/20" /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="sr-only">Telefon</FormLabel><FormControl><Input {...field} placeholder="Telefon" className="bg-white/10 border-white/20" /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel className="sr-only">Email</FormLabel><FormControl><Input type="email" {...field} placeholder="Email" className="bg-white/10 border-white/20" /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel className="sr-only">Mesaj</FormLabel><FormControl><Textarea {...field} placeholder="Mesaj (Opțional)" className="bg-white/10 border-white/20" /></FormControl><FormMessage /></FormItem> )} />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 text-base rounded-lg bg-transparent border border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)] hover:bg-green-500/10 hover:text-green-300"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Programează Vizionare
            </Button>
          </form>
        </Form>
    </div>
  );
}
