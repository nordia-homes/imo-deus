'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Calculator, FileText, Loader2 } from "lucide-react";
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
    
    const getStatusBadge = (status: ComparableProperty['status']) => {
        switch (status) {
            case 'Vândut': return 'bg-destructive/80';
            case 'Închiriat': return 'bg-destructive/80';
            case 'Activ': return 'bg-green-600/80';
            default: return 'bg-muted';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analiză Comparativă de Piață (CMA)</CardTitle>
                <CardDescription>
                    Generează un raport AI pentru a estima valoarea de piață a proprietății pe baza datelor din portofoliul tău.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isGenerating && (
                    <div className="flex flex-col items-center justify-center text-center p-12 space-y-3">
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        <h3 className="text-lg font-semibold">AI-ul analizează datele...</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Se caută proprietăți comparabile și se calculează valoarea estimată. Acest proces poate dura câteva momente.
                        </p>
                    </div>
                )}

                {!isGenerating && !cmaResult && (
                    <div className="flex flex-col items-center justify-center text-center p-12 space-y-4">
                        <Calculator className="h-16 w-16 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Gata pentru analiză</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Apasă pe butonul de mai jos pentru a porni o analiză comparativă a pieței pentru proprietatea curentă, folosind inteligența artificială.
                        </p>
                        <Button size="lg" onClick={handleGenerateCMA}>
                            Generează Analiză CMA
                        </Button>
                    </div>
                )}
                
                {cmaResult && !isGenerating && (
                    <div className="space-y-6">
                        <Alert>
                            <FileText className="h-4 w-4" />
                            <AlertTitle>Rezumat Analiză</AlertTitle>
                            <AlertDescription>{cmaResult.notes}</AlertDescription>
                        </Alert>
                        
                         <Card className="bg-primary/5">
                            <CardHeader>
                               <CardTitle>Valoare de Piață Estimată</CardTitle>
                            </CardHeader>
                            <CardContent className="text-center">
                                <p className="text-4xl font-bold text-primary">
                                    €{cmaResult.estimatedValueRange.min.toLocaleString()} - €{cmaResult.estimatedValueRange.max.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>

                        <div>
                            <h3 className="font-semibold mb-2">Proprietăți Comparabile (Comps)</h3>
                            <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Adresă</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Preț (€)</TableHead>
                                            <TableHead>mp</TableHead>
                                            <TableHead>Similaritate</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cmaResult.comparableProperties.map(comp => (
                                            <TableRow key={comp.id}>
                                                <TableCell className="font-medium">{comp.address}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 text-xs rounded-full text-white ${getStatusBadge(comp.status)}`}>
                                                        {comp.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{comp.price.toLocaleString()}</TableCell>
                                                <TableCell>{comp.squareFootage}</TableCell>
                                                <TableCell className="text-muted-foreground text-xs">{comp.similarity}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                         <div>
                            <h3 className="font-semibold mb-2">Ajustări de Preț</h3>
                             <div className="border rounded-lg">
                                <Table>
                                     <TableHeader>
                                        <TableRow>
                                            <TableHead>Caracteristică</TableHead>
                                            <TableHead>Ajustare</TableHead>
                                            <TableHead>Motiv</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cmaResult.priceAdjustments.map((adj, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">{adj.feature}</TableCell>
                                                <TableCell className={adj.adjustment.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
                                                    {adj.adjustment}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs">{adj.reason}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                         <div className="text-center pt-4">
                            <Button onClick={handleGenerateCMA} variant="outline">
                                Regenerează Analiza
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
