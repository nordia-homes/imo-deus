
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { Edit, FileText, Rocket, Globe, MoreVertical, Calendar, Clock, Phone, CalendarCheck } from 'lucide-react';
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
import { differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';

export function PropertyHeader({ property, onTriggerAddViewing }: { property: Property; onTriggerAddViewing: () => void; }) {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const handleStatusChange = (newStatus: Property['status']) => {
        if (!agencyId || !property) return;
        
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

    const creationDate = property.createdAt ? new Date(property.createdAt) : new Date();
    const ageInDays = differenceInDays(new Date(), creationDate);

  return (
    <>
        <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mt-4 md:-mt-6 lg:-mt-8 -mx-4 md:-mx-6 lg:mx-0 px-4 md:px-6 lg:px-0 py-4 border-b lg:bg-transparent lg:border-white/10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2 flex-wrap">
                        <div className="inline-block h-auto w-full md:max-w-lg truncate p-3 rounded-lg border bg-[#f8f8f9] lg:bg-[#152A47] lg:border-none lg:text-white text-card-foreground shadow-lg text-xl font-bold" title={property.title}>
                            {property.title}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground lg:text-white/70 text-sm mt-2">
                        <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none"><Calendar className="mr-1.5 h-3.5 w-3.5" /> {creationDate.toLocaleDateString('ro-RO')}</Badge>
                        <Badge variant="secondary" className="lg:bg-white/10 lg:text-white lg:border-none"><Clock className="mr-1.5 h-3.5 w-3.5" /> Vechime: {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}</Badge>
                        <span className="hidden sm:inline text-gray-400">•</span>
                        <span className="hidden sm:inline">{property.location}</span>
                        <span className="hidden sm:inline text-gray-400">•</span>
                        <span>{property.rooms} camere</span>
                        <span className="text-gray-400">•</span>
                        <span>{property.bathrooms} {property.bathrooms === 1 ? 'baie' : 'băi'}</span>
                        <span className="text-gray-400">•</span>
                        <span>{property.squareFootage} mp</span>
                        {property.constructionYear && (
                            <>
                                <span className="hidden sm:inline text-gray-400">•</span>
                                <span className="hidden sm:inline">{property.constructionYear}</span>
                            </>
                        )}
                        {property.floor && (
                            <>
                                <span className="hidden sm:inline text-gray-400">•</span>
                                <span className="hidden sm:inline">Et. {property.floor}</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Select onValueChange={(value) => handleStatusChange(value as Property['status'])} defaultValue={property.status}>
                        <SelectTrigger className="w-full sm:w-auto flex-1 sm:flex-initial h-10 text-sm font-semibold lg:bg-white/10 lg:border-white/20 lg:hover:bg-white/20">
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
                    <Button className="flex-1 bg-primary text-primary-foreground" onClick={onTriggerAddViewing}>
                        <CalendarCheck className="mr-2 h-4 w-4"/> 
                        Vizionare
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="lg:bg-white/10 lg:border-white/20 lg:hover:bg-white/20">
                                <MoreVertical className="h-4 w-4"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                                <Edit className="mr-2 h-4 w-4"/> 
                                Editează
                            </DropdownMenuItem>
                             <DropdownMenuItem asChild>
                                <Link href={`/agencies/${agencyId}/properties/${property.id}`} target="_blank" rel="noopener noreferrer">
                                    <Globe className="mr-2 h-4 w-4"/> 
                                    Vezi pe Website
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem><FileText className="mr-2 h-4 w-4"/> Generează PDF</DropdownMenuItem>
                            <DropdownMenuItem><Rocket className="mr-2 h-4 w-4"/> Promovează</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
        <AddPropertyDialog 
            property={property}
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
        />
    </>
  );
}
