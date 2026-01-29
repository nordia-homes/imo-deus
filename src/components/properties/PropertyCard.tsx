import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Bath, Ruler, MapPin } from "lucide-react";
import type { Property } from "@/lib/types";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/properties/${property.id}`} className="group">
      <Card className="overflow-hidden h-full flex flex-col transition-all hover:shadow-lg">
        <div className="relative aspect-video">
            <Image
                src={property.images[0].url}
                alt={property.title}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                data-ai-hint={property.imageHint}
            />
             <Badge variant="default" className="absolute top-2 right-2">{property.transactionType}</Badge>
        </div>
        <CardHeader>
          <CardTitle className="truncate text-xl">{property.title}</CardTitle>
          <CardDescription className="flex items-center gap-1 text-sm">
            <MapPin className="h-4 w-4" />
            {property.address}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
            <div className="flex justify-around text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <BedDouble className="h-5 w-5 text-primary" />
                    <span>{property.bedrooms} dorm.</span>
                </div>
                <div className="flex items-center gap-2">
                    <Bath className="h-5 w-5 text-primary" />
                    <span>{property.bathrooms} băi</span>
                </div>
                 <div className="flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-primary" />
                    <span>{property.squareFootage} mp</span>
                </div>
            </div>
        </CardContent>
        <CardFooter className="mt-auto">
          <p className="font-bold text-2xl text-primary">€{property.price.toLocaleString()}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}
