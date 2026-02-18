'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateContactPreferences } from '@/ai/flows/update-buyer-preferences';

import { locations, type City } from '@/lib/locations';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';

const preferencesSchema = z.object({
  budget: z.coerce.number().optional(),
  desiredRooms: z.coerce.number().optional(),
  desiredSquareFootageMin: z.coerce.number().optional(),
  city: z.string().optional(),
  generalZone: z.string().optional(),
  zones: z.array(z.string()).optional(),
  mentiuni: z.string().optional(),
});

export function BuyerPreferencesForm({ linkId }: { linkId: string }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      budget: undefined,
      desiredRooms: undefined,
      desiredSquareFootageMin: undefined,
      city: undefined,
      generalZone: undefined,
      zones: [],
      mentiuni: '',
    },
  });
  
  const watchedCity = form.watch('city') as City;
  
  const availableZones = useMemo(() => {
    if (watchedCity && locations[watchedCity]) {
      return locations[watchedCity].sort();
    }
    return [];
  }, [watchedCity]);

  useEffect(() => {
    if (watchedCity) {
      form.setValue('zones', []);
    }
  }, [watchedCity, form]);


  async function onSubmit(values: z.infer<typeof preferencesSchema>) {
    setIsSubmitting(true);
    try {
      const result = await updateContactPreferences({ linkId, ...values });
      if (result.success) {
        setIsSuccess(true);
        toast({
          title: 'Mulțumim!',
          description: 'Preferințele tale au fost actualizate cu succes.',
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'A apărut o eroare',
        description: error.message || 'Nu am putut salva preferințele. Te rugăm să încerci din nou.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <Alert variant="default" className="border-green-500 bg-green-50">
        <AlertTitle className="text-green-800">Succes!</AlertTitle>
        <AlertDescription className="text-green-700">
          Formularul a fost trimis. Agentul tău va reveni cu proprietăți care se potrivesc noilor tale preferințe. Poți închide această pagină.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="shadow-2xl rounded-2xl">
        <CardContent className="p-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="budget"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Buget (€)</FormLabel>
                            <FormControl><Input type="number" {...field} placeholder="150000" /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="desiredRooms"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Nr. Camere</FormLabel>
                            <FormControl><Input type="number" {...field} placeholder="2" /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="desiredSquareFootageMin"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Suprafață Minimă (mp)</FormLabel>
                            <FormControl><Input type="number" {...field} placeholder="50" /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Oraș de interes</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selectează orașul" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {Object.keys(locations).map((city) => (
                                <SelectItem key={city} value={city}>
                                {city.replace('-', ' - ')}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
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
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selectează zona generală" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Oricare">Oricare</SelectItem>
                                    <SelectItem value="Nord">Nord</SelectItem>
                                    <SelectItem value="Sud">Sud</SelectItem>
                                    <SelectItem value="Est">Est</SelectItem>
                                    <SelectItem value="Vest">Vest</SelectItem>
                                    <SelectItem value="Central">Central</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>

                {watchedCity && availableZones.length > 0 && (
                    <div>
                         <Label>Zone Specifice</Label>
                         <p className="text-sm text-muted-foreground mb-2">Selectează zonele de interes din {watchedCity.replace('-', ' - ')}.</p>
                        <div className="max-h-60 overflow-y-auto rounded-md border p-4">
                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {availableZones.map((zone) => (
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
                                                                : field.onChange(field.value?.filter((value) => value !== zone));
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal cursor-pointer">
                                                    {zone}
                                                </FormLabel>
                                            </FormItem>
                                        );
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                <FormField
                    control={form.control}
                    name="mentiuni"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Mențiuni Suplimentare</FormLabel>
                        <FormControl>
                            <Textarea
                            placeholder="Orice alte detalii sau preferințe: etaj, an construcție, apropiere de parc, etc."
                            className="resize-none"
                            {...field}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Trimite Preferințele
                </Button>
                </form>
            </Form>
        </CardContent>
    </Card>
  );
}
