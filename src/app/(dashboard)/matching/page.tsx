'use client';

import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Contact, Property, MatchedProperty } from '@/lib/types';
import { propertyMatcher } from '@/ai/flows/property-matcher';
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Wand2, Star, Info } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useAgency } from '@/context/AgencyContext';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const propertyMatchSchema = z.object({
  desiredPriceRangeMin: z.coerce.number(),
  desiredPriceRangeMax: z.coerce.number(),
  desiredRooms: z.coerce.number(),
  desiredBathrooms: z.coerce.number(),
  desiredSquareFootageMin: z.coerce.number(),
  desiredSquareFootageMax: z.coerce.number(),
  desiredFeatures: z.string(),
  locationPreferences: z.string(),
});

export default function MatchingPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [isMatching, setIsMatching] = useState(false);
    const [matchedProperties, setMatchedProperties] = useState<MatchedProperty[]>([]);
    
    // --- Data Fetching ---
    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
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
            const preferences = selectedContact.preferences || {
                desiredPriceRangeMin: (selectedContact.budget || 0) * 0.8,
                desiredPriceRangeMax: (selectedContact.budget || 0) * 1.2,
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

    const isLoading = areContactsLoading || arePropertiesLoading;

    return (
        <div className="agentfinder-matching-page space-y-6 bg-[#0F1E33] text-white p-2 lg:p-4">
            <div className="agentfinder-matching-hero text-center lg:text-left">
                <h1 className="text-3xl font-headline font-bold text-white">Potrivire Proprietăți AI</h1>
                <p className="text-white/70">
                    Găsește cele mai bune proprietăți pentru clienții tăi folosind inteligența artificială.
                </p>
            </div>
            
            <Card className="agentfinder-matching-card bg-[#152A47] border-none text-white rounded-2xl shadow-2xl">
                <CardHeader>
                    <CardTitle className="text-white">1. Selectează un client</CardTitle>
                    <CardDescription className="text-white/70">Alege un lead din lista ta pentru a-i vedea preferințele și a rula analiza.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-10 w-full md:w-1/2 bg-white/10" /> : (
                        <Select onValueChange={setSelectedContactId} value={selectedContactId || ''}>
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
