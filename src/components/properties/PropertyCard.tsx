'use client';
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Heart, BedDouble, Bath, Ruler, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import type { Property } from "@/lib/types";
import { Card, CardContent } from "../ui/card";
import { AddPropertyDialog } from "./add-property-dialog";
import { Button } from "../ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PropertyCard({ property, agencyId }: { property: Property; agencyId?: string }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  
  const href = agencyId
    ? `/agencies/${agencyId}/properties/${property.id}`
    : `/properties/${property.id}`;
    
  const primaryImageUrl = property.images?.[0]?.url || 'https://via.placeholder.com/800x500.png?text=Imagine+lipsa';

  const isNew = property.createdAt && new Date(property.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  let statusBadge;
  if (isNew) {
      statusBadge = <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Nou</Badge>
  } else {
      statusBadge = <Badge variant="outline" className="bg-white">{property.transactionType}</Badge>
  }

  return (
    <>
      <Card className="group overflow-hidden rounded-2xl shadow-2xl hover:shadow-xl transition-all duration-300 bg-card">
        <CardContent className="p-0">
          <div className="relative">
            <Link href={href} className="block aspect-[16/10] relative overflow-hidden rounded-t-2xl">
              <Image
                src={primaryImageUrl}
                alt={property.title || 'Proprietate'}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </Link>
            <div className="absolute top-3 left-3">
              {statusBadge}
            </div>
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm hover:bg-background"
              onClick={() => setIsFavorite(!isFavorite)}
            >
              <Heart className={cn("h-4 w-4 text-slate-600", isFavorite && "fill-red-500 text-red-500")} />
            </Button>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <Link href={href} className="flex-1">
                <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{property.title}</h3>
                <p className="text-sm text-muted-foreground">{property.location}</p>
              </Link>
               {!agencyId && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editează
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Șterge
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
               )}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className="font-bold text-xl text-foreground">
                €{property.price.toLocaleString()}
              </p>
              {!agencyId ? (
                <Button asChild size="sm">
                    <Link href={href}>Vezi Detalii</Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="rounded-full">
                    <Link href={href}>Vezi</Link>
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
