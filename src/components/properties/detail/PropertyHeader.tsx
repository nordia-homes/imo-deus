
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
        <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mt-4 md:-mt-6 lg:-mt-8 -mx-4 md:-mx-6 lg:mx-0 px-4 md:px-6 lg:px-0 py-4 border-b lg:bg-transparent lg:border-white/10 lg:mb-4">
            <div className="flex h-full flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
                <div className="min-w-0 lg:col-span-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2 flex-wrap">
                        <div
                            className="inline-block h-auto w-full md:max-w-lg truncate rounded-lg border bg-[#f8f8f9] p-3 text-xl font-bold text-card-foreground shadow-lg lg:max-w-2xl lg:rounded-[1.6rem] lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-5 lg:py-4 lg:text-[1.65rem] lg:tracking-tight lg:text-emerald-100 lg:shadow-none"
                            title={property.title}
                        >
                            {property.title}
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground lg:text-white/70">
                        <Badge variant="outline" className="font-normal lg:rounded-full lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:text-emerald-100"><Calendar className="mr-1.5 h-3.5 w-3.5" /> {creationDate.toLocaleDateString('ro-RO')}</Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:text-emerald-100"><Clock className="mr-1.5 h-3.5 w-3.5" /> Vechime: {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}</Badge>
                        <Badge variant="secondary" className="hidden sm:inline-flex lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:text-emerald-100">
                            {property.location}
                        </Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:text-emerald-100">
                            {property.rooms} camere
                        </Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:text-emerald-100">
                            {property.bathrooms} {property.bathrooms === 1 ? 'baie' : 'băi'}
                        </Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:text-emerald-100">
                            {property.squareFootage} mp
                        </Badge>
                        {property.constructionYear && (
                            <Badge variant="secondary" className="hidden sm:inline-flex lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:text-emerald-100">
                                {property.constructionYear}
                            </Badge>
                        )}
                        {property.floor && (
                            <Badge variant="secondary" className="hidden sm:inline-flex lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:text-emerald-100">
                                Et. {property.floor}
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap lg:col-span-4 lg:flex-nowrap">
                    <div className="w-full rounded-[1.6rem] border border-emerald-300/14 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.12),transparent_34%),linear-gradient(180deg,#18304f_0%,#152A47_58%,#12233b_100%)] p-3 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.72)]">
                        <div className="flex items-center gap-2">
                            <Select onValueChange={(value) => handleStatusChange(value as Property['status'])} defaultValue={property.status}>
                                <SelectTrigger className="h-11 min-w-[124px] rounded-full border border-emerald-300/16 bg-emerald-400/10 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/14">
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
                            <Button className="h-11 rounded-full border border-emerald-300/16 bg-emerald-400/10 px-5 text-emerald-200 hover:bg-emerald-400/14" onClick={onTriggerAddViewing}>
                                <CalendarCheck className="mr-2 h-4 w-4"/> 
                                Vizionare
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-11 w-11 rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/14">
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
