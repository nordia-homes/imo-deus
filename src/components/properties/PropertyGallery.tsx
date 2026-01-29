'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Carousel, CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Grid } from 'lucide-react';

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
    const [api, setApi] = React.useState<CarouselApi>()
    const [open, setOpen] = React.useState(false)

    React.useEffect(() => {
        if (!api) return;
        if (open) {
            // Re-initialize carousel when dialog opens to fix button state and sizing
            setTimeout(() => api.reInit(), 50); 
        }
    }, [open, api])

    if (!images || images.length === 0) {
        return (
             <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">No images available</p>
            </div>
        )
    }
    
    const showGrid = images.length >= 5;
    const mainImage = images[0];
    const gridImages = images.slice(1, 5);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <div className="relative">
                {/* --- Airbnb-style Grid Layout (Desktop) --- */}
                <div className={showGrid ? "hidden md:grid md:grid-cols-2 md:gap-2 rounded-lg overflow-hidden h-[450px] lg:h-[550px]" : "hidden"}>
                    {/* Left Column (Main Image) */}
                    <DialogTrigger asChild>
                        <div className="h-full w-full relative cursor-pointer group">
                            <Image src={mainImage} alt={title} fill priority className="object-cover" sizes="(min-width: 768px) 50vw, 100vw"/>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                        </div>
                    </DialogTrigger>

                    {/* Right Column (4 Small Images) */}
                    <div className="grid grid-cols-2 gap-2">
                        {gridImages.map((src, index) => (
                            <DialogTrigger asChild key={index}>
                                <div className="h-full w-full relative cursor-pointer group">
                                    <Image src={src} alt={`${title} thumbnail ${index + 2}`} fill className="object-cover" sizes="(min-width: 768px) 25vw, 50vw"/>
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                                </div>
                            </DialogTrigger>
                        ))}
                    </div>
                </div>

                {/* --- Fallback Single Image View (Mobile or < 5 images) --- */}
                <div className={showGrid ? "md:hidden" : ""}>
                    <DialogTrigger asChild>
                        <div className="aspect-video relative cursor-pointer group rounded-lg overflow-hidden">
                            <Image src={images[0]} alt={title} fill priority className="object-cover" sizes="100vw" />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-all"></div>
                        </div>
                    </DialogTrigger>
                </div>

                {/* Show All Photos Button */}
                <DialogTrigger asChild>
                    <Button variant="secondary" className="absolute bottom-4 right-4 z-10">
                        <Grid className="mr-2 h-4 w-4" />
                        Show all photos
                    </Button>
                </DialogTrigger>
            </div>
            
            {/* Modal Content */}
            <DialogContent className="max-w-none w-full h-full p-0 border-0 bg-black/90 flex items-center justify-center">
                 <Carousel setApi={setApi} className="w-full max-w-5xl" opts={{ loop: true, startIndex: 0 }}>
                    <CarouselContent>
                        {images.map((src, index) => (
                            <CarouselItem key={index}>
                                 <div className="relative aspect-video">
                                    <Image src={src} alt={`${title} image ${index + 1}`} fill className="object-contain" sizes="90vw" />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-4 text-white border-white hover:bg-white/20 hover:text-white" />
                    <CarouselNext className="right-4 text-white border-white hover:bg-white/20 hover:text-white" />
                </Carousel>
            </DialogContent>
        </Dialog>
    );
}
