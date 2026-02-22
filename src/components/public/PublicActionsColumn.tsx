'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import type { Property, UserProfile } from '@/lib/types';
import { AgentCard } from '@/components/properties/detail/actions/AgentCard';
import { OwnerCard } from '@/components/properties/detail/actions/OwnerCard';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { AiPriceEvaluationDialog } from './AiPriceEvaluationDialog';

const contactFormSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu.'),
  phone: z.string().min(1, 'Telefonul este obligatoriu.'),
  email: z.string().email('Email invalid.'),
  message: z.string().optional(),
});

export function PublicActionsColumn({ property, agentProfile, agencyId, isMobile }: { property: Property, agentProfile: UserProfile | null, agencyId: string, isMobile?: boolean }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName,
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };

    const form = useForm<z.infer<typeof contactFormSchema>>({
        resolver: zodResolver(contactFormSchema),
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            message: `Bună ziua, sunt interesat de proprietatea "${property.title}". Aș dori să programez o vizionare.`,
        },
    });

    async function onSubmit(values: z.infer<typeof contactFormSchema>) {
        setIsSubmitting(true);
        try {
            const result = await scheduleViewing({ ...values, propertyId: property.id, agencyId });
            if (result.success) {
                toast({ title: "Solicitare trimisă!", description: result.message });
                form.reset();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error("Failed to schedule viewing:", error);
            toast({ variant: 'destructive', title: 'Eroare', description: error.message || 'Nu am putut trimite solicitarea.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className={cn(!isMobile && "sticky top-28")}>
            <Card className={cn(
                "rounded-2xl shadow-2xl",
                isMobile ? "bg-[#152A47] border-none p-4" : "bg-[#f8f8f9] lg:bg-[#152A47] lg:border-none lg:text-white"
            )}>
                 <div className={cn("space-y-4", isMobile && "text-white")}>
                    {agentForCard.name && <AgentCard agent={agentForCard} isMobile={isMobile} />}
                    <OwnerCard property={property} isMobile={isMobile} />
                    <Separator className={cn(isMobile ? "bg-white/20" : "")} />
                    <div className={cn(isMobile && "text-center")}>
                         <h3 className="text-lg font-semibold">Programează o Vizionare</h3>
                         <p className={cn("text-sm", isMobile ? "text-white/70" : "text-muted-foreground lg:text-white/70")}>Agentul nostru te va contacta în cel mai scurt timp.</p>
                    </div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="sr-only">Nume</FormLabel><FormControl><Input placeholder="Nume" {...field} className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="sr-only">Telefon</FormLabel><FormControl><Input placeholder="Telefon" {...field} className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel className="sr-only">Email</FormLabel><FormControl><Input placeholder="Email" {...field} className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel className="sr-only">Mesaj</FormLabel><FormControl><Textarea placeholder="Mesajul tău..." rows={3} {...field} className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")} /></FormControl><FormMessage /></FormItem> )} />
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Trimite Solicitarea
                            </Button>
                        </form>
                    </Form>
                </div>
            </Card>
             <div className="mt-4">
                 <AiPriceEvaluationDialog property={property} />
            </div>
        </div>
    );
}
