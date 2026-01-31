'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import Image from 'next/image';
import { ArrowRight, BedDouble, Bath, Ruler, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

const MatchedPropertyCard = ({ property }: { property: Property }) => {
  return (
    <Card className="rounded-2xl overflow-hidden shadow-sm w-full">
      <div className="aspect-[4/3] relative">
        <Image src={property.images[0].url} alt={property.title} fill className="object-cover" />
      </div>
      <div className="p-4">
        <p className="font-bold text-lg text-primary">€{property.price.toLocaleString()}</p>
        <p className="font-semibold truncate">{property.title}</p>
        <p className="text-xs text-muted-foreground">{property.location}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {property.bedrooms}</span>
            <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {property.bathrooms}</span>
            <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {property.squareFootage} m²</span>
        </div>
      </div>
       <div className="p-4 pt-0 flex gap-2">
         <Button className="w-full">Trimite Clientului</Button>
         <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
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
        <Button variant="ghost" size="sm" asChild>
          <Link href="/matching">
            Vezi tot <ArrowRight className="h-4 w-4 ml-1" />
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
