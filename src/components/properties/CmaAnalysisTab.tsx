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

interface CmaAnalysisTabProps {
    subjectProperty: Property;
    allProperties: Property[];
    agencyId: string;
}

export function CmaAnalysisTab({ subjectProperty, allProperties, agencyId }: CmaAnalysisTabProps) {
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
        <Card className="rounded-2xl shadow-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Analiză Comparativă de Piață</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center text-center space-y-2">
                    <Button size="sm" className="w-full" onClick={handleGenerateCMA} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Generează Analiză CMA
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
