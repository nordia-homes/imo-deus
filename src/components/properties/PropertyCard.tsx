import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Star, BedDouble, Bath, Ruler, Edit } from "lucide-react";
import type { Property } from "@/lib/types";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card } from "../ui/card";
import { AddPropertyDialog } from "./add-property-dialog";
import { Button } from "../ui/button";
import { useState } from "react";

export function PropertyCard({ property, agencyId }: { property: Property; agencyId?: string }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const href = agencyId
    ? `/agencies/${agencyId}/properties/${property.id}`
    : `/properties/${property.id}`;
    
  const hasImages = property.images && property.images.length > 0;
  const primaryImageUrl = hasImages ? property.images[0].url : 'https://placehold.co/800x600?text=Imagine+lipsa';

  // Check if property was created in the last 7 days
  const isNew = property.createdAt && new Date(property.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return (
    <>
      <Card className="group overflow-hidden rounded-2xl shadow-2xl">
          <Carousel
            opts={{
              align: "start",
              loop: hasImages,
            }}
            className="w-full relative"
          >
            <CarouselContent>
              {hasImages ? property.images.map((image, index) => (
                <CarouselItem key={index}>
                  <Link href={href} className="block aspect-square relative">
                    <Image
                      src={image.url}
                      alt={image.alt || property.title || 'Proprietate'}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </Link>
                </CarouselItem>
              )) : (
                  <CarouselItem>
                      <Link href={href} className="block aspect-square relative bg-muted">
                          <Image
                              src={primaryImageUrl}
                              alt={property.title || 'Proprietate'}
                              fill
                              className="object-cover"
                          />
                      </Link>
                  </CarouselItem>
              )}
            </CarouselContent>
            {hasImages && property.images.length > 1 && (
              <>
                  <CarouselPrevious className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white" />
                  <CarouselNext className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white" />
              </>
            )}
            <div className="absolute top-3 left-3 right-3 flex justify-between z-10">
                <div>
                  {property.featured && <Badge>Recomandată</Badge>}
                  {isNew && !property.featured && <Badge variant="secondary">Nou</Badge>}
                </div>
                <Badge variant="secondary" className="bg-black/50 text-white border-transparent">{property.transactionType}</Badge>
            </div>
          </Carousel>

          <div className="p-4">
            <div className="flex justify-between items-start gap-2">
              <Link href={href} className="flex-1 truncate">
                <h3 className="font-semibold text-base text-foreground truncate pr-2 group-hover:underline">{property.title}</h3>
              </Link>
              {!agencyId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  aria-label="Editează proprietatea"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Link href={href} className="block mt-1">
              <p className="text-sm text-muted-foreground">{property.location}</p>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                      <BedDouble className="h-4 w-4"/>
                      <span>{property.rooms}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <Bath className="h-4 w-4"/>
                      <span>{property.bathrooms}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <Ruler className="h-4 w-4"/>
                      <span>{property.squareFootage} mp</span>
                  </div>
              </div>
            <p className="font-semibold text-base mt-2">
              €{property.price.toLocaleString()}
              {property.transactionType === 'Închiriere' && <span className="font-normal text-muted-foreground"> / lună</span>}
            </p>
            </Link>
          </div>
      </Card>
      {!agencyId && (
        <AddPropertyDialog 
          property={property}
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}
    </>
  );
}
