'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPinned, NotebookPen, Percent } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { OwnerListingFavorite } from '@/components/owner-listings/types';

type OwnerListingFavoriteEditorProps = {
  favorite: OwnerListingFavorite;
  onSave: (updates: Partial<OwnerListingFavorite>) => void;
};

export function OwnerListingFavoriteEditor({ favorite, onSave }: OwnerListingFavoriteEditorProps) {
  const [propertyAddress, setPropertyAddress] = useState(favorite.propertyAddress ?? '');
  const [commissionValue, setCommissionValue] = useState(favorite.commissionValue ?? '');
  const [notes, setNotes] = useState(favorite.notes ?? '');

  useEffect(() => {
    setPropertyAddress(favorite.propertyAddress ?? '');
    setCommissionValue(favorite.commissionValue ?? '');
    setNotes(favorite.notes ?? '');
  }, [favorite.commissionValue, favorite.notes, favorite.propertyAddress]);

  const currentValues = useMemo(
    () => ({
      propertyAddress,
      commissionValue,
      notes,
    }),
    [commissionValue, notes, propertyAddress],
  );

  const commitChanges = () => {
    const updates: Partial<OwnerListingFavorite> = {};

    if (currentValues.propertyAddress !== (favorite.propertyAddress ?? '')) {
      updates.propertyAddress = currentValues.propertyAddress;
    }

    if (currentValues.commissionValue !== (favorite.commissionValue ?? '')) {
      updates.commissionValue = currentValues.commissionValue;
    }

    if (currentValues.notes !== (favorite.notes ?? '')) {
      updates.notes = currentValues.notes;
    }

    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-slate-300 bg-white p-4 text-slate-900 shadow-[0_24px_52px_-34px_rgba(15,23,42,0.36)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-slate-950">Detalii de contact intern</p>
          <p className="text-sm text-slate-600">Completeaza contextul util pentru apel si pastreaza-l pe anunt.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-2 rounded-[1.2rem] border border-slate-300 bg-slate-50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <Label className="flex items-center gap-2 text-[15px] font-medium text-slate-700">
            <MapPinned className="h-4 w-4" />
            Adresa proprietatii
          </Label>
          <Input
            value={propertyAddress}
            onChange={(event) => setPropertyAddress(event.target.value)}
            onBlur={commitChanges}
            placeholder="Ex: Str. Nerva Traian nr. 12"
            className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-500"
          />
        </div>

        <div className="space-y-2 rounded-[1.2rem] border border-slate-300 bg-slate-50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <Label className="flex items-center gap-2 text-[15px] font-medium text-slate-700">
            <Percent className="h-4 w-4" />
            Comision
          </Label>
          <Input
            value={commissionValue}
            onChange={(event) => setCommissionValue(event.target.value)}
            onBlur={commitChanges}
            placeholder="Ex: 2% + TVA"
            className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-[1.2rem] border border-slate-300 bg-slate-50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <Label className="flex items-center gap-2 text-[15px] font-medium text-slate-700">
          <NotebookPen className="h-4 w-4" />
          Notite
        </Label>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={commitChanges}
          rows={4}
          placeholder="Ex: Proprietarul raspunde dupa 18:00, cere feedback dupa prima discutie, accepta colaborare doar exclusiv..."
          className="min-h-[120px] resize-none border-slate-300 bg-white text-slate-900 placeholder:text-slate-500"
        />
      </div>
    </div>
  );
}
