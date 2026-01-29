'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Contract, Contact, Property, Task } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { useMemo } from 'react';
import { Building, UserPlus, CheckCircle, FileText } from 'lucide-react';

export function RecentActivity() {
    const { user } = useUser();
    const firestore = useFirestore();

    const contractsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'contracts'), orderBy('date', 'desc'), limit(5));
    }, [firestore, user]);
    const { data: contracts, isLoading: contractsLoading } = useCollection<Contract>(contractsQuery);

    const newLeadsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'contacts'), orderBy('createdAt', 'desc'), limit(5));
    }, [firestore, user]);
    const { data: newLeads, isLoading: newLeadsLoading } = useCollection<Contact>(newLeadsQuery);
    
    const newPropertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'properties'), orderBy('createdAt', 'desc'), limit(5));
    }, [firestore, user]);
    const { data: newProperties, isLoading: newPropertiesLoading } = useCollection<Property>(newPropertiesQuery);
    
    const completedTasksQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'tasks'), where('status', '==', 'completed'), orderBy('dueDate', 'desc'), limit(5));
    }, [firestore, user]);
    const { data: completedTasks, isLoading: completedTasksLoading } = useCollection<Task>(completedTasksQuery);

    const combinedActivities = useMemo(() => {
        const activities: any[] = [];
        if (contracts) activities.push(...contracts.map(c => ({ ...c, type: 'contract', timestamp: c.date })));
        if (newLeads) activities.push(...newLeads.map(c => ({ ...c, type: 'contact', timestamp: c.createdAt })));
        if (newProperties) activities.push(...newProperties.map(p => ({ ...p, type: 'property', timestamp: p.createdAt })));
        if (completedTasks) activities.push(...completedTasks.map(t => ({ ...t, type: 'task', timestamp: t.dueDate })));
        
        return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 7);

    }, [contracts, newLeads, newProperties, completedTasks]);

    const isLoading = contractsLoading || newLeadsLoading || newPropertiesLoading || completedTasksLoading;

    const renderActivityRow = (activity: any) => {
        if (!activity.timestamp) return null;
        const date = new Date(activity.timestamp).toLocaleDateString('ro-RO');

        switch(activity.type) {
            case 'contract':
                return (
                    <TableRow key={`contract-${activity.id}`}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="font-medium">Contract <Badge variant="secondary">{activity.contractType}</Badge> semnat</p>
                                    <p className="text-sm text-muted-foreground">
                                        Pentru <Link href={`/leads/${activity.contactId}`} className="font-semibold text-primary hover:underline">{activity.contactName}</Link>
                                    </p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{date}</TableCell>
                    </TableRow>
                )
            case 'contact':
                 return (
                    <TableRow key={`contact-${activity.id}`}>
                        <TableCell>
                             <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                                    <UserPlus className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="font-medium">Lead nou adăugat</p>
                                    <p className="text-sm text-muted-foreground">
                                        <Link href={`/leads/${activity.id}`} className="font-semibold text-primary hover:underline">{activity.name}</Link> din sursa {activity.source}
                                    </p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{date}</TableCell>
                    </TableRow>
                )
            case 'property':
                 return (
                    <TableRow key={`property-${activity.id}`}>
                        <TableCell>
                             <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50">
                                    <Building className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="font-medium">Proprietate nouă adăugată</p>
                                    <p className="text-sm text-muted-foreground">
                                        <Link href={`/properties/${activity.id}`} className="font-semibold text-primary hover:underline">{activity.title}</Link>
                                    </p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{date}</TableCell>
                    </TableRow>
                )
            case 'task':
                 return (
                    <TableRow key={`task-${activity.id}`}>
                        <TableCell>
                             <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                                    <CheckCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                </div>
                                <div>
                                    <p className="font-medium">Task finalizat</p>
                                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{date}</TableCell>
                    </TableRow>
                )
            default:
                return null;
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Activitate Recentă</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Descriere</TableHead>
                            <TableHead className="text-right">Data</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={2}><Skeleton className="h-12 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : combinedActivities.length > 0 ? combinedActivities.map(renderActivityRow) : (
                             <TableRow>
                                <TableCell colSpan={2} className="h-24 text-center">
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
