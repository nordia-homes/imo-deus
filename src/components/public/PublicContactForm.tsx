
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';

const contactSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu.'),
  phone: z.string().min(1, 'Telefonul este obligatoriu.'),
  email: z.string().email('Adresa de email este invalidă.'),
  message: z.string().optional(),
});

interface PublicContactFormProps {
    propertyId: string;
    agencyId: string;
}

export function PublicContactForm({ propertyId, agencyId }: PublicContactFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof contactSchema>>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            message: '',
        }
    });

    async function onSubmit(values: z.infer<typeof contactSchema>) {
        setIsSubmitting(true);
        try {
            const result = await scheduleViewing({
                ...values,
                agencyId: agencyId,
                propertyId: propertyId,
            });

            if (result.success) {
                toast({
                    title: "Solicitare trimisă!",
                    description: "Un agent vă va contacta în curând pentru a confirma vizionarea.",
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="sr-only">Nume</FormLabel>
                            <FormControl>
                                <Input placeholder="Nume" {...field} className="bg-slate-800/60 border-slate-700 h-12" />
                            </FormControl>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="sr-only">Telefon</FormLabel>
                            <FormControl>
                                <Input placeholder="Telefon" {...field} className="bg-slate-800/60 border-slate-700 h-12" />
                            </FormControl>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="sr-only">Email</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="Email" {...field} className="bg-slate-800/60 border-slate-700 h-12" />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="sr-only">Mesaj (opțional)</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Mesaj (opțional)" {...field} className="bg-slate-800/60 border-slate-700 min-h-[80px]" />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-green-600 hover:bg-green-700 text-base">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Programează o vizionare
                </Button>
                <p className="text-xs text-center text-white/60 pt-1">⭐ Răspundem în mai puțin de 30 de minute</p>
            </form>
        </Form>
    );
}
