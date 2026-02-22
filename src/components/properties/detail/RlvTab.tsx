'use client';

import type { Property } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileText, ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface RlvTabProps {
  property: Property;
}

export function RlvTab({ property }: RlvTabProps) {
  const isImage = property.rlvUrl && /\.(jpg|jpeg|png|webp|gif)$/i.test(property.rlvUrl);

  return (
    <div className="text-center text-card-foreground dark:text-white">
      {property.rlvUrl ? (
        <div className="space-y-4">
           <div className="p-4 border rounded-lg bg-muted dark:bg-white/5 dark:border-white/10 flex flex-col items-center justify-center">
              {isImage ? (
                   <div className="relative w-full aspect-video">
                      <Image src={property.rlvUrl} alt="Releveu" fill sizes="(max-width: 768px) 100vw, 768px" className="rounded-md object-contain" />
                   </div>
              ) : (
                  <FileText className="h-16 w-16 text-primary mb-4" />
              )}
              <h3 className="font-semibold mt-4">Releveul este disponibil.</h3>
           </div>
           <Button asChild>
              <a href={property.rlvUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Descarcă / Vizualizează
              </a>
          </Button>
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed rounded-lg border-muted-foreground/30 dark:border-white/20">
          <ImageIcon className="h-16 w-16 text-muted-foreground/70 dark:text-white/70 mx-auto mb-4" />
          <p className="text-muted-foreground dark:text-white/70 mb-4">Niciun releveu încărcat pentru această proprietate.</p>
        </div>
      )}
    </div>
  );
}
