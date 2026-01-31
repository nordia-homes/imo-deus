'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Download, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function getStatusBadge(status: string) {
    switch (status) {
        case 'Trimis': return 'warning';
        case 'Semnat': return 'success';
        case 'Draft': return 'secondary';
        case 'Anulat': return 'destructive';
        default: return 'outline';
    }
}

export function ContractsList() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();

    const contractsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'contracts'), orderBy('date', 'desc'));
    }, [firestore, agencyId]);

    const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

    const handleDownload = (contract: Contract) => {
        if (!contract.content) {
            toast({ variant: 'destructive', title: 'Conținut lipsă', description: 'Acest contract nu are conținut care poate fi descărcat.' });
            return;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="ro">
            <head>
                <meta charset="UTF-8">
                <title>Contract: ${contract.propertyTitle}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; line-height: 1.6; margin: 40px; color: #000; }
                    h1, h2 { text-align: center; }
                    pre { white-space: pre-wrap; font-family: inherit; font-size: 12pt; }
                </style>
            </head>
            <body>
                <h1>CONTRACT DE ${contract.contractType.toUpperCase()}</h1>
                <pre>${contract.content}</pre>
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Contract-${contract.contractType}-${contract.contactName?.replace(' ', '_')}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Proprietate</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Dată</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {contracts && contracts.length > 0 ? contracts.map((contract) => (
                    <TableRow key={contract.id}>
                        <TableCell className="font-medium">
                            <Link href={`/properties/${contract.propertyId}`} className="hover:underline">{contract.propertyTitle}</Link>
                        </TableCell>
                        <TableCell>
                            <Link href={`/leads/${contract.contactId}`} className="hover:underline">{contract.contactName}</Link>
                        </TableCell>
                        <TableCell>{contract.contractType}</TableCell>
                        <TableCell>{new Date(contract.date).toLocaleDateString('ro-RO')}</TableCell>
                        <TableCell><Badge variant={getStatusBadge(contract.status) as any}>{contract.status}</Badge></TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDownload(contract)} title="Descarcă">
                                <Download className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">Niciun contract generat încă.</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )
}
