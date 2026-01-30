
'use client';

import React from 'react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Share2,
  BedDouble,
  Bath,
  Ruler,
  MapPin,
  CheckCircle2,
  Phone,
  Mail,
} from "lucide-react";
import type { Property } from "@/lib/types";

const PropertyContactCard = ({ property }: { property: Property }) => (
    <Card className="sticky top-24 shadow-lg">
        <CardHeader>
            <p className="text-2xl font-bold">
                €{property.price.toLocaleString()}
                <span className="text-base font-normal text-muted-foreground">
                    {property.transactionType === 'Închiriere' ? '/lună' : ''}
                </span>
            </p>
        </CardHeader>
        <CardContent className="space-y-4">
            {/* Placeholder for a booking/contact form */}
            <div className="grid gap-2">
                <Button size="lg">Solicită detalii</Button>
                <Button size="lg" variant="outline">Trimite mesaj</Button>
            </div>
             <div className="text-center text-sm text-muted-foreground pt-2">
                Nu vei fi taxat încă
            </div>
        </CardContent>
    </Card>
);


export function PropertyClientView({ property }: { property: Property }) {
  const allImages = (property.images || []).map(img => img.url).filter(Boolean);
  const defaultImages = ['https://placehold.co/1200x800?text=Imagine+lipsa'];
  const galleryImages = allImages.length > 0 ? allImages : defaultImages;

  return (
    <div className="bg-background">
      {/* --- Image Gallery Header --- */}
      <header className="relative h-[60vh] md:h-[70vh]">
        <Carousel className="w-full h-full">
          <CarouselContent>
            {galleryImages.map((src, index) => (
              <CarouselItem key={index}>
                <div className="relative h-full w-full">
                  <Image
                    src={src}
                    alt={`${property.title} image ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
          <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
        </Carousel>

        {/* Overlay Actions */}
        <div className="absolute top-4 right-4 z-10">
          <Button variant="secondary" className="bg-white/90 hover:bg-white text-black">
            <Share2 className="mr-2" />
            Distribuie
          </Button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="relative -mt-16 md:-mt-24 z-10">
         <div className="container mx-auto px-4 lg:px-8 py-8 bg-background rounded-t-3xl shadow-2xl">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16">
                
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-10">
                    {/* Primary Info */}
                    <section>
                         <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{property.title}</h1>
                         <p className="text-lg text-muted-foreground mt-2 flex items-center gap-2">
                             <MapPin className="h-5 w-5"/>
                             {property.address}
                         </p>
                        <div className="flex items-center gap-6 text-muted-foreground mt-4 border-y py-4">
                           <div className="flex items-center gap-2"><BedDouble /> {property.bedrooms} Dormitoare</div>
                           <div className="flex items-center gap-2"><Bath /> {property.bathrooms} Băi</div>
                           <div className="flex items-center gap-2"><Ruler /> {property.squareFootage} mp</div>
                        </div>
                    </section>
                    
                    <Separator />

                    {/* Agent Info */}
                    {property.agent && (
                    <section className="flex items-center gap-4">
                         <div className="flex-1">
                            <h2 className="text-xl font-semibold">Proprietate administrată de {property.agent.name}</h2>
                             <div className="flex items-center gap-3 mt-2">
                                <Button variant="outline"><Phone className="mr-2"/> Sună acum</Button>
                                <Button variant="outline"><Mail className="mr-2"/> Trimite email</Button>
                             </div>
                        </div>
                    </section>
                    )}

                    <Separator />

                     {/* Description */}
                    <section>
                        <h2 className="text-2xl font-semibold mb-4">Descriere</h2>
                        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{property.description}</p>
                    </section>
                    
                    <Separator />

                    {/* Amenities */}
                    {property.amenities && property.amenities.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-semibold mb-4">Dotări și Facilități</h2>
                            <div className="columns-2 md:columns-3 gap-x-8 gap-y-4 space-y-2">
                                {property.amenities.map(amenity => (
                                    <div key={amenity} className="flex items-center gap-3 break-inside-avoid">
                                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                                        <span>{amenity}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                    
                    <Separator />

                    {/* Map */}
                    <section>
                        <h2 className="text-2xl font-semibold mb-4">Locație pe Hartă</h2>
                        {(property.latitude && property.longitude) ? (
                            <iframe
                                className="w-full aspect-video rounded-md border"
                                loading="lazy"
                                allowFullScreen
                                src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&hl=ro&z=15&output=embed`}
                            ></iframe>
                        ) : (
                            <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                                <p className="text-muted-foreground">Locația nu este disponibilă pe hartă.</p>
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column (Sticky) */}
                <div className="lg:col-span-1">
                    <PropertyContactCard property={property} />
                </div>
            </div>
         </div>
      </main>
    </div>
  );
}

