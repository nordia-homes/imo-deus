'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import { Loader2 } from 'lucide-react';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Numele este obligatoriu.'),
  phone: z.string().min(10, 'Numărul de telefon este obligatoriu.'),
  email: z.string().email('Adresa de email este invalidă.'),
  message: z.string().optional(),
});

export function PublicContactForm({ agencyId, propertyId }: { agencyId: string, propertyId: string }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      message: '',
    },
  });

  async function onSubmit(values: z.infer<typeof contactFormSchema>) {
    setIsSubmitting(true);
    try {
      const result = await scheduleViewing({
        ...values,
        agencyId,
        propertyId,
      });

      if (result.success) {
        toast({
          title: 'Mesaj trimis!',
          description: result.message,
        });
        form.reset();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
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
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/80">Nume</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Numele dumneavoastră" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
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
              <FormLabel className="text-white/80">Telefon</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Numărul de telefon" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
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
              <FormLabel className="text-white/80">Email</FormLabel>
              <FormControl>
                <Input {...field} type="email" placeholder="Adresa de email" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
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
              <FormLabel className="text-white/80">Mesaj (Opțional)</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Doresc să programez o vizionare..." rows={3} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Programează Vizionare
        </Button>
      </form>
    </Form>
  );
}