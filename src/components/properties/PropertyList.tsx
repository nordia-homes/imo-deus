'use client';
import { useMemo, useState } from 'react';
import type { Property } from '@/lib/types';
import { PropertyCard } from "./PropertyCard";
import { Skeleton } from '../ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import Link from 'next/link';

interface PropertyListProps {
    properties: Property[] | null;
    isLoading: boolean;
    onDeleteRequest: (property: Property) => void;
}

export function PropertyList({ properties, isLoading, onDeleteRequest }: PropertyListProps) {

    const renderPropertyList = () => {
        if (isLoading) {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                         <div key={i} className="space-y-3">
                            <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-5 w-1/3" />
                        </div>
                    ))}
                </div>
            );
        }

        if (!properties || properties.length === 0) {
            return (
                <Card className="shadow-lg rounded-2xl mt-4">
                    <CardContent className="p-10 text-center text-muted-foreground">
                        Nicio proprietate în portofoliu. Apasă "Adaugă Proprietate" pentru a începe.
                    </CardContent>
                </Card>
            )
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {properties.map(property => (
                    <PropertyCard 
                        key={property.id} 
                        property={property}
                        onDeleteRequest={() => onDeleteRequest(property)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4 mt-4">
            {renderPropertyList()}
        </div>
    )
}


export function PublicPropertyList({ properties, agencyId }: { properties: Property[], agencyId: string }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('price-desc');

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
            // Add a sort by creation date as a fallback/default
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

    }, [properties, searchTerm, typeFilter, sortOrder]);

    const propertyTypes = useMemo(() => {
        if (!properties) return [];
        const types = new Set(properties.map(p => p.propertyType));
        return Array.from(types);
    }, [properties]);

    const renderPropertyList = () => {
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
            <Card className="shadow-2xl rounded-2xl sticky top-[80px] z-20">
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
