
"use client";

import type { Contact, Property } from '@/lib/types';
import { leadScoring } from '@/ai/flows/lead-scoring';
import { propertyMatcher } from '@/ai/flows/property-matcher';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const leadScoreSchema = z.object({
  engagementLevel: z.string().min(1, 'Engagement level is required.'),
  potentialValue: z.string().min(1, 'Potential value is required.'),
});

const propertyMatchSchema = z.object({
  desiredPriceRangeMin: z.coerce.number(),
  desiredPriceRangeMax: z.coerce.number(),
  desiredBedrooms: z.coerce.number(),
  desiredBathrooms: z.coerce.number(),
  desiredSquareFootageMin: z.coerce.number(),
  desiredSquareFootageMax: z.coerce.number(),
  desiredFeatures: z.string(),
  locationPreferences: z.string(),
});

type MatchedProperty = Property & { matchScore: number; reasoning: string };

export function ContactDetailsClient({ contact, properties }: { contact: Contact, properties: (Property & { image: string})[] }) {
  const { toast } = useToast();
  const [isScoring, setIsScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number, reason: string } | null>(null);

  const [isMatching, setIsMatching] = useState(false);
  const [matchedProperties, setMatchedProperties] = useState<MatchedProperty[]>([]);

  const leadScoreForm = useForm<z.infer<typeof leadScoreSchema>>({
    resolver: zodResolver(leadScoreSchema),
    defaultValues: { engagementLevel: '', potentialValue: '' },
  });

  const propertyMatchForm = useForm<z.infer<typeof propertyMatchSchema>>({
    resolver: zodResolver(propertyMatchSchema),
    defaultValues: contact.preferences || {
      desiredPriceRangeMin: 100000,
      desiredPriceRangeMax: 500000,
      desiredBedrooms: 3,
      desiredBathrooms: 2,
      desiredSquareFootageMin: 70,
      desiredSquareFootageMax: 120,
      desiredFeatures: 'modern kitchen, backyard',
      locationPreferences: 'suburbs'
    },
  });

  async function onLeadScoreSubmit(values: z.infer<typeof leadScoreSchema>) {
    setIsScoring(true);
    setScoreResult(null);
    try {
      const result = await leadScoring({
        ...values,
        leadDetails: `Name: ${contact.name}, Status: ${contact.status}, Notes: ${contact.notes}`,
      });
      setScoreResult(result);
      toast({
        title: "Scor AI generat!",
        description: `Lead-ul a primit scorul ${result.score}.`,
      });
    } catch (error) {
      console.error('Lead scoring failed', error);
      toast({
        variant: "destructive",
        title: "A apărut o eroare",
        description: "Nu am putut genera scorul AI.",
      });
    } finally {
      setIsScoring(false);
    }
  }

  async function onPropertyMatchSubmit(values: z.infer<typeof propertyMatchSchema>) {
    setIsMatching(true);
    setMatchedProperties([]);
    try {
        const result = await propertyMatcher({
            clientPreferences: values,
            properties: properties
        });
        setMatchedProperties(result.matchedProperties as MatchedProperty[]);
    } catch (error) {
        console.error('Property matching failed:', error);
        toast({
            variant: "destructive",
            title: "A apărut o eroare",
            description: "Nu am putut găsi proprietăți potrivite.",
        });
    } finally {
        setIsMatching(false);
    }
  }

  return (
    <Tabs defaultValue="match" className="w-full">
      <TabsList>
        <TabsTrigger value="match">Potrivire Proprietăți</TabsTrigger>
        <TabsTrigger value="score">Scor AI Lead</TabsTrigger>
        <TabsTrigger value="details">Notițe</TabsTrigger>
        <TabsTrigger value="history">Istoric</TabsTrigger>
      </TabsList>
       <TabsContent value="match">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Preferințele Clientului</CardTitle>
                        <CardDescription>Setează preferințele pentru a găsi proprietăți potrivite.</CardDescription>
                    </CardHeader>
                     <Form {...propertyMatchForm}>
                        <form onSubmit={propertyMatchForm.handleSubmit(onPropertyMatchSubmit)}>
                            <CardContent className="space-y-3">
                               <div className="flex gap-2">
                                    <FormField control={propertyMatchForm.control} name="desiredPriceRangeMin" render={({ field }) => (
                                        <FormItem><FormLabel>Preț Min (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                    )}/>
                                     <FormField control={propertyMatchForm.control} name="desiredPriceRangeMax" render={({ field }) => (
                                        <FormItem><FormLabel>Preț Max (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                    )}/>
                               </div>
                                <div className="flex gap-2">
                                     <FormField control={propertyMatchForm.control} name="desiredBedrooms" render={({ field }) => (
                                        <FormItem><FormLabel>Dormitoare</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                    )}/>
                                    <FormField control={propertyMatchForm.control} name="desiredBathrooms" render={({ field }) => (
                                        <FormItem><FormLabel>Băi</FormLabel><FormControl><Input type="number" step="1" {...field} /></FormControl></FormItem>
                                    )}/>
                               </div>
                                <FormField control={propertyMatchForm.control} name="locationPreferences" render={({ field }) => (
                                    <FormItem><FormLabel>Locație Preferată</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )}/>
                                <FormField control={propertyMatchForm.control} name="desiredFeatures" render={({ field }) => (
                                    <FormItem><FormLabel>Caracteristici Dorite</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                                )}/>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" className="w-full" disabled={isMatching}>
                                    {isMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                    Găsește Potriviri
                                </Button>
                            </CardFooter>
                        </form>
                     </Form>
                </Card>
            </div>
            <div className="lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle>Proprietăți Potrivite</CardTitle>
                        <CardDescription>Cele mai bune proprietăți conform preferințelor.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isMatching && <p className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Caut cele mai bune potriviri...</p>}
                        {!isMatching && matchedProperties.length === 0 && <p className="text-muted-foreground">Nicio proprietate găsită. Rulează căutarea pentru a vedea rezultatele.</p>}
                        {matchedProperties.map(prop => (
                            <Card key={prop.id}>
                                <CardContent className="p-4 flex gap-4 items-center">
                                     <Image src={prop.image || 'https://placehold.co/400x300'} alt={prop.address} width={150} height={100} className="rounded-md object-cover aspect-[4/3]" data-ai-hint={prop.imageHint} />
                                     <div className="flex-1">
                                        <Link href={`/properties/${prop.id}`} className="font-bold hover:underline">{prop.address}</Link>
                                        <p className="text-sm text-primary font-semibold">€{prop.price.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">{prop.bedrooms} dorm. | {prop.bathrooms} băi | {prop.squareFootage} mp</p>
                                        <Card className="mt-2 bg-accent/50 text-xs">
                                            <CardHeader className="p-2">
                                                <p className="font-semibold text-primary">Scor Potrivire: {prop.matchScore}/100</p>
                                            </CardHeader>
                                            <CardContent className="p-2 pt-0">
                                                <p>{prop.reasoning}</p>
                                            </CardContent>
                                        </Card>
                                     </div>
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                 </Card>
            </div>
        </div>
      </TabsContent>
      <TabsContent value="score">
        <Card>
          <CardHeader>
            <CardTitle>Scor AI pentru Lead</CardTitle>
            <CardDescription>Prioritizează acest lead pe baza angajamentului și potențialului.</CardDescription>
          </CardHeader>
          <Form {...leadScoreForm}>
            <form onSubmit={leadScoreForm.handleSubmit(onLeadScoreSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={leadScoreForm.control}
                  name="engagementLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nivel de Angajament</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selectează angajamentul" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">Ridicat</SelectItem>
                          <SelectItem value="medium">Mediu</SelectItem>
                          <SelectItem value="low">Scăzut</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadScoreForm.control}
                  name="potentialValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valoare Potențială</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selectează potențialul" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">Ridicat</SelectItem>
                          <SelectItem value="medium">Mediu</SelectItem>
                          <SelectItem value="low">Scăzut</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isScoring}>
                  {isScoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generează Scor
                </Button>
              </CardFooter>
            </form>
          </Form>
          {scoreResult && (
            <CardContent>
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-800">
                            <span>Scor Lead: {scoreResult.score} / 100</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-blue-700">{scoreResult.reason}</p>
                    </CardContent>
                </Card>
            </CardContent>
          )}
        </Card>
      </TabsContent>
      <TabsContent value="details">
        <Card>
          <CardHeader>
            <CardTitle>Notițe Contact</CardTitle>
            <CardDescription>Toate notițele și detaliile despre {contact.name}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea defaultValue={contact.notes} rows={8} />
          </CardContent>
          <CardFooter>
            <Button>Salvează Notițe</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="history">
        <Card>
            <CardHeader>
                <CardTitle>Istoric Interacțiuni</CardTitle>
            </CardHeader>
            <CardContent>
                {(contact.interactionHistory || []).length > 0 ? (
                    <ul className="space-y-4">
                        {(contact.interactionHistory || []).map(interaction => (
                            <li key={interaction.id} className="border-l-2 pl-4 border-primary/50">
                                <p className="font-semibold">{interaction.type} - <time className="font-normal text-muted-foreground text-sm">{interaction.date}</time></p>
                                <p className="text-sm text-muted-foreground">{interaction.notes}</p>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-muted-foreground">Nicio interacțiune înregistrată.</p>}
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
