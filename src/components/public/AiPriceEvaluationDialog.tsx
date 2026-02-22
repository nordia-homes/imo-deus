'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Property } from '@/lib/types';
import { generatePropertyInsights, type PropertyInsightsOutput } from '@/ai/flows/property-insights-generator';
import { useToast } from '@/hooks/use-toast';

export function AiPriceEvaluationDialog({ property }: { property: Property }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [insights, setInsights] = useState<PropertyInsightsOutput | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (insights) return; // Don't re-generate if already generated

    setIsGenerating(true);
    try {
      const result = await generatePropertyInsights({
        propertyType: property.propertyType,
        location: property.location,
        price: property.price,
        rooms: property.rooms,
        squareFootage: property.squareFootage,
        constructionYear: property.constructionYear,
        keyFeatures: property.keyFeatures || property.amenities?.join(', ') || '',
      });
      setInsights(result);
    } catch (error) {
      console.error('Failed to generate insights:', error);
      toast({
        variant: 'destructive',
        title: 'Eroare la generare',
        description: 'Nu am putut finaliza evaluarea AI. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !insights) {
      handleGenerate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 p-2 h-auto">
          <TrendingUp className="mr-2" />
          Evalueaza pretul cu ImoDeus.ai
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-slate-900/80 backdrop-blur-lg border-cyan-400/20 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-cyan-400" />
            Evaluare Preț AI
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Analiză generată de ImoDeus.ai pe baza datelor proprietății și a pieței.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center text-center gap-2 h-24">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="text-slate-300">AI-ul analizează proprietatea...</p>
            </div>
          )}
          {insights && (
            <div className="space-y-4">
              <Alert className="bg-cyan-500/10 border-cyan-500/30 text-white">
                <AlertTitle className="font-bold text-cyan-300">Feedback Preț</AlertTitle>
                <AlertDescription className="text-cyan-100">
                  {insights.pricingFeedback}
                </AlertDescription>
              </Alert>
              <Alert className="bg-purple-500/10 border-purple-500/30 text-white">
                <AlertTitle className="font-bold text-purple-300">Profil Cumpărător Ideal</AlertTitle>
                <AlertDescription className="text-purple-100">
                  {insights.buyerProfile}
                </AlertDescription>
              </Alert>
              <div className="text-center">
                 <p className="text-xs text-slate-400">Scor de Atractivitate în Piață</p>
                 <p className="text-5xl font-bold text-white">{insights.marketScore}<span className="text-2xl text-slate-400">/100</span></p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
