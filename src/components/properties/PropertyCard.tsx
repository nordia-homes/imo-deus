
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Bath, Ruler, MapPin, Eye, Users } from "lucide-react";
import type { Property } from "@/lib/types";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/properties/${property.id}`} className="group">
      <Card className="overflow-hidden h-full flex flex-col transition-all hover:shadow-lg">
        <div className="relative aspect-video">
            <Image
                src={property.imageUrl || 'https://placehold.co/800x600'}
                alt={property.title || 'Proprietate'}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                data-ai-hint={property.imageHint}
            />
            <div className="absolute top-2 right-2 flex gap-2">
                {property.visibility && (
                     <Badge variant={property.visibility === 'Colaborare' ? 'secondary' : 'outline'} className="backdrop-blur-sm">
                        {property.visibility === 'Colaborare' ? <Users className="h-3 w-3 mr-1"/> : <Eye className="h-3 w-3 mr-1"/>}
                        {property.visibility}
                     </Badge>
                )}
                 <Badge variant="default" className="">{property.transactionType}</Badge>
            </div>
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
