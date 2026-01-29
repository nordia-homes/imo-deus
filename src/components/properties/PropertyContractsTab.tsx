'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FilePlus2, Download, Send, MessageSquare } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import Link from "next/link";


function getStatusBadge(status: string) {
    switch (status) {
        case 'Trimis': return 'warning';
        case 'Semnat': return 'success';
        case 'Draft': return 'secondary';
        case 'Anulat': return 'destructive';
        default: return 'outline';
    }
}


export function PropertyContractsTab({ propertyId }: { propertyId: string }) {
    const { user } = useUser();
    const firestore = useFirestore();

    const contractsQuery = useMemoFirebase(() => {
        if (!user || !propertyId) return null;
        return query(
            collection(firestore, 'users', user.uid, 'contracts'),
            where('propertyId', '==', propertyId)
        );
    }, [firestore, user, propertyId]);
    
    const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Contracte pentru Proprietate</CardTitle>
                    <CardDescription>Generează și urmărește contractele asociate.</CardDescription>
                </div>
                {/* Button is decorative for now until we have contacts list here */}
                <Button disabled>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Generează Contract
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tip</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Acțiuni</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(1)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : contracts && contracts.length > 0 ? contracts.map((contract) => (
                            <TableRow key={contract.id}>
                                <TableCell>{contract.contractType}</TableCell>
                                <TableCell>
                                     <Link href={`/leads/${contract.contactId}`} className="hover:underline">
                                        {contract.contactName}
                                     </Link>
                                </TableCell>
                                <TableCell>{new Date(contract.date).toLocaleDateString('ro-RO')}</TableCell>
                                <TableCell><Badge variant={getStatusBadge(contract.status) as any}>{contract.status}</Badge></TableCell>
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
                                <TableCell colSpan={5} className="h-24 text-center">
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
