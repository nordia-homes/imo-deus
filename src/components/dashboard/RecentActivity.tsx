'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';

export function RecentActivity() {
    const { user } = useUser();
    const firestore = useFirestore();

    // Query for recent contracts, ordered by date
    const contractsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'contracts'), orderBy('date', 'desc'), limit(5));
    }, [firestore, user]);

    const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Activitate Recentă</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Proprietate</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Data</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : contracts && contracts.length > 0 ? contracts.map((contract) => (
                            <TableRow key={contract.id}>
                                <TableCell className="font-medium">
                                    <Link href={`/properties/${contract.propertyId}`} className="hover:underline">
                                        {contract.propertyTitle}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Link href={`/leads/${contract.contactId}`} className="hover:underline">
                                        {contract.contactName}
                                    </Link>
                                </TableCell>
                                <TableCell><Badge variant={contract.status === 'Semnat' ? 'success' : 'secondary'}>{contract.status}</Badge></TableCell>
                                <TableCell className="text-right">{new Date(contract.date).toLocaleDateString('ro-RO')}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
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
