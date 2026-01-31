'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Property } from "@/lib/types";
import { updateDocumentNonBlocking, useFirestore } from "@/firebase";
import { doc } from 'firebase/firestore';
import { useAgency } from "@/context/AgencyContext";
import { useToast } from "@/hooks/use-toast";
import { HandCoins } from "lucide-react";

export function PriceStatusCard({ property }: { property: Property }) {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleStatusChange = (newStatus: Property['status']) => {
        if (!agencyId || !property) return;
        const propertyDocRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
        
        // This will only work if the property exists in Firestore.
        // For the demo, we show a toast and assume the change is persisted in local state.
        updateDocumentNonBlocking(propertyDocRef, {
            status: newStatus,
            statusUpdatedAt: new Date().toISOString()
        });

        toast({
            title: "Status actualizat!",
            description: `Proprietatea este acum: ${newStatus}.`,
        });
    };

    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <CardTitle className="text-base font-semibold">Acțiuni Rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Preț & Status</p>
                    <div className="flex items-center justify-between">
                         <p className="text-xl font-bold">€{property.price.toLocaleString()}</p>
                         <Select onValueChange={(value) => handleStatusChange(value as Property['status'])} defaultValue={property.status}>
                            <SelectTrigger className="w-auto h-8 text-xs font-semibold">
                                <div className="flex items-center gap-2">
                                    <HandCoins className="h-4 w-4" />
                                    <SelectValue />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Activ">Activ</SelectItem>
                                <SelectItem value="Rezervat">Rezervat</SelectItem>
                                <SelectItem value="Vândut">Vândut</SelectItem>
                                <SelectItem value="Închiriat">Închiriat</SelectItem>
                                <SelectItem value="Inactiv">Inactiv</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
