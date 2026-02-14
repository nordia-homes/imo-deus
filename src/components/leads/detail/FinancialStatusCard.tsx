'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Contact, Offer, FinancialStatus, PortalRecommendation, Property } from '@/lib/types';
import { Banknote, FileText, Heart, ThumbsDown, HelpCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface OfferItem extends Property {
    feedback: PortalRecommendation['clientFeedback'];
    recId: string;
}

interface FinancialStatusCardProps {
  contact: Contact;
  onUpdateContact: (data: Partial<Pick<Contact, 'financialStatus'>>) => void;
  recommendations: PortalRecommendation[] | null;
  properties: Property[] | null;
  portalId: string | null;
  onUpdateRecommendation: (recommendationId: string, data: Partial<Omit<PortalRecommendation, 'id'>>) => void;
}

export function FinancialStatusCard({ contact, onUpdateContact, recommendations, properties, portalId, onUpdateRecommendation }: FinancialStatusCardProps) {

  const handleStatusChange = (status: FinancialStatus) => {
    onUpdateContact({ financialStatus: status });
  };
  
  const offers: OfferItem[] = useMemo(() => {
    if (!recommendations || !properties) return [];
    
    const propertiesById = new Map(properties.map(p => [p.id, p]));
    
    return recommendations
      .map(rec => {
        const property = propertiesById.get(rec.propertyId);
        if (!property) return null;
        return {
          ...property,
          feedback: rec.clientFeedback,
          recId: rec.id, // which is the propertyId
        };
      })
      .filter((item): item is OfferItem => item !== null);
  }, [recommendations, properties]);

  const handleFeedbackChange = (recId: string, feedback: PortalRecommendation['clientFeedback']) => {
      if (!portalId) return;
      onUpdateRecommendation(recId, { clientFeedback: feedback });
  };

  return (
    <Card className="mx-2 bg-[#152A47] text-white border-none rounded-2xl lg:mx-0 lg:bg-card lg:text-card-foreground lg:shadow-2xl">
      <CardHeader className="p-4 pb-2 lg:p-6 lg:pb-4">
        <CardTitle className="flex items-center gap-2 text-base text-white lg:text-card-foreground">
          <Banknote className="h-5 w-5 text-primary" />
          <span>Situație Financiară și Oferte</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 lg:p-6 lg:pt-0">
        <div>
          <Label className="text-xs text-white/70 lg:text-muted-foreground">Status Financiar</Label>
          <Select value={contact.financialStatus || 'Neprecalificat'} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-9 bg-white/10 lg:bg-background border-white/20 lg:border-input">
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

        <div>
          <Label className="text-xs text-white/70 lg:text-muted-foreground">Istoric Oferte Portal</Label>
          <div className="mt-2 space-y-2">
            {offers.length > 0 ? (
              offers.map(offer => (
                <div key={offer.recId} className="text-sm p-2 rounded-md border border-white/20 lg:border-input">
                    <Link href={`/properties/${offer.id}`} className="hover:underline">
                        <p className="font-semibold truncate" title={offer.title}>{offer.title.length > 20 ? `${offer.title.substring(0, 20)}...` : offer.title}</p>
                    </Link>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-primary font-bold">€{offer.price.toLocaleString()}</span>
                     <Select value={offer.feedback} onValueChange={(value: PortalRecommendation['clientFeedback']) => handleFeedbackChange(offer.recId, value)}>
                        <SelectTrigger className={cn("h-8 w-[150px] text-xs bg-white/10 lg:bg-background border-white/20",
                            offer.feedback === 'liked' && 'text-green-400 border-green-500',
                            offer.feedback === 'disliked' && 'text-red-400 border-red-500',
                            offer.feedback === 'none' && 'text-yellow-400 border-yellow-500',
                        )}>
                            <div className="flex items-center gap-2">
                                {offer.feedback === 'liked' && <><Heart className="h-4 w-4" /> I-a plăcut</>}
                                {offer.feedback === 'disliked' && <><ThumbsDown className="h-4 w-4" /> Nu i-a plăcut</>}
                                {offer.feedback === 'none' && <><HelpCircle className="h-4 w-4" /> Niciun răspuns</>}
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="none">
                                <div className="flex items-center gap-2"><HelpCircle className="h-4 w-4 text-yellow-500" /> Niciun răspuns</div>
                             </SelectItem>
                             <SelectItem value="liked">
                                <div className="flex items-center gap-2"><Heart className="h-4 w-4 text-green-500" /> I-a plăcut</div>
                            </SelectItem>
                            <SelectItem value="disliked">
                                <div className="flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-red-500" /> Nu i-a plăcut</div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/70 lg:text-muted-foreground text-center py-4">Nicio ofertă în portal.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
