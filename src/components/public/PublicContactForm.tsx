'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import { Loader2 } from 'lucide-react';

const contactFormSchema = z.object({
  name: z.string().min(1, { message: 'Numele este obligatoriu.' }),
  phone: z.string().min(1, { message: 'Telefonul este obligatoriu.' }),
  email: z.string().email({ message: 'Emailul este invalid.' }),
  message: z.string().optional(),
});

interface PublicContactFormProps {
  propertyId: string;
  agencyId: string;
}

export function PublicContactForm({ propertyId, agencyId }: PublicContactFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: '', phone: '', email: '', message: '' },
  });

  async function onSubmit(values: z.infer<typeof contactFormSchema>) {
    setIsSubmitting(true);
    try {
      const result = await scheduleViewing({ ...values, propertyId, agencyId });
      if (result.success) {
        toast({ title: 'Solicitare trimisă!', description: result.message });
        form.reset();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('Failed to schedule viewing:', error);
      toast({
        variant: 'destructive',
        title: 'Eroare la trimitere',
        description: error.message || 'A apărut o problemă. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormControl><Input {...field} placeholder="Nume" className="bg-white/10 border-white/20 text-white placeholder:text-white/60" /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormControl><Input {...field} placeholder="Telefon" className="bg-white/10 border-white/20 text-white placeholder:text-white/60" /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormControl><Input {...field} placeholder="Email" type="email" className="bg-white/10 border-white/20 text-white placeholder:text-white/60" /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormControl><Textarea {...field} placeholder="Mesajul tău (opțional)" className="bg-white/10 border-white/20 text-white placeholder:text-white/60" /></FormControl><FormMessage /></FormItem> )} />
        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Programează Vizionare
        </Button>
      </form>
    </Form>
  );
}
