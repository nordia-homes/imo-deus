
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Property, Contact, MatchedProperty } from '@/lib/types';
import Image from 'next/image';
import { ArrowRight, BedDouble, Ruler, Calendar, Plus } from 'lucide-react';
import Link from 'next/link';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';

const sanitizeForWhatsapp = (phone?: string | null) => {
    if (!phone) return '';
    let sanitized = phone.replace(/\D/g, '');
    if (sanitized.length === 10 && sanitized.startsWith('07')) {
        return `40${sanitized.substring(1)}`;
    }
    return sanitized;
};


const MatchedPropertyCard = ({ property, onAddRecommendation, agencyId, contact }: { property: Property, onAddRecommendation: (property: Property) => void, agencyId: string | null | undefined, contact: Contact | null }) => {
  const imageUrl = property.images?.[0]?.url || 'https://placehold.co/800x600?text=Imagine+lipsa';
  const constructionYear = property.constructionYear;
  
  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddRecommendation(property);
  }

  const handleWhatsAppShare = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!agencyId || !contact?.phone) return;

      const propertyUrl = `${window.location.origin}/agencies/${agencyId}/properties/${property.id}`;
      const message = `Salut, ${contact.name}! Cred că această proprietate ți s-ar potrivi: ${propertyUrl}`;
      const sanitizedPhone = sanitizeForWhatsapp(contact.phone);
      const whatsappUrl = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-900 text-white shadow-lg h-full flex flex-col">
      <div className="relative aspect-video lg:aspect-[16/6] w-full">
          <Image
              src={imageUrl}
              alt={property.title || 'Proprietate'}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
          />
      </div>
      <div className="relative p-4 space-y-3 flex-1 flex flex-col">
        <Link href={`/properties/${property.id}`} className="block">
          <h4 className="font-bold text-lg hover:underline break-words">{property.title}</h4>
        </Link>
        <p className="text-sm text-slate-300 break-words">{property.address}</p>
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300 pt-2">
            <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-slate-400" /> {property.rooms}</span>
            <span className="flex items-center gap-1.5"><Ruler className="h-4 w-4 text-slate-400" /> {property.squareFootage} mp</span>
            {constructionYear && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" /> {constructionYear}</span>}
        </div>
        
        <div className="pt-2 mt-auto flex justify-between items-end">
            <p className="text-2xl font-extrabold text-white">€{property.price.toLocaleString()}</p>
             <div className="flex items-center gap-2">
                 {contact?.phone && agencyId && (
                    <Button onClick={handleWhatsAppShare} size="icon" className="bg-green-500 hover:bg-green-600 text-white rounded-full h-10 w-10">
                        <WhatsappIcon className="h-5 w-5" />
                    </Button>
                 )}
                 <Button onClick={handleAddClick} size="icon" className="bg-blue-500 hover:bg-blue-600 text-white rounded-full h-10 w-10">
                    <Plus className="h-5 w-5" />
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};

    