'use client';

import { useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Contract, Property, Contact } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Send, MessageSquare } from "lucide-react";
import { AddContractDialog } from "@/components/contracts/AddContractDialog";

export default function ContractsPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const contractsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'contracts');
    }, [firestore, user]);
    const { data: contracts, isLoading: areContractsLoading } = useCollection<Contract>(contractsQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'properties');
    }, [firestore, user]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

    const contactsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'contacts');
    }, [firestore, user]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

    const isLoading = areContractsLoading || arePropertiesLoading || areContactsLoading;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Contracte</h1>
                    <p className="text-muted-foreground">
                        Gestionează, generează și urmărește statusul contractelor.
                    </p>
                </div>
                <AddContractDialog properties={properties || []} contacts={contacts || []} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Listă Contracte</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tip</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Proprietate</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Acțiuni</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : contracts && contracts.length > 0 ? contracts.map((contract) => (
                                <TableRow key={contract.id}>
                                    <TableCell>{contract.contractType}</TableCell>
                                    <TableCell>{contract.contactName}</TableCell>
                                    <TableCell className="max-w-xs truncate">{contract.propertyTitle}</TableCell>
                                    <TableCell>{new Date(contract.date).toLocaleDateString('ro-RO')}</TableCell>
                                    <TableCell><Badge variant="outline">{contract.status}</Badge></TableCell>
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
                                        Niciun contract generat. Folosește butonul de mai sus pentru a începe.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

    