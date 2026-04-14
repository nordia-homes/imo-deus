'use client';
import { useMemo } from 'react';
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
    const formStartedAt = useMemo(() => Date.now(), []);

    const form = useForm<z.infer<typeof ScheduleViewingInputSchema>>({
        resolver: zodResolver(ScheduleViewingInputSchema),
        defaultValues: {
            propertyId,
            agencyId,
            name: '',
            phone: '',
            email: '',
            message: '',
            website: '',
            formStartedAt,
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
        <Card className="rounded-[1.75rem] border border-white/10 bg-[var(--public-header-bg)] text-stone-100 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
            <CardHeader>
                <CardTitle className="text-stone-50">Programeaza o Vizionare</CardTitle>
                <CardDescription className="text-stone-400">Completati formularul si un agent va va contacta in cel mai scurt timp.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="hidden" aria-hidden="true">
                            <FormField control={form.control} name="website" render={({ field }) => (
                                <FormItem tabIndex={-1}><FormLabel>Website</FormLabel><FormControl><Input placeholder="" {...field} autoComplete="off" /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel className="text-stone-300">Nume</FormLabel><FormControl><Input placeholder="Numele dvs." {...field} className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem><FormLabel className="text-stone-300">Telefon</FormLabel><FormControl><Input placeholder="07xxxxxxxx" {...field} className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel className="text-stone-300">Email</FormLabel><FormControl><Input type="email" placeholder="email@exemplu.com" {...field} className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="message" render={({ field }) => (
                            <FormItem><FormLabel className="text-stone-300">Mesaj (Optional)</FormLabel><FormControl><Textarea placeholder="As dori sa aflu mai multe detalii..." {...field} className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" className="w-full rounded-full bg-[#22c55e] text-black hover:bg-[#4ade80]" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Trimite Solicitarea
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
