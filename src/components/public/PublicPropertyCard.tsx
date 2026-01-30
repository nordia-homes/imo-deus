
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Bath, Ruler, MapPin } from "lucide-react";
import type { Property } from "@/lib/types";

export function PublicPropertyCard({ property, agencyId }: { property: Property, agencyId: string }) {
  const primaryImageUrl = property.images?.[0]?.url || 'https://placehold.co/800x600';
  
  return (
    <Link href={`/agencies/${agencyId}/properties/${property.id}`} className="group">
      <Card className="overflow-hidden h-full flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
        <div className="relative aspect-[4/3]">
            <Image
                src={primaryImageUrl}
                alt={property.title || 'Proprietate'}
                fill
                className="object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute top-3 left-3 flex gap-2">
                 <Badge variant="default" className="">{property.transactionType}</Badge>
            </div>
             <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                 <p className="font-bold text-2xl text-white">€{property.price.toLocaleString()}</p>
             </div>
        </div>
        <CardHeader>
          <CardTitle className="truncate text-lg group-hover:text-primary transition-colors">{property.title}</CardTitle>
          <CardDescription className="flex items-center gap-1 text-sm">
            <MapPin className="h-4 w-4" />
            {property.address}
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto flex justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
                <BedDouble className="h-4 w-4" />
                <span>{property.bedrooms}</span>
            </div>
            <div className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                <span>{property.bathrooms}</span>
            </div>
             <div className="flex items-center gap-1">
                <Ruler className="h-4 w-4" />
                <span>{property.squareFootage} mp</span>
            </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
