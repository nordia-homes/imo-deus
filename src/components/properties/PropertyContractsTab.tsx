
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilePlus2, Download, Send, MessageSquare } from "lucide-react";

export function PropertyContractsTab({ propertyId }: { propertyId: string }) {
    // Placeholder data, filtered for the current propertyId
    const contracts = [
        { id: 'C001', type: 'Vânzare-Cumpărare', client: 'Alex Popescu', status: 'Semnat', date: '20.05.2024' },
    ];

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Contracte pentru Proprietate</CardTitle>
                    <CardDescription>Generează și urmărește contractele asociate.</CardDescription>
                </div>
                <Button>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Generează Contract
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Tip</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Acțiuni</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contracts.length > 0 ? contracts.map((contract) => (
                            <TableRow key={contract.id}>
                                <TableCell>{contract.id}</TableCell>
                                <TableCell>{contract.type}</TableCell>
                                <TableCell>{contract.client}</TableCell>
                                <TableCell>{contract.date}</TableCell>
                                <TableCell>{contract.status}</TableCell>
                                <TableCell className="text-right space-x-2">
                                     <Button variant="outline" size="icon" title="Trimite pe Email">
                                        <Send className="h-4 w-4" />
                                    </Button>
                                     <Button variant="outline" size="icon" title="Trimite pe WhatsApp">
                                        <MessageSquare className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" title="Descarcă PDF">
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Niciun contract generat pentru această proprietate.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
