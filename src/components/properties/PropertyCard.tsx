'use client';
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Heart, BedDouble, Bath, Ruler, Edit, Trash2, Calendar, Link as LinkIcon, Check, Share2, ArrowRight } from "lucide-react";
import type { Property } from "@/lib/types";
import { Card, CardContent } from "../ui/card";
import { AddPropertyDialog } from "./add-property-dialog";
import { Button } from "../ui/button";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAgency } from "@/context/AgencyContext";
import { useToast } from "@/hooks/use-toast";

export function PropertyCard({
  property,
  agencyId,
  publicBasePath,
  onDeleteRequest,
}: {
  property: Property;
  agencyId?: string;
  publicBasePath?: string;
  onDeleteRequest?: () => void;
}) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const isMobile = useIsMobile();
  const displaySurface = property.totalSurface ?? property.squareFootage;
  const { agencyId: dashboardAgencyId } = useAgency();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const isPublicCard = Boolean(agencyId);
  const normalizedPublicBasePath =
    publicBasePath && publicBasePath !== '/'
      ? publicBasePath.endsWith('/')
        ? publicBasePath.slice(0, -1)
      : publicBasePath
      : '';
  
  const href = agencyId
    ? publicBasePath !== undefined
      ? `${normalizedPublicBasePath}/properties/${property.id}` || `/properties/${property.id}`
      : `/agencies/${agencyId}/properties/${property.id}`
    : `/properties/${property.id}`;
  const shareImageUrl = agencyId
    ? `/api/public-property-image?agencyId=${encodeURIComponent(agencyId)}&propertyId=${encodeURIComponent(property.id)}`
    : undefined;
    
  const primaryImageUrl = property.images?.[0]?.url || 'https://via.placeholder.com/800x500.png?text=Imagine+lipsa';

  const handleCopyLink = () => {
    if (!dashboardAgencyId) {
        toast({
            variant: "destructive",
            title: "Eroare",
            description: "ID-ul agenției nu a fost găsit."
        });
        return;
    }
    const url = `${window.location.origin}/agencies/${dashboardAgencyId}/properties/${property.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link copiat!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined" || !agencyId) return;

    const absoluteUrl = new URL(href, window.location.origin).toString();
    const shareData: ShareData = {
      title: property.title,
      text: `Aceasta proprietate este acum disponibila si poate fi vizionata: ${property.title}`,
      url: absoluteUrl,
    };

    try {
      if (navigator.share) {
        try {
          if (shareImageUrl) {
            const imageResponse = await fetch(shareImageUrl, { cache: 'no-store' });
            if (imageResponse.ok) {
              const blob = await imageResponse.blob();
              const fileExtension = blob.type.split('/')[1] || 'jpg';
              const file = new File([blob], `proprietate-${property.id}.${fileExtension}`, {
                type: blob.type || 'image/jpeg',
              });
              const shareDataWithFile: ShareData = {
                files: [file],
                title: property.title,
                text: `${shareData.text}\n${absoluteUrl}`,
              };

              if (!navigator.canShare || navigator.canShare(shareDataWithFile)) {
                await navigator.share(shareDataWithFile);
                return;
              }
            }
          }
        } catch (error) {
          console.error('Public property card image share failed:', error);
        }

        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        toast({ title: "Link copiat!" });
      }
    } catch (error) {
      console.error('Public property card share failed:', error);
    }
  }, [agencyId, href, property.id, property.title, shareImageUrl, toast]);

  return (
    <>
      <Card className={cn(
        "group overflow-hidden rounded-[1.75rem] transition-all duration-300 hover:-translate-y-1",
        isPublicCard
          ? "border border-white/10 bg-[#0f1013] text-stone-100 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.72)] hover:shadow-[0_30px_80px_-34px_rgba(0,0,0,0.85)]"
          : "border-none bg-[#152A47] text-white shadow-2xl hover:shadow-xl"
      )}>
        <CardContent className="p-0">
          <div className="relative">
            <Link href={href} className="block aspect-[16/10] relative overflow-hidden rounded-t-[1.75rem]">
              <Image
                src={primaryImageUrl}
                alt={property.title || 'Proprietate'}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </Link>
            <div className="absolute top-3 left-3">
               <Badge variant="outline" className={cn("font-semibold", isPublicCard ? "border-[#22c55e]/25 bg-black/55 text-[#86efac]" : "bg-white/90 text-black")}>{property.transactionType}</Badge>
            </div>
            <Button
              size="icon"
              variant="secondary"
              className={cn("absolute top-3 right-3 h-8 w-8 rounded-full backdrop-blur-sm", isPublicCard ? "bg-black/45 text-stone-100 hover:bg-black/70" : "bg-black/30 text-white hover:bg-black/50")}
              onClick={() => setIsFavorite(!isFavorite)}
            >
              <Heart className={cn("h-4 w-4", isFavorite && "fill-red-500 text-red-500")} />
            </Button>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <Link href={href} className="flex-1 min-w-0">
                <h3 className={cn("truncate font-semibold transition-colors", isPublicCard ? "text-stone-100 group-hover:text-[#86efac]" : "text-white group-hover:text-primary/90")} title={property.title}>{property.title}</h3>
                <p className={cn("truncate text-sm", isPublicCard ? "text-stone-400" : "text-white/70")} title={property.address}>{property.address}</p>
              </Link>
            </div>
            
            <div className={cn("flex flex-wrap items-center gap-4 text-sm", isPublicCard ? "text-stone-400" : "text-white/70")}>
                <div className="flex items-center gap-1.5">
                    <BedDouble className="h-4 w-4"/>
                    <span>{property.rooms}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Bath className="h-4 w-4"/>
                    <span>{property.bathrooms}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Ruler className="h-4 w-4"/>
                    <span>{displaySurface} mp</span>
                </div>
                {property.constructionYear && (
                  <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4"/>
                      <span>{property.constructionYear}</span>
                  </div>
                )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className={cn("text-xl font-bold", isPublicCard ? "text-[#4ade80]" : "text-white")}>
                €{property.price.toLocaleString()}
              </p>
              {!agencyId ? (
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:bg-white/10" onClick={handleCopyLink}>
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <LinkIcon className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:bg-white/10" onClick={() => setIsEditDialogOpen(true)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/20 hover:text-destructive" onClick={onDeleteRequest}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button asChild size="sm" variant="outline" className="bg-white/10 border-primary/50 text-white hover:bg-primary/10 button-glow">
                        <Link href={href}>Vezi Detalii</Link>
                    </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Distribuie proprietatea"
                    aria-label="Distribuie proprietatea"
                    onClick={handleShare}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-stone-100 transition-colors hover:bg-white/[0.12] hover:text-white"
                  >
                    <Share2 className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                  <Button asChild size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-stone-100 hover:bg-white/[0.08]">
                      <Link href={href} className="inline-flex items-center gap-2">
                        Vezi Detalii
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {!agencyId && (
        <AddPropertyDialog 
          property={property}
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}
    </>
  );
}
