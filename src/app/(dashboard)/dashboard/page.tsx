'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Property, Viewing, Task, Contact, LeadSourceData, SalesData, ConversionData, ActiveBuyersEvolutionData } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { isThisMonth, parseISO, format, isPast, isToday, addDays, isWithinInterval, subDays, eachDayOfInterval } from 'date-fns';
import { ro } from "date-fns/locale";
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking } from '@/firebase';
import { useUser } from '@/firebase';

// Components
import { SalesChart } from '@/components/dashboard/sales-chart';
import { ConversionChart } from '@/components/dashboard/ConversionChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import { Button } from '@/components/ui/button';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { Separator } from '@/components/ui/separator';


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

    const handleAddViewing = (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
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

        const monthlyCommissionDataResult: SalesData[] = Object.values(monthlyCommissions)
            .sort((a,b) => a.date.getTime() - b.date.getTime())
            .map(data => ({
                month: data.date.toLocaleString('ro-RO', { month: 'short' }),
                sales: data.sales,
            }));
            
        const thirtyDaysAgo = subDays(new Date(), 30);
        const today = new Date();
        const dateArray = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

        const conversionMap: Map<string, { vizionari: number; tranzactii: number }> = new Map();
        dateArray.forEach(date => {
            const dayKey = format(date, 'd');
            conversionMap.set(dayKey, { vizionari: 0, tranzactii: 0 });
        });

        viewings?.forEach(viewing => {
            const viewingDate = parseISO(viewing.viewingDate);
            if (isWithinInterval(viewingDate, { start: thirtyDaysAgo, end: today })) {
                const dayKey = format(viewingDate, 'd');
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
                    const dayKey = format(updatedDate, 'd');
                    const dayData = conversionMap.get(dayKey);
                    if (dayData) {
                        dayData.tranzactii++;
                    }
                }
            }
        });

        const conversionDataResult: ConversionData[] = Array.from(conversionMap.entries()).map(([date, data]) => ({
          date,
          ...data,
        }));

        const dailyNewContactsMap: Map<string, number> = new Map();
        dateArray.forEach(date => {
            const dayKey = format(date, 'd');
            dailyNewContactsMap.set(dayKey, 0);
        });

        contacts?.forEach(contact => {
            if (contact.createdAt) {
                try {
                    const creationDate = parseISO(contact.createdAt);
                    if (isWithinInterval(creationDate, { start: thirtyDaysAgo, end: today })) {
                        const dayKey = format(creationDate, 'd');
                        dailyNewContactsMap.set(dayKey, (dailyNewContactsMap.get(dayKey) || 0) + 1);
                    }
                } catch (e) {
                    console.error("Invalid createdAt date for contact:", contact.id, contact.createdAt);
                }
            }
        });

        const activeBuyersEvolutionDataResult: ActiveBuyersEvolutionData[] = Array.from(dailyNewContactsMap.entries()).map(([date, count]) => ({
          date,
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
        <div className="agentfinder-dashboard-page space-y-6 p-4">
            <AddPropertyDialog isOpen={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen} property={null} />
            <AddLeadDialog properties={properties || []} isOpen={isAddLeadOpen} onOpenChange={setIsAddLeadOpen} />
            <AddViewingDialog isOpen={isAddViewingOpen} onOpenChange={setIsAddViewingOpen} onAddViewing={handleAddViewing} contacts={contacts || []} properties={properties || []} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                
                <Card className="agentfinder-dashboard-card shadow-2xl rounded-2xl bg-[#152a47] text-white border-none">
                    <CardHeader className="pt-4 pb-2 text-center">
                        <CardTitle className="text-white text-lg">Performanța Contului Tău</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="agentfinder-dashboard-stat text-center p-3 rounded-lg bg-white/5">
                                <p className="font-bold text-3xl">{activePropertiesCount}</p>
                                <p className="text-xs text-white/70">Proprietăți Active</p>
                            </div>
                            <div className="agentfinder-dashboard-stat text-center p-3 rounded-lg bg-white/5">
                                <p className="font-bold text-3xl">{activeBuyersCount}</p>
                                <p className="text-xs text-white/70">Cumpărători Activi</p>
                            </div>
                            <div className="agentfinder-dashboard-stat text-center p-3 rounded-lg bg-white/5">
                                <p className="font-bold text-3xl">{totalReservedCount}</p>
                                <p className="text-xs text-white/70">Prop. Rezervate</p>
                            </div>
                            <div className="agentfinder-dashboard-stat text-center p-3 rounded-lg bg-white/5">
                                <p className="font-bold text-3xl">{totalSoldCount}</p>
                                <p className="text-xs text-white/70">Prop. Vândute</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                             <Button className="agentfinder-dashboard-soft-button w-full justify-between bg-white/10 text-white hover:bg-white/20 font-semibold rounded-lg h-12 text-sm">
                               <span>Proprietăți Rezervate Luna Curentă</span>
                               <span>{reservedThisMonth.length}</span>
                            </Button>
                             <Button className="agentfinder-dashboard-soft-button w-full justify-between bg-white/10 text-white hover:bg-white/20 font-semibold rounded-lg h-12 text-sm">
                               <span>Proprietăți Vândute Luna Curentă</span>
                               <span>{soldThisMonth.length}</span>
                            </Button>
                        </div>
                        <Separator className="bg-white/10" />
                        <div className="pt-2">
                          <CardTitle className="text-base font-semibold text-white text-center">Conversie Vizionări vs. Tranzacții</CardTitle>
                          <CardDescription className="text-white/80 text-center">Ultimele 30 de zile</CardDescription>
                          <div className="px-0 pt-2">
                              <ConversionChart data={conversionData} />
                          </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
                 <Card className="agentfinder-dashboard-card shadow-2xl rounded-2xl border-none bg-[#152a47]">
                    <CardHeader className="text-white p-4">
                        <CardTitle className="text-base font-semibold text-white">Evoluție Comision Lunar</CardTitle>
                        <CardDescription className="text-white/80">Comision realizat în ultimele luni</CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 pt-4">
                        <SalesChart data={monthlyCommissionData} />
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
