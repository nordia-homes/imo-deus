
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Contact } from "@/lib/types";
import { useState, useEffect, useRef } from "react";
import { FileText } from 'lucide-react';

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
        <Card className="mx-2 bg-[#152A47] text-white border-none rounded-2xl lg:mx-0 lg:bg-card lg:text-card-foreground lg:shadow-2xl">
             <CardHeader className="p-4 pb-2 lg:p-6 lg:pb-4">
                <CardTitle className="flex items-center gap-2 text-white lg:text-card-foreground text-base">
                    <FileText className="h-5 w-5" />
                    <span>Descriere</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6 lg:pt-0">
                <Textarea
                    ref={textareaRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Adaugă o descriere detaliată a cumpărătorului, preferințe, cerințe speciale, etc."
                    className="text-sm resize-none overflow-hidden bg-white/10 lg:bg-background border-white/20 lg:border-input text-white lg:text-inherit"
                    rows={4}
                />
            </CardContent>
        </Card>
    );
}
