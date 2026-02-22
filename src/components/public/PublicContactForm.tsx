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
    propertyId: string;
    agencyId: string;
}

export function PublicContactForm({ propertyId, agencyId }: PublicContactFormProps) {
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
            "shadow-2xl rounded-2xl",
            isMobile ? "bg-[#152A47] border-none text-white" : "bg-card text-card-foreground"
        )}>
            <CardHeader>
                <CardTitle className="text-lg">Programează o Vizionare</CardTitle>
                <CardDescription className={cn(isMobile && "text-white/70")}>Completează formularul și agentul te va contacta în cel mai scurt timp.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel className={cn(isMobile && "text-white/80")}>Nume</FormLabel><FormControl><Input {...field} placeholder="Numele tău" className={cn(isMobile && "bg-white/10 border-white/20")} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className={cn(isMobile && "text-white/80")}>Telefon</FormLabel><FormControl><Input {...field} placeholder="0712 345 678" className={cn(isMobile && "bg-white/10 border-white/20")} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel className={cn(isMobile && "text-white/80")}>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="email@exemplu.com" className={cn(isMobile && "bg-white/10 border-white/20")} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel className={cn(isMobile && "text-white/80")}>Mesaj (Opțional)</FormLabel><FormControl><Textarea {...field} placeholder="Aș dori mai multe detalii..." className={cn(isMobile && "bg-white/10 border-white/20")} /></FormControl><FormMessage /></FormItem> )} />
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Trimite Solicitarea
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
