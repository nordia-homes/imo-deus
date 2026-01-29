'use client';

import { useMemo } from 'react';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { LeadList } from '@/components/leads/LeadList';
import { StatCard } from '@/components/dashboard/StatCard';
import { Users, Target, BarChart } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Contact } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function LeadsPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const contactsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'contacts');
    }, [firestore, user]);

    const { data: contacts, isLoading } = useCollection<Contact>(contactsQuery);

    const { newLeadsCount, totalBudget, averageAiScore } = useMemo(() => {
        if (!contacts) {
            return { newLeadsCount: 0, totalBudget: 0, averageAiScore: 0 };
        }

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const newLeads = contacts.filter(contact => 
            contact.createdAt && new Date(contact.createdAt) > oneWeekAgo
        );

        const totalBudget = contacts.reduce((sum, contact) => sum + (contact.budget || 0), 0);
        
        const leadsWithScores = contacts.filter(contact => typeof contact.leadScore === 'number');
        const totalScore = leadsWithScores.reduce((sum, contact) => sum + (contact.leadScore!), 0);
        const averageAiScore = leadsWithScores.length > 0 ? Math.round(totalScore / leadsWithScores.length) : 0;

        return {
            newLeadsCount: newLeads.length,
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

  return (
    <div className="space-y-6">
       <div className="flex items-start justify-between">
            <div>
                <h1 className="text-3xl font-headline font-bold">Lead-uri</h1>
                <p className="text-muted-foreground">
                    Gestionează și prioritizează potențialii clienți.
                </p>
            </div>
            <AddLeadDialog />
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
                <>
                    <Skeleton className="h-[126px]" />
                    <Skeleton className="h-[126px]" />
                    <Skeleton className="h-[126px]" />
                </>
            ) : (
                <>
                    <StatCard title="Lead-uri Noi" value={newLeadsCount.toString()} change="+0" changeType="increase" period="săptămâna aceasta" icon={<Users />} />
                    <StatCard title="Buget Total Estimat" value={formatBudget(totalBudget)} change="+0" changeType="increase" period="față de luna trecută" icon={<Target />} />
                    <StatCard title="Scor Mediu AI" value={averageAiScore.toString()} change="0" changeType="increase" period="față de luna trecută" icon={<BarChart />} />
                </>
            )}
        </div>

        <LeadList />
    </div>
  );
}
