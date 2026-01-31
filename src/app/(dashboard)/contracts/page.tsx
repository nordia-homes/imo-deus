'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContractsPage() {
    
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Management Contracte</h1>
                    <p className="text-muted-foreground">
                        Vizualizează și gestionează toate contractele agenției.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Toate Contractele</CardTitle>
                    <CardDescription>O listă a tuturor contractelor de vânzare sau închiriere.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-muted-foreground py-10">
                        Funcționalitatea de management a contractelor nu este încă disponibilă.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
