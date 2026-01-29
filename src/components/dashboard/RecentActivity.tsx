'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { FileSignature } from 'lucide-react';

export function RecentActivity() {
    const { user } = useUser();
    const firestore = useFirestore();

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
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                ) : contracts && contracts.length > 0 ? (
                    <div className="space-y-4">
                        {contracts.map((contract) => (
                           <Link href="/contracts" key={contract.id} className="flex items-center gap-4 group p-2 -m-2 rounded-md hover:bg-accent">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                    <FileSignature className="h-5 w-5 text-purple-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-sm group-hover:text-primary transition-colors">Contract nou semnat pentru {contract.propertyTitle || 'proprietate'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(contract.date).toLocaleString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
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
