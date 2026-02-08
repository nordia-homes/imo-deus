'use client';
import { useMemo, useState } from 'react';
import type { Property } from '@/lib/types';
import { PropertyCard } from "./PropertyCard";
import { Skeleton } from '../ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { locations } from '@/lib/locations';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useFirestore, deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import { DeletePropertyAlert } from './DeletePropertyAlert';
import { Filter } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";


interface PropertyListProps {
    properties: Property[] | null;
    isLoading: boolean;
}

export function PropertyList({ properties, isLoading }: PropertyListProps) {
    const [filters, setFilters] = useState({
        transactionType: 'Toate',
        rooms: [] as number[],
        price: { min: '', max: '' },
        parking: [] as string[],
        heating: [] as string[],
        nearMetro: false,
        minArea: '',
        zones: [] as string[],
        after1977: false,
        furnishing: [] as string[],
        partitioning: [] as string[],
        kitchen: [] as string[],
    });

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const parkingOptions = ['Garaj', 'Loc exterior', 'Subteran', 'Fără'];
    const furnishingOptions = ['Lux', 'Complet', 'Parțial', 'Nemobilat'];
    const heatingOptions = ['Centrală proprie', 'Termoficare', 'Sobă/Șemineu'];
    const partitioningOptions = ['Decomandat', 'Semidecomandat', 'Circular', 'Nedecomandat'];
    const kitchenOptions = ['Deschisă', 'Închisă'];
    
    const zoneOptions = useMemo(() => {
        const allZones = Object.values(locations).flat();
        return [...new Set(allZones)].sort();
    }, []);


    const handleMultiSelectFilter = (filterKey: 'rooms' | 'parking' | 'heating' | 'furnishing' | 'zones' | 'partitioning' | 'kitchen', value: any) => {
        setFilters(prev => {
            const currentValues = prev[filterKey] as any[];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [filterKey]: newValues };
        });
    };

    const filteredProperties = useMemo(() => {
        if (!properties) return [];

        return properties.filter(property => {
            const { transactionType, rooms, price, parking, heating, nearMetro, minArea, zones, after1977, furnishing, partitioning, kitchen } = filters;

            if (transactionType !== 'Toate' && property.transactionType !== transactionType) return false;
            if (after1977 && (!property.constructionYear || property.constructionYear <= 1977)) return false;
            if (nearMetro && !property.nearMetro) return false;
            if (price.min && property.price < parseInt(price.min, 10)) return false;
            if (price.max && property.price > parseInt(price.max, 10)) return false;
            if (minArea && property.squareFootage < parseInt(minArea, 10)) return false;

            if (rooms.length > 0) {
                const roomMatch = rooms.some(r => {
                    if (r === 5) return property.rooms >= 5; // Handle "5+"
                    return property.rooms === r;
                });
                if (!roomMatch) return false;
            }

            if (furnishing.length > 0 && (!property.furnishing || !furnishing.includes(property.furnishing))) return false;
            if (parking.length > 0 && (!property.parking || !parking.includes(property.parking))) return false;
            if (heating.length > 0 && (!property.heatingSystem || !heating.includes(property.heatingSystem))) return false;
            if (zones.length > 0 && (!property.zone || !zones.includes(property.zone))) return false;
            if (partitioning.length > 0 && (!property.partitioning || !partitioning.includes(property.partitioning))) return false;
            if (kitchen.length > 0 && (!property.kitchen || !kitchen.includes(property.kitchen))) return false;

            return true;
        });
    }, [properties, filters]);

    const handleDelete = () => {
        if (!agencyId || !deletingProperty) return;
        const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', deletingProperty.id);
        deleteDocumentNonBlocking(propertyRef);
        toast({
            variant: 'destructive',
            title: "Proprietate ștearsă!",
            description: `Proprietatea "${deletingProperty.title}" a fost ștearsă.`,
        });
        setDeletingProperty(null);
    };
    
    const FilterControls = () => (
      <div className="flex flex-col gap-6">
        <div>
            <Label className="font-semibold mb-3 block">Tip Tranzacție</Label>
            <div className="flex items-center gap-2 flex-wrap pt-2">
                <Button onClick={() => setFilters(f => ({ ...f, transactionType: 'Toate' }))} variant={filters.transactionType === 'Toate' ? 'default' : 'outline'} size="sm" className="rounded-full h-8 font-normal">Toate</Button>
                <Button onClick={() => setFilters(f => ({ ...f, transactionType: 'Vânzare' }))} variant={filters.transactionType === 'Vânzare' ? 'default' : 'outline'} size="sm" className="rounded-full h-8 font-normal">Vânzare</Button>
                <Button onClick={() => setFilters(f => ({ ...f, transactionType: 'Închiriere' }))} variant={filters.transactionType === 'Închiriere' ? 'default' : 'outline'} size="sm" className="rounded-full h-8 font-normal">Închiriere</Button>
            </div>
        </div>
        <div className="space-y-2">
            <h4 className="font-medium text-sm">Număr Camere</h4>
            <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map(num => (
                    <Button key={num} variant={filters.rooms.includes(num) ? "default" : "outline"} onClick={() => handleMultiSelectFilter('rooms', num)} size="sm">{num}{num === 5 ? '+' : ''} cam.</Button>
                ))}
            </div>
        </div>
        <div className="space-y-2">
             <h4 className="font-medium text-sm">Interval Preț (€)</h4>
             <div className="flex gap-2">
                <Input placeholder="Min" value={filters.price.min} onChange={e => setFilters(f => ({...f, price: {...f.price, min: e.target.value}}))} />
                <Input placeholder="Max" value={filters.price.max} onChange={e => setFilters(f => ({...f, price: {...f.price, max: e.target.value}}))} />
             </div>
        </div>
      </div>
    );

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
                    <PropertyCard 
                        key={property.id} 
                        property={property}
                        onDeleteRequest={() => setDeletingProperty(property)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="hidden md:flex items-center gap-2 flex-wrap">
                <Button onClick={() => setFilters(f => ({ ...f, transactionType: 'Toate' }))} variant={filters.transactionType === 'Toate' ? 'default' : 'outline'} size="sm" className="rounded-full h-8 font-normal">Toate</Button>
                <Button onClick={() => setFilters(f => ({ ...f, transactionType: 'Vânzare' }))} variant={filters.transactionType === 'Vânzare' ? 'default' : 'outline'} size="sm" className="rounded-full h-8 font-normal">Vânzare</Button>
                <Button onClick={() => setFilters(f => ({ ...f, transactionType: 'Închiriere' }))} variant={filters.transactionType === 'Închiriere' ? 'default' : 'outline'} size="sm" className="rounded-full h-8 font-normal">Închiriere</Button>

                <Popover>
                    <PopoverTrigger asChild><Button variant={filters.rooms.length > 0 ? "default" : "outline"} size="sm" className="rounded-full h-8 font-normal">Nr. Camere</Button></PopoverTrigger>
                    <PopoverContent className="p-4 w-56">
                        <div className="space-y-2">
                            <h4 className="font-medium text-sm">Număr Camere</h4>
                            {[1, 2, 3, 4, 5].map(num => (
                                <div key={num} className="flex items-center gap-2">
                                    <Checkbox id={`rooms-${num}`} checked={filters.rooms.includes(num)} onCheckedChange={() => handleMultiSelectFilter('rooms', num)} />
                                    <Label htmlFor={`rooms-${num}`} className="font-normal">{num}{num === 5 ? '+' : ''} camere</Label>
                                </div>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                <Popover>
                    <PopoverTrigger asChild><Button variant={filters.price.min || filters.price.max ? "default" : "outline"} size="sm" className="rounded-full h-8 font-normal">Preț</Button></PopoverTrigger>
                    <PopoverContent className="p-4 w-64">
                        <div className="space-y-2">
                             <h4 className="font-medium text-sm">Interval Preț (€)</h4>
                             <div className="flex gap-2">
                                <Input placeholder="Min" value={filters.price.min} onChange={e => setFilters(f => ({...f, price: {...f.price, min: e.target.value}}))} />
                                <Input placeholder="Max" value={filters.price.max} onChange={e => setFilters(f => ({...f, price: {...f.price, max: e.target.value}}))} />
                             </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            
            <div className="md:hidden">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="w-full">
                            <Filter className="mr-2 h-4 w-4" /> Filtrează ({filteredProperties.length})
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-2xl">
                        <SheetHeader className="text-left pb-4">
                            <SheetTitle>Filtre</SheetTitle>
                        </SheetHeader>
                        <div className="px-1 overflow-y-auto max-h-[60vh]">
                           <FilterControls />
                        </div>
                        <SheetFooter className="pt-6">
                            <Button onClick={() => setIsSheetOpen(false)} className="w-full">Vezi {filteredProperties.length} proprietăți</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            </div>

            {renderPropertyList()}
            <DeletePropertyAlert
                isOpen={!!deletingProperty}
                onOpenChange={(isOpen) => !isOpen && setDeletingProperty(null)}
                property={deletingProperty}
                onDelete={handleDelete}
            />
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
