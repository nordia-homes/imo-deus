'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Contact, Offer, Property } from '@/lib/types';
import { FileText, MoreVertical, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { AddOfferDialog } from './AddOfferDialog';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button';


interface OfferManagementCardProps {
  contact: Contact;
  properties: Property[];
  onAddOffer: (offerData: Omit<Offer, 'id' | 'date' | 'status'>) => void;
  onUpdateOffer: (offerId: string, data: Partial<Offer>) => void;
  onDeleteOffer: (offerId: string) => void;
}

export function OfferManagementCard({ contact, properties, onAddOffer, onUpdateOffer, onDeleteOffer }: OfferManagementCardProps) {

  const handleStatusChange = (offerId: string, status: Offer['status']) => {
    onUpdateOffer(offerId, { status });
  };

  const getStatusClass = (status: Offer['status']) => {
    switch (status) {
        case 'Acceptată': return 'text-green-600 border-green-500';
        case 'Refuzată': return 'text-red-600 border-red-500';
        case 'În așteptare':
        default:
            return 'text-yellow-600 border-yellow-500';
    }
  }

  return (
    <Card className="rounded-2xl shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-primary" />
          <span>Management Oferte</span>
        </CardTitle>
        <CardDescription>
            Înregistrează și urmărește ofertele formale.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {contact.offers && contact.offers.length > 0 ? (
          contact.offers.map(offer => (
            <div key={offer.id} className="text-sm p-3 rounded-lg border">
                <div className="flex justify-between items-start">
                    <div>
                        <Link href={`/properties/${offer.propertyId}`} className="hover:underline">
                            <p className="font-semibold truncate">{offer.propertyTitle}</p>
                        </Link>
                        <p className="text-xs text-muted-foreground">{format(new Date(offer.date), 'd MMM yyyy', { locale: ro })}</p>
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 -mt-1">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onDeleteOffer(offer.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Șterge Oferta
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-primary font-bold text-lg">€{offer.price.toLocaleString()}</span>
                 <Select value={offer.status} onValueChange={(value: Offer['status']) => handleStatusChange(offer.id, value)}>
                    <SelectTrigger className={cn("h-8 w-[150px] text-xs font-semibold", getStatusClass(offer.status))}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                         <SelectItem value="În așteptare">În așteptare</SelectItem>
                         <SelectItem value="Acceptată">Acceptată</SelectItem>
                         <SelectItem value="Refuzată">Refuzată</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Nicio ofertă înregistrată.</p>
        )}
      </CardContent>
      <CardFooter>
        <AddOfferDialog onAddOffer={onAddOffer} properties={properties}>
            <Button variant="outline" className="w-full">
                Adaugă Ofertă
            </Button>
        </AddOfferDialog>
      </CardFooter>
    </Card>
  );
}
