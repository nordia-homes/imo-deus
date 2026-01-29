'use client';

import { MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Property } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import Image from "next/image";
import Link from "next/link";

export function PropertyMarker({ property, style }: { property: Property, style: React.CSSProperties }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    style={style}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 text-primary transition-transform hover:scale-125 focus:outline-none"
                    title={property.title}
                >
                    <MapPin className="h-8 w-8 drop-shadow-lg" fill="currentColor" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
                 <Link href={`/properties/${property.id}`} className="group">
                    <Card className="border-0 shadow-none">
                        <div className="relative aspect-video">
                            <Image
                                src={property.imageUrl || 'https://placehold.co/800x600'}
                                alt={property.title || 'Proprietate'}
                                fill
                                className="object-cover rounded-t-lg"
                                data-ai-hint={property.imageHint}
                            />
                        </div>
                        <CardHeader className="p-4">
                            <CardTitle className="truncate text-base group-hover:underline">{property.title}</CardTitle>
                            <CardDescription className="text-xs">{property.address}</CardDescription>
                        </CardHeader>
                        <CardFooter className="p-4 pt-0">
                            <p className="font-bold text-lg text-primary">€{property.price.toLocaleString()}</p>
                        </CardFooter>
                    </Card>
                </Link>
            </PopoverContent>
        </Popover>
    );
}
