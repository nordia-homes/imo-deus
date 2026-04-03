'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Contact, Offer, FinancialStatus, PortalRecommendation, Property } from '@/lib/types';
import { Banknote, FileText, Heart, ThumbsDown, HelpCircle, MoreVertical, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AddOfferDialog } from './AddOfferDialog';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface OfferItem extends Property {
  feedback: PortalRecommendation['clientFeedback'];
  recId: string;
}

interface BuyerFinanceAndOffersCardProps {
  contact: Contact;
  onUpdateContact: (data: Partial<Pick<Contact, 'financialStatus'>>) => void;
  recommendations: PortalRecommendation[] | null;
  properties: Property[] | null;
  portalId: string | null;
  onUpdateRecommendation: (recommendationId: string, data: Partial<Omit<PortalRecommendation, 'id'>>) => void;
  onAddOffer: (offerData: Omit<Offer, 'id' | 'date' | 'status'>) => void;
  onUpdateOffer: (offerId: string, data: Partial<Offer>) => void;
  onDeleteOffer: (offerId: string) => void;
}

export function BuyerFinanceAndOffersCard({
  contact,
  onUpdateContact,
  recommendations,
  properties,
  portalId,
  onUpdateRecommendation,
  onAddOffer,
  onUpdateOffer,
  onDeleteOffer,
}: BuyerFinanceAndOffersCardProps) {
  const handleStatusChange = (status: FinancialStatus) => {
    onUpdateContact({ financialStatus: status });
  };

  const portalOffers: OfferItem[] = useMemo(() => {
    if (!recommendations || !properties) return [];
    const propertiesById = new Map(properties.map((property) => [property.id, property]));

    return recommendations
      .map((recommendation) => {
        const property = propertiesById.get(recommendation.propertyId);
        if (!property) return null;
        return {
          ...property,
          feedback: recommendation.clientFeedback,
          recId: recommendation.id,
        };
      })
      .filter((item): item is OfferItem => item !== null);
  }, [recommendations, properties]);

  const handleFeedbackChange = (recId: string, feedback: PortalRecommendation['clientFeedback']) => {
    if (!portalId) return;
    onUpdateRecommendation(recId, { clientFeedback: feedback });
  };

  const handleOfferStatusChange = (offerId: string, status: Offer['status']) => {
    onUpdateOffer(offerId, { status });
  };

  const getOfferStatusClass = (status: Offer['status']) => {
    switch (status) {
      case 'Acceptată':
        return 'text-green-400 border-green-500';
      case 'Refuzată':
        return 'text-red-400 border-red-500';
      case 'În așteptare':
      default:
        return 'text-yellow-400 border-yellow-500';
    }
  };

  return (
    <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#132844_0%,#0f2036_62%,#0b1727_100%)] text-white shadow-[0_30px_80px_-38px_rgba(0,0,0,0.9)]">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Banknote className="h-5 w-5 text-primary" />
          <span>Situație Financiară și Oferte</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-5 pt-0">
        <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Status financiar</Label>
          <Select value={contact.financialStatus || 'Neprecalificat'} onValueChange={handleStatusChange}>
            <SelectTrigger className="mt-2 h-11 rounded-2xl border-white/10 bg-[#1d385d]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Neprecalificat">Neprecalificat</SelectItem>
              <SelectItem value="Credit Pre-aprobat">Credit Pre-aprobat</SelectItem>
              <SelectItem value="Credit Aprobat">Credit Aprobat</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Istoric oferte portal</Label>
          {portalOffers.length > 0 ? (
            portalOffers.map((offer) => (
              <div key={offer.recId} className="rounded-2xl border border-white/10 bg-white/6 p-3 text-sm">
                <Link href={`/properties/${offer.id}`} className="hover:underline">
                  <p className="truncate font-semibold" title={offer.title}>
                    {offer.title.length > 24 ? `${offer.title.substring(0, 24)}...` : offer.title}
                  </p>
                </Link>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="font-bold text-primary">€{offer.price.toLocaleString()}</span>
                  <Select value={offer.feedback} onValueChange={(value: PortalRecommendation['clientFeedback']) => handleFeedbackChange(offer.recId, value)}>
                    <SelectTrigger
                      className={cn(
                        'h-8 w-[150px] text-xs bg-white/10 border-white/20',
                        offer.feedback === 'liked' && 'text-green-400 border-green-500',
                        offer.feedback === 'disliked' && 'text-red-400 border-red-500',
                        offer.feedback === 'none' && 'text-yellow-400 border-yellow-500'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {offer.feedback === 'liked' && <><Heart className="h-4 w-4" /> I-a plăcut</>}
                        {offer.feedback === 'disliked' && <><ThumbsDown className="h-4 w-4" /> Nu i-a plăcut</>}
                        {offer.feedback === 'none' && <><HelpCircle className="h-4 w-4" /> Niciun răspuns</>}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none"><div className="flex items-center gap-2"><HelpCircle className="h-4 w-4 text-yellow-500" /> Niciun răspuns</div></SelectItem>
                      <SelectItem value="liked"><div className="flex items-center gap-2"><Heart className="h-4 w-4 text-green-500" /> I-a plăcut</div></SelectItem>
                      <SelectItem value="disliked"><div className="flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-red-500" /> Nu i-a plăcut</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          ) : (
            <p className="py-2 text-center text-sm text-white/70">Nicio ofertă în portal.</p>
          )}
        </div>

        <Separator className="bg-white/10" />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-white">Administrare oferte</p>
          </div>
          {contact.offers && contact.offers.length > 0 ? (
            contact.offers.map((offer) => (
              <div key={offer.id} className="rounded-2xl border border-white/10 bg-white/6 p-3 text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/properties/${offer.propertyId}`} className="hover:underline">
                      <p className="truncate font-semibold" title={offer.propertyTitle}>
                        {offer.propertyTitle.length > 24 ? `${offer.propertyTitle.substring(0, 24)}...` : offer.propertyTitle}
                      </p>
                    </Link>
                    <p className="text-xs text-white/70">{format(new Date(offer.date), 'd MMM yyyy', { locale: ro })}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-7 w-7 text-white">
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
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-lg font-bold text-primary">€{offer.price.toLocaleString()}</span>
                  <Select value={offer.status} onValueChange={(value: Offer['status']) => handleOfferStatusChange(offer.id, value)}>
                    <SelectTrigger className={cn('h-8 w-[150px] text-xs font-semibold bg-white/10 border-white/20', getOfferStatusClass(offer.status))}>
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
            <p className="py-2 text-center text-sm text-white/70">Nicio ofertă înregistrată.</p>
          )}
          <AddOfferDialog onAddOffer={onAddOffer} properties={properties || []}>
            <Button variant="outline" className="h-11 w-full rounded-2xl border-white/10 bg-white/8 text-white hover:bg-white/16">
              Adaugă Ofertă
            </Button>
          </AddOfferDialog>
        </div>
      </CardContent>
    </Card>
  );
}
