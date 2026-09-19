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
import '@/components/marketing/tiktok-ads/tiktok-workspace.css';

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

  const watchedCity = form.watch('city') as City | 'all' | undefined;

  const availableZones = useMemo<string[]>(() => {
    if (watchedCity && watchedCity !== 'all') {
      return [...locations[watchedCity]].sort();
    }
    return [];
  }, [watchedCity]);
  
  const filteredZones = useMemo(() => {
    if (!zoneSearch) return availableZones;
    return availableZones.filter((zone) => zone.toLowerCase().includes(zoneSearch.toLowerCase()));
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
        className="tt-design settings-filter-sheet flex max-h-[90vh] flex-col overflow-hidden rounded-t-[2rem] border border-slate-200 bg-[#f7f9fc] p-0 text-slate-900 shadow-2xl"
      >
        <style>{`
          .settings-filter-sheet input:not([type=checkbox]):not([type=radio]),
          .settings-filter-sheet select,
          .settings-filter-sheet textarea {
            height: 44px;
            border-radius: 10px !important;
            border: 1px solid #d5e0e9 !important;
            background: #ffffff !important;
            color: #263b51 !important;
            padding: 10px 13px;
            font-size: 13px;
            box-shadow: none !important;
          }
          .settings-filter-sheet button:not([role=checkbox]) {
            border-radius: 12px !important;
            min-height: 42px;
            font-weight: 650;
          }
          .settings-filter-sheet label { color: #4d657d !important; }
          .settings-filter-sheet [role=combobox],
          .settings-filter-sheet [role=listbox] {
            background: #ffffff !important;
            color: #263b51 !important;
            border-color: #d5e0e9 !important;
          }
          .settings-filter-sheet [role=option] { color: #263b51 !important; }
        `}</style>
        <SheetHeader className="shrink-0 border-b border-slate-200 bg-white/80 p-5 text-left backdrop-blur">
          <div className="tt-hero-kicker">
            <Filter size={17} />
            <span className="tt-eyebrow">FILTRE PROPRIETĂȚI</span>
          </div>
          <SheetTitle className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            Rafinează portofoliul
          </SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 touch-scroll">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField control={form.control} name="transactionType" render={({ field }) => (
                     <FormItem><FormLabel className="text-stone-300">Tip Tranzactie</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="border-white/10 bg-[#141416] text-stone-100"><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent className="border-white/10 bg-[#141416] text-stone-100"><SelectItem value="all">Toate</SelectItem><SelectItem value="Vânzare">Vânzare</SelectItem><SelectItem value="Închiriere">Închiriere</SelectItem></SelectContent>
                        </Select>
                     </FormItem>
                 )} />
                 <FormField control={form.control} name="rooms" render={({ field }) => (
                    <FormItem><FormLabel className="text-stone-300">Nr. Camere</FormLabel>
                        <Select
                            onValueChange={(val) => field.onChange(val === 'any' ? undefined : Number(val))}
                            value={field.value ? String(field.value) : 'any'}
                        >
                            <FormControl><SelectTrigger className="border-white/10 bg-[#141416] text-stone-100"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent className="border-white/10 bg-[#141416] text-stone-100">
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
                      <FormLabel className="text-stone-300">Pret Minim (EUR)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="ex: 50000" className="border-white/10 bg-[#141416] text-stone-100 placeholder:text-stone-500" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priceMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-stone-300">Pret Maxim (EUR)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="ex: 150000" className="border-white/10 bg-[#141416] text-stone-100 placeholder:text-stone-500" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField control={form.control} name="minSurface" render={({ field }) => (<FormItem><FormLabel className="text-stone-300">Suprafata Minima (mp)</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 50" className="border-white/10 bg-[#141416] text-stone-100 placeholder:text-stone-500" /></FormControl></FormItem>)} />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="furnishing" render={({ field }) => (
                    <FormItem><FormLabel className="text-stone-300">Stare Mobilier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="border-white/10 bg-[#141416] text-stone-100"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent className="border-white/10 bg-[#141416] text-stone-100"><SelectItem value="all">Oricare</SelectItem><SelectItem value="Complet">Complet</SelectItem><SelectItem value="Parțial">Parțial</SelectItem><SelectItem value="Nemobilat">Nemobilat</SelectItem></SelectContent>
                        </Select>
                    </FormItem>
                )}/>

                <FormField control={form.control} name="heatingSystem" render={({ field }) => (
                    <FormItem><FormLabel className="text-stone-300">Centrala Termica</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="border-white/10 bg-[#141416] text-stone-100"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent className="border-white/10 bg-[#141416] text-stone-100"><SelectItem value="all">Oricare</SelectItem><SelectItem value="Centrală proprie">Centrală proprie</SelectItem><SelectItem value="Termoficare">Termoficare</SelectItem><SelectItem value="Încălzire în pardoseală">Încălzire în pardoseală</SelectItem></SelectContent>
                        </Select>
                    </FormItem>
                )}/>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                 <FormField control={form.control} name="hasParking" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-white/20 data-[state=checked]:bg-[#22c55e] data-[state=checked]:text-black" /></FormControl><FormLabel className="font-normal text-stone-300">Parcare</FormLabel></FormItem>)} />
                 <FormField control={form.control} name="nearMetro" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-white/20 data-[state=checked]:bg-[#22c55e] data-[state=checked]:text-black" /></FormControl><FormLabel className="font-normal text-stone-300">Aproape de metrou</FormLabel></FormItem>)} />
                 <FormField control={form.control} name="after1977" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-white/20 data-[state=checked]:bg-[#22c55e] data-[state=checked]:text-black" /></FormControl><FormLabel className="font-normal text-stone-300">Construit dupa 1977</FormLabel></FormItem>)} />
              </div>
              
              <div className="space-y-4">
                   <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem><FormLabel className="text-stone-300">Localitate</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="border-white/10 bg-[#141416] text-stone-100"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent className="border-white/10 bg-[#141416] text-stone-100"><SelectItem value="all">Toate</SelectItem>{Object.keys(locations).map(city => <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>)}</SelectContent>
                          </Select>
                      </FormItem>
                  )} />
                  {watchedCity && watchedCity !== 'all' && (
                       <div>
                          <Label className="text-stone-300">Zone</Label>
                           <div className="relative mt-2">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
                               <Input 
                                   placeholder="Cauta zona..." 
                                   className="border-white/10 bg-[#141416] pl-9 text-stone-100 placeholder:text-stone-500"
                                   value={zoneSearch}
                                   onChange={(e) => setZoneSearch(e.target.value)}
                               />
                           </div>
                          <div className="mt-2 h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#141416] p-4 touch-scroll">
                              <div className="space-y-2">
                                  {filteredZones.map((zone) => (
                                      <FormField key={zone} control={form.control} name="zones" render={({ field }) => (
                                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                              <FormControl><Checkbox checked={field.value?.includes(zone)} onCheckedChange={(checked) => {
                                                  return checked ? field.onChange([...(field.value || []), zone]) : field.onChange(field.value?.filter((value) => value !== zone))
                                              }} className="border-white/20 data-[state=checked]:bg-[#22c55e] data-[state=checked]:text-black" /></FormControl>
                                              <FormLabel className="font-normal cursor-pointer text-stone-300">{zone}</FormLabel>
                                          </FormItem>
                                      )} />
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}
              </div>
            </div>
            <SheetFooter className="shrink-0 border-t border-white/10 p-4">
              <div className="flex justify-end gap-2 w-full">
                  <Button type="button" variant="outline" onClick={handleReset} className="tt-button tt-button--outline">Resetează</Button>
                  <Button type="submit" className="tt-button tt-button--default">Aplică filtrele</Button>
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
