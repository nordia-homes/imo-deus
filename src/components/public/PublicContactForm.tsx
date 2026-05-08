'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { scheduleViewing } from '@/ai/flows/schedule-viewing';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { getAgencyThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';

const contactSchema = z.object({
  name: z.string().min(2, { message: 'Numele trebuie să aibă cel puțin 2 caractere.' }),
  phone: z.string().min(10, { message: 'Numărul de telefon este invalid.' }),
  email: z.string().email({ message: 'Adresa de email este invalidă.' }),
  message: z.string().optional(),
  website: z.string().max(0).optional(),
  formStartedAt: z.number(),
});

interface PublicContactFormProps {
  propertyId?: string;
  agencyId: string;
}

export function PublicContactForm({ propertyId = '', agencyId }: PublicContactFormProps) {
  const { toast } = useToast();
  const { agency } = usePublicAgency();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formStartedAt = useMemo(() => Date.now(), []);
  const isAgentfinderTheme = getAgencyThemePreset(agency) === 'agentfinder';

  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      message: '',
      website: '',
      formStartedAt,
    },
  });

  const onSubmit = async (values: z.infer<typeof contactSchema>) => {
    setIsSubmitting(true);
    try {
      const result = await scheduleViewing({
        ...values,
        propertyId,
        agencyId,
      });

      if (result.success) {
        toast({
          title: 'Solicitare trimisă!',
          description: result.message,
        });
        form.reset();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Eroare la trimitere',
        description: error.message || 'A apărut o problemă. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden rounded-[2rem] border shadow-[0_34px_96px_-42px_rgba(0,0,0,0.94)] backdrop-blur-xl",
      isAgentfinderTheme
        ? "public-premium-panel text-slate-950"
        : "[border-color:var(--public-card-border)] [background:var(--public-card-bg)] text-stone-100"
    )}>
      <CardHeader className={cn("pb-6", isAgentfinderTheme ? "border-b border-slate-200/80" : "border-b border-white/8")}>
        <CardTitle className={cn("text-3xl font-semibold tracking-tight", isAgentfinderTheme ? "text-slate-950" : "text-white")}>Trimite-ne un mesaj</CardTitle>
        <CardDescription className={cn("max-w-2xl text-sm leading-7 md:text-base", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/72")}>
          Spune-ne ce proprietate ți-a atras atenția sau ce cauți mai exact, iar noi revenim rapid cu următorii pași.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="hidden" aria-hidden="true">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem tabIndex={-1}>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={cn("text-sm font-medium", isAgentfinderTheme ? "text-slate-700" : "text-stone-300")}>Nume</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Cum te numești?"
                        className={cn("h-14 rounded-[1.25rem] px-5 text-base", isAgentfinderTheme ? "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400" : "border-white/8 bg-white/[0.03] text-stone-100 placeholder:text-stone-500")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={cn("text-sm font-medium", isAgentfinderTheme ? "text-slate-700" : "text-stone-300")}>Telefon</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Pe ce număr te putem suna?"
                        className={cn("h-14 rounded-[1.25rem] px-5 text-base", isAgentfinderTheme ? "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400" : "border-white/8 bg-white/[0.03] text-stone-100 placeholder:text-stone-500")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn("text-sm font-medium", isAgentfinderTheme ? "text-slate-700" : "text-stone-300")}>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="Unde îți răspundem dacă preferi email?"
                      className={cn("h-14 rounded-[1.25rem] px-5 text-base", isAgentfinderTheme ? "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400" : "border-white/8 bg-white/[0.03] text-stone-100 placeholder:text-stone-500")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn("text-sm font-medium", isAgentfinderTheme ? "text-slate-700" : "text-stone-300")}>Mesaj</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Spune-ne ce proprietate ți-a atras atenția sau ce cauți mai exact..."
                      className={cn("min-h-[180px] rounded-[1.5rem] px-5 py-4 text-base leading-7", isAgentfinderTheme ? "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400" : "border-white/8 bg-white/[0.03] text-stone-100 placeholder:text-stone-500")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={cn("rounded-[1.35rem] px-4 py-3 text-sm leading-6", isAgentfinderTheme ? "border border-slate-200 bg-sky-50/70 text-slate-600" : "border border-white/8 bg-white/[0.03] text-stone-300")}>
              Revenim rapid cu un răspuns clar. Dacă ai deja o proprietate în minte, menționeaz-o și mergem mai repede
              mai departe.
            </div>

            <Button
              type="submit"
              className={cn("h-14 w-full rounded-full text-base font-semibold", isAgentfinderTheme ? "public-premium-primary-button" : "bg-emerald-400 text-black hover:bg-emerald-300")}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Trimite mesajul
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
