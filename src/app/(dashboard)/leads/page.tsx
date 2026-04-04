'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { LeadList } from '@/components/leads/LeadList';
import { StatCard } from '@/components/dashboard/StatCard';
import { Users, Target, BarChart, PlusCircle, Filter, Archive, ArchiveRestore, ArrowUpDown } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Contact, Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LeadFiltersDialog, type LeadFilters } from '@/components/leads/LeadFiltersDialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ContactAgeBucket, getContactAgeBucket, getContactAgeInDays, isArchivedContact, shouldAutoArchiveContact } from '@/lib/contact-aging';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const AGE_BUCKET_OPTIONS: Array<{ value: ContactAgeBucket; label: string }> = [
    { value: 'all', label: 'Toate vechimile' },
    { value: '0-7', label: 'Vechime 0-7 zile' },
    { value: '7-14', label: 'Vechime 7-14 zile' },
    { value: '14-21', label: 'Vechime 14-21 zile' },
    { value: '21-30', label: 'Vechime 21-30 zile' },
    { value: '30-40', label: 'Vechime 30-40 zile' },
];

export default function LeadsPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [ageSortBucket, setAgeSortBucket] = useState<ContactAgeBucket>('all');
    const [filters, setFilters] = useState<LeadFilters | null>(null);
    const isMobile = useIsMobile();
    const archivedInSessionRef = useRef<Set<string>>(new Set());

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

    const buyerContacts = useMemo(
        () => (contacts ?? []).filter((contact) => contact.contactType === 'Cumparator'),
        [contacts]
    );

    useEffect(() => {
        if (!agencyId || !buyerContacts) return;

        const nowIso = new Date().toISOString();

        buyerContacts.forEach((contact) => {
            if (!contact.id || archivedInSessionRef.current.has(contact.id)) return;
            if (!shouldAutoArchiveContact(contact)) return;

            archivedInSessionRef.current.add(contact.id);
            updateDocumentNonBlocking(doc(firestore, 'agencies', agencyId, 'contacts', contact.id), {
                archivedAt: nowIso,
                archivedByAge: true,
            });
        });
    }, [agencyId, buyerContacts, firestore]);

    const activeContacts = useMemo(
        () => buyerContacts.filter((contact) => !isArchivedContact(contact)),
        [buyerContacts]
    );

    const archivedContacts = useMemo(
        () => buyerContacts.filter((contact) => isArchivedContact(contact)),
        [buyerContacts]
    );

    const { newBuyersCount, totalBudget, averageAiScore } = useMemo(() => {
        if (!activeContacts) {
            return { newBuyersCount: 0, totalBudget: 0, averageAiScore: 0 };
        }

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const newLeads = activeContacts.filter(contact => 
            contact.createdAt && new Date(contact.createdAt) > oneWeekAgo
        );

        const totalBudget = activeContacts.reduce((sum, contact) => sum + (contact.budget || 0), 0);
        
        const buyersWithScores = activeContacts.filter(contact => typeof contact.leadScore === 'number');
        const totalScore = buyersWithScores.reduce((sum, contact) => sum + (contact.leadScore!), 0);
        const averageAiScore = buyersWithScores.length > 0 ? Math.round(totalScore / buyersWithScores.length) : 0;

        return {
            newBuyersCount: newLeads.length,
            totalBudget,
            averageAiScore
        };
    }, [activeContacts]);

    const filteredContacts = useMemo(() => {
        const sourceContacts = showArchived ? archivedContacts : activeContacts;
        const filtered = !filters ? sourceContacts : sourceContacts.filter(contact => {
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

        return [...filtered].sort((left, right) => {
            const leftBucket = getContactAgeBucket(left);
            const rightBucket = getContactAgeBucket(right);

            if (ageSortBucket !== 'all') {
                const leftPriority = leftBucket === ageSortBucket ? 0 : 1;
                const rightPriority = rightBucket === ageSortBucket ? 0 : 1;
                if (leftPriority !== rightPriority) {
                    return leftPriority - rightPriority;
                }
            } else {
                const order: ContactAgeBucket[] = ['0-7', '7-14', '14-21', '21-30', '30-40'];
                const leftIndex = order.indexOf(leftBucket as ContactAgeBucket);
                const rightIndex = order.indexOf(rightBucket as ContactAgeBucket);
                if (leftIndex !== rightIndex) {
                    return leftIndex - rightIndex;
                }
            }

            const leftAge = getContactAgeInDays(left.createdAt) ?? 0;
            const rightAge = getContactAgeInDays(right.createdAt) ?? 0;
            return leftAge - rightAge;
        });
    }, [activeContacts, ageSortBucket, archivedContacts, filters, showArchived]);

    const handleUnarchive = (contact: Contact) => {
        if (!agencyId) return;

        updateDocumentNonBlocking(doc(firestore, 'agencies', agencyId, 'contacts', contact.id), {
            archivedAt: null,
            archivedByAge: false,
        });
    };

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
    const activeAgeSortLabel = AGE_BUCKET_OPTIONS.find((option) => option.value === ageSortBucket)?.label ?? 'Ordonează după vechime';

  return (
    <div className={cn(
        "space-y-6", 
        isMobile ? "p-0" : "bg-[#0F1E33] text-white px-4 pb-6 pt-1 lg:px-6 lg:pb-6 lg:pt-1"
    )}>
        {/* Mobile & Tablet View */}
        <div className="lg:hidden space-y-4">
            <Card className="bg-[#152A47] text-white border-none rounded-b-2xl rounded-t-none">
                <CardHeader>
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <CardTitle className="text-white text-xl">Cumpărători</CardTitle>
                                    <p className="text-sm text-white/65">
                                        {showArchived ? `Arhivă: ${filteredContacts.length}` : `Activi: ${filteredContacts.length}`}
                                    </p>
                                </div>
                                <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/90 ring-1 ring-inset ring-white/10">
                                    {filteredContacts.length}
                                </span>
                            </div>
                        </div>
                        <AddLeadDialog properties={properties || []} contacts={buyerContacts} isOpen={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
                            <button
                                type="button"
                                className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-4 py-3 text-left text-white transition-colors hover:bg-emerald-500/18"
                            >
                                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-emerald-200/80">
                                    <PlusCircle className="h-3.5 w-3.5" />
                                    Acțiune
                                </div>
                                <p className="mt-1 text-lg font-semibold text-white">Adaugă Cumpărător</p>
                            </button>
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
                <div className="flex gap-2">
                    <Button variant="outline" className="w-full" onClick={() => setIsFilterOpen(true)}>
                        <Filter className="mr-2 h-4 w-4" />
                        Filtrare Preferinte
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" className="shrink-0">
                                <ArrowUpDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuRadioGroup value={ageSortBucket} onValueChange={(value) => setAgeSortBucket(value as ContactAgeBucket)}>
                                {AGE_BUCKET_OPTIONS.map((option) => (
                                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                                        {option.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setShowArchived((current) => !current)}
                    >
                        {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
            <div className="px-2">
              <LeadList contacts={filteredContacts} isLoading={isLoading} onUnarchive={handleUnarchive} showArchivedState={showArchived} />
            </div>
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block space-y-6">
            <Card className="overflow-hidden border-white/10 bg-[#152A47] text-white shadow-xl">
                <CardContent className="p-0">
                    <div className="grid gap-6 p-6">
                        <div className="space-y-4">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/10">
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h1 className="text-3xl font-headline font-bold text-white">Cumpărători</h1>
                                            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/90 ring-1 ring-inset ring-white/10">
                                                {filteredContacts.length}
                                            </span>
                                            <span className="rounded-full bg-white/5 px-3 py-1 text-sm font-medium text-white/65 ring-1 ring-inset ring-white/10">
                                                {showArchived ? `Arhiva ${archivedContacts.length}` : `Activi ${activeContacts.length}`}
                                            </span>
                                        </div>
                                        <p className="max-w-2xl text-sm leading-6 text-white/70">
                                            Vezi rapid cumpărătorii activi, filtrează după preferințe, urmărește vechimea lead-urilor și intră rapid în arhivă când ai nevoie.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                                        >
                                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
                                                <ArrowUpDown className="h-3.5 w-3.5" />
                                                Sortare
                                            </div>
                                            <p className="mt-1 truncate text-lg font-semibold text-white">{activeAgeSortLabel}</p>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-56">
                                        <DropdownMenuRadioGroup value={ageSortBucket} onValueChange={(value) => setAgeSortBucket(value as ContactAgeBucket)}>
                                            {AGE_BUCKET_OPTIONS.map((option) => (
                                                <DropdownMenuRadioItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <button
                                    type="button"
                                    onClick={() => setShowArchived((current) => !current)}
                                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                                >
                                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
                                        {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                        Afișare
                                    </div>
                                    <p className="mt-1 text-lg font-semibold text-white">
                                        {showArchived ? `Vezi activi (${activeContacts.length})` : `Vezi arhiva (${archivedContacts.length})`}
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsFilterOpen(true)}
                                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                                >
                                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
                                        <Filter className="h-3.5 w-3.5" />
                                        Filtrare
                                    </div>
                                    <p className="mt-1 text-lg font-semibold text-white">Preferințe și Buget</p>
                                </button>
                                <AddLeadDialog 
                                    properties={properties || []}
                                    contacts={buyerContacts}
                                    isOpen={isAddLeadOpen}
                                    onOpenChange={setIsAddLeadOpen}
                                >
                                    <button
                                        type="button"
                                        className="rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-4 py-3 text-left text-white transition-colors hover:bg-emerald-500/18"
                                    >
                                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-emerald-200/80">
                                            <PlusCircle className="h-3.5 w-3.5" />
                                            Acțiune
                                        </div>
                                        <p className="mt-1 text-lg font-semibold text-white">Adaugă Cumpărător</p>
                                    </button>
                                </AddLeadDialog>
                            </div>
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

                <LeadList contacts={filteredContacts} isLoading={isLoading} onUnarchive={handleUnarchive} showArchivedState={showArchived} />
            </div>
        <LeadFiltersDialog
            isOpen={isFilterOpen}
            onOpenChange={setIsFilterOpen}
            onApplyFilters={(appliedFilters) => setFilters(appliedFilters)}
        />
    </div>
  );
}
