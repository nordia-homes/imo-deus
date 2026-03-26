'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const contactSchema = z.object({
    name: z.string().min(2, { message: 'Numele trebuie să aibă cel puțin 2 caractere.' }),
    phone: z.string().min(10, { message: 'Numărul de telefon este invalid.' }),
    email: z.string().email({ message: 'Adresa de email este invalidă.' }),
    message: z.string().optional(),
});

interface PublicContactFormProps {
    propertyId?: string;
    agencyId: string;
}

export function PublicContactForm({ propertyId = '', agencyId }: PublicContactFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isMobile = useIsMobile();

    const form = useForm<z.infer<typeof contactSchema>>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            message: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof contactSchema>) => {
        setIsSubmitting(true);
        try {
            const result = await scheduleViewing({
                ...values,
                propertyId,
                agencyId,
            });

            if (result.success) {
                toast({
                    title: 'Solicitare trimisă!',
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
    };
    
    return (
        <Card className={cn(
            "rounded-[1.75rem] border border-white/10 bg-[#111214]/95 text-stone-100 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl",
            !isMobile && "bg-[#111214]/98"
        )}>
            <CardHeader>
                <CardTitle className="text-lg text-stone-50">Programeaza o Vizionare</CardTitle>
                <CardDescription className="text-stone-400">Completeaza formularul si agentul te va contacta in cel mai scurt timp.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-stone-300">Nume</FormLabel><FormControl><Input {...field} placeholder="Numele tau" className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="text-stone-300">Telefon</FormLabel><FormControl><Input {...field} placeholder="0712 345 678" className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel className="text-stone-300">Email</FormLabel><FormControl><Input {...field} type="email" placeholder="email@exemplu.com" className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel className="text-stone-300">Mesaj (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="As dori mai multe detalii..." className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem> )} />
                        <Button type="submit" className="w-full rounded-full bg-[#d4af37] text-black hover:bg-[#e6c766]" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Trimite Solicitarea
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
