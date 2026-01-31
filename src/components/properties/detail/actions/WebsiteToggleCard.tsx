'use client';
import { Card, CardContent } from "@/components/ui/card";
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
        <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
                <Label htmlFor="website-public-toggle" className="font-semibold text-sm">
                    Website Public
                </Label>
                <Switch
                    id="website-public-toggle"
                    checked={property.featured}
                    onCheckedChange={handleToggle}
                />
            </CardContent>
        </Card>
    );
}
