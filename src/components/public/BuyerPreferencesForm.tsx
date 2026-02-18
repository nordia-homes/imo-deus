'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { locations, type City } from '@/lib/locations';
import { updateContactPreferences } from '@/ai/flows/update-buyer-preferences';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';


const preferencesSchema = z.object({
  budget: z.coerce.number({invalid_type_error: "Introduceți o valoare numerică."}).positive("Bugetul trebuie să fie pozitiv.").optional(),
  desiredRooms: z.coerce.number().int("Numărul de camere trebuie să fie un număr întreg.").optional(),
  desiredSquareFootageMin: z.coerce.number().optional(),
  city: z.string().optional(),
  generalZone: z.string().optional(),
  zones: z.array(z.string()).optional(),
  mentiuni: z.string().optional(),
});

type BuyerPreferencesFormValues = z.infer<typeof preferencesSchema>;

export function BuyerPreferencesForm({ linkId }: { linkId: string }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<BuyerPreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
        budget: undefined,
        desiredRooms: undefined,
        desiredSquareFootageMin: undefined,
        city: '',
        generalZone: '',
        zones: [],
        mentiuni: '',
    },
  });

  const watchedCity = form.watch('city') as City;

  const zoneOptions = useMemo(() => {
    if (watchedCity && locations[watchedCity]) {
      return locations[watchedCity].sort();
    }
    return [];
  }, [watchedCity]);
  
  const handleZoneToggle = (zone: string, checked: boolean) => {
    const currentZones = form.getValues('zones') || [];
    const newZones = checked
      ? [...currentZones, zone]
      : currentZones.filter((z) => z !== zone);
    form.setValue('zones', newZones);
  }

  async function onSubmit(values: BuyerPreferencesFormValues) {
    setIsSubmitting(true);
    try {
        const result = await updateContactPreferences({ linkId, ...values });
        if (result.success) {
            setIsSuccess(true);
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        console.error(error);
        toast({
            variant: "destructive",
            title: "Eroare la trimitere",
            description: error.message || "Nu am putut salva preferințele. Vă rugăm să încercați din nou.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  if (isSuccess) {
    return (
        <Alert className="text-center p-8">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-4" />
            <AlertTitle className="text-2xl font-bold">Mulțumim!</AlertTitle>
            <AlertDescription>
                Preferințele tale au fost actualizate cu succes. Agentul tău va reveni cu noi propuneri în cel mai scurt timp.
            </AlertDescription>
        </Alert>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
            <CardHeader><CardTitle>Preferințe Financiare</CardTitle></CardHeader>
            <CardContent>
                <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Care este bugetul tău maxim? (€)</FormLabel>
                        <FormControl><Input type="number" placeholder="ex: 150000" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Caracteristici Proprietate</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="desiredRooms" render={({ field }) => ( <FormItem><FormLabel>Nr. de camere</FormLabel><FormControl><Input type="number" placeholder="ex: 3" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="desiredSquareFootageMin" render={({ field }) => ( <FormItem><FormLabel>Suprafață minimă (mp)</FormLabel><FormControl><Input type="number" placeholder="ex: 70" {...field} /></FormControl><FormMessage /></FormItem> )} />
                 </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Locație</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Oraș de interes</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selectează orașul" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="">Niciunul</SelectItem>
                                {Object.keys(locations).map(city => (
                                    <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="generalZone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Zonă Generală</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selectează o zonă generală" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="">Oricare</SelectItem>
                                <SelectItem value="Nord">Nord</SelectItem>
                                <SelectItem value="Sud">Sud</SelectItem>
                                <SelectItem value="Est">Est</SelectItem>
                                <SelectItem value="Vest">Vest</SelectItem>
                                <SelectItem value="Central">Central</SelectItem>
                            </SelectContent>
                        </Select>
                        </FormItem>
                    )}
                />
                
                {watchedCity && zoneOptions.length > 0 && (
                    <div>
                        <Label>Zone Specifice (opțional)</Label>
                        <div className="max-h-60 overflow-y-auto rounded-md border p-4 mt-2">
                             <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                {zoneOptions.map(zone => (
                                    <div key={zone} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`zone-${zone}`}
                                            onCheckedChange={(checked) => handleZoneToggle(zone, !!checked)}
                                        />
                                        <Label htmlFor={`zone-${zone}`} className="font-normal cursor-pointer">
                                            {zone}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

         <Card>
            <CardHeader><CardTitle>Alte Mențiuni</CardTitle></CardHeader>
            <CardContent>
                <FormField
                    control={form.control}
                    name="mentiuni"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Există alte detalii importante pentru tine?</FormLabel>
                        <FormControl><Textarea placeholder="ex: Doresc neapărat un etaj superior, vedere panoramică, parcare subterană..." {...field} rows={4} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
        
        <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Trimite Preferințele
        </Button>
      </form>
    </Form>
  );
}
