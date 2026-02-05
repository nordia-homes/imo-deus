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

type PropertyNotesCardProps = {
    property: Property;
}

export function PropertyNotesCard({ property }: PropertyNotesCardProps) {
    const [notes, setNotes] = useState(property.notes || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();

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
            textarea.style.height = 'auto'; // Temporarily shrink to get the correct scrollHeight
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [notes]);


    return (
        <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9]">
            <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    Notițe Interne
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <Textarea
                    ref={textareaRef}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Adaugă notițe despre proprietar, vizite tehnice, etc."
                    className="text-sm resize-none overflow-hidden bg-background"
                    rows={4}
                />
            </CardContent>
        </Card>
    );
}
