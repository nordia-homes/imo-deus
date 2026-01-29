'use client';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Grid } from 'lucide-react';

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
    if (!images || images.length === 0) {
        return (
             <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">No images available</p>
            </div>
        )
    }

    const mainImage = images[0];
    const gridImages = images.slice(1, 5);
    const hasGridDisplay = images.length >= 5;

    return (
        <Dialog>
            <div className="relative">
                {/* --- Grid Layout (Desktop) --- */}
                {hasGridDisplay && (
                    <div className="hidden md:grid md:grid-cols-4 md:grid-rows-2 md:gap-2 aspect-video rounded-lg overflow-hidden">
                        <DialogTrigger asChild>
                            <div className="col-span-2 row-span-2 relative cursor-pointer group">
                                <Image src={mainImage} alt={title} fill priority className="object-cover" sizes="(min-width: 768px) 50vw, 100vw"/>
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-all"></div>
                            </div>
                        </DialogTrigger>
                        {gridImages.map((src, index) => (
                            <DialogTrigger asChild key={index}>
                                <div className="relative cursor-pointer group">
                                    <Image src={src} alt={`${title} thumbnail ${index + 2}`} fill className="object-cover" sizes="(min-width: 768px) 25vw, 50vw"/>
                                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-all"></div>
                                </div>
                            </DialogTrigger>
                        ))}
                    </div>
                )}
                
                {/* --- Single Image Layout (Mobile or < 5 images) --- */}
                <div className={hasGridDisplay ? "md:hidden" : ""}>
                    <DialogTrigger asChild>
                        <div className="aspect-video relative cursor-pointer group rounded-lg overflow-hidden">
                            <Image src={mainImage} alt={title} fill priority className="object-cover" sizes="100vw" />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-all"></div>
                        </div>
                    </DialogTrigger>
                </div>

                <DialogTrigger asChild>
                    <Button variant="secondary" className="absolute bottom-4 right-4 z-10">
                        <Grid className="mr-2 h-4 w-4" />
                        Show all photos
                    </Button>
                </DialogTrigger>
            </div>
            
            <DialogContent className="max-w-none w-full h-full p-0 border-0 bg-black/90 flex items-center justify-center">
                 <Carousel className="w-full max-w-5xl" opts={{ loop: true }}>
                    <CarouselContent>
                        {images.map((src, index) => (
                            <CarouselItem key={index}>
                                 <div className="relative aspect-video">
                                    <Image src={src} alt={`${title} image ${index + 1}`} fill className="object-contain" sizes="90vw" />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                </Carousel>
            </DialogContent>
        </Dialog>
    );
}
