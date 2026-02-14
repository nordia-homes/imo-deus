'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import type { Contact, ContactPreferences } from '@/lib/types';
import { locations, type City } from '@/lib/locations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';

const preferencesSchema = z.object({
  desiredRooms: z.coerce.number().optional(),
  desiredPriceRangeMax: z.coerce.number().optional(),
  desiredSquareFootageMin: z.coerce.number().optional(),
  city: z.string().optional(),
  zones: z.array(z.string()).optional(),
  desiredFeatures: z.string().optional(),
});

interface EditPreferencesFormProps {
  contact: Contact;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  onRematch: (preferences: ContactPreferences) => void;
  isMatching: boolean;
  onClose: () => void;
}

export function EditPreferencesForm({ contact, onUpdateContact, onRematch, isMatching, onClose }: EditPreferencesFormProps) {
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
    if (watchedCity && watchedCity !== contact.city) {
      form.setValue('zones', []);
    }
  }, [watchedCity, contact.city, form]);
  
  const handleBlur = (fieldName: keyof z.infer<typeof preferencesSchema>) => {
    const value = form.getValues(fieldName);
    
    if (fieldName === 'city') {
        if (value !== contact.city) {
            onUpdateContact({ city: value });
        }
    } else {
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
    <div className="lg:p-6 space-y-6 bg-[#0F1E33] lg:bg-transparent text-white lg:text-inherit h-full lg:h-auto">
        <div className="flex items-center justify-end pt-4 pr-4 lg:pt-0 lg:pr-0">
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white lg:text-inherit">
                <X className="h-5 w-5" />
            </Button>
        </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 px-4 lg:px-0">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <span>Preferinte cautare</span>
            </h2>
          </div>
          
          <div className="space-y-4">
            <Card className="bg-[#152A47] border-none text-white rounded-2xl">
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="desiredRooms" render={({ field }) => ( <FormItem><FormLabel>Nr. camere</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredRooms')} className="bg-white/10 border-white/20" /></FormControl></FormItem> )}/>
                    <FormField control={form.control} name="desiredPriceRangeMax" render={({ field }) => ( <FormItem><FormLabel>Preț maxim (€)</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredPriceRangeMax')} className="bg-white/10 border-white/20" /></FormControl></FormItem> )}/>
                    <FormField control={form.control} name="desiredSquareFootageMin" render={({ field }) => ( <FormItem><FormLabel>Suprafață minimă</FormLabel><FormControl><Input type="number" {...field} onBlur={() => handleBlur('desiredSquareFootageMin')} className="bg-white/10 border-white/20" /></FormControl></FormItem> )}/>
                </CardContent>
            </Card>
            <Card className="bg-[#152A47] border-none text-white rounded-2xl">
                 <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Localitate</FormLabel>
                            <Select onValueChange={(value) => {field.onChange(value); handleBlur('city');}} value={field.value}>
                                <FormControl><SelectTrigger className="bg-white/10 border-white/20"><SelectValue placeholder="Selectează orașul" /></SelectTrigger></FormControl>
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
                                <Button variant="outline" className="w-full justify-between bg-white/10 border-white/20 hover:bg-white/20" disabled={!watchedCity}>
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
                </CardContent>
            </Card>
            <Card className="bg-[#152A47] border-none text-white rounded-2xl">
                <CardContent className="pt-6">
                    <FormField control={form.control} name="desiredFeatures" render={({ field }) => ( <FormItem><FormLabel>Caracteristici dorite</FormLabel><FormControl><Textarea {...field} onBlur={() => handleBlur('desiredFeatures')} rows={2} className="bg-white/10 border-white/20" /></FormControl></FormItem> )}/>
                </CardContent>
            </Card>
          </div>
          
          <div className="pb-4 lg:pb-0">
            <Button type="submit" disabled={isMatching} className="w-full bg-primary hover:bg-primary/90">
              {isMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Actualizează Potrivirile AI
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
