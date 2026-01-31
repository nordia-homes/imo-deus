'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Property, Viewing } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { isThisMonth, isThisWeek, parseISO, format } from 'date-fns';
import { ro } from "date-fns/locale";
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { CalendarCheck, Handshake, Bookmark } from 'lucide-react';
import Link from 'next/link';

// Component to display a list of items on the dashboard
function DashboardInfoList({ items, emptyText, renderItem }: { items: any[], emptyText: string, renderItem: (item: any) => React.ReactNode }) {
    if (!items || items.length === 0) {
        return <p className="text-sm text-muted-foreground text-center p-4">{emptyText}</p>;
    }
    return <div className="space-y-3">{items.map(renderItem)}</div>;
}

export default function DashboardPage() {
    const { agencyId, isAgencyLoading } = useAgency();
    const firestore = useFirestore();

    // --- DATA FETCHING ---
    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);
    
    const viewingsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'viewings'), orderBy('viewingDate', 'asc'));
    }, [firestore, agencyId]);
    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

    // --- DATA CALCULATION ---
    const { soldThisMonth, reservedThisMonth, viewingsThisWeek } = useMemo(() => {
        
        const sold = properties?.filter(p => 
            p.status === 'Vândut' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))
        ) || [];

        const reserved = properties?.filter(p => 
            p.status === 'Rezervat' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))
        ) || [];
        
        const weekViewings = viewings?.filter(v => 
            v.status === 'scheduled' && isThisWeek(parseISO(v.viewingDate), { weekStartsOn: 1 })
        ) || [];

        return {
            soldThisMonth: sold,
            reservedThisMonth: reserved,
            viewingsThisWeek: weekViewings,
        };
    }, [properties, viewings]);
    
    const isLoading = isAgencyLoading || arePropertiesLoading || areViewingsLoading;
    
    // --- RENDER ---
    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48 mb-2" />
                <div className="grid gap-6 md:grid-cols-3">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
             <h1 className="text-3xl font-headline font-bold">Dashboard</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                <DashboardSection
                    title="Vizionări Săptămâna Aceasta"
                    icon={<CalendarCheck className="h-6 w-6 text-primary" />}
                    count={viewingsThisWeek.length}
                >
                    <DashboardInfoList
                        items={viewingsThisWeek}
                        emptyText="Nicio vizionare programată pentru această săptămână."
                        renderItem={(viewing: Viewing) => (
                             <Link href={`/viewings`} key={viewing.id} className="block p-3 rounded-md hover:bg-muted transition-colors">
                                <p className="font-semibold truncate">{viewing.propertyTitle}</p>
                                <p className="text-sm text-muted-foreground">{viewing.contactName}</p>
                                <p className="text-sm font-medium text-primary mt-1">
                                    {format(parseISO(viewing.viewingDate), 'eeee, d MMMM, HH:mm', { locale: ro })}
                                </p>
                            </Link>
                        )}
                    />
                </DashboardSection>

                <DashboardSection
                    title="Proprietăți Vândute Luna Aceasta"
                    icon={<Handshake className="h-6 w-6 text-green-600" />}
                    count={soldThisMonth.length}
                >
                     <DashboardInfoList
                        items={soldThisMonth}
                        emptyText="Nicio proprietate vândută luna aceasta."
                        renderItem={(prop: Property) => (
                             <Link href={`/properties/${prop.id}`} key={prop.id} className="block p-3 rounded-md hover:bg-muted transition-colors">
                                <p className="font-semibold truncate">{prop.title}</p>
                                <p className="text-sm text-muted-foreground">{prop.address}</p>
                                <p className="text-sm font-medium text-green-600 mt-1">€{prop.price.toLocaleString()}</p>
                            </Link>
                        )}
                    />
                </DashboardSection>

                 <DashboardSection
                    title="Proprietăți Rezervate Luna Aceasta"
                    icon={<Bookmark className="h-6 w-6 text-yellow-600" />}
                    count={reservedThisMonth.length}
                >
                     <DashboardInfoList
                        items={reservedThisMonth}
                        emptyText="Nicio proprietate rezervată luna aceasta."
                        renderItem={(prop: Property) => (
                            <Link href={`/properties/${prop.id}`} key={prop.id} className="block p-3 rounded-md hover:bg-muted transition-colors">
                                <p className="font-semibold truncate">{prop.title}</p>
                                <p className="text-sm text-muted-foreground">{prop.address}</p>
                                <p className="text-sm font-medium text-yellow-600 mt-1">€{prop.price.toLocaleString()}</p>
                           </Link>
                        )}
                    />
                </DashboardSection>
                
            </div>
        </div>
    );
}
