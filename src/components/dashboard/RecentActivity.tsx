'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';

function getStatusBadge(status: string) {
    switch (status) {
        case 'Trimis': return 'warning';
        case 'Semnat': return 'success';
        case 'Draft': return 'secondary';
        case 'Anulat': return 'destructive';
        default: return 'outline';
    }
}

export function RecentActivity() {
    const { user } = useUser();
    const firestore = useFirestore();

    const recentContractsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'users', user.uid, 'contracts'),
            orderBy('date', 'desc'),
            limit(5)
        );
    }, [firestore, user]);

    const { data: activities, isLoading } = useCollection<Contract>(recentContractsQuery);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Activitate Recentă (Contracte)</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Proprietate</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Preț</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : activities && activities.length > 0 ? activities.map(activity => (
                            <TableRow key={activity.id}>
                                <TableCell>
                                    <Link href={`/leads/${activity.contactId}`} className="hover:underline">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback>{activity.contactName?.charAt(0) || 'C'}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">{activity.contactName}</p>
                                            </div>
                                        </div>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                     <Link href={`/properties/${activity.propertyId}`} className="hover:underline">
                                        {activity.propertyTitle}
                                     </Link>
                                </TableCell>
                                <TableCell>{new Date(activity.date).toLocaleDateString('ro-RO')}</TableCell>
                                <TableCell>€{activity.price.toLocaleString()}</TableCell>
                                <TableCell><Badge variant={getStatusBadge(activity.status) as any}>{activity.status}</Badge></TableCell>
                            </TableRow>
                        )) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Nicio activitate recentă de afișat.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
