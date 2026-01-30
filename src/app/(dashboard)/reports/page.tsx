'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Contact, SalesData, LeadSourceData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { LeadSourceChart } from '@/components/dashboard/lead-source-chart';
import { StatCard } from '@/components/dashboard/StatCard';
import { DollarSign, Target, TrendingUp } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';

export default function ReportsPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    // Fetch all contacts
    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);
    
    // Fetch only won contacts for sales volume
    const wonLeadsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'contacts'), where('status', '==', 'Câștigat'));
    }, [firestore, agencyId]);
    const { data: wonLeads, isLoading: areWonLeadsLoading } = useCollection<Contact>(wonLeadsQuery);

    const isLoading = areContactsLoading || areWonLeadsLoading;

    const { salesData, leadSourceData, totalWonLeads, conversionRate, averageDealSize } = useMemo(() => {
        if (!contacts || !wonLeads) {
            return {
                salesData: [],
                leadSourceData: [],
                totalWonLeads: 0,
                conversionRate: 0,
                averageDealSize: 0,
            };
        }

        // Process sales data (monthly sales volume from won leads)
        const monthlySales: { [key: string]: { sales: number, date: Date } } = {};
        wonLeads.forEach(lead => {
            if (lead.createdAt) {
                const date = new Date(lead.createdAt);
                const monthKey = `${date.getFullYear()}-${date.getMonth()}`; // '2024-0' for Jan
                if (!monthlySales[monthKey]) {
                    monthlySales[monthKey] = { sales: 0, date: new Date(date.getFullYear(), date.getMonth(), 1) };
                }
                monthlySales[monthKey].sales += (lead.budget || 0);
            }
        });

        const salesData: SalesData[] = Object.values(monthlySales)
            .sort((a,b) => a.date.getTime() - b.date.getTime())
            .map(data => ({
                month: data.date.toLocaleString('ro-RO', { month: 'short' }), // "ian."
                sales: data.sales,
            }));


        // Process lead source data
        const sourceCounts: { [key: string]: number } = {};
        contacts.forEach(contact => {
            const source = contact.source || 'Necunoscută';
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });
        const chartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE'];
        const leadSourceData: LeadSourceData[] = Object.keys(sourceCounts).map((source, index) => ({
            source,
            count: sourceCounts[source],
            fill: chartColors[index % chartColors.length],
        }));
        
        // Calculate KPIs
        const totalWonLeads = wonLeads.length;
        const totalLeads = contacts.length;
        const conversionRate = totalLeads > 0 ? (totalWonLeads / totalLeads) * 100 : 0;
        const totalSalesVolume = wonLeads.reduce((sum, lead) => sum + (lead.budget || 0), 0);
        const averageDealSize = totalWonLeads > 0 ? totalSalesVolume / totalWonLeads : 0;


        return { salesData, leadSourceData, totalWonLeads, conversionRate, averageDealSize };

    }, [contacts, wonLeads]);
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Rapoarte de Performanță</h1>
                <p className="text-muted-foreground">
                    Analizează performanța vânzărilor și eficiența canalelor de marketing.
                </p>
            </div>
            
            {/* Stat Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                {isLoading ? (
                    <>
                        <Skeleton className="h-[126px]" />
                        <Skeleton className="h-[126px]" />
                        <Skeleton className="h-[126px]" />
                    </>
                ) : (
                    <>
                        <StatCard title="Total Vânzări Câștigate" value={totalWonLeads.toString()} icon={<DollarSign />} period="Număr total de tranzacții"/>
                        <StatCard title="Rata de Conversie" value={`${conversionRate.toFixed(1)}%`} icon={<Target />} period="Din totalul de lead-uri"/>
                        <StatCard title="Valoare Medie Tranzacție" value={`€${averageDealSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<TrendingUp />} period="Pe tranzacție câștigată"/>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                 {/* Sales Chart */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Volum Vânzări Lunare</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[250px] w-full" /> : <SalesChart data={salesData} />}
                    </CardContent>
                </Card>

                 {/* Lead Source Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Distribuție Surse Lead-uri</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Skeleton className="h-[250px] w-full" /> : <LeadSourceChart data={leadSourceData} />}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
