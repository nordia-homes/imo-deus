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

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;

    // When the dialog opens, re-initialize the carousel to ensure it sizes correctly
    // and scroll to the image that was clicked to open the gallery.
    if (open) {
      setTimeout(() => {
        api.reInit();
        api.scrollTo(activeIndex, true); // Use 'true' for an instant jump without animation
      }, 50); // A small delay ensures the dialog is fully rendered and sized
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="relative">
        {/* --- Layout Container --- */}
        <div className="rounded-lg overflow-hidden">
          {/* --- Mobile View (Single Image) --- */}
          <div
            className="md:hidden aspect-video relative cursor-pointer group"
            onClick={() => openDialog(0)}
          >
            <Image
              src={images[0]}
              alt={title}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
          </div>

          {/* --- Desktop Grid Layout (Airbnb Style) --- */}
           <div className="hidden md:grid md:grid-cols-4 md:grid-rows-2 md:gap-2 h-[550px]">
                {/* Main image */}
                <div className="col-span-2 row-span-2 relative cursor-pointer group" onClick={() => openDialog(0)}>
                    {images[0] && (
                        <>
                            <Image src={images[0]} alt={title} fill priority className="object-cover" sizes="(min-width: 768px) 50vw, 100vw" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                        </>
                    )}
                </div>
                
                {/* Image 2 */}
                <div className="relative cursor-pointer group" onClick={() => openDialog(1)}>
                    {images[1] ? (
                        <>
                            <Image src={images[1]} alt={`${title} 1`} fill className="object-cover" sizes="25vw"/>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                        </>
                    ) : <div className="bg-muted w-full h-full"></div>}
                </div>

                {/* Image 3 */}
                <div className="relative cursor-pointer group" onClick={() => openDialog(2)}>
                    {images[2] ? (
                        <>
                            <Image src={images[2]} alt={`${title} 2`} fill className="object-cover" sizes="25vw"/>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                        </>
                    ) : <div className="bg-muted w-full h-full"></div>}
                </div>

                {/* Image 4 */}
                <div className="relative cursor-pointer group" onClick={() => openDialog(3)}>
                    {images[3] ? (
                        <>
                            <Image src={images[3]} alt={`${title} 3`} fill className="object-cover" sizes="25vw"/>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                        </>
                    ) : <div className="bg-muted w-full h-full"></div>}
                </div>
                
                {/* Image 5 */}
                <div className="relative cursor-pointer group" onClick={() => openDialog(4)}>
                    {images[4] ? (
                        <>
                            <Image src={images[4]} alt={`${title} 4`} fill className="object-cover" sizes="25vw"/>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                        </>
                    ) : <div className="bg-muted w-full h-full"></div>}
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
        <DialogDescription className="sr-only">
          A carousel of images for the property: {title}. Use the left and right
          arrows to navigate.
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
          <CarouselPrevious className="left-4 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
          <CarouselNext className="right-4 text-white border-white bg-black/50 hover:bg-black/70 hover:text-white" />
        </Carousel>
      </DialogContent>
    </Dialog>
  );
}
