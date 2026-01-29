'use client';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Grid } from 'lucide-react';

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
    if (!images || images.length === 0) {
        return (
             <div className="aspect-[16/10] bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">No images available</p>
            </div>
        )
    }

    const mainImage = images[0];
    const gridImages = images.slice(1, 5);

    return (
        <Dialog>
            <div className="relative">
                {/* Desktop Grid Layout */}
                <div className="hidden md:grid md:grid-cols-4 md:grid-rows-2 md:gap-2 max-h-[550px] rounded-lg overflow-hidden">
                    {/* Main Image */}
                    <DialogTrigger asChild>
                        <div className="md:col-span-2 md:row-span-2 relative cursor-pointer group">
                             <Image
                                src={mainImage}
                                alt={title}
                                fill
                                priority
                                className="object-cover w-full h-full"
                                sizes="50vw"
                            />
                            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </DialogTrigger>
                    {/* 4 Small Images */}
                    {gridImages.map((src, index) => (
                        <DialogTrigger asChild key={index}>
                            <div className="relative cursor-pointer group">
                                <Image
                                    src={src}
                                    alt={`${title} thumbnail ${index + 2}`}
                                    fill
                                    className="object-cover w-full h-full"
                                    sizes="25vw"
                                />
                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </DialogTrigger>
                    ))}
                </div>

                {/* Mobile Single Image Layout */}
                <DialogTrigger asChild>
                     <div className="md:hidden relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer group">
                         <Image
                            src={mainImage}
                            alt={title}
                            fill
                            priority
                            className="object-cover w-full h-full"
                            sizes="100vw"
                        />
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </DialogTrigger>


                <DialogTrigger asChild>
                    <Button variant="secondary" className="absolute bottom-4 right-4 z-10">
                        <Grid className="mr-2 h-4 w-4" />
                        Show all photos
                    </Button>
                </DialogTrigger>
            </div>
            
            <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-black/95 flex items-center justify-center">
                 <Carousel className="w-full max-w-6xl" opts={{ loop: true, align: "start" }}>
                    <CarouselContent>
                        {images.map((src, index) => (
                            <CarouselItem key={index}>
                                 <div className="relative aspect-video">
                                    <Image
                                        src={src}
                                        alt={`${title} image ${index + 1}`}
                                        fill
                                        className="object-contain"
                                        sizes="100vw"
                                    />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-4 bg-background/50 hover:bg-background/80 border-0 text-foreground" />
                    <CarouselNext className="right-4 bg-background/50 hover:bg-background/80 border-0 text-foreground" />
                </Carousel>
            </DialogContent>
        </Dialog>
    );
}
