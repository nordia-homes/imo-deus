'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { DollarSign, MapPin, Edit, FileText, Rocket, Send } from 'lucide-react';
import { AddPropertyDialog } from '../add-property-dialog';

type OwnerDetails = {
    name: string;
    phone: string;
    email: string;
};

type PropertyHeaderProps = {
  property: Property;
  owner: OwnerDetails;
};

function getStatusBadgeVariant(status?: Property['status']) {
    switch (status) {
        case 'Activ': return 'success';
        case 'Vândut': case 'Închiriat': return 'destructive';
        case 'Rezervat': return 'warning';
        default: return 'secondary';
    }
}


export function PropertyHeader({ property, owner }: PropertyHeaderProps) {
  
  return (
    <header className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-sm -mx-8 px-8 py-4 border-b">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 text-lg">
            <AvatarFallback>{owner.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{owner.name}</h1>
              <Badge variant={getStatusBadgeVariant(property.status)} className="capitalize shrink-0">{property.status}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm mt-1">
               <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />€{property.price.toLocaleString()}</span>
               <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{property.title}</span>
            </div>
          </div>
        </div>
        <div className="items-center gap-2 hidden md:flex">
             <Button variant="outline" size="sm"><Send className="mr-2 h-4 w-4"/> Trimite clientului</Button>
             <Button variant="outline" size="sm"><Rocket className="mr-2 h-4 w-4"/> Publică</Button>
             <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4"/> Generează PDF</Button>
             <AddPropertyDialog property={property}>
                <Button size="sm">
                    <Edit className="mr-2 h-4 w-4"/> 
                    Editează
                </Button>
            </AddPropertyDialog>
         </div>
      </div>
    </header>
  );
}
