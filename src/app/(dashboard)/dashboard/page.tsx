
'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Property, Viewing, Task, Contact, LeadSourceData, SalesData, ConversionData } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { isThisMonth, parseISO, format, isPast, isToday, addDays, isWithinInterval, subDays, eachDayOfInterval } from 'date-fns';
import { ro } from "date-fns/locale";

// Components
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { PriorityTasks } from '@/components/dashboard/PriorityTasks';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { ConversionChart } from '@/components/dashboard/ConversionChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardPropertyList } from '@/components/dashboard/DashboardPropertyList';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import { Button } from '@/components/ui/button';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking } from '@/firebase';
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
        viewingsNext7Days,
        activePropertiesCount,
        monthlyCommissionData,
        realizedCommissionThisMonth,
        todaysTasks,
        todaysViewings,
        conversionData,
        activeBuyersCount,
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

        const now = new Date();
        const sevenDaysFromNow = addDays(now, 7);
        const viewingsNext7Days = viewings?.filter(v => {
            if (v.status !== 'scheduled') return false;
            const viewingDate = parseISO(v.viewingDate);
            return isWithinInterval(viewingDate, { start: now, end: sevenDaysFromNow });
        }) || [];

        const activeProperties = properties?.filter(p => p.status === 'Activ') || [];
        const activePropertiesCount = activeProperties.length;
        
        // Commission Calculations
        const soldOrRentedThisMonth = properties?.filter(p =>
            (p.status === 'Vândut' || p.status === 'Închiriat') &&
            p.statusUpdatedAt &&
            isThisMonth(parseISO(p.statusUpdatedAt))
        ) || [];
        const realizedCommissionThisMonth = soldOrRentedThisMonth.reduce((sum, prop) => sum + calculateCommission(prop), 0);

        // Today's Agenda Calculations
        const todaysTasks = openTasks?.filter(task => {
            try { return isToday(new Date(task.dueDate)); } catch (e) { return false; }
        }) || [];

        const todaysViewings = viewings?.filter(viewing => {
            if (viewing.status !== 'scheduled') return false;
            try { return isToday(parseISO(viewing.viewingDate)); } catch (e) { return false; }
        }) || [];

        // Monthly Commission Data calculation
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
            
        // Conversion Data (last 30 days)
        const thirtyDaysAgo = subDays(new Date(), 30);
        const today = new Date();
        const dateArray = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

        const conversionMap: Map<string, { vizionari: number; tranzactii: number }> = new Map();
        dateArray.forEach(date => {
            conversionMap.set(format(date, 'd MMM', { locale: ro }), { vizionari: 0, tranzactii: 0 });
        });

        viewings?.forEach(viewing => {
            const viewingDate = parseISO(viewing.viewingDate);
            if (isWithinInterval(viewingDate, { start: thirtyDaysAgo, end: today })) {
                const dayKey = format(viewingDate, 'd MMM', { locale: ro });
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
                    const dayKey = format(updatedDate, 'd MMM', { locale: ro });
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


        return {
            soldThisMonth,
            reservedThisMonth,
            totalSoldCount,
            totalReservedCount,
            viewingsNext7Days,
            activePropertiesCount,
            monthlyCommissionData: monthlyCommissionDataResult,
            realizedCommissionThisMonth,
            todaysTasks,
            todaysViewings,
            conversionData: conversionDataResult,
            activeBuyersCount,
        };
    }, [properties, viewings, contacts, openTasks]);
    
    const priorityTasks = useMemo(() => {
        if (!openTasks) return [];
        return openTasks.filter(task => {
            try {
                const dueDate = new Date(task.dueDate);
                return isPast(dueDate) && !isToday(dueDate);
            } catch(e) {
                return false;
            }
        }).slice(0, 5);
    }, [openTasks]);

    const recentContacts = useMemo(() => {
        if (!contacts) return [];
        return [...contacts]
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 10);
    }, [contacts]);

    const isLoading = isAgencyLoading || arePropertiesLoading || areViewingsLoading || areTasksLoading || areContactsLoading;
    
    // --- RENDER ---
    if (isLoading) {
        return (
            <div className="space-y-4 lg:p-0">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-4 bg-[#0F1E33] lg:px-2">
            <AddPropertyDialog isOpen={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen} property={null} />
            <AddLeadDialog properties={properties || []} isOpen={isAddLeadOpen} onOpenChange={setIsAddLeadOpen} />
            <AddViewingDialog isOpen={isAddViewingOpen} onOpenChange={setIsAddViewingOpen} onAddViewing={handleAddViewing} contacts={contacts || []} properties={properties || []} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <QuickActionsCard
                    onAddLead={() => setIsAddLeadOpen(true)}
                    onAddProperty={() => setIsAddPropertyOpen(true)}
                    onAddViewing={() => setIsAddViewingOpen(true)}
                    onAddTask={handleAddTask}
                    contacts={contacts || []}
                    realizedCommissionThisMonth={realizedCommissionThisMonth}
                    viewings={viewingsNext7Days}
                    properties={properties || []}
                    agencyName={agencyName}
                    displayName={displayName}
                />
                
                <Card className="shadow-2xl rounded-2xl bg-[#152a47] text-white border-none">
                    <CardHeader className="pt-4 pb-2 text-center">
                        <CardTitle className="text-white text-lg">Performanța Contului Tău</CardTitle>
                    </CardHeader>
                    <CardContent className="py-4 px-2 pt-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-2xl">{activePropertiesCount}</p>
                                <p className="text-xs text-white/80">Proprietăți Active</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-2xl">{activeBuyersCount}</p>
                                <p className="text-xs text-white/80">Cumpărători Activi</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-2xl">{totalReservedCount}</p>
                                <p className="text-xs text-white/80">Prop. Rezervate</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-2xl">{totalSoldCount}</p>
                                <p className="text-xs text-white/80">Prop. Vândute</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                             <Button className="w-full justify-between bg-white/10 text-white hover:bg-white/20 font-semibold pointer-events-none">
                               <span>Proprietăți Rezervate Luna Curentă</span>
                               <span>{reservedThisMonth.length}</span>
                            </Button>
                             <Button className="w-full justify-between bg-white/10 text-white hover:bg-white/20 font-semibold pointer-events-none">
                               <span>Proprietăți Vândute Luna Curentă</span>
                               <span>{soldThisMonth.length}</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <div className="mt-4">
                <Card className="shadow-2xl rounded-2xl border-none">
                    <CardHeader className="bg-[#152a47] text-white p-3 rounded-t-2xl">
                        <CardTitle className="text-base font-semibold">Conversie Vizionari vs. Tranzactii</CardTitle>
                        <CardDescription className="text-white/80">Ultimele 30 de zile</CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 bg-card rounded-b-2xl">
                        <ConversionChart data={conversionData} />
                    </CardContent>
                </Card>
            </div>
            
            <div className="mt-4">
                 <Card className="shadow-2xl rounded-2xl border-none">
                    <CardHeader className="bg-[#152a47] text-white p-3 rounded-t-2xl">
                        <CardTitle className="text-base font-semibold text-white">Evoluție Comision Lunar</CardTitle>
                        <CardDescription className="text-white/80">Comision realizat în ultimele luni</CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 pt-4 bg-card rounded-b-2xl">
                        <SalesChart data={monthlyCommissionData} />
                    </CardContent>
                </Card>
            </div>

            <div className="mt-4">
                <DashboardPropertyList title="Proprietăți Rezervate" properties={reservedThisMonth} variant="mobile" />
            </div>
            <div className="mt-4">
                <DashboardPropertyList title="Proprietăți Vândute" properties={soldThisMonth} variant="mobile" />
            </div>

            <div className="mt-4">
                <Card className="shadow-2xl rounded-2xl border-none">
                    <CardHeader className="bg-[#152a47] text-white p-3 rounded-t-2xl flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-semibold text-white">Ultimii Cumpărători Adăugați</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 bg-card rounded-b-2xl">
                        {recentContacts.length > 0 ? (
                            <div className="space-y-2">
                                {recentContacts.map(contact => (
                                    <Link href={`/leads/${contact.id}`} key={contact.id} className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent group">
                                        <div>
                                            <p className="font-semibold text-sm group-hover:text-primary">{contact.name}</p>
                                            <p className="text-xs text-muted-foreground">{contact.createdAt ? format(new Date(contact.createdAt), 'd MMM yyyy', { locale: ro }) : ''}</p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">Niciun cumpărător adăugat recent.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="mt-4">
                <PriorityTasks tasks={priorityTasks} isLoading={areTasksLoading} />
            </div>
            <div className="mt-4">
                <RecentActivity />
            </div>
        </div>
    );
}
