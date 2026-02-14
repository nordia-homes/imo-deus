'use client';

import type { Property } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BedDouble, Bath, Ruler, Edit, Link2 } from 'lucide-react';
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
            <Card className="mx-2 lg:mx-0 rounded-2xl shadow-2xl bg-[#152A47]">
                <CardContent className="p-4">
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        );
    }
    
    if (isEditing) {
         return (
             <Card className="mx-2 lg:mx-0 rounded-2xl shadow-2xl bg-[#152A47] text-white">
                <CardHeader className="pb-4 pt-4">
                    <CardTitle className="text-base text-white">Schimbă Proprietate Sursă</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={handleSelectChange} defaultValue={property?.id || 'none'}>
                        <SelectTrigger className="bg-white/10 border-white/20">
                            <SelectValue placeholder="Selectează proprietatea..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Niciuna</SelectItem>
                            {allProperties.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" onClick={() => setIsEditing(false)} className="mt-2 w-full text-white/80">Anulează</Button>
                </CardContent>
            </Card>
        )
    }
    
    return (
        <Card className="mx-2 lg:mx-0 rounded-2xl shadow-2xl bg-[#152A47] text-white">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                <CardTitle className="text-base font-semibold text-white">
                    Proprietate Inițială
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {!property ? (
                    <div className="text-center text-white/70 py-4">
                         <p className="text-sm mb-2">Nicio proprietate sursă asociată.</p>
                         <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} className="bg-white/10 hover:bg-white/20 text-white">Asociază o proprietate</Button>
                    </div>
                ) : (
                    <Link href={`/properties/${property.id}`} className="block group">
                        <div className="flex gap-4 items-center">
                            <div className="relative h-20 w-20 shrink-0">
                                <Image
                                    src={property.images?.[0]?.url || 'https://placehold.co/200x200'}
                                    alt={property.title || 'Proprietate'}
                                    fill
                                    sizes="80px"
                                    className="object-cover rounded-md"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold group-hover:underline text-sm" title={property.title}>
                                  {property.title.length > 20 ? `${property.title.substring(0, 20)}...` : property.title}
                                </p>
                                <p className="text-xs text-white/70 break-words">{property.location}</p>
                                <p className="font-bold text-base text-white mt-1">€{property.price.toLocaleString()}</p>
                            </div>
                            <Link2 className="h-5 w-5 text-white/70 group-hover:text-white" />
                        </div>
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}
