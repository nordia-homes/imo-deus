'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Property } from "@/lib/types";
import { useState, useEffect, useRef } from "react";
import { useAgency } from "@/context/AgencyContext";
import { useFirestore, updateDocumentNonBlocking } from "@/firebase";
import { doc } from 'firebase/firestore';
import { StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ACTION_CARD_CLASSNAME, ACTION_INPUT_CLASSNAME } from "./cardStyles";

type PropertyNotesCardProps = {
    property: Property;
    fillAvailableHeight?: boolean;
}

export function PropertyNotesCard({ property, fillAvailableHeight = false }: PropertyNotesCardProps) {
    const [notes, setNotes] = useState(property.notes || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();
    const isMobile = useIsMobile();

    useEffect(() => {
        setNotes(property.notes || '');
    }, [property]);

    const handleBlur = () => {
        if (!agencyId) return;
        if (notes !== (property.notes || '')) {
            const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
            updateDocumentNonBlocking(propertyRef, { notes });
            toast({ title: 'Notițe salvate!' });
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            if (fillAvailableHeight) {
                textarea.style.height = '100%';
                return;
            }
            textarea.style.height = 'auto'; // Temporarily shrink to get the correct scrollHeight
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [fillAvailableHeight, notes]);


    return (
        <Card className={cn(ACTION_CARD_CLASSNAME, fillAvailableHeight && "flex h-full min-h-[220px] flex-col")}>
            <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    Notițe Interne
                </CardTitle>
            </CardHeader>
            <CardContent className={cn("p-3 pt-0", fillAvailableHeight && "flex min-h-0 flex-1")}>
                <Textarea
                    ref={textareaRef}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Adaugă notițe despre proprietar, vizite tehnice, etc."
                    className={cn(
                        "min-h-[112px] resize-none overflow-hidden text-sm",
                        fillAvailableHeight && "h-full flex-1",
                        ACTION_INPUT_CLASSNAME
                    )}
                    rows={4}
                />
            </CardContent>
        </Card>
    );
}
