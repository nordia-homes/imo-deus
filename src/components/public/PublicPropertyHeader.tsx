'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { Edit, FileText, Rocket, Globe, MoreVertical, Calendar, BedDouble, Bath, Ruler, Layers } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddPropertyDialog } from '../properties/add-property-dialog';
import { useAgency } from '@/context/AgencyContext';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export function PublicPropertyHeader({ property }: { property: Property }) {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const pricePerSqm = (property.price && property.squareFootage) ? (property.price / property.squareFootage).toFixed(0) : null;

  return (
    <>
        <header className="sticky top-0 z-20 bg-[#0F1E33]/95 backdrop-blur-sm -mx-4 md:-mx-6 lg:mx-0 px-4 md:px-6 lg:px-8 py-3 border-b border-white/10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 h-full max-w-7xl mx-auto">
                <div className="min-w-0">
                    <h1 className="text-xl lg:text-2xl font-bold truncate text-white" title={property.title}>
                        {property.title}
                    </h1>
                     <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/70 text-sm mt-1">
                        <Badge variant="outline" className="font-normal bg-white/10 text-white border-none"><BedDouble className="mr-1.5 h-3.5 w-3.5" /> {property.rooms} camere</Badge>
                        <Badge variant="outline" className="font-normal bg-white/10 text-white border-none"><Ruler className="mr-1.5 h-3.5 w-3.5" /> {property.squareFootage} mp</Badge>
                        {property.floor && <Badge variant="outline" className="font-normal bg-white/10 text-white border-none"><Layers className="mr-1.5 h-3.5 w-3.5" /> Et. {property.floor}</Badge>}
                        {property.constructionYear && <Badge variant="outline" className="font-normal bg-white/10 text-white border-none"><Calendar className="mr-1.5 h-3.5 w-3.5" /> {property.constructionYear}</Badge>}
                     </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" className="h-11 text-base bg-white/10 border-white/20 text-white hover:bg-white/20 pointer-events-none">
                        €{property.price.toLocaleString()}
                        {pricePerSqm && <span className="text-xs text-white/70 ml-2">(€{pricePerSqm}/mp)</span>}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-11 w-11 bg-white/10 border-white/20 text-white hover:bg-white/20">
                                <MoreVertical className="h-4 w-4"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
