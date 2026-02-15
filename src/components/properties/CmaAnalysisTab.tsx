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
        <Card className={cn(
            "rounded-2xl shadow-2xl p-0 h-12 flex items-center",
            isMobile ? "bg-[#152A47] text-white border-none" : "bg-[#f8f8f9]"
        )}>
            <CardContent className="p-2 w-full">
                <div className="flex items-center justify-between text-center">
                     <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">Analiză CMA</span>
                    </div>
                    <Button 
                        size="sm" 
                        className={cn("h-8", isMobile && "bg-white/20 text-white hover:bg-white/30")}
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
