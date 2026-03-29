'use client';

import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type { Property, UserProfile } from '@/lib/types';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';

import { PublicPropertyHeader } from '@/components/public/PublicPropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { PublicInfoColumn } from '@/components/public/PublicInfoColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Mail, Phone, Loader2 } from 'lucide-react';
import { PriceStatusCard } from '@/components/properties/detail/actions/PriceStatusCard';
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
import { PropertiesMap } from '@/components/map/PropertiesMap';
import { SimilarProperties } from '@/components/public/SimilarProperties';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';


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
        <div className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-[#18191d] p-4">
            <div className="flex items-center gap-3">
                 <Avatar className="h-12 w-12">
                    <AvatarImage src={agent.avatarUrl || undefined} alt={agent.name || 'Agent'}/>
                    <AvatarFallback className="bg-[#22c55e]/15 text-[#86efac]">{getInitials(agent.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-xs text-stone-500">Consultantul tau</p>
                    <p className="text-base font-semibold text-stone-50">{agent.name}</p>
                    {agent.phone && <p className="text-sm text-stone-400">{agent.phone}</p>}
                </div>
            </div>
            <div className="flex items-center">
                {agent.phone && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-stone-300 hover:bg-white/5 hover:text-stone-50" asChild>
                        <a href={`tel:${agent.phone}`} aria-label="Call agent">
                            <Phone className="h-5 w-5" />
                        </a>
                    </Button>
                )}
                {sanitizedPhone && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-stone-300 hover:bg-white/5 hover:text-stone-50" asChild>
                        <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message agent on WhatsApp">
                            <WhatsappIcon className="h-5 w-5" />
                        </a>
                    </Button>
                )}
                {agent.email && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-stone-300 hover:bg-white/5 hover:text-stone-50" asChild>
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
  website: z.string().max(0).optional(),
  formStartedAt: z.number(),
});

function PublicScheduleViewingCard({ property, agentProfile, agencyId }: { property: Property, agentProfile: UserProfile | null, agencyId: string }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formStartedAt = useMemo(() => Date.now(), []);

    const form = useForm<z.infer<typeof scheduleSchema>>({
        resolver: zodResolver(scheduleSchema),
        defaultValues: { name: '', phone: '', email: '', message: '', website: '', formStartedAt },
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
        <Card className="rounded-[2rem] border border-white/10 bg-[#101113]/95 text-stone-100 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
            <CardHeader>
                <CardTitle className="text-xl text-stone-50">Programeaza o Vizionare</CardTitle>
                <CardDescription className="text-stone-400">
                    Completează formularul și un agent te va contacta în cel mai scurt timp.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <AgentCard agent={agentForCard} />

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="hidden" aria-hidden="true">
                            <FormField control={form.control} name="website" render={({ field }) => ( <FormItem tabIndex={-1}><FormLabel>Website</FormLabel><FormControl><Input {...field} autoComplete="off" className="hidden" /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-stone-300">Nume</FormLabel><FormControl><Input {...field} placeholder="Numele tau" className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="text-stone-300">Telefon</FormLabel><FormControl><Input {...field} placeholder="0712 345 678" className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel className="text-stone-300">Email</FormLabel><FormControl><Input {...field} type="email" placeholder="email@exemplu.com" className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="message" render={({ field }) => ( <FormItem><FormLabel className="text-stone-300">Mesaj (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="As dori mai multe detalii despre..." className="border-white/10 bg-[#18191d] text-stone-100 placeholder:text-stone-500" /></FormControl><FormMessage /></FormItem> )} />
                        <Button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-[#22c55e] text-black hover:bg-[#4ade80]">
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

const financeCardClassName = "overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.2),transparent_28%),linear-gradient(135deg,rgba(7,18,12,0.96)_0%,rgba(10,10,12,0.98)_52%,rgba(16,24,18,0.96)_100%)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]";
const financeCardClassNameSoft = "overflow-hidden rounded-[2rem] border border-emerald-400/16 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.08),transparent_28%),linear-gradient(135deg,rgba(7,18,12,0.96)_0%,rgba(10,10,12,0.98)_52%,rgba(16,24,18,0.96)_100%)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]";
const financeCardClassNameMedium = "overflow-hidden rounded-[2rem] border border-emerald-400/18 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.14),transparent_28%),linear-gradient(135deg,rgba(7,18,12,0.96)_0%,rgba(10,10,12,0.98)_52%,rgba(16,24,18,0.96)_100%)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]";


const PageSkeleton = () => (
    <div className="space-y-6 lg:p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="space-y-2 w-full"> <Skeleton className="h-8 w-3/4" /> <Skeleton className="h-5 w-1/2" /></div>
            <div className="flex gap-2 w-full justify-start md:justify-end"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-10" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-6">
             <div className="lg:col-span-8 space-y-6"> <Skeleton className="h-[250px] md:h-[550px]" /> <Skeleton className="h-96" /> </div>
             <div className="lg:col-span-4 space-y-4"> <Skeleton className="h-[700px]" /> </div>
        </div>
    </div>
);

export default function PublicPropertyDetailPage() {
    const params = useParams();
    const { agencyId: contextAgencyId, agency } = usePublicAgency();
    const routeParams = params as { agencyId?: string, propertyId?: string };
    const agencyId = routeParams.agencyId || contextAgencyId || '';
    const propertyId = routeParams.propertyId || '';
    const firestore = useFirestore();
    const isMobile = useIsMobile();
    const publicPath = usePublicPath();

    const [agentProfile, setAgentProfile] = useState<UserProfile | null>(null);
    const [isAgentLoading, setIsAgentLoading] = useState(true);

    const propertyDocRef = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
    }, [firestore, agencyId, propertyId]);
    const { data: property, isLoading: isPropertyLoading, error } = useDoc<Property>(propertyDocRef);
    
    // Fetch all active properties for the agency to find similar ones
    const allPropertiesQuery = useMemoFirebase(() => {
      if (!agencyId) return null;
      return query(
          collection(firestore, 'agencies', agencyId, 'properties'),
          where('status', '==', 'Activ')
      );
    }, [firestore, agencyId]);
    const { data: allProperties, isLoading: areAllPropertiesLoading } = useCollection<Property>(allPropertiesQuery);
    
    // Filter for similar properties
    const similarProperties = useMemo(() => {
        if (!property || !allProperties) return [];

        const priceFlexibility = 0.25; // 25%
        const minPrice = property.price * (1 - priceFlexibility);
        const maxPrice = property.price * (1 + priceFlexibility);

        return allProperties
        .filter(p =>
            p.id !== property.id &&
            p.propertyType === property.propertyType &&
            p.price >= minPrice &&
            p.price <= maxPrice
        )
        .slice(0, 10);
    }, [property, allProperties]);


    useEffect(() => {
        if (!property?.agentId || !firestore) {
            setIsAgentLoading(false);
            return;
        }

        const fetchAgent = async () => {
            setIsAgentLoading(true);
            try {
                const response = await fetch(`/api/public-agent?agencyId=${encodeURIComponent(agencyId)}&agentId=${encodeURIComponent(property.agentId!)}`, {
                    cache: 'no-store',
                });
                if (!response.ok) {
                    throw new Error('Nu am putut incarca profilul public al agentului.');
                }
                const payload = await response.json();
                if (payload?.agent) {
                    setAgentProfile(payload.agent as UserProfile);
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
    
    const isLoading = isPropertyLoading || isAgentLoading || areAllPropertiesLoading;
    
    if (isLoading) {
        return <div className="h-full bg-background"><PageSkeleton /></div>;
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
        name: agentProfile?.name || property.agentName || property.agent?.name || agency?.name || "Consultant",
        email: agentProfile?.email || agency?.email || null,
        phone: agentProfile?.phone || agency?.phone || null,
        avatarUrl:
            agentProfile?.photoUrl ||
            property.agent?.avatarUrl ||
            `https://i.pravatar.cc/150?u=${property.agentId || agencyId || 'unassigned'}`,
    };
    const sanitizedPhone = sanitizeForWhatsapp(agentForCard.phone);


    if (isMobile) {
        return (
          <div className="min-h-screen bg-transparent pb-24 text-stone-100">
             <div className="space-y-0">
                 <MediaColumn property={property} />

                <div className="space-y-4 px-2">
                    <Card className="mx-[-0.5rem] -mb-4 overflow-hidden rounded-b-[2rem] rounded-t-none border-0 bg-[#0b0f0d] shadow-none">
                        <CardContent className="space-y-3 p-4">
                            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-medium text-stone-200">
                                {property.rooms ? <span className="whitespace-nowrap">{property.rooms} camere</span> : null}
                                {property.rooms && property.squareFootage ? <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" /> : null}
                                {property.squareFootage ? <span className="whitespace-nowrap">{property.squareFootage} mp</span> : null}
                                {(property.rooms || property.squareFootage) && property.constructionYear ? <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" /> : null}
                                {property.constructionYear ? <span className="whitespace-nowrap">An {property.constructionYear}</span> : null}
                                {(property.rooms || property.squareFootage || property.constructionYear) && property.floor ? <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" /> : null}
                                {property.floor ? <span className="whitespace-nowrap">Etaj {property.floor}</span> : null}
                            </div>

                            <div className="space-y-1 border-t border-white/10 pt-3 text-center">
                                <CardTitle className="text-xl font-bold text-stone-50">{property.title}</CardTitle>
                                <CardDescription className="text-sm text-stone-400">{property.address}</CardDescription>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <PriceStatusCard property={property} isMobile={isMobile}/>
                    
                    <PublicInfoColumn property={property} isMobile={true} />

                    <Card className={financeCardClassName}>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-lg font-bold text-stone-50">Localizare pe harta</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 h-80">
                            <PropertiesMap properties={[property]} />
                        </CardContent>
                    </Card>

                    <SimilarProperties properties={similarProperties} />

                    <Card className={financeCardClassName}>
                        <CardContent className="p-5">
                            <div className="space-y-4">
                                <div className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                                    Mai multe optiuni
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-semibold tracking-tight text-white">
                                        Continua cautarea in portofoliul complet al agentiei.
                                    </h3>
                                    <p className="text-sm leading-7 text-emerald-50/85 md:text-base">
                                        Descopera toate proprietatile disponibile, compara stiluri, bugete si zone, apoi alege varianta care ti se potriveste cel mai bine.
                                    </p>
                                </div>
                                <Button asChild className="w-full rounded-full bg-[#22c55e] text-black hover:bg-[#4ade80]">
                                    <Link href={publicPath('/properties')} className="inline-flex items-center justify-center gap-2">
                                        Vezi toate proprietatile
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
             <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/88 p-3 shadow-[0_-12px_40px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11">
                            <AvatarImage src={agentForCard.avatarUrl || undefined} alt={agentForCard.name || 'Agent'}/>
                            <AvatarFallback className="bg-[#22c55e]/15 text-[#86efac]">{getInitials(agentForCard.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-xs text-stone-500">Contacteaza agentul</p>
                            <p className="text-base font-semibold text-stone-50">{agentForCard.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {agentForCard.phone && (
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-white/10 bg-white/5 text-stone-100 hover:bg-white/10" asChild>
                                <a href={`tel:${agentForCard.phone}`} aria-label="Apelează agentul">
                                    <Phone className="h-5 w-5" />
                                </a>
                            </Button>
                        )}
                        {sanitizedPhone && (
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-[#22c55e]/30 bg-[#22c55e]/10 text-[#86efac] hover:bg-[#22c55e]/20" asChild>
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
        <div className="bg-transparent">
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
