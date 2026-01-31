'use client';

import { useMemo } from 'react';
import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Property, Viewing, Contact, Task } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PropertyHeader } from '@/components/properties/detail/PropertyHeader';
import { PropertyTimeline } from '@/components/properties/detail/PropertyTimeline';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { AiPropertyInsights } from '@/components/properties/detail/AiPropertyInsights';
import { PropertyActionPanel } from '@/components/properties/detail/PropertyActionPanel';
import { properties as sampleProperties } from '@/lib/data';
import {
    BedDouble,
    Bath,
    Ruler,
    Building,
    CalendarDays,
    Layers,
    Thermometer,
    Car,
    Sparkles,
    CheckCircle2,
    Tag,
    HandCoins
} from "lucide-react";


const PageSkeleton = () => (
    <div className="p-4">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-64" />
            </div>
        </div>
        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-3 space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-64" />
            </div>
            <div className="xl:col-span-6 space-y-4">
                <Skeleton className="h-96" />
                <Skeleton className="h-56" />
            </div>
            <div className="xl:col-span-3 space-y-4">
                <Skeleton className="h-40" />
                <Skeleton className="h-48" />
                <Skeleton className="h-40" />
            </div>
        </div>
    </div>
)

const FeatureItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value?: string | number | null }) => {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted text-primary shrink-0">
                {icon}
            </div>
            <div>
                <p className="font-semibold text-card-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    );
};


export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    
    const { agencyId, isAgencyLoading: isContextLoading } = useAgency();
    const { user } = useUser();
    const { toast } = useToast();
    const firestore = useFirestore();

    const propertyDocRef = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
    }, [firestore, agencyId, propertyId]);

    // Data fetching - using static data as a fallback for now
    const { data: property, isLoading: isPropertyLoading, error: propertyError } = useMemo(() => {
        const prop = sampleProperties.find(p => p.id === propertyId);
        return { data: prop || null, isLoading: false, error: prop ? null : new Error('Property not found') };
    }, [propertyId]);

    const viewingsQuery = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'viewings'), where('propertyId', '==', propertyId));
    }, [firestore, agencyId, propertyId]);
    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'tasks'), where('propertyId', '==', propertyId));
    }, [firestore, agencyId, propertyId]);
    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    const allContactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: allContacts, isLoading: areContactsLoading } = useCollection<Contact>(allContactsQuery);
    
    const isLoading = isContextLoading || areViewingsLoading || areContactsLoading || isPropertyLoading || areTasksLoading;
    
    const onUpdateProperty = (data: Partial<Omit<Property, 'id'>>) => {
        if (!propertyDocRef) return;
        updateDocumentNonBlocking(propertyDocRef, data);
        toast({ title: 'Proprietate actualizată', description: 'Modificările au fost salvate.' });
    };
    
    const onAddTask = (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => {
        if (!agencyId || !user) return;
        const tasksCollection = collection(firestore, 'agencies', agencyId, 'tasks');
        const taskToAdd: Omit<Task, 'id'> = {
            ...taskData,
            status: 'open',
            agentId: user.uid,
            agentName: user.displayName || user.email,
        };
        addDocumentNonBlocking(tasksCollection, taskToAdd);
        toast({ title: "Task adăugat!" });
    };

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (propertyError || !property) {
        notFound();
        return null;
    }
    
    const ownerDetails = {
        name: property.agent?.name || 'Proprietar Nespecificat',
        phone: '0700 000 000', // Placeholder
        email: 'proprietar@email.com', // Placeholder
    };

    const matchedLeads = allContacts?.filter(c => c.budget && property && c.budget >= property.price * 0.8 && c.budget <= property.price * 1.2).slice(0, 3) || [];

    return (
        <div className="h-full">
            <PropertyHeader property={property} owner={ownerDetails} />

            <main className="p-4 md:p-6 lg:p-8 -mx-8">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    <div className="xl:col-span-3">
                        <PropertyTimeline property={property} viewings={viewings || []} tasks={tasks || []} onAddTask={onAddTask} />
                    </div>

                    <div className="xl:col-span-6 space-y-6">
                        <MediaColumn property={property} />
                        <AiPropertyInsights property={property} />
                        
                        <Card className="rounded-2xl">
                            <CardHeader><CardTitle>Caracteristici Esențiale</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <FeatureItem icon={<HandCoins />} label="Tip tranzacție" value={property.transactionType} />
                                <FeatureItem icon={<Building />} label="Tip proprietate" value={property.propertyType} />
                                <FeatureItem icon={<Ruler />} label="Suprafață utilă" value={`${property.squareFootage} mp`} />
                                {property.totalSurface && <FeatureItem icon={<Ruler />} label="Suprafață construită" value={`${property.totalSurface} mp`} />}
                                <FeatureItem icon={<BedDouble />} label="Dormitoare" value={property.bedrooms} />
                                <FeatureItem icon={<Bath />} label="Băi" value={property.bathrooms} />
                                <FeatureItem icon={<CalendarDays />} label="An construcție" value={property.constructionYear} />
                                <FeatureItem icon={<Layers />} label="Etaj" value={property.floor} />
                                <FeatureItem icon={<Sparkles />} label="Stare interior" value={property.interiorState} />
                                <FeatureItem icon={<Tag />} label="Confort" value={property.comfort} />
                                <FeatureItem icon={<Thermometer />} label="Sistem încălzire" value={property.heatingSystem} />
                                <FeatureItem icon={<Car />} label="Parcare" value={property.parking} />
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl">
                            <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
                            </CardContent>
                        </Card>
                        
                        {property.amenities && property.amenities.length > 0 && (
                            <Card className="rounded-2xl">
                                <CardHeader><CardTitle>Dotări și Facilități</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="columns-2 md:columns-3 gap-4 space-y-2">
                                        {property.amenities.map(amenity => (
                                            <div key={amenity} className="flex items-center gap-2 break-inside-avoid">
                                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                                <span className="text-sm">{amenity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card className="rounded-2xl">
                            <CardHeader><CardTitle>Locație pe Hartă</CardTitle></CardHeader>
                            <CardContent>
                                {(property.latitude && property.longitude) ? (
                                    <iframe
                                        className="w-full aspect-video rounded-md border"
                                        loading="lazy"
                                        allowFullScreen
                                        referrerPolicy="no-referrer-when-downgrade"
                                        src={`https://www.google.com/maps/embed/v1/place?key=&q=${encodeURIComponent(property.address)}`}>
                                    </iframe>
                                ) : (
                                    <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                                        <p className="text-sm text-muted-foreground">Adresa sau coordonatele nu sunt disponibile.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>

                    <div className="xl:col-span-3">
                         <PropertyActionPanel 
                            property={property} 
                            viewings={viewings || []}
                            matchedLeads={matchedLeads}
                            tasks={tasks || []}
                            onUpdateProperty={onUpdateProperty}
                         />
                    </div>
                </div>
            </main>
        </div>
    );
}
