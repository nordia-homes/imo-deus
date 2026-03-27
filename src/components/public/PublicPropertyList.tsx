'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { PublicPropertyCard } from "./PublicPropertyCard";
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function PublicPropertyList({ agencyId }: { agencyId: string }) {
    const firestore = useFirestore();

    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('price-desc');

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        // Query only for active properties for public view
        return query(collection(firestore, 'agencies', agencyId, 'properties'), where('status', '==', 'Activ'));
    }, [firestore, agencyId]);

    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    const filteredAndSortedProperties = useMemo(() => {
        if (!properties) return [];
        
        let processed = properties.filter(property => {
            const matchesSearch = searchTerm === '' ||
                property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                property.address.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesType = typeFilter === 'all' || property.propertyType === typeFilter;
            
            return matchesSearch && matchesType;
        });

        processed.sort((a, b) => {
            switch(sortOrder) {
                case 'price-asc': return a.price - b.price;
                case 'price-desc': return b.price - a.price;
                case 'date-desc': return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                default: return 0;
            }
        });

        return processed;
    }, [properties, searchTerm, typeFilter, sortOrder]);

    const renderPropertyList = () => {
        if (isLoading) {
            return (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:gap-5">
                    {[...Array(6)].map((_, i) => (
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
            return <p className="text-center text-muted-foreground py-10 col-span-full">Nu există proprietăți publice de afișat pentru această agenție.</p>;
        }

        if (filteredAndSortedProperties.length === 0) {
            return <p className="text-center text-muted-foreground py-10 col-span-full">Nicio proprietate nu corespunde filtrelor selectate.</p>;
        }

        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:gap-5">
                {filteredAndSortedProperties.map(property => (
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
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger>
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
                         <Select value={sortOrder} onValueChange={setSortOrder}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ordonează după" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="price-desc">Preț (descrescător)</SelectItem>
                                <SelectItem value="price-asc">Preț (crescător)</SelectItem>
                                <SelectItem value="date-desc">Cele mai noi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
            {renderPropertyList()}
        </div>
    )
}
