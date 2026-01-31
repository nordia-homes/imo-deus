'use client';
import type { Property } from "@/lib/types";
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";

export function MediaColumn({ property }: { property: Property }) {
    const propertyImages = (property.images || []).map(img => img.url).filter(Boolean);
    const hasImages = propertyImages.length > 0;
    const allImages = hasImages ? propertyImages : ['https://placehold.co/1200x800?text=Imagine+lipsa'];
    
    return (
        <div className="space-y-6">
             <Carousel 
                className="w-full rounded-2xl overflow-hidden group"
                opts={{ loop: hasImages }}
            >
                <CarouselContent>
                    {allImages.map((src, index) => (
                        <CarouselItem key={index}>
                            <div className="aspect-video relative">
                                 <Image
                                    src={src}
                                    alt={`${property.title || 'Proprietate'} - imagine ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    sizes="(min-width: 1280px) 50vw, 100vw"
                                />
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                {hasImages && allImages.length > 1 && (
                    <>
                        <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                )}
            </Carousel>
        </div>
    );
}
