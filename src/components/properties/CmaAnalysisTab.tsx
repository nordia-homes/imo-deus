'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Calculator, FileText, Loader2, Wand2 } from "lucide-react";
import type { Property, CMA, ComparableProperty } from "@/lib/types";
import { generateCMA } from '@/ai/flows/cma-generator';
import { cn } from '@/lib/utils';
import { ACTION_CARD_CLASSNAME, ACTION_PILL_CLASSNAME } from "./detail/actions/cardStyles";

interface CmaAnalysisTabProps {
    subjectProperty: Property;
    allProperties: Property[];
    agencyId: string;
    isMobile?: boolean;
}

export function CmaAnalysisTab({ subjectProperty, allProperties, agencyId, isMobile = false }: CmaAnalysisTabProps) {
    const { toast } = useToast();
    const [cmaResult, setCmaResult] = useState<CMA | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateCMA = async () => {
        setIsGenerating(true);
        setCmaResult(null);
        toast({ title: 'Generare CMA în curs...', description: 'AI-ul analizează piața. Acest proces poate dura până la un minut.' });

        try {
            const result = await generateCMA({
                subjectProperty,
                allProperties,
                agencyId
            });
            setCmaResult(result);
            toast({ title: 'Analiza CMA a fost finalizată!', description: 'Raportul este disponibil mai jos.' });
        } catch (error) {
            console.error("CMA generation failed:", error);
            toast({
                variant: 'destructive',
                title: 'Generare eșuată',
                description: 'A apărut o eroare la generarea analizei. Vă rugăm să reîncercați.',
            });
        } finally {
            setIsGenerating(false);
        }
    };
    
    return (
        <Card className={`${ACTION_CARD_CLASSNAME} p-0`}>
            <CardContent className="w-full p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/8 bg-[#1a2a40]">
                            <Calculator className="h-4 w-4 text-sky-100" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-sky-100/62">Analiza pietei</p>
                            <p className="truncate text-sm font-semibold text-white">Analiză CMA</p>
                        </div>
                    </div>
                    <Button 
                        size="sm" 
                        className={`h-10 rounded-full px-4 text-white ${ACTION_PILL_CLASSNAME}`}
                        onClick={handleGenerateCMA} 
                        disabled={isGenerating}
                    >
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Generează
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
