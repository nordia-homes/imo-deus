'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Property, Viewing, Task, Contact, LeadSourceData, SalesData, ConversionData, ActiveBuyersEvolutionData } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { isThisMonth, parseISO, format, isPast, isToday, addDays, isWithinInterval, subDays, eachDayOfInterval, startOfDay, endOfDay, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { ro } from "date-fns/locale";
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking } from '@/firebase';
import { useUser } from '@/firebase';
import { TrendingUp } from 'lucide-react';

// Components
import { SalesChart } from '@/components/dashboard/sales-chart';
import { AccountPerformanceCharts } from '@/components/dashboard/AccountPerformanceCharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';


export default function DashboardPage() {
    const { user } = useUser();
    const { agencyId, isAgencyLoading, userProfile, agency } = useAgency();
    const firestore = useFirestore();
    const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
    const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
    const [isAddViewingOpen, setIsAddViewingOpen] = useState(false);
    const { toast } = useToast();

    const displayName = userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Utilizator';
    const agencyName = agency?.name;

    // --- Action Handlers ---
    const handleAddTask = (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => {
        if (!agencyId || !user) return;
        const tasksCollection = collection(firestore, 'agencies', agencyId, 'tasks');
        const taskToAdd: Omit<Task, 'id'> = {
            ...taskData,
            status: 'open',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
        };
        addDocumentNonBlocking(tasksCollection, taskToAdd);
        toast({
            title: "Task adăugat!",
            description: `Task-ul "${taskData.description}" a fost adăugat.`,
        });
    };

    const handleAddViewing = async (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
        if (!agencyId || !user) return;

        const selectedProperty = properties?.find(p => p.id === viewingData.propertyId);
        if (!selectedProperty) {
            toast({ variant: 'destructive', title: 'Proprietate invalidă.' });
            return;
        };
        
        const viewingToAdd: Omit<Viewing, 'id'> = {
            ...viewingData,
            propertyTitle: selectedProperty.title,
            propertyAddress: selectedProperty.address,
            status: 'scheduled',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
            createdAt: new Date().toISOString(),
        };
        
        addDocumentNonBlocking(collection(firestore, `agencies/${agencyId}/viewings`), viewingToAdd);

        toast({ title: 'Vizionare programată!', description: 'Vizionarea a fost adăugată în calendar.' });
    };

    // --- DATA FETCHING ---
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
    
    const viewingsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'viewings'), orderBy('viewingDate', 'asc'));
    }, [firestore, agencyId]);
    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);
    
    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(
            collection(firestore, 'agencies', agencyId, 'tasks'), 
            where('status', '==', 'open'),
            orderBy('dueDate', 'asc')
        );
    }, [firestore, agencyId]);
    const { data: openTasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    

    // --- DATA CALCULATION ---
    const { 
        soldThisMonth,
        reservedThisMonth,
        totalSoldCount,
        totalReservedCount, 
        activePropertiesCount,
        monthlyCommissionData,
        realizedCommissionThisMonth,
        upcomingViewings,
        conversionData,
        activeBuyersCount,
        activeBuyersEvolutionData,
    } = useMemo(() => {
        const calculateCommission = (prop: Property): number => {
            const price = prop.price || 0;
            if (price === 0) return 0;
            if (prop.commissionType === 'fixed') {
                return prop.commissionValue || 0;
            }
            const percentage = prop.commissionValue !== undefined ? prop.commissionValue : 2;
            return price * (percentage / 100);
        };
        
        const activeBuyersCount = contacts?.filter(c => c.status !== 'Câștigat' && c.status !== 'Pierdut').length || 0;

        const soldThisMonth = properties?.filter(p => p.status === 'Vândut' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))) || [];
        const reservedThisMonth = properties?.filter(p => p.status === 'Rezervat' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))) || [];
        
        const totalSoldCount = properties?.filter(p => p.status === 'Vândut').length || 0;
        const totalReservedCount = properties?.filter(p => p.status === 'Rezervat').length || 0;

        const activeProperties = properties?.filter(p => p.status === 'Activ') || [];
        const activePropertiesCount = activeProperties.length;
        
        const soldOrRentedThisMonth = properties?.filter(p =>
            (p.status === 'Vândut' || p.status === 'Închiriat') &&
            p.statusUpdatedAt &&
            isThisMonth(parseISO(p.statusUpdatedAt))
        ) || [];
        const realizedCommissionThisMonth = soldOrRentedThisMonth.reduce((sum, prop) => sum + calculateCommission(prop), 0);

        const upcomingViewings = viewings?.filter(viewing => {
            if (viewing.status !== 'scheduled') return false;
            try { return !isPast(parseISO(viewing.viewingDate)); } catch (e) { return false; }
        }).sort((a, b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime()) || [];

        const monthlyCommissions: { [key: string]: { sales: number, date: Date } } = {};
        const soldOrRentedAllTime = properties?.filter(p => 
            (p.status === 'Vândut' || p.status === 'Închiriat') && p.statusUpdatedAt
        ) || [];

        soldOrRentedAllTime.forEach(prop => {
            if (!prop.statusUpdatedAt) return;
            const date = parseISO(prop.statusUpdatedAt);
            const monthKey = format(date, 'yyyy-MM');
            if (!monthlyCommissions[monthKey]) {
                monthlyCommissions[monthKey] = { sales: 0, date: new Date(date.getFullYear(), date.getMonth(), 1) };
            }
            monthlyCommissions[monthKey].sales += calculateCommission(prop);
        });

        const commissionMonths = Object.values(monthlyCommissions).sort((a,b) => a.date.getTime() - b.date.getTime());
        const monthlyCommissionDataResult: SalesData[] = commissionMonths.length > 0
            ? eachMonthOfInterval({
                start: startOfMonth(commissionMonths[0].date),
                end: startOfMonth(new Date()),
            }).map((date) => ({
                month: format(date, 'MMM yyyy', { locale: ro }),
                sales: monthlyCommissions[format(date, 'yyyy-MM')]?.sales || 0,
            }))
            : [];
            
        const today = endOfDay(new Date());
        const thirtyDaysAgo = startOfDay(subDays(today, 29));
        const dateArray = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

        const conversionMap: Map<string, { vizionari: number; tranzactii: number }> = new Map();
        dateArray.forEach(date => {
            const dayKey = format(date, 'yyyy-MM-dd');
            conversionMap.set(dayKey, { vizionari: 0, tranzactii: 0 });
        });

        viewings?.forEach(viewing => {
            const viewingDate = parseISO(viewing.viewingDate);
            if (isWithinInterval(viewingDate, { start: thirtyDaysAgo, end: today })) {
                const dayKey = format(viewingDate, 'yyyy-MM-dd');
                const dayData = conversionMap.get(dayKey);
                if (dayData) {
                    dayData.vizionari++;
                }
            }
        });

        properties?.forEach(property => {
            if ((property.status === 'Vândut' || property.status === 'Rezervat') && property.statusUpdatedAt) {
                const updatedDate = parseISO(property.statusUpdatedAt);
                if (isWithinInterval(updatedDate, { start: thirtyDaysAgo, end: today })) {
                    const dayKey = format(updatedDate, 'yyyy-MM-dd');
                    const dayData = conversionMap.get(dayKey);
                    if (dayData) {
                        dayData.tranzactii++;
                    }
                }
            }
        });

        const conversionDataResult: ConversionData[] = Array.from(conversionMap.entries()).map(([date, data]) => ({
          date: format(parseISO(date), 'd'),
          ...data,
        }));

        const dailyNewContactsMap: Map<string, number> = new Map();
        dateArray.forEach(date => {
            const dayKey = format(date, 'yyyy-MM-dd');
            dailyNewContactsMap.set(dayKey, 0);
        });

        contacts?.forEach(contact => {
            if (contact.createdAt) {
                try {
                    const creationDate = parseISO(contact.createdAt);
                    if (isWithinInterval(creationDate, { start: thirtyDaysAgo, end: today })) {
                        const dayKey = format(creationDate, 'yyyy-MM-dd');
                        dailyNewContactsMap.set(dayKey, (dailyNewContactsMap.get(dayKey) || 0) + 1);
                    }
                } catch (e) {
                    console.error("Invalid createdAt date for contact:", contact.id, contact.createdAt);
                }
            }
        });

        const activeBuyersEvolutionDataResult: ActiveBuyersEvolutionData[] = Array.from(dailyNewContactsMap.entries()).map(([date, count]) => ({
          date: format(parseISO(date), 'd'),
          count,
        }));


        return {
            soldThisMonth,
            reservedThisMonth,
            totalSoldCount,
            totalReservedCount,
            activePropertiesCount,
            monthlyCommissionData: monthlyCommissionDataResult,
            realizedCommissionThisMonth,
            upcomingViewings,
            conversionData: conversionDataResult,
            activeBuyersCount,
            activeBuyersEvolutionData: activeBuyersEvolutionDataResult,
        };
    }, [properties, viewings, contacts, openTasks]);
    

    const isLoading = isAgencyLoading || arePropertiesLoading || areViewingsLoading || areTasksLoading || areContactsLoading;
    
    if (isLoading) {
        return (
            <div className="agentfinder-dashboard-page space-y-4 p-4">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="agentfinder-dashboard-page space-y-6 p-3 sm:p-4">
            <AddPropertyDialog isOpen={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen} property={null} />
            <AddLeadDialog properties={properties || []} isOpen={isAddLeadOpen} onOpenChange={setIsAddLeadOpen} />
            <AddViewingDialog isOpen={isAddViewingOpen} onOpenChange={setIsAddViewingOpen} onAddViewing={handleAddViewing} contacts={contacts || []} properties={properties || []} />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <QuickActionsCard
                    onAddLead={() => setIsAddLeadOpen(true)}
                    onAddProperty={() => setIsAddPropertyOpen(true)}
                    onAddViewing={() => setIsAddViewingOpen(true)}
                    onAddTask={handleAddTask}
                    contacts={contacts || []}
                    realizedCommissionThisMonth={realizedCommissionThisMonth}
                    viewings={upcomingViewings}
                    properties={properties || []}
                    agencyName={agencyName}
                    displayName={displayName}
                    activeBuyersEvolutionData={activeBuyersEvolutionData}
                />
                
                <Card className="agentfinder-dashboard-card overflow-hidden rounded-2xl border-none bg-[#152a47] text-white shadow-2xl">
                    <CardHeader className="px-4 pb-3 pt-5 text-center sm:px-5">
                        <CardTitle className="text-lg text-white">Performanța Contului Tău</CardTitle>
                        <CardDescription className="text-xs text-white/55">
                            O privire rapidă asupra portofoliului și activității agenției
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 px-3 pb-4 pt-0 sm:px-4 sm:pb-5">
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <div className="agentfinder-dashboard-stat agentfinder-dashboard-stat--active rounded-xl p-3 text-center sm:p-4">
                                <p className="text-2xl font-bold tabular-nums text-[#62ebba] sm:text-3xl">{activePropertiesCount}</p>
                                <p className="text-xs text-white/70">Proprietăți Active</p>
                            </div>
                            <div className="agentfinder-dashboard-stat agentfinder-dashboard-stat--buyers rounded-xl p-3 text-center sm:p-4">
                                <p className="text-2xl font-bold tabular-nums text-[#9bbcff] sm:text-3xl">{activeBuyersCount}</p>
                                <p className="text-xs text-white/70">Cumpărători Activi</p>
                            </div>
                            <div className="agentfinder-dashboard-stat agentfinder-dashboard-stat--reserved rounded-xl p-3 text-center sm:p-4">
                                <p className="text-2xl font-bold tabular-nums text-[#d7b4ff] sm:text-3xl">{totalReservedCount}</p>
                                <p className="text-xs text-white/70">Prop. Rezervate</p>
                            </div>
                            <div className="agentfinder-dashboard-stat agentfinder-dashboard-stat--sold rounded-xl p-3 text-center sm:p-4">
                                <p className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{totalSoldCount}</p>
                                <p className="text-xs text-white/70">Prop. Vândute</p>
                            </div>
                        </div>
                        <AccountPerformanceCharts
                            activeProperties={activePropertiesCount}
                            activeBuyers={activeBuyersCount}
                            reservedProperties={totalReservedCount}
                            soldProperties={totalSoldCount}
                            reservedThisMonth={reservedThisMonth.length}
                            soldThisMonth={soldThisMonth.length}
                            buyersEvolution={activeBuyersEvolutionData}
                            conversionData={conversionData}
                        />
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
                 <Card className="agentfinder-dashboard-card rounded-2xl border-none bg-[#152a47] shadow-2xl">
                    <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
                        <div className="flex items-start gap-3">
                            <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-2.5 text-emerald-600">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold text-white sm:text-lg">Evoluție Comision Lunar</CardTitle>
                                <CardDescription className="mt-1 text-white/80">Comisioane realizate și evoluția lor în timp</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-4 pt-1 sm:px-5 sm:pb-5">
                        <SalesChart data={monthlyCommissionData} />
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
