'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2, Sparkles, TrendingUp, UserCheck, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Contact } from '@/lib/types';
import { leadScoring } from '@/ai/flows/lead-scoring';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type AiLeadScoreCardProps = {
  contact: Contact;
  onUpdateContact: (data: Partial<Pick<Contact, 'leadScore' | 'leadScoreReason'>>) => void;
};

function getEngagementLevel(interactionCount: number): string {
    if (interactionCount > 5) return 'high';
    if (interactionCount > 1) return 'medium';
    return 'low';
}

function getPotentialValue(budget?: number): string {
    if (!budget) return 'low';
    if (budget > 150000) return 'high';
    if (budget > 50000) return 'medium';
    return 'low';
}

// Helper component for circular progress
const CircularProgress = ({ score }: { score: number }) => {
    const size = 60;
    const strokeWidth = 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    className="text-muted"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className="text-primary"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-primary">
                {score}
            </span>
        </div>
    );
};

export function AiLeadScoreCard({ contact, onUpdateContact }: AiLeadScoreCardProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateScore = async () => {
    setIsGenerating(true);
    try {
      const result = await leadScoring({
        engagementLevel: getEngagementLevel(contact.interactionHistory?.length || 0),
        potentialValue: getPotentialValue(contact.budget),
        leadDetails: `Name: ${contact.name}, Description: ${contact.description || 'N/A'}, Budget: €${contact.budget?.toLocaleString()}`,
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
  
  if (isGenerating) {
    return (
        <Card className="rounded-2xl shadow-lg">
             <CardContent className="flex flex-col items-center justify-center text-center p-8 space-y-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <h3 className="font-semibold">AI-ul analizează lead-ul...</h3>
                <p className="text-sm text-muted-foreground">
                    Se calculează scorul și prioritatea.
                </p>
            </CardContent>
        </Card>
    );
  }

  if (typeof contact.leadScore !== 'number') {
    return (
        <Card className="rounded-2xl bg-muted/50 border-dashed shadow-lg">
            <CardContent className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="p-3 bg-primary/10 rounded-full">
                    <Lightbulb className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Prioritizează cu AI</h3>
                <p className="text-sm text-muted-foreground">
                    Generează un scor de la 0 la 100 pentru a înțelege calitatea acestui lead și a-ți prioritiza eforturile.
                </p>
                <Button onClick={handleGenerateScore}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generează Scor
                </Button>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card className="rounded-2xl shadow-lg border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 hover:text-primary pointer-events-none">
                Calitate Lead
            </Button>
          <CircularProgress score={contact.leadScore} />
        </div>
      </CardHeader>
      <CardContent>
         <Alert className="relative">
            <UserCheck className="h-4 w-4" />
            <AlertTitle className="font-bold">Analiză AI</AlertTitle>
            <AlertDescription className="text-xs pr-8">
                {contact.leadScoreReason || 'Nicio justificare disponibilă.'}
            </AlertDescription>
             <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleGenerateScore} 
                disabled={isGenerating}
                className="absolute bottom-1 right-1 h-7 w-7"
                title="Regenerează scorul"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Regenerează</span>
            </Button>
        </Alert>
      </CardContent>
    </Card>
  );
}
