'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import type { Contract, Contact, Property, Task } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { useMemo } from 'react';
import { FileSignature, UserPlus, Building, CheckCircle2 } from 'lucide-react';

type ActivityItem = {
  id: string;
  type: 'lead' | 'property' | 'task' | 'contract';
  date: string;
  description: string;
  link: string;
  icon: React.ReactNode;
};

export function RecentActivity() {
    const { user } = useUser();
    const firestore = useFirestore();

    const contactsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'contacts'), orderBy('createdAt', 'desc'), limit(5));
    }, [firestore, user]);
    const { data: contacts, isLoading: contactsLoading } = useCollection<Contact>(contactsQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'properties'), orderBy('createdAt', 'desc'), limit(5));
    }, [firestore, user]);
    const { data: properties, isLoading: propertiesLoading } = useCollection<Property>(propertiesQuery);
    
    // Only fetch tasks that have been completed
    const tasksQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'tasks'), where('status', '==', 'completed'), orderBy('dueDate', 'desc'), limit(5));
    }, [firestore, user]);
    const { data: tasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);

    const contractsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'contracts'), orderBy('date', 'desc'), limit(5));
    }, [firestore, user]);
    const { data: contracts, isLoading: contractsLoading } = useCollection<Contract>(contractsQuery);

    const isLoading = contactsLoading || propertiesLoading || tasksLoading || contractsLoading;

    const recentActivity = useMemo((): ActivityItem[] => {
        const allActivities: Omit<ActivityItem, 'icon'>[] = [];

        if (contacts) {
            allActivities.push(...contacts.map(c => ({
                id: c.id,
                type: 'lead' as const,
                date: c.createdAt || new Date().toISOString(),
                description: `Lead nou adăugat: ${c.name}`,
                link: `/leads/${c.id}`
            })));
        }

        if (properties) {
            allActivities.push(...properties.map(p => ({
                id: p.id,
                type: 'property' as const,
                date: p.createdAt || new Date().toISOString(),
                description: `Proprietate nouă: ${p.title}`,
                link: `/properties/${p.id}`
            })));
        }
        
        if (tasks) {
            allActivities.push(...tasks.map(t => ({
                id: t.id,
                type: 'task' as const,
                date: t.dueDate,
                description: `Task finalizat: ${t.description}`,
                link: `/tasks`
            })));
        }

        if (contracts) {
            allActivities.push(...contracts.map(c => ({
                id: c.id,
                type: 'contract' as const,
                date: c.date,
                description: `Contract semnat: ${c.propertyTitle}`,
                link: `/contracts`
            })));
        }

        return allActivities
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 7)
            .map(activity => {
                let icon;
                switch (activity.type) {
                    case 'lead': icon = <UserPlus className="h-5 w-5 text-blue-500" />; break;
                    case 'property': icon = <Building className="h-5 w-5 text-orange-500" />; break;
                    case 'task': icon = <CheckCircle2 className="h-5 w-5 text-green-500" />; break;
                    case 'contract': icon = <FileSignature className="h-5 w-5 text-purple-500" />; break;
                }
                return { ...activity, icon };
            });

    }, [contacts, properties, tasks, contracts]);
    
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
                ) : recentActivity.length > 0 ? (
                    <div className="space-y-4">
                        {recentActivity.map((activity) => (
                           <Link href={activity.link} key={activity.id + activity.type} className="flex items-center gap-4 group p-2 -m-2 rounded-md hover:bg-accent">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                    {activity.icon}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{activity.description}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(activity.date).toLocaleString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
