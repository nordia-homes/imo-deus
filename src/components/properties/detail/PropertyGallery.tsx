'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Grid } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;

    if (open) {
      setTimeout(() => {
        api.reInit();
        api.scrollTo(activeIndex, true); 
      }, 100); 
    }
  }, [open, api, activeIndex]);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-2xl flex items-center justify-center">
        <p className="text-muted-foreground">Fără imagini</p>
      </div>
    );
  }

  const openDialog = (index: number) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const ImageItem = ({ index, className }: { index: number; className?: string }) => {
    const imageUrl = images[index];
    if (!imageUrl) return <div className={cn("bg-muted rounded-lg", className)}></div>;

    return (
      <div
        className={cn("relative cursor-pointer group overflow-hidden", className)}
        onClick={() => openDialog(index)}
      >
        <Image 
          src={imageUrl} 
          alt={`${title} image ${index + 1}`} 
          fill 
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </div>
    );
  };

  return (
    <>
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-4 md:gap-2 h-[450px] rounded-2xl overflow-hidden">
          {/* Main Image */}
          <div className="md:col-span-3 h-full w-full">
            <ImageItem index={0} className="w-full h-full" />
          </div>
          {/* Side Images */}
          <div className="hidden md:grid md:grid-cols-1 md:gap-2">
            <ImageItem index={1} />
            <ImageItem index={2} />
            <ImageItem index={3} />
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="absolute bottom-4 left-4 z-10">
                    <Grid className="mr-2 h-4 w-4" />
                    + {images.length} fotografii
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-none w-full h-full p-0 border-0 bg-black/90 flex items-center justify-center">
                <DialogTitle className="sr-only">Galerie foto pentru {title}</DialogTitle>
                <DialogDescription className="sr-only">
                    Un carusel cu {images.length} imagini pentru proprietatea: {title}.
                </DialogDescription>
                <Carousel setApi={setApi} className="w-full max-w-5xl" opts={{ loop: true, startIndex: activeIndex }}>
                    <CarouselContent>
                        {images.map((image, index) => (
                            <CarouselItem key={index}>
                                <div className="aspect-video relative">
                                    <Image src={image.url} alt={image.alt || `${title} image ${index + 1}`} fill className="object-contain" sizes="90vw" />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
                    <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
                </Carousel>
            </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
