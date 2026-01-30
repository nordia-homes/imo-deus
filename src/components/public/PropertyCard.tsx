import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BedDouble, Bath, Ruler, MapPin } from "lucide-react";
import type { Property } from "@/lib/types";

export function PublicPropertyCard({ property, agencyId }: { property: Property, agencyId: string }) {
  return (
    <Link href={`/agencies/${agencyId}/properties/${property.id}`} className="group">
      <Card className="overflow-hidden h-full flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
        <div className="relative aspect-video">
            <Image
                src={property.imageUrl || 'https://placehold.co/800x600'}
                alt={property.title || 'Proprietate'}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                data-ai-hint={property.imageHint}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
             <div className="absolute top-2 right-2 flex gap-2">
                 <div className="bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">{property.transactionType}</div>
            </div>
        </div>
        <CardHeader className="flex-grow">
          <CardTitle className="text-lg">{property.title}</CardTitle>
          <CardDescription className="flex items-center gap-1 text-sm pt-1">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{property.address}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex justify-between text-sm text-muted-foreground border-t pt-4">
                <div className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-primary" />
                    <span>{property.bedrooms} dorm.</span>
                </div>
                <div className="flex items-center gap-2">
                    <Bath className="h-4 w-4 text-primary" />
                    <span>{property.bathrooms} băi</span>
                </div>
                 <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-primary" />
                    <span>{property.squareFootage} mp</span>
                </div>
            </div>
        </CardContent>
        <CardFooter className="bg-muted/50 p-4">
          <p className="font-bold text-xl text-primary w-full">€{property.price.toLocaleString()}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}
