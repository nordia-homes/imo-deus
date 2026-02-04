'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Contact } from "@/lib/types";
import { useState, useEffect, useRef } from "react";

type LeadDescriptionCardProps = {
    contact: Contact;
    onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
}

export function LeadDescriptionCard({ contact, onUpdateContact }: LeadDescriptionCardProps) {
    const [description, setDescription] = useState(contact.description || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setDescription(contact.description || '');
    }, [contact]);

    const handleBlur = () => {
        if (description !== (contact.description || '')) {
            onUpdateContact({ description });
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Temporarily shrink to get the correct scrollHeight
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [description]);


    return (
        <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
                <Textarea
                    ref={textareaRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Adaugă o descriere detaliată a lead-ului, preferințe, cerințe speciale, etc."
                    className="text-sm resize-none overflow-hidden"
                    rows={4}
                />
            </CardContent>
        </Card>
    );
}
