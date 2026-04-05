
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
import { ACTION_CARD_CLASSNAME } from './actions/cardStyles';

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
    const desktopMetaItems = [
        { icon: <Calendar className="h-4 w-4 text-emerald-300" />, value: creationDate.toLocaleDateString('ro-RO') },
        { icon: <Clock className="h-4 w-4 text-emerald-300" />, value: `Vechime: ${ageInDays} ${ageInDays === 1 ? 'zi' : 'zile'}` },
        { icon: null, value: property.location },
        { icon: null, value: `${property.rooms} camere` },
        { icon: null, value: `${property.bathrooms} ${property.bathrooms === 1 ? 'baie' : 'băi'}` },
        { icon: null, value: `${property.squareFootage} mp` },
        ...(property.constructionYear ? [{ icon: null, value: String(property.constructionYear) }] : []),
        ...(property.floor ? [{ icon: null, value: `Et. ${property.floor}` }] : []),
    ];

  return (
    <>
        <header className="px-4 md:px-6 lg:px-0 py-4 border-b bg-background/95 backdrop-blur-sm lg:bg-transparent lg:border-white/10 lg:mb-2">
            <div className="flex h-full flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
                <div className="min-w-0 lg:col-span-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2 flex-wrap">
                        <div
                            className={`inline-block h-auto w-full truncate rounded-lg border bg-[#f8f8f9] p-3 text-xl font-bold text-card-foreground shadow-lg md:max-w-lg lg:max-w-2xl lg:rounded-[1.6rem] lg:border-0 lg:px-5 lg:py-4 lg:text-[1.65rem] lg:tracking-tight lg:text-emerald-50 lg:shadow-none ${ACTION_CARD_CLASSNAME}`}
                            title={property.title}
                        >
                            {property.title}
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground lg:hidden lg:text-white/70">
                        <Badge variant="outline" className="font-normal lg:rounded-full lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100"><Calendar className="mr-1.5 h-3.5 w-3.5" /> {creationDate.toLocaleDateString('ro-RO')}</Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100"><Clock className="mr-1.5 h-3.5 w-3.5" /> Vechime: {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}</Badge>
                        <Badge variant="secondary" className="hidden sm:inline-flex lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                            {property.location}
                        </Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                            {property.rooms} camere
                        </Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                            {property.bathrooms} {property.bathrooms === 1 ? 'baie' : 'băi'}
                        </Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                            {property.squareFootage} mp
                        </Badge>
                        {property.constructionYear && (
                            <Badge variant="secondary" className="hidden sm:inline-flex lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                                {property.constructionYear}
                            </Badge>
                        )}
                        {property.floor && (
                            <Badge variant="secondary" className="hidden sm:inline-flex lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                                Et. {property.floor}
                            </Badge>
                        )}
                    </div>
                    <div className={`${ACTION_CARD_CLASSNAME} mt-4 hidden rounded-[1.45rem] p-3 lg:block`}>
                        <div className="flex min-w-0 items-center gap-4 overflow-hidden px-2 py-1">
                            {desktopMetaItems.map((item, index) => (
                                <div key={`${item.value}-${index}`} className="flex min-w-0 shrink-0 items-center gap-2">
                                    {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                                    <p className="truncate whitespace-nowrap text-sm font-semibold text-white">
                                        {item.value}
                                    </p>
                                    {index < desktopMetaItems.length - 1 ? (
                                        <span className="ml-2 h-5 w-px shrink-0 bg-white/10" />
                                    ) : null}
                                </div>
                            ))}
                        </div>
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
