
import { ContactDetailsClient } from "@/components/contacts/contact-details-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { properties } from "@/lib/data"; // Using placeholder properties
import type { Contact, Property } from '@/lib/types';
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Euro, User, Calendar, Info } from "lucide-react";

// Placeholder for fetching a single contact
const getContactById = async (id: string): Promise<Contact | null> => {
    const contacts: Contact[] = [
        { 
            id: '1', name: 'Alex Popescu', phone: '0722 123 456', email: 'alex.p@email.com', source: 'Website', budget: 150000, status: 'Contactat', 
            notes: 'Caută apartament cu 3 camere în zona de nord, preferabil aproape de parc. Are un copil mic, deci o școală bună în apropiere este un plus. Buget flexibil dacă proprietatea este excepțională.',
            interactionHistory: [
                {id: 'h1', type: 'Apel telefonic', date: '15.05.2024', notes: 'Discuție inițială, am stabilit preferințele generale.'},
                {id: 'h2', type: 'Email', date: '16.05.2024', notes: 'I-am trimis 3 proprietăți care se potrivesc.'}
            ],
            preferences: {
                desiredPriceRangeMin: 120000, desiredPriceRangeMax: 180000, desiredBedrooms: 3, desiredBathrooms: 2, 
                desiredSquareFootageMin: 70, desiredSquareFootageMax: 90, desiredFeatures: 'parc apropiat, etaj intermediar, balcon', locationPreferences: 'București, zona de nord'
            }
        },
    ];
    return contacts.find(c => c.id === id) || null;
}

export default async function LeadDetailPage({ params }: { params: { leadId: string } }) {
    const contact = await getContactById(params.leadId);

    if (!contact) {
        return <div>Lead not found</div>;
    }
    
    // Convert property format for the property matcher
    const matcherProperties: (Property & { image: string })[] = properties.map(p => ({
        ...p,
        image: p.images[0]?.url || '',
        imageUrl: p.images[0]?.url || '',
        imageHint: '',
    }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader className="text-center items-center">
                        <Avatar className="h-24 w-24 text-3xl">
                            <AvatarFallback>{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <h1 className="text-2xl font-bold">{contact.name}</h1>
                        <Badge variant="outline">{contact.status}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                         <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{contact.phone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{contact.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Euro className="h-4 w-4 text-muted-foreground" />
                            <span>Buget: €{contact.budget.toLocaleString()}</span>
                        </div>
                         <div className="flex items-center gap-3">
                            <Info className="h-4 w-4 text-muted-foreground" />
                            <span>Sursa: {contact.source}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <ContactDetailsClient contact={contact} properties={matcherProperties} />
            </div>
        </div>
    );
}
