'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { TrendingUp, Loader2, Lightbulb } from 'lucide-react';
import { generatePropertyInsights, type PropertyInsightsOutput } from '@/ai/flows/property-insights-generator';
import type { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface AiPriceEvaluationDialogProps {
  property: Property;
}

export function AiPriceEvaluationDialog({ property }: AiPriceEvaluationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [insights, setInsights] = useState<PropertyInsightsOutput | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (insights) return; // Don't re-generate if already present
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
    } catch (e) {
      console.error("AI Insights failed", e);
      toast({
        variant: 'destructive',
        title: "Eroare la generare",
        description: "Nu am putut evalua prețul. Vă rugăm să reîncercați."
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      handleGenerate();
    } else {
      // Reset state when closing
      setInsights(null);
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-sm p-0 h-auto font-semibold text-cyan-400 hover:text-cyan-300">
          <TrendingUp className="mr-2 h-4 w-4" />
          Evalueaza pretul cu ImoDeus.ai
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0F1E33] text-white border-cyan-400/20">
        <DialogHeader>
          <DialogTitle>Evaluare Preț AI</DialogTitle>
          <DialogDescription className="text-white/70">
            Analiză generată de ImoDeus.ai pentru proprietatea: <span className="font-bold">{property.title}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center text-center space-y-3 min-h-[150px]">
              <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
              <h3 className="font-semibold">AI-ul analizează piața...</h3>
              <p className="text-sm text-white/70">
                Se calculează scorul și se compară cu proprietăți similare.
              </p>
            </div>
          )}
          {insights && !isGenerating && (
             <div className="space-y-4">
                <Alert className="bg-cyan-900/30 border-cyan-500/50 text-white">
                    <Lightbulb className="h-4 w-4 text-cyan-400" />
                    <AlertTitle className="font-bold text-cyan-300">Scor Piață: {insights.marketScore}/100</AlertTitle>
                    <AlertDescription className="text-cyan-200">
                        Acest scor indică atractivitatea proprietății pe piața curentă, bazat pe preț, locație și caracteristici.
                    </AlertDescription>
                </Alert>
                <Alert className="bg-white/10 border-white/20">
                    <AlertTitle>Feedback Preț</AlertTitle>
                    <AlertDescription className="text-white/80">{insights.pricingFeedback}</AlertDescription>
                </Alert>
                <Alert className="bg-white/10 border-white/20">
                    <AlertTitle>Profil Cumpărător Ideal</AlertTitle>
                    <AlertDescription className="text-white/80">{insights.buyerProfile}</AlertDescription>
                </Alert>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}