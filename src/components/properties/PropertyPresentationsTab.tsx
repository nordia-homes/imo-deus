
'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileDown, Languages, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

export function PropertyPresentationsTab({ propertyId }: { propertyId: string }) {
    const [isGenerating, setIsGenerating] = useState(false);
    
    const handleGenerate = () => {
        setIsGenerating(true);
        // Placeholder for PDF generation logic
        setTimeout(() => {
            setIsGenerating(false);
            alert('Generare PDF simulata. Aici s-ar descărca fișierul.');
        }, 1500);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generator Prezentări PDF</CardTitle>
                <CardDescription>Creează o prezentare profesională a proprietății cu un singur click.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center space-y-8 p-12">
                 <div className="space-y-4">
                     <div className="flex items-center gap-2 justify-center">
                        <Languages className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Selectează limba</h3>
                     </div>
                    <RadioGroup defaultValue="ro" className="flex justify-center gap-6">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="ro" id="ro" />
                            <Label htmlFor="ro">Română</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="en" id="en" />
                            <Label htmlFor="en">Engleză</Label>
                        </div>
                    </RadioGroup>
                </div>
                <Button size="lg" onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            <span>Se generează...</span>
                        </>
                    ) : (
                        <>
                            <FileDown className="mr-2 h-5 w-5" />
                            <span>Generează și Descarcă PDF</span>
                        </>
                    )}
                </Button>
                <p className="text-xs text-muted-foreground max-w-sm">
                    Prezentarea va include imagini, descrierea, caracteristicile și va fi personalizată cu logo-ul și culorile agenției tale.
                </p>
            </CardContent>
        </Card>
    );
}
