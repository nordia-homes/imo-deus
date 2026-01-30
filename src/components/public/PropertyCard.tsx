import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BedDouble, Bath, Ruler } from "lucide-react";
import type { Property } from "@/lib/types";

export function PublicPropertyCard({ property, agencyId }: { property: Property, agencyId: string }) {
  const primaryImageUrl = property.images?.[0]?.url || 'https://placehold.co/800x600';
  
  return (
    <Link href={`/agencies/${agencyId}/properties/${property.id}`} className="group">
      <Card className="overflow-hidden h-full flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
        <div className="relative aspect-[4/3]">
          <Image
            src={primaryImageUrl}
            alt={property.title || 'Imagine proprietate'}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
           <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
            {property.transactionType}
          </div>
        </div>
        <CardHeader>
          <CardTitle className="truncate text-lg">{property.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
            <div className="flex justify-start gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4" />
                    <span>{property.bedrooms} dorm.</span>
                </div>
                <div className="flex items-center gap-2">
                    <Bath className="h-4 w-4" />
                    <span>{property.bathrooms} băi</span>
                </div>
                 <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    <span>{property.squareFootage} mp</span>
                </div>
            </div>
        </CardContent>
        <CardFooter className="mt-auto bg-muted/50 p-4">
          <p className="font-bold text-xl text-primary">€{property.price.toLocaleString()}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}
