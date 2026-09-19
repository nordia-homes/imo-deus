'use client';

import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { addDoc, collection, query, where } from 'firebase/firestore';
import type { Contact, Property, MatchedProperty } from '@/lib/types';
import { propertyMatcher } from '@/ai/flows/property-matcher';
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Wand2, Star, Info, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useAgency } from '@/context/AgencyContext';
import { useUser } from '@/firebase';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import '@/components/marketing/tiktok-ads/tiktok-workspace.css';

const propertyMatchSchema = z.object({
  desiredPriceRangeMin: z.coerce.number(),
  desiredPriceRangeMax: z.coerce.number(),
  desiredRooms: z.coerce.number(),
  desiredBathrooms: z.coerce.number(),
  desiredSquareFootageMin: z.coerce.number(),
  desiredSquareFootageMax: z.coerce.number(),
  desiredFeatures: z.string(),
  locationPreferences: z.string(),
}).refine((values) => values.desiredPriceRangeMin <= values.desiredPriceRangeMax, {
  message: 'Prețul minim nu poate fi mai mare decât prețul maxim.',
  path: ['desiredPriceRangeMin'],
}).refine((values) => values.desiredSquareFootageMin <= values.desiredSquareFootageMax, {
  message: 'Suprafața minimă nu poate fi mai mare decât suprafața maximă.',
  path: ['desiredSquareFootageMin'],
});

export default function MatchingPage() {
    const { agencyId } = useAgency();
    const { user, userProfile } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [isMatching, setIsMatching] = useState(false);
    const [matchedProperties, setMatchedProperties] = useState<MatchedProperty[]>([]);
    const [actionPropertyId, setActionPropertyId] = useState<string | null>(null);
    
    // --- Data Fetching ---
    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'contacts'), where('contactType', '==', 'Cumparator'));
    }, [firestore, agencyId]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'properties'), where('status', '==', 'Activ'));
    }, [firestore, agencyId]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);
    
    const selectedContact = useMemo(() => {
        if (!selectedContactId || !contacts) return null;
        return contacts.find(c => c.id === selectedContactId);
    }, [selectedContactId, contacts]);

    const form = useForm<z.infer<typeof propertyMatchSchema>>({
        resolver: zodResolver(propertyMatchSchema),
    });

    useEffect(() => {
        if (selectedContact) {
            const baseBudget = selectedContact.budget && selectedContact.budget > 0 ? selectedContact.budget : 100000;
            const preferences = selectedContact.preferences || {
                desiredPriceRangeMin: baseBudget * 0.8,
                desiredPriceRangeMax: baseBudget * 1.2,
                desiredRooms: 2,
                desiredBathrooms: 1,
                desiredSquareFootageMin: 50,
                desiredSquareFootageMax: 100,
                desiredFeatures: '',
                locationPreferences: selectedContact.city || '',
            };
            form.reset(preferences);
        } else {
            form.reset({});
        }
    }, [selectedContact, form]);

    const handleSelectContact = (contactId: string) => {
        setSelectedContactId(contactId);
        setMatchedProperties([]);
    };


    const onMatchSubmit = async (values: z.infer<typeof propertyMatchSchema>) => {
        if (!selectedContact || !properties) {
            toast({ variant: "destructive", title: "Date lipsă", description: "Selectează un client și asigură-te că ai proprietăți în portofoliu."});
            return;
        }

        setIsMatching(true);
        setMatchedProperties([]);
        
        const clientPreferences = values;
        
        const matcherProperties = properties.map(p => ({
            ...p,
            address: p.address || p.location || '',
            price: p.price || 0,
            rooms: p.rooms || 0,
            bathrooms: p.bathrooms || 0,
            squareFootage: p.squareFootage || 0,
            description: p.description || p.title || '',
            image: p.images?.[0]?.url || `https://picsum.photos/seed/${p.id}/400/300`,
        }));

        try {
            const result = await propertyMatcher({
                clientPreferences,
                properties: matcherProperties,
                contact: selectedContact,
            });
            setMatchedProperties(result.matchedProperties as MatchedProperty[]);
            if (result.matchedProperties.length === 0) {
                 toast({
                    title: 'Nicio potrivire perfectă găsită',
                    description: 'AI-ul nu a găsit nicio proprietate care să corespundă criteriilor.',
                });
            }
        } catch (error) {
            console.error('Property matching failed:', error);
            toast({ variant: "destructive", title: "A apărut o eroare", description: "Nu am putut găsi proprietăți potrivite."});
        } finally {
            setIsMatching(false);
        }
    };

    const createTaskForMatch = async (property: MatchedProperty) => {
        if (!agencyId || !user || !selectedContact) return;
        setActionPropertyId(property.id);
        try {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1);
            await addDoc(collection(firestore, 'agencies', agencyId, 'tasks'), {
                description: `Contactează ${selectedContact.name} despre ${property.title}`,
                dueDate: dueDate.toISOString(),
                status: 'open',
                agentId: user.uid,
                agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
                contactId: selectedContact.id,
                contactName: selectedContact.name,
                propertyId: property.id,
                propertyTitle: property.title,
                createdAt: new Date().toISOString(),
            });
            toast({ title: 'Task creat', description: 'Task-ul a fost adăugat în calendarul agenției.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Task-ul nu a putut fi creat', description: error instanceof Error ? error.message : 'Încearcă din nou.' });
        } finally {
            setActionPropertyId(null);
        }
    };

    const createViewingForMatch = async (property: MatchedProperty) => {
        if (!agencyId || !user || !selectedContact) return;
        setActionPropertyId(property.id);
        try {
            const viewingDate = new Date();
            viewingDate.setDate(viewingDate.getDate() + 1);
            viewingDate.setHours(11, 0, 0, 0);
            await addDoc(collection(firestore, 'agencies', agencyId, 'viewings'), {
                propertyId: property.id,
                propertyTitle: property.title,
                propertyAddress: property.location || '',
                contactId: selectedContact.id,
                contactName: selectedContact.name,
                agentId: user.uid,
                agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
                viewingDate: viewingDate.toISOString(),
                status: 'scheduled',
                createdAt: new Date().toISOString(),
            });
            toast({ title: 'Vizionare programată', description: 'Vizionarea a fost adăugată în calendar.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Vizionarea nu a putut fi programată', description: error instanceof Error ? error.message : 'Încearcă din nou.' });
        } finally {
            setActionPropertyId(null);
        }
    };

    const isLoading = areContactsLoading || arePropertiesLoading;

    return (
        <div className="tt-design tt-workspace settings-matching-page space-y-6 p-2 lg:p-4">
            <style>{`
                .settings-matching-page [class*="text-white"] { color: #182b40 !important; -webkit-text-fill-color: currentColor !important; }
                .settings-matching-page [class*="bg-white"] { background-color: transparent !important; background-image: none !important; }
                .settings-matching-page .agentfinder-matching-card,
                .settings-matching-page .agentfinder-matching-result-card,
                .settings-matching-page .agentfinder-matching-score-card {
                    background: #ffffff !important;
                    border-color: rgba(119,146,173,.20) !important;
                }
                .settings-matching-page input,
                .settings-matching-page textarea,
                .settings-matching-page select {
                    height: 44px; border-radius: 10px !important; border: 1px solid #d5e0e9 !important;
                    background: #ffffff !important; color: #263b51 !important; padding: 10px 13px; font-size: 13px;
                    box-shadow: none !important;
                }
                .settings-matching-page button:not([role=switch]) {
                    border-radius: 12px !important; min-height: 42px; font-weight: 650;
                    background: #ffffff !important; border: 1px solid #d9e3ec !important; color: #2d455d !important;
                }
                .settings-matching-page button[type=submit] {
                    background: linear-gradient(115deg,#b5f2e1,#78e4db) !important;
                    color: #082a2a !important;
                    border-color: #a0e5dc !important;
                }
                .settings-matching-page [role=combobox] {
                    background: #ffffff !important;
                    color: #263b51 !important;
                    border-color: #d5e0e9 !important;
                }
            `}</style>
            <div className="tt-design settings-tiktok">
                <style>{`
                    .settings-tiktok .tt-hero { min-height: 0 !important; padding: 24px 28px !important; }
                `}</style>
                <header className="tt-hero">
                    <div>
                        <div className="tt-hero-kicker">
                            <Wand2 size={17} />
                            <span className="tt-eyebrow">POTRIVIRE AI</span>
                        </div>
                        <h1>Potrivire <em>Proprietăți AI</em></h1>
                        <p className="tt-hero-lead">
                            Cele mai bune proprietăți pentru clienții tăi.
                            <br />
                            <strong>Analiză inteligentă, rezultate clare.</strong>
                        </p>
                        <p>
                            Selectează un client, ajustează preferințele și lasă AI-ul să găsească potrivirile.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <article className="tt-feature">
                            <span className="tt-icon-tile"><Users size={18} /></span>
                            <span className="tt-eyebrow">01 / CLIENT</span>
                            <h2>Alege clientul</h2>
                            <p>Selectează un cumpărător din CRM pentru a-i încărca preferințele.</p>
                        </article>
                        <article className="tt-feature tt-feature--video">
                            <span className="tt-icon-tile"><Wand2 size={18} /></span>
                            <span className="tt-eyebrow">02 / ANALIZĂ</span>
                            <h2>Lansează potrivirea</h2>
                            <p>AI-ul compară preferințele cu portofoliul activ și propune cele mai bune proprietăți.</p>
                        </article>
                    </div>
                </header>
            </div>
            
            <Card className="agentfinder-matching-card bg-[#152A47] border-none text-white rounded-2xl shadow-2xl">
                <CardHeader>
                    <CardTitle className="text-white">1. Selectează un client</CardTitle>
                    <CardDescription className="text-white/70">Alege un lead din lista ta pentru a-i vedea preferințele și a rula analiza.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-10 w-full md:w-1/2 bg-white/10" /> : (
                        <Select onValueChange={handleSelectContact} value={selectedContactId || ''}>
                            <SelectTrigger className="agentfinder-matching-select w-full md:w-1/2 bg-white/10 border-white/20 text-white">
                                <SelectValue placeholder="Selectează un client..." />
                            </SelectTrigger>
                            <SelectContent>
                                {contacts?.map(contact => (
                                    <SelectItem key={contact.id} value={contact.id}>
                                        {contact.name} - {contact.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </CardContent>
            </Card>

            {selectedContact && (
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onMatchSubmit)}>
                        <Card className="agentfinder-matching-card animate-in fade-in-0 bg-[#152A47] border-none text-white rounded-2xl shadow-2xl">
                            <CardHeader>
                                <CardTitle className="text-white">2. Preferințele lui {selectedContact.name}</CardTitle>
                                <CardDescription className="text-white/70">Ajustează criteriile de mai jos, apoi lansează analiza AI.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                     <FormField control={form.control} name="desiredPriceRangeMin" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Preț Min (€)</FormLabel><FormControl><Input type="number" {...field} className="bg-white/10 border-white/20 text-white" /></FormControl></FormItem> )}/>
                                     <FormField control={form.control} name="desiredPriceRangeMax" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Preț Max (€)</FormLabel><FormControl><Input type="number" {...field} className="bg-white/10 border-white/20 text-white" /></FormControl></FormItem> )}/>
                                     <FormField control={form.control} name="desiredRooms" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Camere</FormLabel><FormControl><Input type="number" {...field} className="bg-white/10 border-white/20 text-white" /></FormControl></FormItem> )}/>
                                     <FormField control={form.control} name="desiredBathrooms" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Băi</FormLabel><FormControl><Input type="number" {...field} className="bg-white/10 border-white/20 text-white" /></FormControl></FormItem> )}/>
                                     <FormField control={form.control} name="desiredSquareFootageMin" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Suprafață Min</FormLabel><FormControl><Input type="number" {...field} className="bg-white/10 border-white/20 text-white" /></FormControl></FormItem> )}/>
                                     <FormField control={form.control} name="desiredSquareFootageMax" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Suprafață Max</FormLabel><FormControl><Input type="number" {...field} className="bg-white/10 border-white/20 text-white" /></FormControl></FormItem> )}/>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="locationPreferences" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Locație Preferată</FormLabel><FormControl><Input {...field} className="bg-white/10 border-white/20 text-white" /></FormControl></FormItem> )}/>
                                    <FormField control={form.control} name="desiredFeatures" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Caracteristici Dorite</FormLabel><FormControl><Textarea {...field} rows={2} className="bg-white/10 border-white/20 text-white" /></FormControl></FormItem> )}/>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" disabled={isMatching}>
                                    {isMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                    Găsește Potriviri
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                 </Form>
            )}

            {isMatching && (
                <div className="agentfinder-matching-loading text-center p-8">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
                    <p className="font-semibold text-white">Analiza AI este în curs...</p>
                    <p className="text-sm text-white/70">Căutăm cele mai bune proprietăți. Acest proces poate dura câteva momente.</p>
                </div>
            )}
            
            {matchedProperties.length > 0 && !isMatching && (
                 <div className="agentfinder-matching-results space-y-6 animate-in fade-in-0">
                     <h2 className="text-2xl font-headline font-bold text-white">3. Rezultate Analiză AI</h2>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {matchedProperties.map(prop => (
                            <Card key={prop.id} className="agentfinder-matching-result-card flex flex-col md:flex-row gap-4 p-4 bg-[#152A47] border-none text-white rounded-2xl shadow-2xl">
                                <Link href={`/properties/${prop.id}`} className="block w-full md:w-1/3 aspect-video md:aspect-auto relative shrink-0">
                                    <Image 
                                        src={prop.images?.[0]?.url || `https://picsum.photos/seed/${prop.id}/400/300`}
                                        alt={prop.title || 'Proprietate'}
                                        fill
                                        className="rounded-md object-cover"
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                                    />
                                </Link>
                                <div className="flex-1">
                                    <Link href={`/properties/${prop.id}`} className="hover:underline">
                                        <CardTitle className="text-base text-white">{prop.title}</CardTitle>
                                    </Link>
                                    <p className="text-lg font-bold text-primary mt-1">€{prop.price.toLocaleString()}</p>
                                    
                                    <Card className="agentfinder-matching-score-card mt-4 bg-blue-900/30 border-blue-500/50 text-white">
                                        <CardHeader className="flex flex-row items-center gap-2 p-2">
                                            <Star className="h-4 w-4 text-blue-400" />
                                            <CardTitle className="font-bold text-blue-300 text-sm">Potrivire: {prop.matchScore}/100</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-2 pt-0">
                                            <CardDescription className="text-xs text-blue-200">
                                            {prop.reasoning}
                                            </CardDescription>
                                        </CardContent>
                                    </Card>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={actionPropertyId === prop.id}
                                            onClick={() => void createViewingForMatch(prop)}
                                        >
                                            {actionPropertyId === prop.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Programează vizionare
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={actionPropertyId === prop.id}
                                            onClick={() => void createTaskForMatch(prop)}
                                        >
                                            {actionPropertyId === prop.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Creează task
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

             {!isMatching && matchedProperties.length === 0 && selectedContactId && (
                 <Alert className="agentfinder-matching-alert mt-6 bg-transparent border-white/20 text-white">
                     <Info className="h-4 w-4 text-white" />
                    <AlertTitle className="text-white">Gata de analiză</AlertTitle>
                    <AlertDescription className="text-white/70">
                       Apasă pe butonul "Găsește Potriviri" pentru a începe analiza AI folosind criteriile de mai sus.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
