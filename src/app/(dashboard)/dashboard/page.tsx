
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, Building2, CheckSquare } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-headline font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Bun venit! Iată o privire de ansamblu asupra afacerii tale.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead-uri Noi</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+25</div>
            <p className="text-xs text-muted-foreground">+10.2% luna trecută</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proprietăți Vândute</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+7</div>
            <p className="text-xs text-muted-foreground">+5.1% luna trecută</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Venit Total</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€1.2M</div>
            <p className="text-xs text-muted-foreground">+12.4% luna trecută</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task-uri Completate</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">15 în așteptare</p>
          </CardContent>
        </Card>
      </div>

       <div className="grid gap-4 md:grid-cols-2">
         <Card>
           <CardHeader>
             <CardTitle>Performanță Vânzări</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground">Componenta grafic vânzări aici.</p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader>
             <CardTitle>Surse Lead-uri</CardTitle>
           </CardHeader>
           <CardContent>
            <p className="text-muted-foreground">Componenta grafic surse aici.</p>
           </CardContent>
         </Card>
       </div>
    </div>
  );
}
