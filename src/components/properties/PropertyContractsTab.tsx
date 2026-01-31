'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilePlus2 } from "lucide-react";

export function PropertyContractsTab({ propertyId }: { propertyId: string }) {

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Contracte pentru Proprietate</CardTitle>
                    <CardDescription>Urmărește contractele asociate.</CardDescription>
                </div>
                <Button disabled>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Adaugă Contract
                </Button>
            </CardHeader>
            <CardContent>
                <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                    Funcționalitatea de management a contractelor nu este încă disponibilă.
                </div>
            </CardContent>
        </Card>
    )
}
