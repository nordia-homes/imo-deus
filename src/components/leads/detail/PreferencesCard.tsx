'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2 } from 'lucide-react';
import type { Contact, ContactPreferences } from '@/lib/types';
import { SlidersHorizontal } from 'lucide-react';

const preferencesSchema = z.object({
  desiredPriceRangeMin: z.coerce.number(),
  desiredPriceRangeMax: z.coerce.number(),
  desiredBedrooms: z.coerce.number(),
  desiredBathrooms: z.coerce.number(),
  desiredSquareFootageMin: z.coerce.number(),
  desiredSquareFootageMax: z.coerce.number(),
  desiredFeatures: z.string().optional(),
  locationPreferences: z.string().optional(),
});

interface PreferencesCardProps {
  contact: Contact;
  onUpdatePreferences: (data: { preferences: Partial<ContactPreferences> }) => void;
  onRematch: (preferences: ContactPreferences) => void;
  isMatching: boolean;
}

export function PreferencesCard({ contact, onUpdatePreferences, onRematch, isMatching }: PreferencesCardProps) {
  const form = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: contact.preferences || {},
  });

  useEffect(() => {
    const defaultPreferences = {
        desiredPriceRangeMin: 0,
        desiredPriceRangeMax: 0,
        desiredBedrooms: 0,
        desiredBathrooms: 0,
        desiredSquareFootageMin: 0,
        desiredSquareFootageMax: 0,
        desiredFeatures: '',
        locationPreferences: '',
        ...contact.preferences,
    };
    form.reset(defaultPreferences);
  }, [contact, form]);
  
  const handleBlur = (fieldName: keyof ContactPreferences) => {
    const value = form.getValues(fieldName);
    if (value !== (contact.preferences?.[fieldName] || '')) {
      onUpdatePreferences({ preferences: { [fieldName]: value }});
    }
  };

  const onSubmit = (values: z.infer<typeof preferencesSchema>) => {
    onRematch(values as ContactPreferences);
  };

  return (
    <Card className="rounded-2xl shadow-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <span>Preferințe Căutare</span>
            </CardTitle>
            <CardDescription>Ajustează criteriile pentru a recalcula potrivirile AI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="desiredPriceRangeMin" render={({ field }) => ( <FormItem><FormLabel>Preț Min (€)</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredPriceRangeMin')} /></FormControl></FormItem> )}/>
              <FormField control={form.control} name="desiredPriceRangeMax" render={({ field }) => ( <FormItem><FormLabel>Preț Max (€)</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredPriceRangeMax')} /></FormControl></FormItem> )}/>
              <FormField control={form.control} name="desiredBedrooms" render={({ field }) => ( <FormItem><FormLabel>Dormitoare</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredBedrooms')} /></FormControl></FormItem> )}/>
              <FormField control={form.control} name="desiredBathrooms" render={({ field }) => ( <FormItem><FormLabel>Băi</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredBathrooms')} /></FormControl></FormItem> )}/>
              <FormField control={form.control} name="desiredSquareFootageMin" render={({ field }) => ( <FormItem><FormLabel>Suprafață Min</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredSquareFootageMin')} /></FormControl></FormItem> )}/>
              <FormField control={form.control} name="desiredSquareFootageMax" render={({ field }) => ( <FormItem><FormLabel>Suprafață Max</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredSquareFootageMax')} /></FormControl></FormItem> )}/>
            </div>
            <div>
              <FormField control={form.control} name="locationPreferences" render={({ field }) => ( <FormItem><FormLabel>Locație</FormLabel><FormControl><Input {...field} onBlur={() => handleBlur('locationPreferences')} /></FormControl></FormItem> )}/>
            </div>
             <div>
              <FormField control={form.control} name="desiredFeatures" render={({ field }) => ( <FormItem><FormLabel>Caracteristici Dorite</FormLabel><FormControl><Textarea {...field} onBlur={() => handleBlur('desiredFeatures')} rows={2}/></FormControl></FormItem> )}/>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isMatching}>
              {isMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Recalculează Potrivirile AI
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
