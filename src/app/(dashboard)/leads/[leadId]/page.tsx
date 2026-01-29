'use client';

import { useParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

import { ContactDetailsClient } from "@/components/contacts/contact-details-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { properties } from "@/lib/data"; // Using placeholder properties
import type { Contact, Property } from '@/lib/types';
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Euro, Info } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';

export default function LeadDetailPage() {
    const params = useParams();
    const leadId = params.leadId as string;
    
    const { user } = useUser();
    const firestore = useFirestore();

    const contactDocRef = useMemoFirebase(() => {
        if (!user || !leadId) return null;
        return doc(firestore, 'users', user.uid, 'contacts', leadId);
    }, [firestore, user, leadId]);

    const { data: contact, isLoading, error } = useDoc<Contact>(contactDocRef);

    if (isLoading) {
        return (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader className="text-center items-center">
                            <Skeleton className="h-24 w-24 rounded-full" />
                            <Skeleton className="h-8 w-48 mt-4" />
                            <Skeleton className="h-6 w-24 mt-2" />
                        </CardHeader>
                        <CardContent className="space-y-4 p-6">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                        </CardContent>
                    </Card>
                </div>
                 <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                             <Skeleton className="h-10 w-full" />
                        </CardHeader>
                        <CardContent className="p-6">
                            <Skeleton className="h-96 w-full" />
                        </CardContent>
                    </Card>
                 </div>
            </div>
        );
    }

    if (error) {
        console.error(error);
        return <div className="text-center text-red-500">Error loading lead. You may not have permission to view it.</div>;
    }

    if (!contact) {
        return <div className="text-center text-muted-foreground">Lead not found</div>;
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
                            <span>Buget: €{contact.budget?.toLocaleString()}</span>
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
