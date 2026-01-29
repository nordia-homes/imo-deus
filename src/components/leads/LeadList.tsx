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
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Skeleton } from "../ui/skeleton";

export function LeadList() {
    const { user } = useUser();
    const firestore = useFirestore();

    const contactsCollection = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'contacts');
    }, [firestore, user]);

    const { data: leads, isLoading } = useCollection<any>(contactsCollection);

    if (isLoading) {
        return (
            <Card>
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
    <Card>
        <CardHeader>
            <CardTitle>Listă Lead-uri</CardTitle>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Nume</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Sursă</TableHead>
                    <TableHead>Buget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scor AI</TableHead>
                    <TableHead>Urgență</TableHead>
                    <TableHead></TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                    {leads && leads.length > 0 ? leads.map(lead => (
                        <LeadCard key={lead.id} lead={{
                            ...lead,
                            aiScore: lead.aiScore || Math.floor(Math.random() * 40) + 60, // Placeholder
                            urgency: ['Ridicata', 'Medie', 'Scazuta'][Math.floor(Math.random() * 3)] // Placeholder
                        }} />
                    )) : (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center">
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
