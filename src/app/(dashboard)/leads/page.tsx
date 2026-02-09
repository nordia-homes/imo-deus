'use client';

import { useMemo, useState } from 'react';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { LeadList } from '@/components/leads/LeadList';
import { StatCard } from '@/components/dashboard/StatCard';
import { Users, Target, BarChart, PlusCircle } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Contact, Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { Button } from '@/components/ui/button';

export default function LeadsPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);

    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);

    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);

    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

    const { newBuyersCount, totalBudget, averageAiScore } = useMemo(() => {
        if (!contacts) {
            return { newBuyersCount: 0, totalBudget: 0, averageAiScore: 0 };
        }

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const newLeads = contacts.filter(contact => 
            contact.createdAt && new Date(contact.createdAt) > oneWeekAgo
        );

        const totalBudget = contacts.reduce((sum, contact) => sum + (contact.budget || 0), 0);
        
        const buyersWithScores = contacts.filter(contact => typeof contact.leadScore === 'number');
        const totalScore = buyersWithScores.reduce((sum, contact) => sum + (contact.leadScore!), 0);
        const averageAiScore = buyersWithScores.length > 0 ? Math.round(totalScore / buyersWithScores.length) : 0;

        return {
            newBuyersCount: newLeads.length,
            totalBudget,
            averageAiScore
        };
    }, [contacts]);

    // Function to format large numbers for budget
    const formatBudget = (num: number) => {
        if (num >= 1000000) {
            return `€${(num / 1000000).toFixed(1)}M`;
        }
        if (num >= 1000) {
            return `€${Math.round(num / 1000)}k`;
        }
        return `€${num}`;
    }

    const isLoading = areContactsLoading || arePropertiesLoading;

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
                <h1 className="text-3xl font-headline font-bold">Cumpărători</h1>
                <p className="text-muted-foreground">
                    Gestionează și prioritizează potențialii clienți.
                </p>
            </div>
             <AddLeadDialog 
                properties={properties || []}
                isOpen={isAddLeadOpen}
                onOpenChange={setIsAddLeadOpen}
            >
                <Button className="w-full md:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adaugă Cumpărător
                </Button>
            </AddLeadDialog>
        </div>
        
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            {isLoading ? (
                <>
                    <Skeleton className="h-[98px]" />
                    <Skeleton className="h-[98px]" />
                    <Skeleton className="h-[98px]" />
                </>
            ) : (
                <>
                    <StatCard title="Cumpărători Noi" value={newBuyersCount.toString()} period="în ultima săptămână" icon={<Users />} />
                    <StatCard title="Buget Total Estimat" value={formatBudget(totalBudget)} period="din toți cumpărătorii" icon={<Target />} />
                    <StatCard title="Scor Mediu AI" value={averageAiScore.toString()} period="calculat pentru cumpărătorii cu scor" icon={<BarChart />} />
                </>
            )}
        </div>

        <LeadList />
    </div>
  );
}
