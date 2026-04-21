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
  variant?: 'card' | 'embedded' | 'inline';
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
  const normalizedScore = typeof contact.leadScore === 'number' ? Math.max(0, Math.min(100, contact.leadScore)) : 0;
  const scoreTone =
    normalizedScore >= 80 ? 'bg-emerald-400' : normalizedScore >= 60 ? 'bg-cyan-400' : normalizedScore >= 40 ? 'bg-amber-400' : 'bg-rose-400';
  const scoreLabel =
    normalizedScore >= 80 ? 'Foarte bun' : normalizedScore >= 60 ? 'Bun' : normalizedScore >= 40 ? 'Mediu' : 'Scăzut';

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
  const isInline = variant === 'inline';

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
    if (isInline) {
      return (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/72">Credibilitate AI</p>
            <p className="mt-1 text-sm leading-6 text-white/78">Generează cu OpenAI un scor de credibilitate pe baza datelor din CRM.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
            <p className="text-sm text-white/78">Scorul nu este generat încă.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
            <Button onClick={handleGenerateScore} className="agentfinder-button-primary h-11 w-full rounded-full bg-[#1f4b7a] px-4 text-white hover:bg-[#24588f]">
              <Sparkles className="mr-2 h-4 w-4" />
              Generează Scor
            </Button>
          </div>
        </div>
      );
    }

    if (isEmbedded) {
      return (
        <div className="rounded-2xl border border-emerald-300/16 bg-emerald-400/8 p-4 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-emerald-400/12 p-2">
              <Lightbulb className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/72">Credibilitate AI</p>
              <p className="mt-1 text-sm text-white/80">
                Generează cu OpenAI un scor de credibilitate pe baza tuturor informațiilor disponibile despre acest cumpărător.
              </p>
            </div>
          </div>
          <Button onClick={handleGenerateScore} className="agentfinder-button-primary mt-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground">
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
                <Button onClick={handleGenerateScore} className="agentfinder-button-primary bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generează Scor
                </Button>
            </CardContent>
        </Card>
    )
  }

  if (isEmbedded) {
    return (
      <div className="rounded-2xl border border-emerald-300/16 bg-emerald-400/8 p-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/72">Credibilitate AI</p>
            <p className="mt-1 text-sm text-white/78">Scor OpenAI bazat pe datele din CRM.</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-primary">{contact.leadScore}</p>
            <p className="text-xs text-white/70 -mt-1">/ 100</p>
          </div>
        </div>
        {contact.leadScoreReason && (
          <p className="mt-3 border-t border-white/10 pt-3 text-sm text-white/82">{contact.leadScoreReason}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerateScore}
          disabled={isGenerating}
          className="agentfinder-button-tertiary mt-3 h-auto p-0 text-xs text-white/70 hover:text-white"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Regenerează scorul
        </Button>
      </div>
    );
  }

  if (isInline) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/72">Credibilitate AI</p>
            <p className="mt-1 text-sm text-white/78">Scor OpenAI bazat pe datele din CRM.</p>
          </div>
        </div>
        {typeof contact.leadScore === 'number' && (
          <div className="rounded-2xl border border-emerald-300/14 bg-emerald-400/7 px-4 py-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-white/55">Scor</p>
                <div className="mt-1 flex items-end gap-2">
                  <p className="text-4xl font-bold leading-none text-primary">{contact.leadScore}</p>
                  <p className="pb-1 text-xs text-white/70">/ 100</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Nivel</p>
                <p className="mt-1 text-sm font-semibold text-white">{scoreLabel}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${scoreTone}`}
                  style={{ width: `${normalizedScore}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-white/45">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>
          </div>
        )}
        {contact.leadScoreReason && (
          <div className="rounded-2xl border border-white/20 bg-[#0f2036] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">De ce acest scor</p>
            <p className="mt-2 text-sm leading-6 text-white/88">{contact.leadScoreReason}</p>
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerateScore}
            disabled={isGenerating}
            className="agentfinder-button-tertiary h-auto p-0 text-xs text-white/70 hover:text-white"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Regenerează scorul
          </Button>
        </div>
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
                    className="agentfinder-button-tertiary text-xs h-auto p-0 text-white/70 hover:text-white"
                >
                <RefreshCw className="mr-1 h-3 w-3" />
                Regenerează scorul
                </Button>
            </div>
        </CardHeader>
    </Card>
  );
}
