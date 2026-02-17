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
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Label } from '../ui/label';

const propertyFilterSchema = z.object({
  transactionType: z.string().optional(),
  rooms: z.coerce.number().optional(),
  priceRange: z.string().optional(),
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
  const isMobile = useIsMobile();
  const [zoneSearch, setZoneSearch] = useState('');

  const form = useForm<PropertyFiltersType>({
    resolver: zodResolver(propertyFilterSchema),
    defaultValues: {
      transactionType: 'all',
      city: 'all',
      zones: [],
      furnishing: 'all',
      heatingSystem: 'all',
      priceRange: 'all',
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
      priceRange: 'all',
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
        className="rounded-t-lg p-0 bg-[#0F1E33] border-t-0 flex flex-col max-h-[90vh]"
        >
        <SheetHeader className="shrink-0 border-b p-4 text-center border-white/10">
          <SheetTitle className="text-white">Filtrează Proprietăți</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 touch-scroll">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField control={form.control} name="transactionType" render={({ field }) => (
                     <FormItem><FormLabel className="text-white/80">Tip Tranzacție</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="all">Toate</SelectItem><SelectItem value="Vânzare">Vânzare</SelectItem><SelectItem value="Închiriere">Închiriere</SelectItem></SelectContent>
                        </Select>
                     </FormItem>
                 )} />
                 <FormField control={form.control} name="rooms" render={({ field }) => (
                     <FormItem><FormLabel className="text-white/80">Nr. Camere</FormLabel>
                        <Select onValueChange={(val) => field.onChange(val ? Number(val) : undefined)} value={String(field.value || '')}>
                            <FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Toate"/></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="">Toate</SelectItem><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem><SelectItem value="4">4+</SelectItem></SelectContent>
                        </Select>
                     </FormItem>
                 )} />
              </div>
              
              <FormField control={form.control} name="priceRange" render={({ field }) => (
                <FormItem><FormLabel className="text-white/80">Preț (€)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="all">Oricare</SelectItem>
                        <SelectItem value="0-50000">Sub 50.000 €</SelectItem>
                        <SelectItem value="50000-100000">50.000 € - 100.000 €</SelectItem>
                        <SelectItem value="100000-200000">100.000 € - 200.000 €</SelectItem>
                        <SelectItem value="200000-500000">200.000 € - 500.000 €</SelectItem>
                        <SelectItem value="500000-Infinity">Peste 500.000 €</SelectItem>
                      </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="minSurface" render={({ field }) => (<FormItem><FormLabel className="text-white/80">Suprafață Minimă (mp)</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 50" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /></FormControl></FormItem>)} />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="furnishing" render={({ field }) => (
                    <FormItem><FormLabel className="text-white/80">Stare Mobilier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="all">Oricare</SelectItem><SelectItem value="Complet">Complet</SelectItem><SelectItem value="Parțial">Parțial</SelectItem><SelectItem value="Nemobilat">Nemobilat</SelectItem></SelectContent>
                        </Select>
                    </FormItem>
                )}/>

                <FormField control={form.control} name="heatingSystem" render={({ field }) => (
                    <FormItem><FormLabel className="text-white/80">Centrală Termică</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="all">Oricare</SelectItem><SelectItem value="Centrală proprie">Centrală proprie</SelectItem><SelectItem value="Termoficare">Termoficare</SelectItem><SelectItem value="Încălzire în pardoseală">Încălzire în pardoseală</SelectItem></SelectContent>
                        </Select>
                    </FormItem>
                )}/>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                 <FormField control={form.control} name="hasParking" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></FormControl><FormLabel className="font-normal text-white/80">Parcare</FormLabel></FormItem>)} />
                 <FormField control={form.control} name="nearMetro" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></FormControl><FormLabel className="font-normal text-white/80">Aproape de metrou</FormLabel></FormItem>)} />
                 <FormField control={form.control} name="after1977" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></FormControl><FormLabel className="font-normal text-white/80">Construit după 1977</FormLabel></FormItem>)} />
              </div>
              
              <div className="space-y-4">
                   <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem><FormLabel className="text-white/80">Localitate</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="all">Toate</SelectItem>{Object.keys(locations).map(city => <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>)}</SelectContent>
                          </Select>
                      </FormItem>
                  )} />
                  {watchedCity && watchedCity !== 'all' && (
                       <div>
                          <Label className="text-white/80">Zone</Label>
                           <div className="relative mt-2">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                               <Input 
                                   placeholder="Caută zonă..." 
                                   className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                                   value={zoneSearch}
                                   onChange={(e) => setZoneSearch(e.target.value)}
                               />
                           </div>
                          <div className="h-40 overflow-y-auto rounded-md border border-white/20 bg-white/5 p-4 mt-2 touch-scroll">
                              <div className="space-y-2">
                                  {filteredZones.map((zone) => (
                                      <FormField key={zone} control={form.control} name="zones" render={({ field }) => (
                                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                              <FormControl><Checkbox checked={field.value?.includes(zone)} onCheckedChange={(checked) => {
                                                  return checked ? field.onChange([...(field.value || []), zone]) : field.onChange(field.value?.filter((value) => value !== zone))
                                              }} className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></FormControl>
                                              <FormLabel className="font-normal cursor-pointer text-white/90">{zone}</FormLabel>
                                          </FormItem>
                                      )} />
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}
              </div>
            </div>
            <SheetFooter className="shrink-0 border-t p-4 border-white/10">
              <div className="flex justify-end gap-2 w-full">
                  <Button type="button" variant="ghost" onClick={handleReset} className="text-white/80 hover:bg-white/10 hover:text-white/90">Resetează</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">Aplică Filtre</Button>
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
