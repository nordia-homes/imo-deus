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
import type { Property } from "@/lib/types";

type DeletePropertyAlertProps = {
    property: Property | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete: () => void;
};

export function DeletePropertyAlert({ property, isOpen, onOpenChange, onDelete }: DeletePropertyAlertProps) {
  if (!property) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ești sigur?</AlertDialogTitle>
          <AlertDialogDescription>
            Această acțiune nu poate fi anulată. Proprietatea <span className="font-bold">"{property.title}"</span> va fi ștearsă definitiv.
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
