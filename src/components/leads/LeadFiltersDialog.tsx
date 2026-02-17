"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { locations, type City } from '@/lib/locations';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { useIsMobile } from '@/hooks/use-mobile';


const leadFilterSchema = z.object({
  budgetMin: z.coerce.number().optional(),
  budgetMax: z.coerce.number().optional(),
  rooms: z.coerce.number().optional(),
  zones: z.array(z.string()).optional(),
  city: z.string().optional(),
});

export type LeadFilters = z.infer<typeof leadFilterSchema>;

interface LeadFiltersDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: LeadFilters | null) => void;
}

export function LeadFiltersDialog({ isOpen, onOpenChange, onApplyFilters }: LeadFiltersDialogProps) {
  const isMobile = useIsMobile();
  
  const form = useForm<LeadFilters>({
    resolver: zodResolver(leadFilterSchema),
    defaultValues: {
      zones: [],
      city: 'all',
    },
  });

  const watchedCity = form.watch('city') as City;

  const zoneOptions = useMemo(() => {
    if (watchedCity && locations[watchedCity]) {
      return locations[watchedCity].sort();
    }
    const allZones = Object.values(locations).flat();
    return [...new Set(allZones)].sort();
  }, [watchedCity]);
  
  useEffect(() => {
    // Reset zones when city changes
    form.setValue('zones', []);
  }, [watchedCity, form]);


  function onSubmit(values: LeadFilters) {
    onApplyFilters(values);
    onOpenChange(false);
  }

  const handleReset = () => {
    form.reset({
      budgetMin: undefined,
      budgetMax: undefined,
      rooms: undefined,
      zones: [],
      city: 'all',
    });
    onApplyFilters(null);
    onOpenChange(false);
  };
  
  const selectedZones = form.watch('zones') || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("p-0 flex flex-col", isMobile ? "h-screen w-screen max-w-full rounded-none border-none" : "sm:max-w-md")}>
        <DialogHeader className={cn("shrink-0 border-b p-4 text-center", isMobile ? "bg-[#0F1E33] border-white/10" : "")}>
          <DialogTitle className={cn(isMobile && "text-white")}>Filtrare Preferințe și Buget</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={cn("flex-1 flex flex-col min-h-0", isMobile && "bg-[#0F1E33] text-white")}>
            <div className={cn("flex-1 overflow-y-auto px-6 py-4 space-y-4", isMobile && "px-4")}>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="budgetMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn(isMobile && "text-white/80")}>Buget Min (€)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budgetMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn(isMobile && "text-white/80")}>Buget Max (€)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="rooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={cn(isMobile && "text-white/80")}>Nr. Camere Dorit</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")}/>
                    </FormControl>
                  </FormItem>
                )}
              />
            
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(isMobile && "text-white/80")}>Localitate</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || 'all'}>
                    <FormControl>
                      <SelectTrigger className={cn(isMobile && "bg-white/10 border-white/20 text-white")}>
                        <SelectValue placeholder="Toate localitățile" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="all">Toate localitățile</SelectItem>
                        {Object.keys(locations).map(city => (
                            <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div>
              <Label className={cn(isMobile && "text-white/80")}>Zone de interes</Label>
              <ScrollArea className={cn("h-48 w-full rounded-md border p-4 mt-2", isMobile && "border-white/20 bg-white/5")}>
                  <div className="space-y-2">
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
                                                          : field.onChange(field.value?.filter((value) => value !== zone));
                                                  }}
                                                  className={cn(isMobile && "border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground")}
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
              </ScrollArea>
            </div>

            </div>
            <DialogFooter className={cn("shrink-0 border-t p-4", isMobile && "bg-[#0F1E33] border-white/10")}>
              <Button type="button" variant="ghost" onClick={handleReset} className={cn(isMobile && "text-white/80 hover:bg-white/10 hover:text-white/90")}>
                Resetează
              </Button>
              <Button type="submit">Aplică Filtre</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}