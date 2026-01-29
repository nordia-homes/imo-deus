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

  // This effect re-initializes the carousel when the dialog is opened.
  // It's crucial for the carousel to calculate its dimensions correctly inside the modal.
  React.useEffect(() => {
    if (!api) return;

    if (open) {
      // A small delay ensures the dialog's CSS transitions are complete
      setTimeout(() => {
        api.reInit();
        // Instantly jump to the image that was clicked, without animation
        api.scrollTo(activeIndex, true); 
      }, 100); 
    }
  }, [open, api, activeIndex]);

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

  // Create a helper component for repeated image items to keep the code clean
  const ImageItem = ({ index, className }: { index: number; className?: string }) => {
    const imageUrl = images[index];
    // If an image doesn't exist for a given index, render a placeholder.
    // This makes the grid layout robust even with fewer than 5 images.
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

  return (
    <>
      {/* The main gallery container */}
      <div className="relative">
        
        {/* --- Desktop Grid Layout (Airbnb Style) --- */}
        <div className="hidden md:grid md:grid-cols-4 md:grid-rows-2 md:gap-2 h-[550px]">
          {/* Main image */}
          <div className="col-span-2 row-span-2">
            <ImageItem index={0} className="w-full h-full" />
          </div>
          {/* The other 4 images */}
          <ImageItem index={1} />
          <ImageItem index={2} />
          <ImageItem index={3} />
          <ImageItem index={4} />
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

      {/* --- Dialog for the full-screen carousel --- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-none w-full h-full p-0 border-0 bg-black/90 flex items-center justify-center">
            {/* Accessibility Titles */}
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
      </Dialog>
    </>
  );
}
