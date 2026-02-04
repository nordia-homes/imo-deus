'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Contact } from "@/lib/types";
import { useState, useEffect } from "react";

type LeadDescriptionCardProps = {
    contact: Contact;
    onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
}

export function LeadDescriptionCard({ contact, onUpdateContact }: LeadDescriptionCardProps) {
    const [description, setDescription] = useState(contact.description || '');

    useEffect(() => {
        setDescription(contact.description || '');
    }, [contact]);

    const handleBlur = () => {
        if (description !== (contact.description || '')) {
            onUpdateContact({ description });
        }
    };

    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader>
                <CardTitle>Descriere Lead</CardTitle>
            </CardHeader>
            <CardContent>
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Adaugă o descriere detaliată a lead-ului, preferințe, cerințe speciale, etc."
                    className="h-48 text-sm"
                />
            </CardContent>
        </Card>
    );
}
