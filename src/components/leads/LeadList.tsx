
'use client';

import {
  Table,
  TableBody,
  TableHeader,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { LeadCard } from "./LeadCard";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Skeleton } from "../ui/skeleton";
import type { Contact } from "@/lib/types";
import { useAgency } from "@/context/AgencyContext";

export function LeadList() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const contactsCollection = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);

    const { data: leads, isLoading } = useCollection<Contact>(contactsCollection);

    if (isLoading) {
        return (
            <Card className="shadow-2xl rounded-2xl">
                <CardHeader>
                    <CardTitle>Listă Lead-uri</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }
  
  return (
    <Card className="shadow-2xl rounded-2xl">
        <CardHeader>
            <CardTitle>Listă Lead-uri</CardTitle>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Nume</TableHead>
                    <TableHead>Prioritate</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Buget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scor AI</TableHead>
                    <TableHead></TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                    {leads && leads.length > 0 ? leads.map(lead => (
                        <LeadCard key={lead.id} lead={lead} />
                    )) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                Nu ai adăugat niciun lead. Folosește butonul "Adaugă Lead" pentru a începe.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );
}
