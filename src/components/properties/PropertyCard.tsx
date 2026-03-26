'use client';
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Heart, BedDouble, Bath, Ruler, MoreHorizontal, Edit, Trash2, Calendar, Link as LinkIcon, Check } from "lucide-react";
import type { Property } from "@/lib/types";
import { Card, CardContent } from "../ui/card";
import { AddPropertyDialog } from "./add-property-dialog";
import { Button } from "../ui/button";
import { useState } from "react";
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
  onDeleteRequest,
}: {
  property: Property;
  agencyId?: string;
  onDeleteRequest?: () => void;
}) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const isMobile = useIsMobile();
  const { agencyId: dashboardAgencyId } = useAgency();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const isPublicCard = Boolean(agencyId);
  
  const href = agencyId
    ? `/agencies/${agencyId}/properties/${property.id}`
    : `/properties/${property.id}`;
    
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

  return (
    <>
      <Card className={cn(
        "group overflow-hidden rounded-[1.75rem] transition-all duration-300 hover:-translate-y-1",
        isPublicCard
          ? "border border-slate-200/80 bg-white text-slate-900 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)] hover:shadow-[0_30px_80px_-34px_rgba(15,23,42,0.32)]"
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
               <Badge variant="outline" className={cn("font-semibold", isPublicCard ? "border-white/80 bg-white/85 text-slate-900" : "bg-white/90 text-black")}>{property.transactionType}</Badge>
            </div>
            <Button
              size="icon"
              variant="secondary"
              className={cn("absolute top-3 right-3 h-8 w-8 rounded-full backdrop-blur-sm", isPublicCard ? "bg-white/80 text-slate-700 hover:bg-white" : "bg-black/30 text-white hover:bg-black/50")}
              onClick={() => setIsFavorite(!isFavorite)}
            >
              <Heart className={cn("h-4 w-4", isFavorite && "fill-red-500 text-red-500")} />
            </Button>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <Link href={href} className="flex-1 min-w-0">
                <h3 className={cn("truncate font-semibold transition-colors", isPublicCard ? "text-slate-950 group-hover:text-primary" : "text-white group-hover:text-primary/90")} title={property.title}>{property.title}</h3>
                <p className={cn("truncate text-sm", isPublicCard ? "text-slate-500" : "text-white/70")} title={property.address}>{property.address}</p>
              </Link>
            </div>
            
            <div className={cn("flex flex-wrap items-center gap-4 text-sm", isPublicCard ? "text-slate-500" : "text-white/70")}>
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
                    <span>{property.squareFootage} mp</span>
                </div>
                {property.constructionYear && (
                  <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4"/>
                      <span>{property.constructionYear}</span>
                  </div>
                )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className={cn("text-xl font-bold", isPublicCard ? "text-slate-950" : "text-white")}>
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
                <Button asChild size="sm" variant="outline" className="rounded-full border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">
                    <Link href={href}>Vezi Detalii</Link>
                </Button>
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
