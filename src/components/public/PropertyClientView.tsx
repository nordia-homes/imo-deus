
'use client';

import type { Property } from '@/lib/types';
import React from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
    BedDouble,
    Bath,
    Ruler,
    CalendarDays,
    Share2,
    Heart,
    Mail,
    Phone
} from "lucide-react";
import { Separator } from '@/components/ui/separator';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';

const ContactCard = ({ property }: { property: Property }) => {
    return (
        <Card className="shadow-lg rounded-xl sticky top-24">
            <CardHeader>
                <p className="text-2xl font-bold">€{property.price.toLocaleString()}<span className="text-base font-normal text-muted-foreground"> / {property.transactionType === 'Închiriere' ? 'lună' : 'total'}</span></p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="public-contact-name">Nume</Label>
                        <Input id="public-contact-name" placeholder="Numele tău" />
                    </div>
                    <div className="grid gap-2">
                         <Label htmlFor="public-contact-email">Email</Label>
                        <Input id="public-contact-email" type="email" placeholder="nume@email.com" />
                    </div>
                     <div className="grid gap-2">
                         <Label htmlFor="public-contact-phone">Telefon</Label>
                        <Input id="public-contact-phone" placeholder="Numărul de telefon" />
                    </div>
                    <div className="grid gap-2">
                         <Label htmlFor="public-contact-message">Mesaj</Label>
                        <Textarea id="public-contact-message" placeholder="Aș dori mai multe detalii despre această proprietate..." defaultValue={`Bună ziua, sunt interesat de proprietatea "${property.title}". Vă rog să mă contactați.`} />
                    </div>
                </div>
                <Button className="w-full" size="lg">
                    <Mail className="mr-2 h-4 w-4" /> Trimite Mesaj
                </Button>
                <Button className="w-full" variant="outline" size="lg">
                    <Phone className="mr-2 h-4 w-4" /> Sună Acum
                </Button>
            </CardContent>
        </Card>
    )
}

export function PropertyClientView({ property }: { property: Property }) {

    const images = property.images && property.images.length > 0 ? property.images : [{ url: 'https://placehold.co/1200x800', alt: 'Placeholder image' }];

    return (
       <div className="bg-background">
            <header className="relative h-[400px] md:h-[550px] w-full">
                <Carousel className="w-full h-full">
                    <CarouselContent>
                        {images.map((image, index) => (
                            <CarouselItem key={index}>
                                <div className="h-[400px] md:h-[550px] w-full relative">
                                    <Image
                                        src={image.url}
                                        alt={image.alt}
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
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <Button variant="secondary" size="icon"><Share2 className="h-5 w-5"/></Button>
                     <Button variant="secondary" size="icon"><Heart className="h-5 w-5"/></Button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-12">
                   <div className="lg:col-span-2 space-y-8">
                        <section>
                            <h1 className="text-3xl font-bold">{property.title}</h1>
                            <p className="text-muted-foreground text-lg mt-1">{property.address}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground">
                                <span className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" /> {property.bedrooms} dormitoare</span>
                                <span className="flex items-center gap-2"><Bath className="h-5 w-5 text-primary" /> {property.bathrooms} băi</span>
                                <span className="flex items-center gap-2"><Ruler className="h-5 w-5 text-primary" /> {property.squareFootage} mp</span>
                                {property.constructionYear && <span className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> {property.constructionYear}</span>}
                            </div>
                        </section>

                        <Separator />

                        {property.agent && (
                             <section className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold">Proprietate administrată de {property.agent.name}</h2>
                                    <p className="text-muted-foreground">Agent imobiliar</p>
                                </div>
                                <Image src={property.agent.avatarUrl} alt={property.agent.name} width={64} height={64} className="rounded-full" />
                            </section>
                        )}
                       
                        <Separator />
                        
                        <section>
                            <h2 className="text-xl font-semibold mb-4">Descriere</h2>
                            <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
                        </section>
                        
                        {property.amenities && property.amenities.length > 0 && (
                            <>
                                <Separator />
                                <section>
                                    <h2 className="text-xl font-semibold mb-4">Dotări și Facilități</h2>
                                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {property.amenities.map(amenity => (
                                             <div key={amenity} className="flex items-center gap-2">
                                                <div className="text-primary">✓</div>
                                                <span className="text-muted-foreground">{amenity}</span>
                                            </div>
                                        ))}
                                     </div>
                                </section>
                            </>
                        )}

                        <Separator />

                        <section>
                            <h2 className="text-xl font-semibold mb-4">Locație pe Hartă</h2>
                             {(property.latitude && property.longitude) ? (
                                <div className="aspect-video w-full rounded-lg overflow-hidden">
                                     <iframe
                                        className="w-full h-full"
                                        loading="lazy"
                                        allowFullScreen
                                        src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&hl=ro&z=15&output=embed`}
                                    >
                                    </iframe>
                                </div>
                            ) : (
                                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                                    <p className="text-muted-foreground">Locația nu este disponibilă pe hartă.</p>
                                </div>
                            )}
                        </section>
                   </div>
                   
                   <div className="hidden lg:block">
                        <ContactCard property={property} />
                   </div>
                </div>
                 {/* Contact form for mobile */}
                <div className="lg:hidden mt-8">
                    <h2 className="text-xl font-semibold mb-4 text-center">Contactează agentul</h2>
                    <ContactCard property={property} />
                </div>
            </main>
       </div>
    );
}
