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
import { ExternalLink, Grid, Heart, Play, Share2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

export function PropertyGallery({
  images,
  title,
  propertyId,
  showMatchPrompt = true,
  shareUrl,
  shareImageUrl,
  videoAction,
  pdfAction,
  rlvAction,
  ownerListingUrl,
  uploadedVideoUrl,
  uploadedVideoName,
}: {
  images: string[];
  title: string;
  propertyId: string;
  showMatchPrompt?: boolean;
  shareUrl?: string;
  shareImageUrl?: string;
  videoAction?: React.ReactNode;
  pdfAction?: React.ReactNode;
  rlvAction?: React.ReactNode;
  ownerListingUrl?: string | null;
  uploadedVideoUrl?: string | null;
  uploadedVideoName?: string | null;
}) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [isMobileGalleryOpen, setIsMobileGalleryOpen] = React.useState(false);
  const [isLoved, setIsLoved] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  const [isVideoOpen, setIsVideoOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const ownerListingHref = (() => {
    const value = ownerListingUrl?.trim();
    if (!value || (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value))) return null;
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : null;
    } catch {
      return null;
    }
  })();
  const financeCardClassName = "overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.2),transparent_28%),linear-gradient(135deg,rgba(7,18,12,0.96)_0%,rgba(10,10,12,0.98)_52%,rgba(16,24,18,0.96)_100%)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]";

  const handleShare = React.useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const resolvedShareUrl = shareUrl || window.location.href;
    const shareData: ShareData = {
      title,
      text: `Aceasta proprietate este acum disponibila si poate fi vizionata: ${title}`,
      url: resolvedShareUrl,
    };

    try {
      const firstImageUrl = shareImageUrl || images[0];
      if (firstImageUrl && navigator.share) {
        try {
          const response = await fetch(firstImageUrl, { cache: "no-store" });
          if (response.ok) {
            const blob = await response.blob();
            const fileExtension = blob.type.split("/")[1] || "jpg";
            const file = new File([blob], `proprietate-${propertyId}.${fileExtension}`, { type: blob.type || "image/jpeg" });
            const shareDataWithFile: ShareData = {
              files: [file],
              title,
              text: `${shareData.text}\n${resolvedShareUrl}`,
            };

            if (!navigator.canShare || navigator.canShare(shareDataWithFile)) {
              await navigator.share(shareDataWithFile);
              return;
            }
          }
        } catch (error) {
          console.error("Image share fallback failed:", error);
        }
      }

      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resolvedShareUrl);
        setIsCopied(true);
        window.setTimeout(() => setIsCopied(false), 1800);
      }
    } catch (error) {
      console.error("Share failed:", error);
    }
  }, [images, propertyId, shareImageUrl, shareUrl, title]);

  React.useEffect(() => {
    if (!api) return

    if (open) {
      setTimeout(() => {
        api.reInit()
        api.scrollTo(activeIndex, true) 
      }, 100) 
    }
  }, [open, api, activeIndex])

  if ((!images || images.length === 0) && !uploadedVideoUrl) {
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
        <div className="agentfinder-gallery-overlay absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </div>
    )
  }

  if ((!images || images.length === 0) && uploadedVideoUrl) {
    return (
      <>
        <button
          type="button"
          className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-slate-950"
          onClick={() => setIsVideoOpen(true)}
          aria-label="Redă videoclipul proprietății"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white shadow-xl backdrop-blur-md transition group-hover:scale-105 group-hover:bg-black/60">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </button>
        <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
          <DialogContent className="w-[min(94vw,1100px)] max-w-none border-white/10 bg-black p-2 text-white sm:rounded-3xl">
            <DialogTitle className="sr-only">{uploadedVideoName || `Video ${title}`}</DialogTitle>
            <DialogDescription className="sr-only">Videoclip încărcat pentru proprietatea {title}.</DialogDescription>
            <video src={uploadedVideoUrl} className="max-h-[84vh] w-full rounded-2xl bg-black object-contain" controls autoPlay playsInline />
          </DialogContent>
        </Dialog>
      </>
    );
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
        {uploadedVideoUrl ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Redă videoclipul proprietății"
            className={cn("absolute left-4 top-4 z-20 h-11 w-11 rounded-full border border-white/40 bg-black/38 text-white shadow-[0_14px_34px_-14px_rgba(0,0,0,0.75)] backdrop-blur-xl hover:scale-105 hover:bg-black/55 hover:text-white", rlvAction && "max-md:top-10", ownerListingHref && "max-md:left-20")}
            onClick={(event) => {
              event.stopPropagation();
              setIsVideoOpen(true);
            }}
          >
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </Button>
        ) : null}
        {ownerListingHref ? (
          <Button asChild variant="secondary" size="icon" className="absolute left-4 top-10 z-20 h-11 w-11 rounded-full border border-white/40 bg-white/12 text-white backdrop-blur-xl hover:bg-white/18 md:hidden">
            <a href={ownerListingHref} target="_blank" rel="noopener noreferrer" aria-label="Deschide anunțul proprietarului" title="Deschide anunțul proprietarului">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
        {rlvAction ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-4 top-10 z-20 h-11 w-11 rounded-full border border-white/40 bg-white/12 text-white backdrop-blur-xl hover:bg-white/18 hover:text-white md:hidden"
            aria-label={isCopied ? "Link copiat" : "Distribuie"}
            title={isCopied ? "Link copiat" : "Distribuie"}
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            <span className="sr-only" aria-live="polite">{isCopied ? "Link copiat" : "Distribuie"}</span>
          </Button>
        ) : null}
        {showMatchPrompt ? (
          <div className={cn("absolute top-4 z-10 flex items-center gap-3 rounded-full border border-white/20 bg-black/24 px-4 py-2 text-white shadow-[0_16px_38px_-18px_rgba(0,0,0,0.6)] backdrop-blur-xl", uploadedVideoUrl ? "left-16" : "left-4")}>
            <span className="whitespace-nowrap text-sm font-medium leading-none text-white/92">Aceasta proprietate ti se potriveste?</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-pressed={isLoved}
              aria-label={isLoved ? "Scoate de la favorite" : "Adauga la favorite"}
              className="h-9 w-9 rounded-full border border-[#22c55e] bg-white/8 text-white hover:bg-white/14 hover:text-white"
              onClick={() => setIsLoved((prev) => !prev)}
            >
              <Heart className={cn("h-4 w-4", isLoved && "fill-[#e50700] text-[#e50700]")} />
            </Button>
          </div>
        ) : null}
        <div className={cn("absolute bottom-4 right-2 z-10 flex max-w-[calc(100%-1rem)] flex-nowrap items-center justify-end gap-1 md:right-4 md:max-w-[calc(100%-2rem)] md:flex-wrap md:gap-2 max-md:[&>button]:shrink-0 max-md:[&>button]:gap-1 max-md:[&>button]:!px-2 max-md:[&>button]:text-xs", pdfAction && "max-md:left-2 max-[360px]:[&>button]:!px-1.5 max-[360px]:[&>button]:text-[11px] max-[360px]:[&>button]:gap-0.5")}>
          {rlvAction}
          {pdfAction}
          {videoAction}
          <Button
            variant="secondary"
            className={cn("w-10 rounded-full border border-white/30 bg-white/12 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] backdrop-blur-xl hover:bg-white/18 hover:text-white md:w-auto", rlvAction && "max-md:hidden")}
            aria-label={isCopied ? "Link copiat" : "Distribuie"}
            title={isCopied ? "Link copiat" : "Distribuie"}
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4 md:mr-2" />
            <span className="sr-only md:not-sr-only" aria-live="polite">{isCopied ? "Link copiat" : "Distribuie"}</span>
          </Button>
          <Button
            variant="secondary"
            className="rounded-full border border-white/30 bg-white/12 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] backdrop-blur-xl hover:bg-white/18 hover:text-white"
            onClick={() => handleOpenGallery(0)}
          >
            <Grid className="h-4 w-4 md:mr-2" />
            Vezi Fotografiile
          </Button>
        </div>
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

      {uploadedVideoUrl ? (
        <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
          <DialogContent className="w-[min(94vw,1100px)] max-w-none border-white/10 bg-black p-2 text-white sm:rounded-3xl">
            <DialogTitle className="sr-only">{uploadedVideoName || `Video ${title}`}</DialogTitle>
            <DialogDescription className="sr-only">Videoclip încărcat pentru proprietatea {title}.</DialogDescription>
            <video src={uploadedVideoUrl} className="max-h-[84vh] w-full rounded-2xl bg-black object-contain" controls autoPlay playsInline />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
