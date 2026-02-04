'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import Image from 'next/image';
import { ArrowRight, BedDouble, Bath, Ruler } from 'lucide-react';
import Link from 'next/link';

const MatchedPropertyCard = ({ property }: { property: Property }) => {
  const hasImages = property.images && property.images.length > 0;
  const imageUrl = hasImages ? property.images[0].url : 'https://placehold.co/800x600?text=Imagine+lipsa';

  return (
    <Card className="rounded-2xl overflow-hidden shadow-sm w-full group">
      <Link href={`/properties/${property.id}`} className="block aspect-[4/3] relative">
        <Image 
          src={imageUrl} 
          alt={property.title || 'Proprietate'} 
          fill 
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>
      <div className="p-4">
        <p className="font-bold text-lg text-primary">€{property.price.toLocaleString()}</p>
        <Link href={`/properties/${property.id}`} className="block">
            <p className="font-semibold truncate group-hover:underline">{property.title}</p>
        </Link>
        <p className="text-xs text-muted-foreground">{property.location}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {property.bedrooms}</span>
            <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {property.bathrooms}</span>
            <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {property.squareFootage} m²</span>
        </div>
      </div>
       <div className="p-4 pt-0">
         <Button asChild className="w-full">
            <Link href={`/properties/${property.id}`}>Vezi proprietatea</Link>
         </Button>
       </div>
    </Card>
  );
};


export function MatchedProperties({ properties }: { properties: Property[] }) {
  if (!properties || properties.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Proprietăți Potrivite</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-10">
          Nicio proprietate potrivită găsită.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Proprietăți Potrivite</CardTitle>
        <Button variant="link" size="sm" asChild>
          <Link href="/matching">
            Vezi apel <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {properties.slice(0, 2).map((prop) => (
          <MatchedPropertyCard key={prop.id} property={prop} />
        ))}
      </CardContent>
    </Card>
  );
}
