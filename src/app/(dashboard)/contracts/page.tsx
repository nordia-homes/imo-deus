'use client';

import { useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Contract, Property, Contact } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Send, MessageSquare, MoreHorizontal } from "lucide-react";
import { AddContractDialog } from "@/components/contracts/AddContractDialog";
import { useToast } from "@/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAgency } from "@/context/AgencyContext";

function getStatusBadge(status: string) {
    switch (status) {
        case 'Trimis': return 'warning';
        case 'Semnat': return 'success';
        case 'Draft': return 'secondary';
        case 'Anulat': return 'destructive';
        default: return 'outline';
    }
}

export default function ContractsPage() {
    const { user } = useUser();
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();

    const contractsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contracts');
    }, [firestore, agencyId]);
    const { data: contracts, isLoading: areContractsLoading } = useCollection<Contract>(contractsQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

    const isLoading = areContractsLoading || arePropertiesLoading || areContactsLoading;

    const handleStatusChange = (contract: Contract, newStatus: Contract['status']) => {
        if (!agencyId) return;
        const contractRef = doc(firestore, 'agencies', agencyId, 'contracts', contract.id);
        updateDocumentNonBlocking(contractRef, { status: newStatus });
        toast({
            title: "Status actualizat!",
            description: `Statusul contractului pentru ${contract.contactName} a fost schimbat în "${newStatus}".`,
        });
    };

    const handleDownloadContract = (contract: Contract) => {
        if (!contract.content) {
            toast({
                variant: "destructive",
                title: "Conținut lipsă",
                description: "Acest contract nu are conținut generat pentru a fi descărcat.",
            });
            return;
        }

        const htmlContent = `
            <html>
                <head>
                    <title>Contract: ${contract.propertyTitle || 'Proprietate'}</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; margin: 40px; color: #333; }
                        h1 { font-size: 24px; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
                        p { margin: 0 0 10px; }
                        strong { font-weight: 600; }
                        hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
                        pre { 
                            white-space: pre-wrap; 
                            font-family: inherit; 
                            font-size: 14px;
                            background-color: #f9f9f9;
                            padding: 20px;
                            border-radius: 5px;
                            border: 1px solid #eee;
                            color: #555;
                        }
                    </style>
                </head>
                <body>
                    <h1>Contract de ${contract.contractType}</h1>
                    <p><strong>Client:</strong> ${contract.contactName}</p>
                    <p><strong>Proprietate:</strong> ${contract.propertyTitle}</p>
                    <p><strong>Data:</strong> ${new Date(contract.date).toLocaleDateString('ro-RO')}</p>
                    <hr />
                    <h2>Conținut Contract:</h2>
                    <pre>${contract.content}</pre>
                </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        } else {
            toast({
                variant: "destructive",
                title: "Eroare la descărcare",
                description: "Browser-ul a blocat deschiderea unei noi ferestre. Vă rugăm să permiteți pop-up-urile pentru acest site.",
            });
        }
    };

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
                                    <TableCell><Badge variant={getStatusBadge(contract.status) as any}>{contract.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acțiuni</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>Schimbă statusul</DropdownMenuSubTrigger>
                                                    <DropdownMenuPortal>
                                                        <DropdownMenuSubContent>
                                                            {['Draft', 'Trimis', 'Semnat', 'Anulat'].map((status) => (
                                                                <DropdownMenuItem
                                                                    key={status}
                                                                    onSelect={() => handleStatusChange(contract, status as Contract['status'])}
                                                                    disabled={contract.status === status}
                                                                >
                                                                    {status}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuPortal>
                                                </DropdownMenuSub>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem disabled>
                                                    <Send className="mr-2 h-4 w-4" /> Trimite pe Email
                                                </DropdownMenuItem>
                                                <DropdownMenuItem disabled>
                                                    <MessageSquare className="mr-2 h-4 w-4" /> Trimite pe WhatsApp
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleDownloadContract(contract)}>
                                                    <Download className="mr-2 h-4 w-4" /> Descarcă PDF
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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
