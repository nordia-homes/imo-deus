'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
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
import { useIsMobile } from '@/hooks/use-mobile';

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!api || isMobile) return;

    if (open) {
      setTimeout(() => {
        api.reInit();
        api.scrollTo(activeIndex, true); 
      }, 100); 
    }
  }, [open, api, activeIndex, isMobile]);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">No images available</p>
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
        className={cn("relative cursor-pointer group overflow-hidden rounded-lg", className)}
        onClick={() => openDialog(index)}
      >
        <Image 
          src={imageUrl} 
          alt={`${title} image ${index + 1}`} 
          fill 
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </div>
    );
  };
  
  const renderDialogContent = () => {
    if (isMobile) {
      return (
        <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-background flex flex-col rounded-none data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom">
            <DialogHeader className="p-4 border-b shrink-0">
              <DialogTitle>Galerie Foto</DialogTitle>
              <DialogDescription className="sr-only">
                Listă de imagini pentru {title}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2 p-2">
                {images.map((src, index) => (
                  <div key={index} className="relative w-full h-auto rounded-lg overflow-hidden bg-muted">
                    <Image
                      src={src}
                      alt={`${title} image ${index + 1}`}
                      width={1200}
                      height={800}
                      className="w-full h-auto object-contain"
                      sizes="100vw"
                      priority={index < 2} // Prioritize loading the first couple of images
                    />
                  </div>
                ))}
              </div>
            </div>
        </DialogContent>
      );
    }

    // Desktop Carousel
    return (
      <DialogContent className="max-w-none w-full h-full p-0 border-0 bg-black/90 flex items-center justify-center">
          <DialogTitle className="sr-only">Image gallery for {title}</DialogTitle>
          <DialogDescription className="sr-only">
            A carousel of {images.length} images for the property: {title}.
          </DialogDescription>
      
          <Carousel
            setApi={setApi}
            className="w-full max-w-5xl"
            opts={{ loop: true, startIndex: activeIndex }}
          >
            <CarouselContent>
              {images.map((src, index) => (
                <CarouselItem key={index}>
                  <div className="relative aspect-video">
                    <Image
                      src={src}
                      alt={`${title} image ${index + 1}`}
                      fill
                      className="object-contain"
                      sizes="90vw"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
            <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
          </Carousel>
      </DialogContent>
    );
  }

  return (
    <>
      {/* The main gallery container */}
      <div className="relative">
        
        {/* --- Desktop Grid Layout --- */}
        <div className="hidden md:grid md:grid-cols-3 md:grid-rows-2 md:gap-2 h-[405px]">
          <ImageItem index={0} className="col-span-2 row-span-2" />
          <ImageItem index={1} className="col-span-1" />
          <ImageItem index={2} className="col-span-1" />
        </div>

        {/* --- Mobile View (Single Image) --- */}
        <div className="md:hidden aspect-video">
            <ImageItem index={0} className="w-full h-full" />
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

      {/* --- Dialog for the full-screen view --- */}
      <Dialog open={open} onOpenChange={setOpen}>
        {renderDialogContent()}
      </Dialog>
    </>
  );
}
