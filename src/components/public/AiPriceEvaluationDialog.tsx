'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { generatePropertyInsights, type PropertyInsightsOutput } from '@/ai/flows/property-insights-generator';
import type { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface AiPriceEvaluationDialogProps {
  property: Property;
  children: React.ReactNode;
}

export function AiPriceEvaluationDialog({ property, children }: AiPriceEvaluationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<PropertyInsightsOutput | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsLoading(true);
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
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'A apărut o eroare',
        description: 'Nu am putut genera evaluarea. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      handleGenerate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-slate-900/80 text-white border-cyan-400/20 backdrop-blur-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-cyan-400" />
            Evaluare Preț ImoDeus.ai
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Aceasta este o evaluare automată bazată pe datele proprietății și condițiile de piață.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-center space-y-2 h-24">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="text-slate-300">AI-ul analizează piața...</p>
            </div>
          )}
          {!isLoading && insights && (
            <Alert className="bg-cyan-900/30 border-cyan-500/50 text-white">
              <TrendingUp className="h-4 w-4 !text-cyan-400" />
              <AlertTitle className="font-bold text-cyan-300">Feedback Preț</AlertTitle>
              <AlertDescription className="text-cyan-200">
                {insights.pricingFeedback}
              </AlertDescription>
            </Alert>
          )}
           {!isLoading && !insights && (
             <div className="flex flex-col items-center justify-center text-center space-y-2 h-24">
              <p className="text-slate-400">Nu s-a putut genera evaluarea.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
