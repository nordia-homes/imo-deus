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
        <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9]">
            <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-semibold">Website Public</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="website-public-toggle" className="font-semibold text-sm">
                        Recomandată
                    </Label>
                    <Switch
                        id="website-public-toggle"
                        checked={property.featured}
                        onCheckedChange={handleToggle}
                    />
                </div>
                <CardDescription className="text-xs !mt-1">
                   Dacă este activ, proprietatea va apărea în secțiunea "Recomandate" de pe website-ul public.
                </CardDescription>
            </CardContent>
        </Card>
    );
}
