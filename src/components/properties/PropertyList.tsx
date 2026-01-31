'use client';
import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { PropertyCard } from "./PropertyCard";
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAgency } from '@/context/AgencyContext';
import { properties as sampleProperties } from '@/lib/data';

export function PropertyList() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [transactionFilter, setTransactionFilter] = useState('all');

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);

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
                         <div key={i} className="space-y-3">
                            <Skeleton className="aspect-square w-full rounded-xl" />
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-5 w-1/3" />
                        </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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


export function PublicPropertyList({ agencyId }: { agencyId: string }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('price-desc');

    const properties = useMemo(() => sampleProperties.filter(p => p.status === 'Activ'), []);
    const isLoading = false;

    const filteredAndSortedProperties = useMemo(() => {
        if (!properties) return [];

        const filtered = properties.filter(property => {
            const matchesSearch = searchTerm === '' ||
                (property.title && property.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (property.address && property.address.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesType = typeFilter === 'all' || property.propertyType === typeFilter;
            
            return matchesSearch && matchesType;
        });

        return [...filtered].sort((a, b) => {
            if (sortOrder === 'price-desc') {
                return b.price - a.price;
            }
            if (sortOrder === 'price-asc') {
                return a.price - b.price;
            }
            return 0;
        });

    }, [properties, searchTerm, typeFilter, sortOrder]);

    const propertyTypes = useMemo(() => {
        if (!properties) return [];
        const types = new Set(properties.map(p => p.propertyType));
        return Array.from(types);
    }, [properties]);

    const renderPropertyList = () => {
        if (isLoading) {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="space-y-3">
                            <Skeleton className="aspect-square w-full rounded-xl" />
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-5 w-1/3" />
                        </div>
                    ))}
                </div>
            );
        }

        if (!properties) {
             return <p className="text-center text-muted-foreground py-10">A apărut o eroare la încărcarea proprietăților.</p>;
        }

        if (filteredAndSortedProperties.length === 0) {
            return <p className="text-center text-muted-foreground py-10">Nicio proprietate nu corespunde căutării.</p>;
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
                {filteredAndSortedProperties.map(property => (
                    <PropertyCard key={property.id} property={property} agencyId={agencyId} />
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-md rounded-xl sticky top-[80px] z-20">
                <CardContent className="p-3 flex flex-col md:flex-row gap-2">
                    <Input 
                        placeholder="Caută după titlu sau adresă..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-12 rounded-lg"
                    />
                    <div className="grid grid-cols-2 gap-2">
                         <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="h-12 rounded-lg">
                                <SelectValue placeholder="Toate Tipurile" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toate Tipurile</SelectItem>
                                {propertyTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         <Select value={sortOrder} onValueChange={setSortOrder}>
                            <SelectTrigger className="h-12 rounded-lg">
                                <SelectValue placeholder="Sortează" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="price-desc">Preț (descrescător)</SelectItem>
                                <SelectItem value="price-asc">Preț (crescător)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
            {renderPropertyList()}
        </div>
    )
}
