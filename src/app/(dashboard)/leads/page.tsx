'use client';

import { useMemo, useState } from 'react';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { LeadList } from '@/components/leads/LeadList';
import { StatCard } from '@/components/dashboard/StatCard';
import { Users, Target, BarChart, PlusCircle, Filter } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Contact, Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LeadFiltersDialog, type LeadFilters } from '@/components/leads/LeadFiltersDialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export default function LeadsPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<LeadFilters | null>(null);
    const isMobile = useIsMobile();

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

    const filteredContacts = useMemo(() => {
        if (!contacts) return [];
        if (!filters) return contacts;

        return contacts.filter(contact => {
            const { budgetMin, budgetMax, rooms, zones, city } = filters;

            if (budgetMin && (contact.budget || 0) < budgetMin) return false;
            if (budgetMax && (contact.budget || 0) > budgetMax) return false;
            
            if (rooms && (contact.preferences?.desiredRooms !== rooms)) return false;

            if (city && city !== 'all' && contact.city !== city) return false;
            
            if (zones && zones.length > 0) {
                if (!contact.zones || contact.zones.length === 0) return false;
                const hasZoneMatch = zones.some(filterZone => contact.zones?.includes(filterZone));
                if (!hasZoneMatch) return false;
            }

            return true;
        });
    }, [contacts, filters]);

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
    <div className={cn(
        "space-y-6", 
        isMobile ? "p-0" : "bg-[#0F1E33] text-white p-4 lg:p-6"
    )}>
        {/* Mobile & Tablet View */}
        <div className="lg:hidden space-y-4">
            <Card className="bg-[#152A47] text-white border-none rounded-b-2xl rounded-t-none">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-xl">Cumpărători ({filteredContacts.length})</CardTitle>
                        <AddLeadDialog properties={properties || []} isOpen={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
                            <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white"><PlusCircle className="mr-2 h-4 w-4" /> Adaugă</Button>
                        </AddLeadDialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <Skeleton className="h-16 w-full" />
                    ) : (
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-2xl">{newBuyersCount.toString()}</p>
                                <p className="text-xs text-white/80">Noi (7 zile)</p>
                            </div>
                            <div className="p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-2xl">{formatBudget(totalBudget)}</p>
                                <p className="text-xs text-white/80">Buget Total</p>
                            </div>
                            <div className="p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-2xl">{averageAiScore.toString()}</p>
                                <p className="text-xs text-white/80">Scor Mediu AI</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            <div className="mt-4 px-2">
                <Button variant="outline" className="w-full" onClick={() => setIsFilterOpen(true)}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filtrare Preferinte si Buget
                </Button>
            </div>
            <div className="px-2">
              <LeadList contacts={filteredContacts} isLoading={isLoading} />
            </div>
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block space-y-6">
            <Card className="overflow-hidden border-white/10 bg-[#152A47] text-white shadow-xl">
                <CardContent className="p-0">
                    <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/10">
                                <Users className="h-6 w-6" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-headline font-bold text-white">Cumpărători</h1>
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/90 ring-1 ring-inset ring-white/10">
                                        {filteredContacts.length}
                                    </span>
                                </div>
                                <p className="max-w-2xl text-sm leading-6 text-white/70">
                                    Vezi rapid cumpărătorii activi, filtrează după preferințe și prioritizează lead-urile cu cel mai bun potențial.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                             <Button variant="outline" onClick={() => setIsFilterOpen(true)} className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
                                <Filter className="mr-2 h-4 w-4" />
                                Filtrare Preferinte si Buget
                            </Button>
                            <AddLeadDialog 
                                properties={properties || []}
                                isOpen={isAddLeadOpen}
                                onOpenChange={setIsAddLeadOpen}
                            >
                                <Button className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Adaugă Cumpărător
                                </Button>
                            </AddLeadDialog>
                        </div>
                    </div>
                </CardContent>
            </Card>
                
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                    {isLoading ? (
                        <>
                            <Skeleton className="h-[98px] bg-white/10" />
                            <Skeleton className="h-[98px] bg-white/10" />
                            <Skeleton className="h-[98px] bg-white/10" />
                        </>
                    ) : (
                        <>
                            <StatCard className="bg-[#152A47] border-none text-white" title="Cumpărători Noi" value={newBuyersCount.toString()} period="în ultima săptămână" icon={<Users />} />
                            <StatCard className="bg-[#152A47] border-none text-white" title="Buget Total Estimat" value={formatBudget(totalBudget)} period="din toți cumpărătorii" icon={<Target />} />
                            <StatCard className="bg-[#152A47] border-none text-white" title="Scor Mediu AI" value={averageAiScore.toString()} icon={<BarChart />} segmentedScore={averageAiScore} />
                        </>
                    )}
                </div>

                <LeadList contacts={filteredContacts} isLoading={isLoading} />
            </div>
        <LeadFiltersDialog
            isOpen={isFilterOpen}
            onOpenChange={setIsFilterOpen}
            onApplyFilters={(appliedFilters) => setFilters(appliedFilters)}
        />
    </div>
  );
}
