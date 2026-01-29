'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import type { Interaction } from '@/lib/types';
import { Plus } from 'lucide-react';

const interactionSchema = z.object({
  type: z.enum(['Apel telefonic', 'Email', 'Întâlnire', 'Vizionare', 'Ofertă']),
  notes: z.string().min(1, 'Notițele sunt obligatorii.'),
});

type InteractionLoggerProps = {
  onLogInteraction: (interaction: Omit<Interaction, 'id' | 'date'>) => void;
  isLogging: boolean;
};

export function InteractionLogger({ onLogInteraction, isLogging }: InteractionLoggerProps) {
  const form = useForm<z.infer<typeof interactionSchema>>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      type: 'Apel telefonic',
      notes: '',
    },
  });

  function onSubmit(values: z.infer<typeof interactionSchema>) {
    onLogInteraction(values);
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="sm:col-span-1">
                <FormLabel>Tip</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Apel telefonic">Apel telefonic</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Întâlnire">Întâlnire</SelectItem>
                    <SelectItem value="Vizionare">Vizionare</SelectItem>
                    <SelectItem value="Ofertă">Ofertă</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Notițe</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Discuție despre buget, preferințe, etc." rows={1} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto" disabled={isLogging}>
          <Plus className="mr-2 h-4 w-4" />
          Adaugă Interacțiune
        </Button>
      </form>
    </Form>
  );
}
