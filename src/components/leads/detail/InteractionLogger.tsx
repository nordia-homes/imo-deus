'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Interaction } from '@/lib/types';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const interactionSchema = z.object({
  type: z.custom<Interaction['type']>(),
  notes: z.string().min(1, 'Notițele sunt obligatorii.'),
});

type InteractionLoggerProps = {
  onAddInteraction: (interaction: Omit<Interaction, 'id' | 'date' | 'agent'>) => Promise<void>;
};

export function InteractionLogger({ onAddInteraction }: InteractionLoggerProps) {
  const { toast } = useToast();
  const [isLogging, setIsLogging] = useState(false);
  
  const form = useForm<z.infer<typeof interactionSchema>>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      type: 'Notiță',
      notes: '',
    },
  });

  async function onSubmit(values: z.infer<typeof interactionSchema>) {
    setIsLogging(true);
    try {
      await onAddInteraction(values);
      form.reset();
      toast({ title: 'Interacțiune adăugată.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Eroare', description: 'Nu s-a putut adăuga interacțiunea.' });
    } finally {
        setIsLogging(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
                <FormItem>
                    <FormControl>
                        <Textarea {...field} placeholder="Adaugă o notiță, un apel telefonic, email..." rows={2} />
                    </FormControl>
                </FormItem>
            )}
        />
        <div className="flex justify-between items-center">
             <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                    <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger className="h-8 w-[150px]">
                                    <SelectValue />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Notiță">Notiță</SelectItem>
                                <SelectItem value="Apel telefonic">Apel telefonic</SelectItem>
                                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                <SelectItem value="Email">Email</SelectItem>
                                <SelectItem value="Întâlnire">Întâlnire</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}
            />
            <Button type="submit" size="sm" disabled={isLogging}>
              {isLogging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Adaugă
            </Button>
        </div>
      </form>
    </Form>
  );
}
