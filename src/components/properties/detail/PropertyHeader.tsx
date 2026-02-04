'use client';

import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { Edit, FileText, Rocket, Send, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddPropertyDialog } from '../add-property-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgency } from '@/context/AgencyContext';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';

export function PropertyHeader({ property }: { property: Property }) {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleStatusChange = (newStatus: Property['status']) => {
        if (!agencyId || !property) return;
        
        // This will only work if the property exists in Firestore.
        // For the demo with static data, this updates will not persist.
        if (agencyId && firestore) {
            const propertyDocRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
            updateDocumentNonBlocking(propertyDocRef, {
                status: newStatus,
                statusUpdatedAt: new Date().toISOString()
            });
        }

        toast({
            title: "Status actualizat!",
            description: `Proprietatea este acum: ${newStatus}.`,
        });
    };

  return (
    <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mt-4 md:-mt-6 lg:-mt-8 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 border-b">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold">{property.title}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm mt-2">
                    <span className="font-semibold text-foreground">€{property.price.toLocaleString()}</span>
                    <span className="text-gray-400">•</span>
                    <span>{property.location}</span>
                    <span className="text-gray-400">•</span>
                    <span>{property.rooms} camere</span>
                    <span className="text-gray-400">•</span>
                    <span>{property.bathrooms} {property.bathrooms === 1 ? 'baie' : 'băi'}</span>
                    <span className="text-gray-400">•</span>
                    <span>{property.squareFootage} mp</span>
                    {property.constructionYear && (
                        <>
                            <span className="text-gray-400">•</span>
                            <span>{property.constructionYear}</span>
                        </>
                    )}
                    {property.floor && (
                        <>
                            <span className="text-gray-400">•</span>
                            <span>Et. {property.floor}</span>
                        </>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                 <Select onValueChange={(value) => handleStatusChange(value as Property['status'])} defaultValue={property.status}>
                    <SelectTrigger className="w-[120px] h-10 text-sm font-semibold">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Activ">Activ</SelectItem>
                        <SelectItem value="Rezervat">Rezervat</SelectItem>
                        <SelectItem value="Vândut">Vândut</SelectItem>
                        <SelectItem value="Închiriat">Închiriat</SelectItem>
                        <SelectItem value="Inactiv">Inactiv</SelectItem>
                    </SelectContent>
                </Select>
                 <Button>
                    <Send className="mr-2 h-4 w-4"/> 
                    Trimite clientului
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <MoreVertical className="h-4 w-4"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <AddPropertyDialog property={property}>
                           <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Edit className="mr-2 h-4 w-4"/> 
                                Editează
                           </DropdownMenuItem>
                        </AddPropertyDialog>
                        <DropdownMenuItem><FileText className="mr-2 h-4 w-4"/> Generează PDF</DropdownMenuItem>
                        <DropdownMenuItem><Rocket className="mr-2 h-4 w-4"/> Promovează</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    </header>
  );
}
