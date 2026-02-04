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
import { Loader2, Wand2, SlidersHorizontal, ChevronDown } from 'lucide-react';
import type { Contact, ContactPreferences } from '@/lib/types';
import { locations, type City } from '@/lib/locations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';


const preferencesSchema = z.object({
  desiredRooms: z.coerce.number().optional(),
  desiredPriceRangeMax: z.coerce.number().optional(),
  desiredSquareFootageMin: z.coerce.number().optional(),
  city: z.string().optional(),
  zones: z.array(z.string()).optional(),
  desiredFeatures: z.string().optional(),
});

interface PreferencesCardProps {
  contact: Contact;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  onRematch: (preferences: ContactPreferences) => void;
  isMatching: boolean;
}

export function PreferencesCard({ contact, onUpdateContact, onRematch, isMatching }: PreferencesCardProps) {
  const form = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
  });

  useEffect(() => {
    form.reset({
      desiredRooms: contact.preferences?.desiredRooms || 0,
      desiredPriceRangeMax: contact.preferences?.desiredPriceRangeMax || contact.budget,
      desiredSquareFootageMin: contact.preferences?.desiredSquareFootageMin || 0,
      city: contact.city,
      zones: contact.zones || [],
      desiredFeatures: contact.preferences?.desiredFeatures || '',
    });
  }, [contact, form]);
  
  const watchedCity = form.watch('city') as City;

  useEffect(() => {
    // If the city in the form changes and differs from the contact's original city,
    // we should only reset the form's local state for zones, not the parent contact object.
    if (watchedCity && watchedCity !== contact.city) {
      form.setValue('zones', []);
    }
  // The parent's state will be updated when the user selects new zones via `handleZonesChange`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCity, contact.city]);
  
  const handleBlur = (fieldName: keyof z.infer<typeof preferencesSchema>) => {
    const value = form.getValues(fieldName);
    
    if (fieldName === 'city') {
        if (value !== contact.city) {
            onUpdateContact({ city: value });
        }
    } else { // Fields that belong in `preferences`
        if (value !== (contact.preferences?.[fieldName as keyof ContactPreferences] || '')) {
            onUpdateContact({ preferences: { [fieldName as keyof ContactPreferences]: value }});
        }
    }
  };
  
  const handleZonesChange = (zone: string, checked: boolean) => {
    const currentZones = form.getValues('zones') || [];
    const newZones = checked
      ? [...currentZones, zone]
      : currentZones.filter((z) => z !== zone);
    form.setValue('zones', newZones);
    onUpdateContact({ zones: newZones });
  }

  const onSubmit = (values: z.infer<typeof preferencesSchema>) => {
    const fullPreferences: ContactPreferences = {
      desiredPriceRangeMin: 0,
      desiredPriceRangeMax: values.desiredPriceRangeMax || 9999999,
      desiredRooms: values.desiredRooms || 0,
      desiredBathrooms: 0, 
      desiredSquareFootageMin: values.desiredSquareFootageMin || 0,
      desiredSquareFootageMax: 99999,
      desiredFeatures: values.desiredFeatures || '',
      locationPreferences: values.city || '',
    };
    onRematch(fullPreferences);
  };
  
  const currentZones = form.watch('zones') || [];
  const availableZones = (watchedCity && locations[watchedCity]) ? locations[watchedCity].sort() : [];

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="desiredRooms" render={({ field }) => ( <FormItem><FormLabel>Nr. camere</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredRooms')} /></FormControl></FormItem> )}/>
              <FormField control={form.control} name="desiredPriceRangeMax" render={({ field }) => ( <FormItem><FormLabel>Preț maxim (€)</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredPriceRangeMax')} /></FormControl></FormItem> )}/>
              <FormField control={form.control} name="desiredSquareFootageMin" render={({ field }) => ( <FormItem><FormLabel>Suprafață minimă</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredSquareFootageMin')} /></FormControl></FormItem> )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Localitate</FormLabel>
                        <Select onValueChange={(value) => {field.onChange(value); handleBlur('city');}} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selectează orașul" /></SelectTrigger></FormControl>
                            <SelectContent>
                            {Object.keys(locations).map(city => (
                                <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        </FormItem>
                    )}
                    />
                
                 <FormItem>
                    <FormLabel>Zone</FormLabel>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between" disabled={!watchedCity}>
                                <span className="truncate pr-2">
                                    {currentZones.length === 0 ? 'Selectează zone' : currentZones.length === 1 ? currentZones[0] : `${currentZones.length} zone selectate`}
                                </span>
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                            <ScrollArea className="h-72">
                                {availableZones.map(zone => (
                                    <DropdownMenuCheckboxItem
                                        key={zone}
                                        checked={currentZones.includes(zone)}
                                        onCheckedChange={(checked) => handleZonesChange(zone, !!checked)}
                                        onSelect={(e) => e.preventDefault()}
                                    >
                                        {zone}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </ScrollArea>
                        </DropdownMenuContent>
                    </DropdownMenu>
                 </FormItem>
            </div>
             <div>
              <FormField control={form.control} name="desiredFeatures" render={({ field }) => ( <FormItem><FormLabel>Caracteristici dorite</FormLabel><FormControl><Textarea {...field} onBlur={() => handleBlur('desiredFeatures')} rows={2}/></FormControl></FormItem> )}/>
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
