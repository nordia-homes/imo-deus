'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, TrendingUp } from 'lucide-react';
import type { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { generatePropertyInsights, type PropertyInsightsOutput } from '@/ai/flows/property-insights-generator';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface AiPriceEvaluationDialogProps {
  property: Property;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiPriceEvaluationDialog({ property, isOpen, onOpenChange }: AiPriceEvaluationDialogProps) {
  const { toast } = useToast();
  const [insights, setInsights] = useState<PropertyInsightsOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setInsights(null);
    try {
      const result = await generatePropertyInsights({
        propertyType: property.propertyType,
        location: property.location,
        price: property.price,
        rooms: property.rooms,
        squareFootage: property.squareFootage,
        constructionYear: property.constructionYear,
        keyFeatures: property.keyFeatures || '',
      });
      setInsights(result);
    } catch (error) {
      console.error('Failed to generate insights:', error);
      toast({
        variant: 'destructive',
        title: 'Eroare la generare',
        description: 'Nu am putut genera evaluarea. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !insights && !isGenerating) {
      handleGenerate();
    }
    if (!isOpen) {
      setInsights(null);
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0F1E33] border-none text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="text-primary" /> Evaluare Preț ImoDeus.ai</DialogTitle>
          <DialogDescription className="text-white/70">
            Analiză automată a prețului pentru "{property.title}" pe baza datelor de piață.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center text-center space-y-3 h-40">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="font-semibold">AI-ul analizează piața...</p>
              <p className="text-sm text-white/70">Acest proces poate dura câteva momente.</p>
            </div>
          )}
          {insights && (
            <div className="space-y-4">
               <Alert className="bg-white/5 border-primary/20 text-white">
                <TrendingUp className="h-4 w-4 text-primary" />
                <AlertTitle className="text-white">Feedback Preț</AlertTitle>
                <AlertDescription className="text-white/90">
                  {insights.pricingFeedback}
                </AlertDescription>
              </Alert>
               <div className="text-center">
                 <p className="text-sm text-white/70">Scor de Atractivitate</p>
                 <p className="text-5xl font-bold text-primary">{insights.marketScore}/100</p>
               </div>
               <Alert className="bg-white/5 border-primary/20 text-white">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertTitle className="text-white">Profil Cumpărător Ideal</AlertTitle>
                <AlertDescription className="text-white/90">
                    {insights.buyerProfile}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
