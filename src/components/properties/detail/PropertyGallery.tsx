"use client"

import * as React from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Grid, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

export function PropertyGallery({ images, title, propertyId }: { images: string[]; title: string; propertyId: string }) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [isMobileGalleryOpen, setIsMobileGalleryOpen] = React.useState(false);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!api) return

    if (open) {
      setTimeout(() => {
        api.reInit()
        api.scrollTo(activeIndex, true) 
      }, 100) 
    }
  }, [open, api, activeIndex])

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">No images available</p>
      </div>
    )
  }

  const handleOpenGallery = (index: number) => {
    setActiveIndex(index);
    if (isMobile) {
      setIsMobileGalleryOpen(true);
    } else {
      setOpen(true);
    }
  };


  const ImageItem = ({ index, className }: { index: number; className?: string }) => {
    const imageUrl = images[index]
    if (!imageUrl) return <div className={cn("bg-slate-800/50 rounded-lg", className)}></div>

    return (
      <div
        className={cn("relative cursor-pointer group overflow-hidden rounded-lg", className)}
        onClick={() => handleOpenGallery(index)}
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
    )
  }

  // Mobile Gallery View
  if (isMobileGalleryOpen) {
    return (
      <div className="fixed inset-0 bg-[#0F1E33] z-50 flex flex-col">
        <header className="flex items-center justify-between p-2 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-semibold text-white ml-2">Galerie Foto</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileGalleryOpen(false)} className="text-white">
            <X className="h-6 w-6" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {images.map((src, index) => (
            <div key={index} className="relative w-full rounded-lg overflow-hidden">
              <Image
                src={src}
                alt={`${title} image ${index + 1}`}
                width={1200}
                height={800}
                className="w-full h-auto"
                sizes="100vw"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-[250px] md:h-[405px]">
            {/* Main Image */}
            <div className="col-span-1 h-full">
                <ImageItem index={0} className="w-full h-full" />
            </div>
            {/* Side Images */}
            <div className="hidden md:grid grid-rows-2 gap-2 h-full">
                <ImageItem index={1} className="w-full h-full" />
                <ImageItem index={2} className="w-full h-full" />
            </div>
        </div>
        <Button
          variant="secondary"
          className="absolute bottom-4 right-4 z-10 bg-white/90 hover:bg-white text-black"
          onClick={() => handleOpenGallery(0)}
        >
          <Grid className="mr-2 h-4 w-4" />
          Vezi Fotografiile
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
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
      </Dialog>
    </>
  )
}
