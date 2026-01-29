'use client';
import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { PropertyCard } from "./PropertyCard";
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function PropertyList() {
    const { user } = useUser();
    const firestore = useFirestore();

    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [transactionFilter, setTransactionFilter] = useState('all');

    const propertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'properties');
    }, [firestore, user]);

    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    const filteredProperties = useMemo(() => {
        if (!properties) return [];
        return properties.filter(property => {
            const matchesSearch = searchTerm === '' ||
                property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                property.address.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesType = typeFilter === 'all' || property.propertyType === typeFilter;

            const matchesTransaction = transactionFilter === 'all' || property.transactionType === transactionFilter;

            return matchesSearch && matchesType && matchesTransaction;
        });
    }, [properties, searchTerm, typeFilter, transactionFilter]);

    const renderPropertyList = () => {
        if (isLoading) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i}>
                            <Skeleton className="aspect-video w-full" />
                            <div className="p-4 space-y-2">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-8 w-1/3 mt-4" />
                            </div>
                        </Card>
                    ))}
                </div>
            );
        }

        if (!properties || properties.length === 0) {
            return <p className="text-center text-muted-foreground py-10">Nu există proprietăți de afișat. Adaugă una pentru a începe.</p>;
        }

        if (filteredProperties.length === 0) {
            return <p className="text-center text-muted-foreground py-10">Nicio proprietate nu corespunde filtrelor selectate.</p>;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProperties.map(property => (
                    <PropertyCard key={property.id} property={property} />
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
                            <SelectTrigger className="w-full sm:w-[180px]">
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
                            <SelectTrigger className="w-full sm:w-[180px]">
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
