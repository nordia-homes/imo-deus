'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import { cn } from '@/lib/utils';

const contactFormSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu.'),
  phone: z.string().min(1, 'Telefonul este obligatoriu.'),
  email: z.string().email('Email invalid.'),
  message: z.string().optional(),
});

export function PublicContactForm({ propertyId, agencyId }: { propertyId: string, agencyId?: string }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof contactFormSchema>>({
        resolver: zodResolver(contactFormSchema),
        defaultValues: { name: '', phone: '', email: '', message: '' },
    });

    async function onSubmit(values: z.infer<typeof contactFormSchema>) {
        if (!agencyId) {
             toast({ variant: 'destructive', title: 'Eroare', description: 'ID-ul agenției lipsește.' });
             return;
        }

        setIsSubmitting(true);
        try {
            const result = await scheduleViewing({
                ...values,
                propertyId,
                agencyId,
            });

            if (result.success) {
                toast({ title: 'Solicitare trimisă!', description: result.message });
                form.reset();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Eroare', description: error.message || 'Nu am putut trimite solicitarea.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nume</FormLabel><FormControl><Input className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Telefon</FormLabel><FormControl><Input className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Email</FormLabel><FormControl><Input type="email" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Mesaj (opțional)</FormLabel><FormControl><Textarea className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} rows={3} /></FormControl><FormMessage /></FormItem> )}/>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Programează o vizionare
                </Button>
            </form>
        </Form>
    );
}
