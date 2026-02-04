'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contact } from "@/lib/types";

type LeadDescriptionCardProps = {
    contact: Contact;
}

export function LeadDescriptionCard({ contact }: LeadDescriptionCardProps) {
    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader>
                <CardTitle>Descriere Lead</CardTitle>
            </CardHeader>
            <CardContent>
                {contact.description ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.description}</p>
                ) : (
                    <p className="text-sm text-muted-foreground">Nicio descriere adăugată.</p>
                )}
            </CardContent>
        </Card>
    );
}
