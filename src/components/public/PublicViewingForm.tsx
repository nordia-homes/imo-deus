'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import { ScheduleViewingInputSchema } from '@/ai/flows/schedule-viewing';

interface PublicViewingFormProps {
    propertyId: string;
    agencyId: string;
}

export function PublicViewingForm({ propertyId, agencyId }: PublicViewingFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof ScheduleViewingInputSchema>>({
        resolver: zodResolver(ScheduleViewingInputSchema),
        defaultValues: {
            propertyId,
            agencyId,
            name: '',
            phone: '',
            email: '',
            message: '',
        },
    });

    async function onSubmit(values: z.infer<typeof ScheduleViewingInputSchema>) {
        setIsSubmitting(true);
        try {
            const result = await scheduleViewing(values);
            if (result.success) {
                toast({
                    title: "Solicitare trimisă!",
                    description: result.message,
                });
                form.reset();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Eroare',
                description: error.message || 'A apărut o eroare la trimiterea solicitării.',
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Card className="rounded-[1.75rem] border-slate-200/80 bg-white/95 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.35)]">
            <CardHeader>
                <CardTitle>Programează o Vizionare</CardTitle>
                <CardDescription className="text-slate-600">Completați formularul și un agent vă va contacta în cel mai scurt timp.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Nume</FormLabel><FormControl><Input placeholder="Numele dvs." {...field} className="border-slate-200 bg-slate-50" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input placeholder="07xxxxxxxx" {...field} className="border-slate-200 bg-slate-50" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="email@exemplu.com" {...field} className="border-slate-200 bg-slate-50" /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="message" render={({ field }) => (
                            <FormItem><FormLabel>Mesaj (Opțional)</FormLabel><FormControl><Textarea placeholder="Aș dori să aflu mai multe detalii..." {...field} className="border-slate-200 bg-slate-50" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" className="w-full rounded-full shadow-lg shadow-primary/20" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Trimite Solicitarea
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
