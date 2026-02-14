
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Property, Contact } from '@/lib/types';
import Image from 'next/image';
import { ArrowRight, BedDouble, Bath, Ruler, Star, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useFirestore, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAgency } from '@/context/AgencyContext';

const MatchedPropertyCard = ({ property }: { property: Property }) => {
  const hasImages = property.images && property.images.length > 0;
  const imageUrl = hasImages ? property.images[0].url : 'https://placehold.co/800x600?text=Imagine+lipsa';

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-900 text-white shadow-lg">
      <Image
        src={imageUrl}
        alt={property.title || 'Proprietate'}
        fill
        className="object-cover object-right opacity-20 pointer-events-none"
        style={{
           maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)'
        }}
      />
      <div className="relative p-4 space-y-3">
        <Link href={`/properties/${property.id}`} className="block">
           <h4 className="font-bold text-lg hover:underline break-words">{property.title}</h4>
        </Link>
        <p className="text-sm text-slate-300 break-words">{property.address}</p>
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300 pt-2">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-slate-400" /> {property.zone || property.city}</span>
            <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-slate-400" /> {property.rooms}</span>
            <span className="flex items-center gap-1.5"><Ruler className="h-4 w-4 text-slate-400" /> {property.squareFootage} mp</span>
        </div>
        
        <div className="pt-2">
             <p className="text-2xl font-extrabold text-white">€{property.price.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};


export function MatchedProperties({ properties, contact }: { properties: Property[], contact: Contact }) {
  if (!properties || properties.length === 0) {
    return (
        <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
            <CardHeader className="p-4">
                <CardTitle className="font-semibold text-white text-base">Proprietăți Potrivite</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-white/70 py-6">
            Nicio proprietate potrivită găsită.
            </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
            <CardTitle className="font-semibold text-white text-base">Proprietăți Potrivite</CardTitle>
            <Button variant="link" size="sm" asChild className="text-white">
            <Link href="/matching">
                Vezi toate
            </Link>
            </Button>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
            {properties.slice(0, 3).map((prop) => (
            <MatchedPropertyCard key={prop.id} property={prop} />
            ))}
        </CardContent>
    </Card>
  );
}


