'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Viewing } from "@/lib/types";

type DeleteViewingAlertProps = {
    viewing: Viewing | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete: () => void;
};

export function DeleteViewingAlert({ viewing, isOpen, onOpenChange, onDelete }: DeleteViewingAlertProps) {
  if (!viewing) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ești sigur?</AlertDialogTitle>
          <AlertDialogDescription>
            Această acțiune nu poate fi anulată. Vizionarea pentru <span className="font-bold">"{viewing.propertyTitle}"</span> cu <span className="font-bold">{viewing.contactName}</span> va fi ștearsă definitiv.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anulează</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Continuă</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
