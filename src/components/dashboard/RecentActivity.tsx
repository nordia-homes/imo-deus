
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { Contact, Property } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { UserPlus, Building2 } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

type ActivityItem = {
    id: string;
    type: 'contact' | 'property';
    date: string;
    title: string;
    href: string;
};

const ActivityIcon = ({ type }: { type: ActivityItem['type'] }) => {
    switch (type) {
        case 'contact':
            return <UserPlus className="h-5 w-5 text-blue-500" />;
        case 'property':
            return <Building2 className="h-5 w-5 text-green-500" />;
        default:
            return null;
    }
};

export function RecentActivity() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const newContactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'contacts'), orderBy('createdAt', 'desc'), limit(5));
    }, [firestore, agencyId]);
    const { data: newContacts, isLoading: contactsLoading } = useCollection<Contact>(newContactsQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'properties'), orderBy('createdAt', 'desc'), limit(5));
    }, [firestore, agencyId]);
    const { data: properties, isLoading: propertiesLoading } = useCollection<Property>(propertiesQuery);
    
    const isLoading = contactsLoading || propertiesLoading;

    const combinedActivity = useMemo(() => {
        const activity: ActivityItem[] = [];
        
        newContacts?.forEach(c => activity.push({
            id: c.id,
            type: 'contact',
            date: c.createdAt || new Date().toISOString(),
            title: `Lead nou: ${c.name}`,
            href: `/leads/${c.id}`
        }));

        properties?.forEach(p => activity.push({
            id: p.id,
            type: 'property',
            date: p.createdAt || new Date().toISOString(),
            title: `Proprietate nouă: ${p.title}`,
            href: `/properties/${p.id}`
        }));

        return activity
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 7); // Show the 7 most recent activities overall
    }, [newContacts, properties]);

    return (
        <Card className="shadow-2xl rounded-2xl bg-muted/50 md:bg-card border-none">
            <CardHeader className="rounded-t-2xl bg-[#152a47] p-3 text-white md:rounded-none md:bg-transparent md:p-6 md:text-card-foreground">
                <CardTitle className="text-base font-semibold">Activitate Recentă</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                ) : combinedActivity.length > 0 ? (
                    <div className="space-y-4">
                        {combinedActivity.map((item) => (
                           <Link href={item.href} key={`${item.type}-${item.id}`} className="flex items-center gap-4 group p-2 -m-2 rounded-md hover:bg-accent">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                    <ActivityIcon type={item.type} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{item.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(item.date).toLocaleString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                    </p>
                                </div>
                           </Link>
                        ))}
                    </div>
                ) : (
                    <div className="h-24 flex items-center justify-center text-muted-foreground">
                        Nicio activitate recentă de afișat.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
