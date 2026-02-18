
'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Contact, SalesData, BuyerSourceData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { LeadSourceChart } from '@/components/dashboard/lead-source-chart';
import { StatCard } from '@/components/dashboard/StatCard';
import { DollarSign, Target, TrendingUp, Sparkles, Loader2, Lightbulb } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { summarizeReport } from '@/ai/flows/report-summarizer';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function ReportsPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();

    // AI State
    const [aiReport, setAiReport] = useState<{ summary: string; recommendations: string } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);


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

    const { salesData, buyerSourceData, totalWonBuyers, conversionRate, averageDealSize } = useMemo(() => {
        if (!contacts || !wonLeads) {
            return {
                salesData: [],
                buyerSourceData: [],
                totalWonBuyers: 0,
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
        const buyerSourceData: BuyerSourceData[] = Object.keys(sourceCounts).map((source, index) => ({
            source,
            count: sourceCounts[source],
            fill: chartColors[index % chartColors.length],
        }));
        
        // Calculate KPIs
        const totalWonBuyers = wonLeads.length;
        const totalLeads = contacts.length;
        const conversionRate = totalLeads > 0 ? (totalWonBuyers / totalLeads) * 100 : 0;
        const totalSalesVolume = wonLeads.reduce((sum, lead) => sum + (lead.budget || 0), 0);
        const averageDealSize = totalWonBuyers > 0 ? totalSalesVolume / totalWonBuyers : 0;


        return { salesData, buyerSourceData, totalWonBuyers, conversionRate, averageDealSize };

    }, [contacts, wonLeads]);
    
    const handleGenerateReport = async () => {
        setIsGenerating(true);
        setAiReport(null);
        try {
            const result = await summarizeReport({
                salesData,
                leadSourceData: buyerSourceData,
                kpis: {
                    totalWonLeads: totalWonBuyers,
                    conversionRate,
                    averageDealSize
                }
            });
            setAiReport(result);
            toast({
                title: 'Analiză completă!',
                description: 'Rezumatul performanței agenției este gata.'
            });
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'A apărut o eroare',
                description: 'Nu am putut genera analiza AI. Vă rugăm să reîncercați.'
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 bg-[#0F1E33] text-white p-4 lg:p-6">
            <div>
                <h1 className="text-3xl font-headline font-bold text-white">Rapoarte de Performanță</h1>
                <p className="text-white/70">
                    Analizează performanța vânzărilor și eficiența canalelor de marketing.
                </p>
            </div>
            
             <Card className="shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
                <CardHeader className="text-center">
                    <CardTitle className="flex items-center justify-center gap-2 text-white">
                        <Lightbulb className="text-primary"/>
                        Analiză și Recomandări AI
                    </CardTitle>
                    <CardDescription className="text-white/70">
                        Obține o sinteză a datelor de performanță și recomandări personalizate generate de AI.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isGenerating && (
                        <div className="flex items-center justify-center p-8 text-white/70">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            <span>AI-ul analizează datele...</span>
                        </div>
                    )}
                    {!isGenerating && aiReport && (
                        <div className="space-y-4">
                            <Alert className="bg-white/5 border-white/10 text-white">
                                <AlertTitle className="font-semibold text-white">Sinteză Performanță</AlertTitle>
                                <AlertDescription className="text-white/90">
                                    {aiReport.summary}
                                </AlertDescription>
                            </Alert>
                            <Alert variant="default" className="bg-primary/10 border-primary/20 text-white">
                                <AlertTitle className="font-semibold text-primary">Recomandări</AlertTitle>
                                <AlertDescription className="text-white/90">
                                    <ul className="list-disc pl-5 space-y-1 mt-2">
                                        {aiReport.recommendations.split('\n').map((rec, i) => rec.trim() && <li key={i}>{rec.replace('-', '').trim()}</li>)}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                    {!isGenerating && !aiReport && (
                         <div className="flex flex-col items-center justify-center text-center p-8 space-y-2">
                            <p className="text-sm text-white/70">Apasă pe buton pentru a începe analiza AI.</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="justify-center">
                    <Button onClick={handleGenerateReport} disabled={isLoading || isGenerating} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {aiReport ? 'Regenerează Analiza' : 'Generează Analiza AI'}
                    </Button>
                </CardFooter>
            </Card>

            {/* Stat Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                {isLoading ? (
                    <>
                        <Skeleton className="h-[126px] bg-white/10" />
                        <Skeleton className="h-[126px] bg-white/10" />
                        <Skeleton className="h-[126px] bg-white/10" />
                    </>
                ) : (
                    <>
                        <StatCard className="bg-[#152A47] border-none text-white" title="Total Cumpărători Câștigați" value={totalWonBuyers.toString()} icon={<DollarSign />} period="Număr total de tranzacții"/>
                        <StatCard className="bg-[#152A47] border-none text-white" title="Rata de Conversie" value={`${conversionRate.toFixed(1)}%`} icon={<Target />} period="Din totalul de cumpărători"/>
                        <StatCard className="bg-[#152A47] border-none text-white" title="Valoare Medie Tranzacție" value={`€${averageDealSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<TrendingUp />} period="Pe tranzacție câștigată"/>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                 {/* Sales Chart */}
                <Card className="lg:col-span-3 shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
                    <CardHeader>
                        <CardTitle className="text-white">Volum Vânzări Lunare</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : <SalesChart data={salesData} />}
                    </CardContent>
                </Card>

                 {/* Lead Source Chart */}
                <Card className="lg:col-span-2 shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
                    <CardHeader>
                        <CardTitle className="text-white">Distribuție Surse Cumpărători</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : <LeadSourceChart data={buyerSourceData} />}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
