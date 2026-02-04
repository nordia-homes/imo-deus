'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateEmail } from '@/ai/flows/email-generator';
import type { Contact } from '@/lib/types';
import type { User } from 'firebase/auth';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const emailGenSchema = z.object({
  goal: z.string().min(1, 'Tipul email-ului este obligatoriu.'),
  additionalContext: z.string().optional(),
});

type AiEmailGeneratorProps = {
  contact: Contact;
  agent: User;
}

export function AiEmailGenerator({ contact, agent }: AiEmailGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null);
  const [subjectCopied, setSubjectCopied] = useState(false);
  const [bodyCopied, setBodyCopied] = useState(false);

  const form = useForm<z.infer<typeof emailGenSchema>>({
    resolver: zodResolver(emailGenSchema),
    defaultValues: {
      goal: '',
      additionalContext: '',
    },
  });

  async function onSubmit(values: z.infer<typeof emailGenSchema>) {
    setIsGenerating(true);
    setGeneratedEmail(null);
    try {
      const result = await generateEmail({
        ...values,
        contactName: contact.name,
        agentName: agent.displayName || agent.email || 'Agentul Tău',
      });
      setGeneratedEmail(result);
      toast({ title: 'Email generat!', description: 'Draft-ul email-ului este gata mai jos.' });
    } catch (error) {
      console.error('Email generation failed', error);
      toast({ variant: 'destructive', title: 'A apărut o eroare', description: 'Nu am putut genera email-ul AI.' });
    } finally {
      setIsGenerating(false);
    }
  }

  const handleCopy = (text: string, type: 'subject' | 'body') => {
    navigator.clipboard.writeText(text);
    if (type === 'subject') {
      setSubjectCopied(true);
      setTimeout(() => setSubjectCopied(false), 2000);
    } else {
      setBodyCopied(true);
      setTimeout(() => setBodyCopied(false), 2000);
    }
    toast({ title: `${type === 'subject' ? 'Subiect' : 'Conținut'} copiat!`, description: 'Poți să-l lipești în clientul tău de email.' });
  };

  return (
    <Card className="shadow-2xl rounded-2xl">
      <CardHeader>
        <CardTitle>Asistent Email AI</CardTitle>
        <CardDescription>Generează email-uri profesionale pentru clienții tăi în câteva secunde.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scopul Email-ului</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selectează un șablon..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Follow-up după vizionare">Follow-up după vizionare</SelectItem>
                      <SelectItem value="Primul contact după alocarea lead-ului">Primul contact</SelectItem>
                      <SelectItem value="Propunere proprietăți noi">Propunere proprietăți noi</SelectItem>
                      <SelectItem value="Reactivare client inactiv">Reactivare client inactiv</SelectItem>
                      <SelectItem value="Mesaj de mulțumire după tranzacție">Mesaj de mulțumire</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="additionalContext"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Context suplimentar (Opțional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="ex: Clientul a apreciat balconul, dar prețul este puțin peste buget..." rows={3} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-4">
            <Button type="submit" disabled={isGenerating} className="w-full">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generează Email
            </Button>

            {generatedEmail && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label>Subiect</Label>
                  <div className="relative mt-1">
                    <Input readOnly value={generatedEmail.subject} className="pr-10 bg-muted"/>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => handleCopy(generatedEmail.subject, 'subject')}
                    >
                      {subjectCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                 <div>
                  <Label>Conținut Email</Label>
                   <div className="relative mt-1">
                    <Textarea readOnly value={generatedEmail.body} rows={10} className="pr-10 bg-muted"/>
                     <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-2 h-8 w-8"
                      onClick={() => handleCopy(generatedEmail.body, 'body')}
                    >
                      {bodyCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
