'use client';
import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicPropertyCard } from './PublicPropertyCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

export function PublicPropertyList({ agencyId }: { agencyId: string }) {
    const firestore = useFirestore();

    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [transactionFilter, setTransactionFilter] = useState('all');

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(
            collection(firestore, 'agencies', agencyId, 'properties'),
            where('status', '==', 'Activ')
        );
    }, [firestore, agencyId]);

    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    const filteredProperties = useMemo(() => {
        if (!properties) return [];
        return properties.filter(property => {
            const matchesSearch = searchTerm === '' ||
                (property.title && property.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (property.address && property.address.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesType = typeFilter === 'all' || property.propertyType === typeFilter;
            const matchesTransaction = transactionFilter === 'all' || property.transactionType === transactionFilter;
            
            return matchesSearch && matchesType && matchesTransaction;
        });
    }, [properties, searchTerm, typeFilter, transactionFilter]);

    const renderPropertyList = () => {
        if (isLoading) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-96" />
                    ))}
                </div>
            );
        }

        if (!properties || properties.length === 0) {
            return <p className="text-center text-muted-foreground py-10">Momentan nu există proprietăți active de afișat.</p>;
        }

        if (filteredProperties.length === 0) {
            return <p className="text-center text-muted-foreground py-10">Nicio proprietate nu corespunde filtrelor selectate.</p>;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredProperties.map(property => (
                    <PublicPropertyCard key={property.id} property={property} agencyId={agencyId} />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                    <Input 
                        placeholder="Caută după titlu sau adresă..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="md:max-w-xs"
                    />
                    <div className="flex flex-col sm:flex-row gap-4">
                         <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full sm:w-auto">
                                <SelectValue placeholder="Tip proprietate" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toate Tipurile</SelectItem>
                                <SelectItem value="Apartament">Apartament</SelectItem>
                                <SelectItem value="Casă/Vilă">Casă/Vilă</SelectItem>
                                <SelectItem value="Garsonieră">Garsonieră</SelectItem>
                                <SelectItem value="Teren">Teren</SelectItem>
                                <SelectItem value="Spațiu Comercial">Spațiu Comercial</SelectItem>
                            </SelectContent>
                        </Select>
                         <Select value={transactionFilter} onValueChange={setTransactionFilter}>
                            <SelectTrigger className="w-full sm:w-auto">
                                <SelectValue placeholder="Tip tranzacție" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toate Tranzacțiile</SelectItem>
                                <SelectItem value="Vânzare">Vânzare</SelectItem>
                                <SelectItem value="Închiriere">Închiriere</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
            {renderPropertyList()}
        </div>
    )
}
