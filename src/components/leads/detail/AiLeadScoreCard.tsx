'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Contact, PortalRecommendation, Property, Task, Viewing } from '@/lib/types';
import { leadScoring } from '@/ai/flows/lead-scoring';

type AiLeadScoreCardProps = {
  contact: Contact;
  viewings?: Viewing[] | null;
  tasks?: Task[] | null;
  sourceProperty?: Property | null;
  recommendations?: PortalRecommendation[] | null;
  onUpdateContact: (data: Partial<Pick<Contact, 'leadScore' | 'leadScoreReason'>>) => void;
  variant?: 'card' | 'embedded';
};

export function AiLeadScoreCard({
  contact,
  viewings,
  tasks,
  sourceProperty,
  recommendations,
  onUpdateContact,
  variant = 'card',
}: AiLeadScoreCardProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateScore = async () => {
    setIsGenerating(true);
    try {
      const result = await leadScoring({
        contact,
        viewings,
        tasks,
        sourceProperty,
        recommendations,
      });
      
      onUpdateContact({
        leadScore: result.score,
        leadScoreReason: result.reason,
      });

      toast({
        title: 'Scor AI generat!',
        description: `Noul scor pentru ${contact.name} este ${result.score}.`,
      });
    } catch (error) {
      console.error('Lead scoring failed', error);
      toast({
        variant: 'destructive',
        title: 'A apărut o eroare',
        description: 'Nu am putut genera scorul AI. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const isEmbedded = variant === 'embedded';

  if (isGenerating) {
    return (
        <Card className="rounded-2xl shadow-2xl bg-[#152A47] border-none text-white">
             <CardContent className="flex flex-col items-center justify-center text-center p-8 space-y-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <h3 className="font-semibold text-white">AI-ul analizează cumpărătorul...</h3>
                <p className="text-sm text-white/70">
                    Se calculează scorul și prioritatea.
                </p>
            </CardContent>
        </Card>
    );
  }

  if (typeof contact.leadScore !== 'number') {
    if (isEmbedded) {
      return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Scor Credibilitate AI</h3>
              <p className="mt-1 text-xs text-white/70">
                Generează cu OpenAI un scor de credibilitate pe baza tuturor informațiilor disponibile despre acest cumpărător.
              </p>
            </div>
          </div>
          <Button onClick={handleGenerateScore} className="mt-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            <Sparkles className="mr-2 h-4 w-4" />
            Generează Scor
          </Button>
        </div>
      );
    }

    return (
        <Card className="rounded-2xl shadow-2xl bg-[#152A47] border-none text-white">
            <CardContent className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="p-3 bg-primary/10 rounded-full">
                    <Lightbulb className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Prioritizează cu AI</h3>
                <p className="text-sm text-white/70">
                    Generează cu OpenAI un scor de credibilitate de la 0 la 100 pe baza tuturor informațiilor disponibile despre acest cumpărător.
                </p>
                <Button onClick={handleGenerateScore} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generează Scor
                </Button>
            </CardContent>
        </Card>
    )
  }

  if (isEmbedded) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Credibilitate AI</p>
            <p className="mt-1 text-sm text-white/70">Scor OpenAI bazat pe datele din CRM.</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-primary">{contact.leadScore}</p>
            <p className="text-xs text-white/70 -mt-1">/ 100</p>
          </div>
        </div>
        {contact.leadScoreReason && (
          <p className="mt-3 border-t border-white/10 pt-3 text-sm text-white/80">{contact.leadScoreReason}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerateScore}
          disabled={isGenerating}
          className="mt-3 h-auto p-0 text-xs text-white/70 hover:text-white"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Regenerează scorul
        </Button>
      </div>
    );
  }

  return (
    <Card className="rounded-2xl shadow-2xl bg-[#152A47] border-none text-white">
        <CardHeader className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <CardTitle className="text-base text-white">Calitate Cumpărător</CardTitle>
                    <CardDescription className="text-xs text-white/70 !mt-1">Scor de credibilitate generat cu OpenAI pe baza datelor din CRM.</CardDescription>
                </div>
                <div className="text-right">
                    <p className="text-4xl font-bold text-primary">{contact.leadScore}</p>
                    <p className="text-xs text-white/70 -mt-1">/ 100</p>
                </div>
            </div>
            {contact.leadScoreReason && (
                <CardDescription className="text-white/80 text-sm pt-2 border-t border-white/10 !mt-3">
                    {contact.leadScoreReason}
                </CardDescription>
            )}
             <div className="pt-1">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleGenerateScore} 
                    disabled={isGenerating}
                    className="text-xs h-auto p-0 text-white/70 hover:text-white"
                >
                <RefreshCw className="mr-1 h-3 w-3" />
                Regenerează scorul
                </Button>
            </div>
        </CardHeader>
    </Card>
  );
}
