'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { DollarSign, MapPin, Edit, FileText, Rocket, Send, MoreVertical, ChevronLeft, Menu } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddPropertyDialog } from '../add-property-dialog';

export function PropertyHeader({ property }: { property: Property }) {
  return (
    <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mt-4 md:-mt-6 lg:-mt-8 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 border-b">
        <div className="flex items-center justify-between gap-4 mb-4">
             <Button variant="ghost" asChild>
                <Link href="/properties">
                    <ChevronLeft className="h-4 w-4" />
                    Înapoi la proprietăți
                </Link>
            </Button>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold">{property.title}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm mt-1">
                    <span className="font-semibold text-foreground">€{property.price.toLocaleString()}</span>
                    <span className="text-gray-400">•</span>
                    <span className="flex items-center gap-1.5">{property.location}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
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
