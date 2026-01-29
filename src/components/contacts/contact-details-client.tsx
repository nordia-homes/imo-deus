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

export function ContactDetailsClient({ contact, properties }: { contact: Contact, properties: Property[] }) {
  const [isScoring, setIsScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number, reason: string } | null>(null);

  const [isMatching, setIsMatching] = useState(false);
  const [matchedProperties, setMatchedProperties] = useState<(Property & { matchScore: number; reasoning: string })[]>([]);

  const leadScoreForm = useForm<z.infer<typeof leadScoreSchema>>({
    resolver: zodResolver(leadScoreSchema),
    defaultValues: { engagementLevel: '', potentialValue: '' },
  });

  const propertyMatchForm = useForm<z.infer<typeof propertyMatchSchema>>({
    resolver: zodResolver(propertyMatchSchema),
    defaultValues: {
      desiredPriceRangeMin: 100000,
      desiredPriceRangeMax: 500000,
      desiredBedrooms: 3,
      desiredBathrooms: 2,
      desiredSquareFootageMin: 1500,
      desiredSquareFootageMax: 2500,
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
    } catch (error) {
      console.error('Lead scoring failed', error);
      // Here you would use a toast to show the error
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
            properties: properties.map(p => ({...p, image: p.imageUrl}))
        });
        setMatchedProperties(result.matchedProperties);
    } catch (error) {
        console.error('Property matching failed:', error);
    } finally {
        setIsMatching(false);
    }
  }

  return (
    <Tabs defaultValue="details" className="w-full">
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="score">Lead Score</TabsTrigger>
        <TabsTrigger value="match">Property Matcher</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="details">
        <Card>
          <CardHeader>
            <CardTitle>Contact Notes</CardTitle>
            <CardDescription>All your notes and details about {contact.name}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea defaultValue={contact.notes} rows={8} />
          </CardContent>
          <CardFooter>
            <Button>Save Notes</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="score">
        <Card>
          <CardHeader>
            <CardTitle>AI Lead Scoring</CardTitle>
            <CardDescription>Prioritize this lead based on engagement and potential.</CardDescription>
          </CardHeader>
          <Form {...leadScoreForm}>
            <form onSubmit={leadScoreForm.handleSubmit(onLeadScoreSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={leadScoreForm.control}
                  name="engagementLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Engagement Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select engagement" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
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
                      <FormLabel>Potential Value</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select potential" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
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
                  Generate Score
                </Button>
              </CardFooter>
            </form>
          </Form>
          {scoreResult && (
            <CardContent>
                <Card className="bg-accent/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span>Lead Score: {scoreResult.score} / 100</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">{scoreResult.reason}</p>
                    </CardContent>
                </Card>
            </CardContent>
          )}
        </Card>
      </TabsContent>
      <TabsContent value="match">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Client Preferences</CardTitle>
                        <CardDescription>Set the client's preferences to find matching properties.</CardDescription>
                    </CardHeader>
                     <Form {...propertyMatchForm}>
                        <form onSubmit={propertyMatchForm.handleSubmit(onPropertyMatchSubmit)}>
                            <CardContent className="space-y-4">
                               <FormField control={propertyMatchForm.control} name="desiredBedrooms" render={({ field }) => (
                                    <FormItem><FormLabel>Bedrooms</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                )}/>
                                 <FormField control={propertyMatchForm.control} name="desiredBathrooms" render={({ field }) => (
                                    <FormItem><FormLabel>Bathrooms</FormLabel><FormControl><Input type="number" step="0.5" {...field} /></FormControl></FormItem>
                                )}/>
                                <FormField control={propertyMatchForm.control} name="desiredFeatures" render={({ field }) => (
                                    <FormItem><FormLabel>Desired Features</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                                )}/>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" className="w-full" disabled={isMatching}>
                                    {isMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                    Find Matches
                                </Button>
                            </CardFooter>
                        </form>
                     </Form>
                </Card>
            </div>
            <div className="lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle>Matched Properties</CardTitle>
                        <CardDescription>Top properties matching the client's needs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isMatching && <p className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching for best matches...</p>}
                        {!isMatching && matchedProperties.length === 0 && <p className="text-muted-foreground">No properties matched yet. Run the matcher to see results.</p>}
                        {matchedProperties.map(prop => (
                            <Card key={prop.id}>
                                <CardContent className="p-4 flex gap-4">
                                     <Image src={prop.imageUrl} alt={prop.address} width={150} height={100} className="rounded-md object-cover" data-ai-hint={prop.imageHint} />
                                     <div className="flex-1">
                                        <h3 className="font-bold">{prop.address}</h3>
                                        <p className="text-sm text-primary font-semibold">${prop.price.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">{prop.bedrooms} bed | {prop.bathrooms} bath | {prop.squareFootage} sqft</p>
                                        <Card className="mt-2 bg-accent/10 text-xs">
                                            <CardHeader className="p-2">
                                                <p className="font-semibold">Match Score: {prop.matchScore}/100</p>
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
      <TabsContent value="history">
        <Card>
            <CardHeader>
                <CardTitle>Interaction History</CardTitle>
            </CardHeader>
            <CardContent>
                {contact.interactionHistory.length > 0 ? (
                    <ul className="space-y-4">
                        {contact.interactionHistory.map(interaction => (
                            <li key={interaction.id} className="border-l-2 pl-4">
                                <p className="font-semibold">{interaction.type} on {interaction.date}</p>
                                <p className="text-sm text-muted-foreground">{interaction.notes}</p>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-muted-foreground">No interactions logged yet.</p>}
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
