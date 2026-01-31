'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Languages, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Property } from "@/lib/types";
import { useAgency } from "@/context/AgencyContext";
import { useUser } from "@/firebase";
import { generatePropertyPresentation } from "@/ai/flows/property-presentation-generator";


export function PropertyPresentationsTab({ property }: { property: Property }) {
    const { toast } = useToast();
    const { agency } = useAgency();
    const { user } = useUser();
    const [language, setLanguage] = useState<'ro' | 'en'>('ro');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const handleGenerate = async () => {
        if (!agency || !user) {
            toast({
                variant: 'destructive',
                title: 'Eroare',
                description: 'Datele agenției sau ale agentului nu au putut fi încărcate.'
            });
            return;
        }

        setIsGenerating(true);
        toast({ title: 'Generare în curs...', description: 'AI-ul creează prezentarea PDF. Acest proces poate dura câteva momente.' });

        try {
            const result = await generatePropertyPresentation({
                propertyTitle: property.title,
                propertyType: property.propertyType,
                price: property.price,
                transactionType: property.transactionType,
                location: property.location,
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms,
                squareFootage: property.squareFootage,
                description: property.description || '',
                keyFeatures: property.amenities || [],
                agentName: user.displayName || 'Agent Imobiliar',
                agentEmail: user.email || '',
                agentPhone: user.phoneNumber || agency.phone || '',
                agencyName: agency.name,
                agencyLogoUrl: agency.logoUrl,
                agencyPrimaryColor: agency.primaryColor || '#1E3A8A',
                language: language,
                imageCount: Math.max(1, property.images?.length || 0),
            });

            // Replace image placeholders with actual URLs
            let finalHtml = result.htmlContent;
            if (property.images && property.images.length > 0) {
                property.images.forEach((image, index) => {
                    const placeholder = new RegExp(`{{IMAGE_URL_${index}}}`, 'g');
                    finalHtml = finalHtml.replace(placeholder, image.url);
                });
            }
            // Clean up any unused image placeholders
            finalHtml = finalHtml.replace(/{{IMAGE_URL_\d+}}/g, 'https://placehold.co/800x600?text=Imagine+lipsa');

            // Open in new window and print
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(finalHtml);
                printWindow.document.close();
                printWindow.focus();
                 toast({ title: 'Prezentare generată!', description: 'Se deschide fereastra de previzualizare pentru tipărire/salvare PDF.' });
                // Use a timeout to ensure all content and styles are loaded before printing
                setTimeout(() => {
                    printWindow.print();
                }, 1000); 
            } else {
                 toast({ variant: 'destructive', title: 'Eroare la deschidere', description: 'Browserul a blocat deschiderea unei noi ferestre.' });
            }

        } catch (error) {
            console.error("Presentation generation failed", error);
            toast({
                variant: 'destructive',
                title: 'Generare eșuată',
                description: 'A apărut o eroare la generarea prezentării. Vă rugăm să reîncercați.',
            });
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generator Prezentări PDF</CardTitle>
                <CardDescription>Creează o prezentare profesională, personalizată cu branding-ul agenției, gata de trimis clienților.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center space-y-8 p-12">
                 <div className="space-y-4">
                     <div className="flex items-center gap-2 justify-center">
                        <Languages className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Selectează limba</h3>
                     </div>
                    <RadioGroup defaultValue={language} onValueChange={(value: 'ro' | 'en') => setLanguage(value)} className="flex justify-center gap-6">
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
