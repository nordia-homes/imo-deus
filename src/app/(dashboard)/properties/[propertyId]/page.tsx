
import { properties } from "@/lib/data";
import type { Property } from "@/lib/types";
import { notFound } from "next/navigation";
import Image from "next/image";
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bed, Bath, Car, Check, MapPin, Square } from "lucide-react";

export default function PropertyDetailPage({ params }: { params: { propertyId: string }}) {
    const property = properties.find(p => p.id === params.propertyId) as Property | undefined;

    if (!property) {
        notFound();
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Title and Location */}
            <div className="mb-4">
                <h1 className="text-3xl font-bold tracking-tight">{property.title}</h1>
                <p className="text-muted-foreground mt-1 hover:underline cursor-pointer">{property.location}</p>
            </div>

            {/* Image Gallery */}
            <PropertyGallery images={property.images.map(i => i.url)} title={property.title} />

            {/* Main Content */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                 <div className="lg:col-span-2">
                    {/* Host and Stats */}
                    <div className="pb-6 border-b">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-semibold">Entire apartment hosted by {property.agent.name}</h2>
                                <div className="text-muted-foreground flex items-center gap-2 mt-1">
                                    <span>{property.bedrooms} beds</span>
                                    <span>&middot;</span>
                                    <span>{property.bathrooms} baths</span>
                                    <span>&middot;</span>
                                    <span>{property.squareFootage} sqft</span>
                                </div>
                            </div>
                            <Avatar className="h-14 w-14">
                                <AvatarImage src={property.agent.avatarUrl} alt={property.agent.name} />
                                <AvatarFallback>{property.agent.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                    
                    {/* Description */}
                    <div className="py-6 border-b">
                        <p className="text-muted-foreground">{property.description}</p>
                    </div>

                    {/* Amenities */}
                    <div className="py-6 border-b">
                        <h2 className="text-2xl font-semibold mb-4">What this place offers</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {property.amenities.map(amenity => (
                                <div key={amenity} className="flex items-center gap-2">
                                    <Check className="h-5 w-5" />
                                    <span>{amenity}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sticky Right Column */}
                 <div className="lg:col-span-1">
                    <div className="sticky top-24">
                         <Card className="shadow-lg rounded-xl p-2">
                            <CardHeader>
                                <CardTitle className="text-2xl">€{property.price.toLocaleString()}</CardTitle>
                                <p className="text-sm text-muted-foreground">{property.bedrooms} beds &middot; {property.bathrooms} baths</p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button className="w-full" size="lg">Request a tour</Button>
                                <Button className="w-full" size="lg" variant="outline">Contact Agent</Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

             {/* Map section */}
            <div className="mt-8 pt-8 border-t">
                <h2 className="text-2xl font-semibold mb-4">Where you’ll be</h2>
                <div className="aspect-video bg-gray-200 rounded-xl flex items-center justify-center">
                    <p className="text-muted-foreground">
                        Map placeholder for {property.location}
                    </p>
                </div>
            </div>
        </div>
    )
}
