'use client';
import { useMemo, useState, useEffect } from 'react';
import type { Property } from '@/lib/types';
import { PropertyCard } from "./PropertyCard";
import { Skeleton } from '../ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Filter, LayoutGrid, List } from 'lucide-react';
import { isThisMonth } from 'date-fns';

const filterChips = ["Toate", "Vânzare", "Închiriere", "Noi", ">100k€", "2+ camere", "București"];

export function PropertyList() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const [activeFilters, setActiveFilters] = useState<string[]>(['Toate']);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);

    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    const handleFilterClick = (filter: string) => {
        setActiveFilters(prev => {
            if (filter === 'Toate') {
                return ['Toate'];
            }
            const newFilters = prev.filter(f => f !== 'Toate');
            if (newFilters.includes(filter)) {
                const afterRemove = newFilters.filter(f => f !== filter);
                return afterRemove.length === 0 ? ['Toate'] : afterRemove;
            }
            return [...newFilters, filter];
        });
    };

    const filteredProperties = useMemo(() => {
        if (!properties) return [];
        if (activeFilters.includes('Toate')) return properties;

        return properties.filter(property => {
            return activeFilters.every(filter => {
                switch(filter) {
                    case 'Vânzare': return property.transactionType === 'Vânzare';
                    case 'Închiriere': return property.transactionType === 'Închiriere';
                    case 'Noi': return property.createdAt && isThisMonth(new Date(property.createdAt));
                    case '>100k€': return property.price > 100000;
                    case '2+ camere': return property.rooms >= 2;
                    case 'București': return property.location.toLowerCase().includes('bucurești');
                    default: return true;
                }
            });
        });
    }, [properties, activeFilters]);

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
            return <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-2xl"><h3 className="text-lg font-semibold">Nicio proprietate</h3><p className="text-muted-foreground text-sm">Adaugă o proprietate pentru a începe.</p></div>;
        }

        if (filteredProperties.length === 0) {
            return <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-2xl"><h3 className="text-lg font-semibold">Niciun rezultat</h3><p className="text-muted-foreground text-sm">Nicio proprietate nu corespunde filtrelor selectate.</p></div>;
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProperties.map(property => (
                    <PropertyCard key={property.id} property={property} />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
                 {filterChips.map((filter) => (
                    <Button
                    key={filter}
                    variant={activeFilters.includes(filter) ? "default" : "outline"}
                    size="sm"
                    className="rounded-full h-8 font-normal bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    onClick={() => handleFilterClick(filter)}
                    >
                    {filter}
                    </Button>
                ))}
                <Button variant="outline" size="sm" className="rounded-full h-8 font-normal bg-card">
                    <Filter className="mr-1 h-3 w-3" />
                    Filtre
                </Button>
                <div className="flex-1" />
                <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 hidden md:inline-flex" onClick={() => setViewMode('grid')}>
                    <LayoutGrid className="h-4 w-4" />
                </Button>
                 <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 hidden md:inline-flex" onClick={() => setViewMode('list')}>
                    <List className="h-4 w-4" />
                </Button>
            </div>
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
