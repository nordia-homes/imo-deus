
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Users, Building, Eye } from 'lucide-react';

export default function ReportsPage() {
    // Placeholder data
    const agentPerformance = [
        { agent: 'Mihai Ionescu', listingsPublished: 15, totalViews: 1250 },
        { agent: 'Elena Popa', listingsPublished: 12, totalViews: 980 },
        { agent: 'Andrei Stancu', listingsPublished: 18, totalViews: 1520 },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Rapoarte de Promovare</h1>
                <p className="text-muted-foreground">
                    Analizează performanța anunțurilor și a agenților.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Anunțuri Publicate</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">45</div>
                        <p className="text-xs text-muted-foreground">+5 față de săptămâna trecută</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Vizualizări</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">3,750</div>
                        <p className="text-xs text-muted-foreground">+12.1% față de săptămâna trecută</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Agenți Activi</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">3</div>
                         <p className="text-xs text-muted-foreground">Toți au publicat anunțuri luna aceasta</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Performanță pe Agent</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Agent</TableHead>
                                <TableHead>Anunțuri Publicate</TableHead>
                                <TableHead>Total Vizualizări</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {agentPerformance.map((data) => (
                                <TableRow key={data.agent}>
                                    <TableCell className="font-medium">{data.agent}</TableCell>
                                    <TableCell>{data.listingsPublished}</TableCell>
                                    <TableCell>{data.totalViews.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
