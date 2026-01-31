'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FilePlus2, Download, Send, MessageSquare } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import Link from "next/link";
import { useAgency } from "@/context/AgencyContext";
import { useToast } from "@/hooks/use-toast";


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
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();

    const contractsQuery = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return query(
            collection(firestore, 'agencies', agencyId, 'contracts'),
            where('propertyId', '==', propertyId)
        );
    }, [firestore, agencyId, propertyId]);
    
    const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);
    
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
                                     <Button variant="outline" size="icon" title="Trimite pe Email" disabled>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                     <Button variant="outline" size="icon" title="Trimite pe WhatsApp" disabled>
                                        <MessageSquare className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" title="Descarcă PDF" onClick={() => handleDownloadContract(contract)}>
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
