
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { updateContactPreferences } from '@/ai/flows/update-buyer-preferences';
import { locations, type City } from '@/lib/locations';
import type { Contact, ContactPreferences } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const preferencesFormSchema = z.object({
  rooms: z.coerce.number().min(0).optional(),
  minSurface: z.coerce.number().min(0).optional(),
  city: z.string().min(1, { message: "Orașul este obligatoriu." }),
  generalZone: z.string().optional(),
  zones: z.array(z.string()).optional(),
  budget: z.coerce.number().min(0).optional(),
  features: z.string().optional(),
});

type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

interface BuyerPreferencesFormProps {
    contact: Contact;
    linkId: string;
}

export function BuyerPreferencesForm({ contact, linkId }: BuyerPreferencesFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const form = useForm<PreferencesFormValues>({
        resolver: zodResolver(preferencesFormSchema),
        defaultValues: {
            rooms: contact.preferences?.desiredRooms || undefined,
            minSurface: contact.preferences?.desiredSquareFootageMin || undefined,
            city: contact.city || 'Bucuresti-Ilfov',
            generalZone: contact.generalZone || 'Oricare',
            zones: contact.zones || [],
            budget: contact.budget || undefined,
            features: contact.preferences?.desiredFeatures || '',
        },
    });
    
    const watchedCity = form.watch('city') as City;

    useEffect(() => {
        if (watchedCity && watchedCity !== contact.city) {
            form.setValue('zones', []);
        }
    }, [watchedCity, contact.city, form]);

    async function onSubmit(values: PreferencesFormValues) {
        setIsSubmitting(true);
        try {
            await updateContactPreferences({
                linkId: linkId,
                budget: values.budget,
                preferences: {
                    desiredRooms: values.rooms,
                    desiredSquareFootageMin: values.minSurface,
                    desiredFeatures: values.features,
                },
                city: values.city,
                generalZone: values.generalZone as Contact['generalZone'],
                zones: values.zones,
            });
            setIsSuccess(true);
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Eroare la salvare',
                description: 'Nu am putut salva preferințele. Te rugăm să încerci din nou mai târziu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isSuccess) {
        return (
            <Card className="text-center p-8">
                <CardHeader>
                    <CardTitle>Mulțumim!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Preferințele tale au fost salvate și agentul tău a fost notificat. Te vom contacta în curând cu proprietăți potrivite.</p>
                </CardContent>
            </Card>
        );
    }
    
    const zoneOptions = (watchedCity && locations[watchedCity]) ? locations[watchedCity].sort() : [];
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                    <CardHeader><CardTitle>Ce fel de proprietate cauți?</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="rooms" render={({ field }) => ( <FormItem><FormLabel>Număr minim de camere</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 2" /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="minSurface" render={({ field }) => ( <FormItem><FormLabel>Suprafață utilă minimă (mp)</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 50" /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Unde vrei să locuiești?</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                         <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>Oraș</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{Object.keys(locations).map(city => <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="generalZone" render={({ field }) => ( <FormItem><FormLabel>Zonă generală</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Oricare">Oricare</SelectItem>
                                    <SelectItem value="Nord">Nord</SelectItem>
                                    <SelectItem value="Sud">Sud</SelectItem>
                                    <SelectItem value="Est">Est</SelectItem>
                                    <SelectItem value="Vest">Vest</SelectItem>
                                    <SelectItem value="Central">Central</SelectItem>
                                </SelectContent></Select><FormMessage /></FormItem> )} />
                        </div>
                        
                        {watchedCity && zoneOptions.length > 0 && (
                            <FormField
                                control={form.control}
                                name="zones"
                                render={() => (
                                <FormItem>
                                    <FormLabel>Zone precise (opțional)</FormLabel>
                                    <div className="max-h-60 overflow-y-auto rounded-md border p-4 space-y-2">
                                        {zoneOptions.map((zone) => (
                                        <FormField
                                            key={zone}
                                            control={form.control}
                                            name="zones"
                                            render={({ field }) => {
                                            return (
                                                <FormItem
                                                key={zone}
                                                className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                <FormControl>
                                                    <Checkbox
                                                    checked={field.value?.includes(zone)}
                                                    onCheckedChange={(checked) => {
                                                        return checked
                                                        ? field.onChange([...(field.value || []), zone])
                                                        : field.onChange(
                                                            field.value?.filter(
                                                            (value) => value !== zone
                                                            )
                                                        )
                                                    }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal cursor-pointer">
                                                    {zone}
                                                </FormLabel>
                                                </FormItem>
                                            )
                                            }}
                                        />
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Care este bugetul tău?</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="budget" render={({ field }) => ( <FormItem><FormLabel>Buget maxim (€)</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 150000" /></FormControl><FormMessage /></FormItem> )} />
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader><CardTitle>Alte preferințe</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="features" render={({ field }) => ( <FormItem><FormLabel>Ce altceva este important pentru tine?</FormLabel><FormControl><Textarea {...field} rows={4} placeholder="ex: etaj superior, balcon mare, an construcție după 2020, etc." /></FormControl><FormMessage /></FormItem> )} />
                    </CardContent>
                </Card>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvează Preferințele
                </Button>
            </form>
        </Form>
    );
}
