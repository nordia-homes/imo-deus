'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import { usePublicAgency } from '@/context/PublicAgencyContext';

const contactSchema = z.object({
  name: z.string().min(2, { message: 'Numele este obligatoriu.' }),
  phone: z.string().min(10, { message: 'Numărul de telefon este invalid.' }),
  email: z.string().email({ message: 'Adresa de email este invalidă.' }),
  message: z.string().optional(),
});

export function PublicContactForm({ propertyId }: { propertyId: string }) {
    const { toast } = useToast();
    const { agencyId } = usePublicAgency();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const form = useForm<z.infer<typeof contactSchema>>({
        resolver: zodResolver(contactSchema),
        defaultValues: { name: '', phone: '', email: '', message: '' },
    });

    async function onSubmit(values: z.infer<typeof contactSchema>) {
        if (!agencyId) {
             toast({
                variant: 'destructive',
                title: 'Eroare',
                description: 'ID-ul agenției lipsește. Reîncărcați pagina.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await scheduleViewing({
                propertyId,
                name: values.name,
                phone: values.phone,
                email: values.email,
                message: values.message,
                agencyId: agencyId, 
            });

            if (result.success) {
                toast({
                    title: 'Solicitare trimisă!',
                    description: 'Un agent vă va contacta în cel mai scurt timp.',
                });
                form.reset();
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error("Failed to send contact message:", error);
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
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input placeholder="Nume și Prenume" {...field} className="bg-slate-800/80 border-slate-700 text-white h-12" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input placeholder="Telefon" {...field} className="bg-slate-800/80 border-slate-700 text-white h-12" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input placeholder="Adresă de email" type="email" {...field} className="bg-slate-800/80 border-slate-700 text-white h-12" />
                        </FormControl>
                         <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Textarea placeholder="Mesajul tău (opțional)" {...field} className="bg-slate-800/80 border-slate-700 text-white" />
                        </FormControl>
                         <FormMessage />
                    </FormItem>
                )} />
                <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Programează o vizionare
                </Button>
            </form>
        </Form>
    );
}
