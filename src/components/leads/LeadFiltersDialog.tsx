"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { locations } from '@/lib/locations';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

const leadFilterSchema = z.object({
  budgetMin: z.coerce.number().optional(),
  budgetMax: z.coerce.number().optional(),
  rooms: z.coerce.number().optional(),
  zones: z.array(z.string()).optional(),
});

export type LeadFilters = z.infer<typeof leadFilterSchema>;

interface LeadFiltersDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: LeadFilters | null) => void;
}

export function LeadFiltersDialog({ isOpen, onOpenChange, onApplyFilters }: LeadFiltersDialogProps) {
  const [zoneSearch, setZoneSearch] = useState('');

  const form = useForm<LeadFilters>({
    resolver: zodResolver(leadFilterSchema),
    defaultValues: {
      zones: [],
    },
  });

  const zoneOptions = useMemo(() => {
    const allZones = Object.values(locations).flat();
    return [...new Set(allZones)].sort();
  }, []);

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
    });
    onApplyFilters(null);
    onOpenChange(false);
  };
  
  const selectedZones = form.watch('zones') || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filtrare Preferințe și Buget</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="budgetMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buget Min (€)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budgetMax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buget Max (€)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
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
                  <FormLabel>Nr. Camere Dorit</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="zones"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Zone</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value?.length && "text-muted-foreground"
                          )}
                        >
                          {field.value?.length ? `${field.value.length} zone selectate` : "Selectează zone"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput placeholder="Caută zonă..." value={zoneSearch} onValueChange={setZoneSearch} />
                        <CommandEmpty>Nicio zonă găsită.</CommandEmpty>
                        <ScrollArea className="h-64">
                          <CommandGroup>
                            {zoneOptions.map((zone) => (
                              <CommandItem
                                value={zone}
                                key={zone}
                                onSelect={() => {
                                  const newZones = field.value?.includes(zone)
                                    ? field.value.filter((z) => z !== zone)
                                    : [...(field.value || []), zone];
                                  form.setValue("zones", newZones);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value?.includes(zone)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {zone}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </ScrollArea>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleReset}>
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
