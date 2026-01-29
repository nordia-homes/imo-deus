import { StatCard } from '@/components/dashboard/StatCard';
import { PriorityTasks } from '@/components/dashboard/PriorityTasks';
import { AiHelperCard } from '@/components/dashboard/AiHelperCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { SalesAnalyticsChart } from '@/components/dashboard/SalesAnalyticsChart';
import { Building, TrendingUp, Users } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Lead-uri" value="74" change="+4" changeType="increase" period="față de luna trecută" icon={<Users />} />
        <StatCard title="Volum Vânzări" value="€35,520" change="-8%" changeType="decrease" period="față de luna trecută" icon={<TrendingUp />} />
        <StatCard title="Proprietăți Active" value="22" change="+6" changeType="increase" period="față de luna trecută" icon={<Building />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <SalesAnalyticsChart />
        </div>
        <div className="space-y-6">
            <PriorityTasks />
            <AiHelperCard />
        </div>
      </div>
      
      <RecentActivity />
    </div>
  );
}
