'use client';

import type { Property } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BedDouble, Bath, Ruler, Edit } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SourcePropertyCardProps {
    property: Property | null;
    isLoading: boolean;
    allProperties: Property[];
    onUpdateContact: (data: { sourcePropertyId: string | null }) => void;
}

export function SourcePropertyCard({ property, isLoading, allProperties, onUpdateContact }: SourcePropertyCardProps) {
    const [isEditing, setIsEditing] = useState(false);

    const handleSelectChange = (propertyId: string) => {
        onUpdateContact({ sourcePropertyId: propertyId === 'none' ? null : propertyId });
        setIsEditing(false);
    };

    if (isLoading) {
        return (
            <Card className="rounded-2xl shadow-2xl">
                <CardHeader className="pb-2 pt-2">
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="aspect-[4/3] w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-5 w-1/3" />
                </CardContent>
            </Card>
        );
    }
    
    if (isEditing) {
         return (
             <Card className="rounded-2xl shadow-2xl">
                <CardHeader className="pb-4 pt-2">
                <CardTitle className="text-base">Selectează Proprietate Sursă</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={handleSelectChange} defaultValue={property?.id || 'none'}>
                        <SelectTrigger>
                        <SelectValue placeholder="Selectează proprietatea..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Niciuna</SelectItem>
                            {allProperties.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        )
    }
    
    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between p-3">
                <Button variant="default" size="sm" className="pointer-events-none">
                    Proprietate Inițială
                </Button>
                {property && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {!property ? (
                    <div className="text-center text-muted-foreground py-6">
                         <p className="text-sm mb-2">Nicio proprietate sursă asociată.</p>
                         <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>Asociază o proprietate</Button>
                    </div>
                ) : (
                    <Link href={`/properties/${property.id}`} className="block group">
                        <div className="overflow-hidden rounded-lg">
                            <div className="aspect-[4/3] relative">
                                <Image
                                    src={property.images?.[0]?.url || 'https://via.placeholder.com/800x600.png?text=Imagine+lipsa'}
                                    alt={property.title || 'Proprietate'}
                                    fill
                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                            </div>
                            <div className="pt-3">
                                <p className="font-bold text-lg text-primary">€{property.price.toLocaleString()}</p>
                                <p className="font-semibold truncate group-hover:underline">{property.title}</p>
                                <p className="text-xs text-muted-foreground">{property.location}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                                    <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {property.bedrooms}</span>
                                    <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {property.bathrooms}</span>
                                    <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {property.squareFootage} m²</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}
