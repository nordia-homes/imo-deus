'use client';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { locations, type City } from '@/lib/locations';
import { Filter, Search } from 'lucide-react';
import { Label } from '../ui/label';

const propertyFilterSchema = z.object({
  transactionType: z.string().optional(),
  rooms: z.coerce.number().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  hasParking: z.boolean().optional(),
  heatingSystem: z.string().optional(),
  nearMetro: z.boolean().optional(),
  minSurface: z.coerce.number().optional(),
  city: z.string().optional(),
  zones: z.array(z.string()).optional(),
  after1977: z.boolean().optional(),
  furnishing: z.string().optional(),
});

export type PropertyFiltersType = z.infer<typeof propertyFilterSchema>;

interface PropertyFiltersProps {
  onApplyFilters: (filters: PropertyFiltersType) => void;
  onResetFilters: () => void;
  children: React.ReactNode;
}

export function PropertyFilters({ onApplyFilters, onResetFilters, children }: PropertyFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoneSearch, setZoneSearch] = useState('');

  const form = useForm<PropertyFiltersType>({
    resolver: zodResolver(propertyFilterSchema),
    defaultValues: {
      transactionType: 'all',
      city: 'all',
      zones: [],
      furnishing: 'all',
      heatingSystem: 'all',
    },
  });

  const watchedCity = form.watch('city') as City;

  const availableZones = useMemo(() => {
    if (watchedCity && locations[watchedCity]) {
      return locations[watchedCity].sort();
    }
    return [];
  }, [watchedCity]);
  
  const filteredZones = useMemo(() => {
    if (!zoneSearch) return availableZones;
    return availableZones.filter(zone => zone.toLowerCase().includes(zoneSearch.toLowerCase()));
  }, [availableZones, zoneSearch]);

  useEffect(() => {
    form.setValue('zones', []);
  }, [watchedCity, form]);

  const onSubmit = (values: PropertyFiltersType) => {
    onApplyFilters(values);
    setIsOpen(false);
  };

  const handleReset = () => {
    form.reset({
      transactionType: 'all',
      rooms: undefined,
      priceMin: undefined,
      priceMax: undefined,
      hasParking: undefined,
      heatingSystem: 'all',
      nearMetro: undefined,
      minSurface: undefined,
      city: 'all',
      zones: [],
      after1977: undefined,
      furnishing: 'all',
    });
    onResetFilters();
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent 
        side="bottom" 
        className="flex max-h-[90vh] flex-col rounded-t-[2rem] border-t border-slate-200 bg-white p-0"
        >
        <SheetHeader className="shrink-0 border-b border-slate-200 p-4 text-center">
          <SheetTitle className="text-slate-950">Filtrează Proprietăți</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 touch-scroll">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField control={form.control} name="transactionType" render={({ field }) => (
                     <FormItem><FormLabel className="text-slate-700">Tip Tranzacție</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="border-slate-200 bg-slate-50 text-slate-900"><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="all">Toate</SelectItem><SelectItem value="Vânzare">Vânzare</SelectItem><SelectItem value="Închiriere">Închiriere</SelectItem></SelectContent>
                        </Select>
                     </FormItem>
                 )} />
                 <FormField control={form.control} name="rooms" render={({ field }) => (
                    <FormItem><FormLabel className="text-slate-700">Nr. Camere</FormLabel>
                        <Select
                            onValueChange={(val) => field.onChange(val === 'any' ? undefined : Number(val))}
                            value={field.value ? String(field.value) : 'any'}
                        >
                            <FormControl><SelectTrigger className="border-slate-200 bg-slate-50 text-slate-900"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="any">Toate</SelectItem>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4+</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priceMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Preț Minim (€)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="ex: 50000" className="border-slate-200 bg-slate-50 placeholder:text-slate-400" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priceMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Preț Maxim (€)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="ex: 150000" className="border-slate-200 bg-slate-50 placeholder:text-slate-400" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField control={form.control} name="minSurface" render={({ field }) => (<FormItem><FormLabel className="text-slate-700">Suprafață Minimă (mp)</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 50" className="border-slate-200 bg-slate-50 placeholder:text-slate-400" /></FormControl></FormItem>)} />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="furnishing" render={({ field }) => (
                    <FormItem><FormLabel className="text-slate-700">Stare Mobilier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="border-slate-200 bg-slate-50 text-slate-900"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="all">Oricare</SelectItem><SelectItem value="Complet">Complet</SelectItem><SelectItem value="Parțial">Parțial</SelectItem><SelectItem value="Nemobilat">Nemobilat</SelectItem></SelectContent>
                        </Select>
                    </FormItem>
                )}/>

                <FormField control={form.control} name="heatingSystem" render={({ field }) => (
                    <FormItem><FormLabel className="text-slate-700">Centrală Termică</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="border-slate-200 bg-slate-50 text-slate-900"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="all">Oricare</SelectItem><SelectItem value="Centrală proprie">Centrală proprie</SelectItem><SelectItem value="Termoficare">Termoficare</SelectItem><SelectItem value="Încălzire în pardoseală">Încălzire în pardoseală</SelectItem></SelectContent>
                        </Select>
                    </FormItem>
                )}/>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                 <FormField control={form.control} name="hasParking" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></FormControl><FormLabel className="font-normal text-slate-700">Parcare</FormLabel></FormItem>)} />
                 <FormField control={form.control} name="nearMetro" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></FormControl><FormLabel className="font-normal text-slate-700">Aproape de metrou</FormLabel></FormItem>)} />
                 <FormField control={form.control} name="after1977" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></FormControl><FormLabel className="font-normal text-slate-700">Construit după 1977</FormLabel></FormItem>)} />
              </div>
              
              <div className="space-y-4">
                   <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem><FormLabel className="text-slate-700">Localitate</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="border-slate-200 bg-slate-50 text-slate-900"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="all">Toate</SelectItem>{Object.keys(locations).map(city => <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>)}</SelectContent>
                          </Select>
                      </FormItem>
                  )} />
                  {watchedCity && watchedCity !== 'all' && (
                       <div>
                          <Label className="text-slate-700">Zone</Label>
                           <div className="relative mt-2">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                               <Input 
                                   placeholder="Caută zonă..." 
                                   className="border-slate-200 bg-slate-50 pl-9 placeholder:text-slate-400"
                                   value={zoneSearch}
                                   onChange={(e) => setZoneSearch(e.target.value)}
                               />
                           </div>
                          <div className="mt-2 h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 touch-scroll">
                              <div className="space-y-2">
                                  {filteredZones.map((zone) => (
                                      <FormField key={zone} control={form.control} name="zones" render={({ field }) => (
                                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                              <FormControl><Checkbox checked={field.value?.includes(zone)} onCheckedChange={(checked) => {
                                                  return checked ? field.onChange([...(field.value || []), zone]) : field.onChange(field.value?.filter((value) => value !== zone))
                                              }} className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></FormControl>
                                              <FormLabel className="font-normal cursor-pointer text-slate-700">{zone}</FormLabel>
                                          </FormItem>
                                      )} />
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}
              </div>
            </div>
            <SheetFooter className="shrink-0 border-t border-slate-200 p-4">
              <div className="flex justify-end gap-2 w-full">
                  <Button type="button" variant="ghost" onClick={handleReset} className="text-slate-600 hover:bg-slate-100 hover:text-slate-900">Resetează</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">Aplică Filtre</Button>
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
