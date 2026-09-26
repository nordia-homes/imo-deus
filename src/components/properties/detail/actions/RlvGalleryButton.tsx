'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Property } from '@/lib/types';
import { RlvTab } from '../RlvTab';

export function RlvGalleryButton({ property }: { property: Property }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" className="h-11 w-14 rounded-full border border-white/40 bg-white/12 text-white backdrop-blur-xl hover:bg-white/18 hover:text-white" aria-label="Deschide releveul proprietății">
          RLV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl p-4">
        <DialogHeader className="pr-6">
          <DialogTitle>Releveul proprietății</DialogTitle>
          <DialogDescription>Vizualizează, încarcă sau înlocuiește fișierul RLV.</DialogDescription>
        </DialogHeader>
        <RlvTab property={property} showPdfPreview />
      </DialogContent>
    </Dialog>
  );
}
