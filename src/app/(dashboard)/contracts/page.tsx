
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function ContractsPage() {
    // Placeholder data
    const contracts = [
        { id: 'C001', property: 'Apartament 2 camere, Dristor', client: 'Alex Popescu', status: 'Semnat', date: '20.05.2024' },
        { id: 'C002', property: 'Garsonieră, Militari', client: 'Ana Ionescu', status: 'Trimis', date: '25.05.2024' },
        { id: 'C003', property: 'Vilă, Pipera', client: 'Dan Georgescu', status: 'Draft', date: '28.05.2024' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Contracte Digitale</h1>
                    <p className="text-muted-foreground">
                        Gestionează, generează și urmărește statusul contractelor.
                    </p>
                </div>
                <Button>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Creează Contract Nou
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Toate Contractele</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID Contract</TableHead>
                                <TableHead>Proprietate</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contracts.map((contract) => (
                                <TableRow key={contract.id}>
                                    <TableCell className="font-medium">{contract.id}</TableCell>
                                    <TableCell>{contract.property}</TableCell>
                                    <TableCell>{contract.client}</TableCell>
                                    <TableCell>{contract.date}</TableCell>
                                    <TableCell><Badge variant={contract.status === 'Semnat' ? 'success' : contract.status === 'Trimis' ? 'warning' : 'secondary' as any}>{contract.status}</Badge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
