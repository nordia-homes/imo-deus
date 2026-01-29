'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Carousel, CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Grid } from 'lucide-react';

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
    const [api, setApi] = React.useState<CarouselApi>()
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(0);

    React.useEffect(() => {
        if (!api) return;
        if (open) {
            // Re-initialize carousel when dialog opens to ensure it's sized correctly and buttons work
            setTimeout(() => {
                api.reInit();
                api.scrollTo(activeIndex, true); // Jump to the image that was clicked
            }, 50);
        }
    }, [open, api, activeIndex]);

    if (!images || images.length === 0) {
        return (
             <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">No images available</p>
            </div>
        )
    }

    const openDialog = (index: number) => {
        setActiveIndex(index);
        setOpen(true);
    };

    const mainImage = images[0];
    const gridImages = images.slice(1, 5);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <div className="relative">
                {/* --- Layout Container --- */}
                <div className="rounded-lg overflow-hidden md:h-[550px]">
                    {/* --- Mobile View (Single Image) --- */}
                     <div 
                        className="md:hidden aspect-video relative cursor-pointer group"
                        onClick={() => openDialog(0)}
                    >
                        <Image src={mainImage} alt={title} fill priority className="object-cover" sizes="100vw" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                    </div>

                    {/* --- Desktop Grid Layout (Airbnb Style) --- */}
                    <div className="hidden md:grid md:grid-cols-2 md:gap-2 h-full">
                        {/* Left: Main Image */}
                        <div 
                            className="relative cursor-pointer group h-full"
                            onClick={() => openDialog(0)}
                        >
                            <Image src={mainImage} alt={title} fill priority className="object-cover" sizes="(min-width: 768px) 50vw, 100vw"/>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                        </div>
                        {/* Right: 4-image grid */}
                        <div className="grid grid-cols-2 gap-2 h-full">
                            {gridImages.map((src, index) => (
                                <div 
                                    key={index} 
                                    className="relative cursor-pointer group h-full"
                                    onClick={() => openDialog(index + 1)}
                                >
                                    <Image src={src} alt={`${title} thumbnail ${index + 2}`} fill className="object-cover" sizes="25vw"/>
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* --- Show all photos button --- */}
                <Button 
                    variant="secondary" 
                    className="absolute bottom-4 right-4 z-10"
                    onClick={() => openDialog(0)}
                >
                    <Grid className="mr-2 h-4 w-4" />
                    Show all photos
                </Button>
            </div>
            
            {/* Modal Content */}
            <DialogContent className="max-w-none w-full h-full p-0 border-0 bg-black/90 flex items-center justify-center">
                 <DialogTitle className="sr-only">Image gallery for {title}</DialogTitle>
                 <DialogDescription className="sr-only">A carousel of images for the property: {title}. Use the left and right arrows to navigate.</DialogDescription>
                 <Carousel setApi={setApi} className="w-full max-w-5xl" opts={{ loop: true, startIndex: activeIndex }}>
                    <CarouselContent>
                        {images.map((src, index) => (
                            <CarouselItem key={index}>
                                 <div className="relative aspect-video">
                                    <Image src={src} alt={`${title} image ${index + 1}`} fill className="object-contain" sizes="90vw" />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-4 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
                    <CarouselNext className="right-4 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
                </Carousel>
            </DialogContent>
        </Dialog>
    );
}
