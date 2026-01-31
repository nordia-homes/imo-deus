'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractsList } from '@/components/contracts/ContractsList';
import { GenerateContractDialog } from '@/components/contracts/GenerateContractDialog';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Property, Contact } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { Skeleton } from "@/components/ui/skeleton";

export default function ContractsPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    
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

    const isLoading = arePropertiesLoading || areContactsLoading;
    
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Management Contracte</h1>
                    <p className="text-muted-foreground">
                        Generează, vizualizează și gestionează toate contractele agenției.
                    </p>
                </div>
                {isLoading ? (
                    <Skeleton className="h-10 w-48" />
                ) : (
                    <GenerateContractDialog properties={properties || []} contacts={contacts || []} />
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Toate Contractele</CardTitle>
                    <CardDescription>O listă a tuturor contractelor de vânzare sau închiriere generate.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ContractsList />
                </CardContent>
            </Card>
        </div>
    );
}
