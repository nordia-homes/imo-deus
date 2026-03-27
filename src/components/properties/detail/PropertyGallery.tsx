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
import { Grid, Heart, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

export function PropertyGallery({ images, title, propertyId }: { images: string[]; title: string; propertyId: string }) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [isMobileGalleryOpen, setIsMobileGalleryOpen] = React.useState(false);
  const [isLoved, setIsLoved] = React.useState(false);
  const isMobile = useIsMobile();
  const financeCardClassName = "overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.2),transparent_28%),linear-gradient(135deg,rgba(7,18,12,0.96)_0%,rgba(10,10,12,0.98)_52%,rgba(16,24,18,0.96)_100%)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]";

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
        className={cn("relative cursor-pointer group overflow-hidden rounded-none md:rounded-lg", className)}
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
      <div className="fixed inset-0 z-50 flex flex-col bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.18),transparent_22%),linear-gradient(180deg,_#050505_0%,_#0b0b0d_40%,_#121214_100%)] text-stone-100">
        <header className={`${financeCardClassName} m-2 mb-0 flex shrink-0 items-center justify-between rounded-b-[1.25rem] rounded-t-[2rem] p-2 backdrop-blur-xl`}>
          <h2 className="ml-2 text-lg font-semibold text-white">Galerie foto</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileGalleryOpen(false)} className="text-stone-300 hover:bg-white/5 hover:text-white">
            <X className="h-6 w-6" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-2 pt-3 space-y-3">
          {images.map((src, index) => (
            <div key={index} className={`relative w-full ${financeCardClassName}`}>
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
        <div className="grid grid-cols-1 gap-2 h-auto md:grid-cols-2 md:h-[405px]">
            {/* Main Image */}
            <div className="col-span-1 aspect-square md:aspect-auto md:h-full">
                <ImageItem index={0} className="h-full w-full" />
            </div>
            {/* Side Images */}
            <div className="hidden md:grid grid-rows-2 gap-2 h-full">
                <ImageItem index={1} className="w-full h-full" />
                <ImageItem index={2} className="w-full h-full" />
            </div>
        </div>
        <div className="absolute left-4 top-4 z-10 flex items-center gap-3 rounded-full border border-white/20 bg-black/24 px-4 py-2 text-white shadow-[0_16px_38px_-18px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <span className="whitespace-nowrap text-sm font-medium leading-none text-white/92">Aceasta proprietate ti se potriveste?</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-pressed={isLoved}
            aria-label={isLoved ? "Scoate de la favorite" : "Adauga la favorite"}
            className="h-9 w-9 rounded-full border border-white/18 bg-white/8 text-white hover:bg-white/14 hover:text-white"
            onClick={() => setIsLoved((prev) => !prev)}
          >
            <Heart className={cn("h-4 w-4", isLoved && "fill-[#fb7185] text-[#fb7185]")} />
          </Button>
        </div>
        <Button
          variant="secondary"
          className="absolute bottom-4 right-4 z-10 rounded-full border border-white/30 bg-white/12 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] backdrop-blur-xl hover:bg-white/18 hover:text-white"
          onClick={() => handleOpenGallery(0)}
        >
          <Grid className="mr-2 h-4 w-4" />
          Vezi Fotografiile
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-full w-full max-w-none items-center justify-center border-0 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.14),transparent_22%),linear-gradient(180deg,rgba(5,5,5,0.96)_0%,rgba(8,8,10,0.94)_100%)] p-0">
            <DialogTitle className="sr-only">Image gallery for {title}</DialogTitle>
            <DialogDescription className="sr-only">
              A carousel of {images.length} images for the property: {title}.
            </DialogDescription>
        
            <Carousel
              setApi={setApi}
              className={`w-full max-w-5xl ${financeCardClassName}`}
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
              <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20 hover:text-white" />
              <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20 hover:text-white" />
            </Carousel>
        </DialogContent>
      </Dialog>
    </>
  )
}
