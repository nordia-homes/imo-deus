'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import type { Property } from "@/lib/types";
import { updateDocumentNonBlocking, useFirestore } from "@/firebase";
import { doc } from 'firebase/firestore';
import { useAgency } from "@/context/AgencyContext";

export function WebsiteToggleCard({ property }: { property: Property }) {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const handleToggle = (isFeatured: boolean) => {
        if (!agencyId) return;
        const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
        updateDocumentNonBlocking(propertyRef, { featured: isFeatured });
        toast({
            title: `Proprietate ${isFeatured ? 'marcată ca recomandată' : 'scoasă de la recomandate'}`,
        });
    }

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Website Public</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
                <Label htmlFor="website-public-toggle" className="font-semibold text-sm">
                    Recomandată
                </Label>
                <Switch
                    id="website-public-toggle"
                    checked={property.featured}
                    onCheckedChange={handleToggle}
                />
            </CardContent>
             <CardContent className="pt-0">
                <CardDescription className="text-xs">
                   Dacă este activ, proprietatea va apărea în secțiunea "Recomandate" de pe website-ul public.
                </CardDescription>
            </CardContent>
        </Card>
    );
}
