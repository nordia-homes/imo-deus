'use client';

import { useParams, notFound } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type { Property, UserProfile } from '@/lib/types';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

import { PublicPropertyHeader } from '@/components/public/PublicPropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { PublicInfoColumn } from '@/components/public/PublicInfoColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bed, Ruler, Calendar, Layers, TrendingUp, Mail, Phone, Loader2 } from 'lucide-react';
import { PriceStatusCard } from '@/components/properties/detail/actions/PriceStatusCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WhatsappIcon } from "@/components/icons/WhatsappIcon";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


// ----------- START OF INLINED/NEW COMPONENTS -----------

// 1. AgentCard
type AgentInfo = {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
}

function AgentCard({ agent }: { agent: AgentInfo }) {
    const getInitials = (name?: string | null) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    const sanitizeForWhatsapp = (phone?: string | null) => {
        if (!phone) return '';
        let sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 && sanitized.startsWith('07')) {
            return `40${sanitized.substring(1)}`;
        }
        return sanitized;
    };
    const sanitizedPhone = sanitizeForWhatsapp(agent.phone);

    return (
        <div className="p-4 flex items-center justify-between bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-3">
                 <Avatar className="h-12 w-12">
                    <AvatarImage src={agent.avatarUrl || undefined} alt={agent.name || 'Agent'}/>
                    <AvatarFallback className="bg-white/20">{getInitials(agent.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-xs text-white/70">Agentul tău:</p>
                    <p className="text-base font-semibold">{agent.name}</p>
                    {agent.phone && <p className="text-sm text-white/70">{agent.phone}</p>}
                </div>
            </div>
            <div className="flex items-center">
                {agent.phone && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-white/80" asChild>
                        <a href={`tel:${agent.phone}`} aria-label="Call agent">
                            <Phone className="h-5 w-5" />
                        </a>
                    </Button>
                )}
                {sanitizedPhone && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-white/80" asChild>
                        <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message agent on WhatsApp">
                            <WhatsappIcon className="h-5 w-5" />
                        </a>
                    </Button>
                )}
                {agent.email && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-white/80" asChild>
                        <a href={`mailto:${agent.email}`} aria-label="Email agent">
                            <Mail className="h-5 w-5" />
                        </a>
                    </Button>
                )}
            </div>
        </div>
    );
}

// 2. PublicScheduleViewingCard
const scheduleSchema = z.object({
  name: z.string().min(1, 'Numele este obligatoriu.'),
  phone: z.string().min(1, 'Telefonul este obligatoriu.'),
  email: z.string().email('Email invalid.'),
  message: z.string().optional(),
});

function PublicScheduleViewingCard({ property, agentProfile, agencyId }: { property: Property, agentProfile: UserProfile | null, agencyId: string }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof scheduleSchema>>({
        resolver: zodResolver(scheduleSchema),
        defaultValues: { name: '', phone: '', email: '', message: '' },
    });

    async function onSubmit(values: z.infer<typeof scheduleSchema>) {
        setIsSubmitting(true);
        try {
            const result = await scheduleViewing({
                ...values,
                propertyId: property.id,
                agencyId,
            });

            if (result.success) {
                toast({ title: 'Solicitare trimisă!', description: result.message });
                form.reset();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Scheduling viewing failed', error);
            toast({
                variant: 'destructive',
                title: 'A apărut o eroare',
                description: (error as Error).message || "Nu am putut trimite solicitarea. Încearcă din nou.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nealocat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };

    return (
        <Card className="rounded-2xl shadow-2xl bg-card lg:bg-[#152A47] lg:border-none lg:text-white">
            <CardHeader>
                <CardTitle className="text-xl">Programează o Vizionare</CardTitle>
                <CardDescription className="lg:text-white/70">
                    Completează formularul și un agent te va contacta în cel mai scurt timp.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <AgentCard agent={agentForCard} />

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="lg:text-white/80">Nume</FormLabel><FormControl><Input {...field} placeholder="Numele tău" className="bg-input lg:bg-white/10 lg:border-white/20" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="lg:text-white/80">Telefon</FormLabel><FormControl><Input {...field} placeholder="0712 345 678" className="bg-input lg:bg-white/10 lg:border-white/20" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel className="lg:text-white/80">Email</FormLabel><FormControl><Input {...field} type="email" placeholder="email@exemplu.com" className="bg-input lg:bg-white/10 lg:border-white/20" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel className="lg:text-white/80">Mesaj (Opțional)</FormLabel><FormControl><Textarea {...field} placeholder="Aș dori mai multe detalii despre..." className="bg-input lg:bg-white/10 lg:border-white/20" /></FormControl><FormMessage /></FormItem> )} />
                        <Button type="submit" disabled={isSubmitting} className="w-full">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Trimite Solicitare
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

// ----------- END OF INLINED/NEW COMPONENTS -----------


const PageSkeleton = () => (
    <div className="space-y-6 lg:p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="space-y-2 w-full"> <Skeleton className="h-8 w-3/4" /> <Skeleton className="h-5 w-1/2" /></div>
            <div className="flex gap-2 w-full justify-start md:justify-end"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-10" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-6">
             <div className="lg:col-span-8 space-y-6"> <Skeleton className="h-[250px] md:h-[550px] bg-white/10" /> <Skeleton className="h-96 bg-white/10" /> </div>
             <div className="lg:col-span-4 space-y-4"> <Skeleton className="h-[700px] bg-white/10" /> </div>
        </div>
    </div>
);

export default function PublicPropertyDetailPage() {
    const params = useParams();
    const { agencyId, propertyId } = params as { agencyId: string, propertyId: string };
    const firestore = useFirestore();
    const isMobile = useIsMobile();

    const [agentProfile, setAgentProfile] = useState<UserProfile | null>(null);
    const [isAgentLoading, setIsAgentLoading] = useState(true);

    const propertyDocRef = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
    }, [firestore, agencyId, propertyId]);
    const { data: property, isLoading: isPropertyLoading, error } = useDoc<Property>(propertyDocRef);

    useEffect(() => {
        if (!property?.agentId || !firestore) {
            setIsAgentLoading(false);
            return;
        }

        const fetchAgent = async () => {
            setIsAgentLoading(true);
            try {
                const agentDocRef = doc(firestore, 'users', property.agentId!);
                const agentSnap = await getDoc(agentDocRef);
                if (agentSnap.exists()) {
                    setAgentProfile({ id: agentSnap.id, ...agentSnap.data() } as UserProfile);
                } else {
                    setAgentProfile(null);
                }
            } catch (error) {
                console.error("Error fetching agent profile:", error);
                setAgentProfile(null);
            } finally {
                setIsAgentLoading(false);
            }
        };

        fetchAgent();
    }, [property, firestore]);
    
    const isLoading = isPropertyLoading || isAgentLoading;
    
    if (isLoading) {
        return <div className="h-full bg-background lg:bg-[#0F1E33] text-white"><PageSkeleton /></div>;
    }
    
    if (!property || error || property.status !== 'Activ') {
        notFound();
        return null;
    }
    
    const getInitials = (name?: string | null) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    const sanitizeForWhatsapp = (phone?: string | null) => {
        if (!phone) return '';
        let sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 && sanitized.startsWith('07')) {
            return `40${sanitized.substring(1)}`;
        }
        return sanitized;
    };
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nealocat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };
    const sanitizedPhone = sanitizeForWhatsapp(agentForCard.phone);


    if (isMobile) {
        return (
          <div className="bg-[#0F1E33] -mt-6 pb-24 min-h-screen text-white">
             <div className="space-y-4">
                 <MediaColumn property={property} />

                <div className="space-y-4 px-2">
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                        <CardContent className="p-3">
                            <div className="flex justify-around items-center text-sm">
                                <div className="flex items-center gap-2"><Bed className="h-5 w-5 text-primary" /> <span className="font-semibold">{property.rooms}</span></div>
                                <div className="flex items-center gap-2"><Ruler className="h-5 w-5 text-primary" /> <span className="font-semibold">{property.squareFootage} mp</span></div>
                                {property.constructionYear && (<div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> <span className="font-semibold">{property.constructionYear}</span></div>)}
                                {property.floor && (<div className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> <span className="font-semibold">{property.floor}</span></div>)}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-xl font-bold">{property.title}</CardTitle>
                            <CardDescription className="text-sm text-white/70">{property.address}</CardDescription>
                        </CardHeader>
                    </Card>
                    
                    <PriceStatusCard property={property} isMobile={isMobile}/>
                    
                    <PublicInfoColumn property={property} isMobile={true} />
                </div>
            </div>
             <div className="fixed bottom-0 left-0 right-0 bg-[#152A47] p-3 border-t border-white/10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.4)] z-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11">
                            <AvatarImage src={agentForCard.avatarUrl || undefined} alt={agentForCard.name || 'Agent'}/>
                            <AvatarFallback className="bg-white/20">{getInitials(agentForCard.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-xs text-white/70">Contactează agentul</p>
                            <p className="text-base font-semibold">{agentForCard.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {agentForCard.phone && (
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-white/10 border-white/20" asChild>
                                <a href={`tel:${agentForCard.phone}`} aria-label="Apelează agentul">
                                    <Phone className="h-5 w-5" />
                                </a>
                            </Button>
                        )}
                        {sanitizedPhone && (
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-green-500/20 border-green-500/50 text-green-400" asChild>
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Trimite mesaj pe WhatsApp">
                                    <WhatsappIcon className="h-6 w-6" />
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
          </div>
        );
    }

    return (
        <div className={cn("bg-[#0F1E33] text-white animated-glow")}>
             <div className="container mx-auto px-4 py-8">
                <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="col-span-12 lg:col-span-8 space-y-8">
                        <PublicPropertyHeader property={property} />
                        <MediaColumn property={property} />
                        <PublicInfoColumn property={property} isMobile={false} />
                    </div>

                    <div className="col-span-12 lg:col-span-4 lg:sticky top-24">
                         <PublicScheduleViewingCard property={property} agentProfile={agentProfile} agencyId={agencyId} />
                    </div>
                </main>
             </div>
        </div>
    );
}
