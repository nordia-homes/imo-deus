
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { LeadList } from '@/components/leads/LeadList';
import { StatCard } from '@/components/dashboard/StatCard';
import { Users, Target, BarChart } from 'lucide-react';

export default function LeadsPage() {
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
            <StatCard title="Lead-uri Noi" value="12" change="+3" changeType="increase" period="săptămâna aceasta" icon={<Users />} />
            <StatCard title="Buget Total Estimat" value="€4.2M" change="+€500k" changeType="increase" period="față de luna trecută" icon={<Target />} />
            <StatCard title="Scor Mediu AI" value="78" change="-2" changeType="decrease" period="față de luna trecută" icon={<BarChart />} />
        </div>

        <LeadList />
    </div>
  );
}
