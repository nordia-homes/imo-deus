
'use client';
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/lib/types";
import { generatePropertyInsights, type PropertyInsightsOutput } from '@/ai/flows/property-insights-generator';

interface AiPriceEvaluationDialogProps {
  property: Property;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiPriceEvaluationDialog({ property, isOpen, onOpenChange }: AiPriceEvaluationDialogProps) {
  const { toast } = useToast();
  const [insights, setInsights] = React.useState<PropertyInsightsOutput | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

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
      console.error("Failed to generate AI insights:", error);
      toast({
        variant: "destructive",
        title: "A apărut o eroare",
        description: "Nu am putut genera evaluarea. Vă rugăm să reîncercați.",
      });
      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !insights && !isGenerating) {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0F1E33] text-white border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary" />
            Evaluare Preț ImoDeus.ai
          </DialogTitle>
          <DialogDescription className="text-white/70">
            Analizăm datele proprietății pentru a oferi o perspectivă asupra prețului.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center text-center space-y-3 h-40">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <h3 className="font-semibold text-white">AI-ul analizează piața...</h3>
              <p className="text-sm text-white/70">
                Se calculează scorul de atractivitate și se compară prețul.
              </p>
            </div>
          )}
          {insights && !isGenerating && (
            <div className="space-y-4">
               <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center">
                        <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center text-primary text-3xl font-bold">
                            {insights.marketScore}
                        </div>
                        <p className="text-sm font-semibold mt-1">Scor Piață</p>
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                            <TrendingUp className="h-5 w-5 text-yellow-400 mt-0.5" />
                            <p className="font-medium text-sm">
                                <span className="text-white/70">Preț: </span>
                                {insights.pricingFeedback}
                            </p>
                        </div>
                    </div>
                </div>
                 <div className="text-xs text-white/60 p-3 bg-white/5 rounded-lg">
                    <span className="font-bold">Disclaimer:</span> Această evaluare este generată automat și are scop informativ. Nu reprezintă o evaluare oficială ANEVAR.
                </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
