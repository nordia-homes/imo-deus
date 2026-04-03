'use client';

import type { Property } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BedDouble, Bath, Ruler, Edit, Link2, Calendar, Layers } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
                <CardHeader className="p-4 pb-2 pt-4">
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
        <div className="mx-2 lg:mx-0">
             {!property ? (
                <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                    <CardHeader className="p-4 pb-2 pt-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-semibold text-white">
                            Proprietate Inițială
                        </CardTitle>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white" onClick={() => setIsEditing(true)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-center text-white/70 py-4">
                            <p className="text-sm mb-2">Nicio proprietate sursă asociată.</p>
                            <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} className="bg-white/10 hover:bg-white/20 text-white">Asociază o proprietate</Button>
                        </div>
                    </CardContent>
                </Card>
             ) : (
                <>
                    {/* Desktop View */}
                    <div className="hidden lg:block group">
                        <div className="relative w-full overflow-hidden rounded-xl bg-slate-900 text-white shadow-lg h-full flex flex-col">
                            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-2 bg-gradient-to-b from-black/60 to-transparent">
                                <h3 className="text-base font-semibold text-white pl-1">
                                    Proprietate Inițială
                                </h3>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setIsEditing(true)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                            
                            <Link href={`/properties/${property.id}`} className="block">
                                <div className="relative aspect-[2/1] w-full">
                                    <Image
                                        src={property.images?.[0]?.url || 'https://placehold.co/800x600?text=Imagine+lipsa'}
                                        alt={property.title || 'Proprietate'}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                        sizes="(max-width: 1023px) 100vw, 25vw"
                                    />
                                    <div className="hidden lg:flex absolute bottom-2 left-2 right-2 justify-start items-center gap-1.5">
                                        <Button variant="secondary" size="sm" className="pointer-events-none shrink-0 h-auto py-1 px-2 text-xs bg-black/50 text-white hover:bg-black/70">
                                            <BedDouble className="mr-1 h-4 w-4" /> {property.rooms}
                                        </Button>
                                        <Button variant="secondary" size="sm" className="pointer-events-none shrink-0 h-auto py-1 px-2 text-xs bg-black/50 text-white hover:bg-black/70">
                                            <Ruler className="mr-1 h-4 w-4" /> {property.squareFootage} mp
                                        </Button>
                                        {property.floor && (
                                            <Button variant="secondary" size="sm" className="pointer-events-none shrink-0 h-auto py-1 px-2 text-xs bg-black/50 text-white hover:bg-black/70">
                                                <Layers className="mr-1 h-4 w-4" /> Et. {property.floor}
                                            </Button>
                                        )}
                                        {property.constructionYear && (
                                            <Button variant="secondary" size="sm" className="pointer-events-none shrink-0 h-auto whitespace-nowrap py-1 px-3 text-xs bg-black/50 text-white hover:bg-black/70">
                                                <Calendar className="mr-1 h-4 w-4" /> {property.constructionYear}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="relative p-3 space-y-2 flex-1 flex flex-col">
                                    <h4 className="font-bold text-base hover:underline break-words" title={property.title}>{(property.title || '').length > 25 ? `${(property.title || '').substring(0, 25)}...` : property.title}</h4>
                                    <p className="text-sm text-slate-300 break-words">{property.address}</p>
                                    <div className="pt-1 mt-auto flex justify-between items-end">
                                        <p className="text-xl font-extrabold text-white">€{property.price.toLocaleString()}</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Mobile view */}
                    <div className="block lg:hidden">
                        <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 pt-4">
                                <CardTitle className="text-base font-semibold text-white">
                                    Proprietate Inițială
                                </CardTitle>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white" onClick={() => setIsEditing(true)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
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
                                            {(property.title || '').length > 25 ? `${(property.title || '').substring(0, 25)}...` : property.title}
                                            </p>
                                            <p className="text-xs text-white/70 break-words">{property.location}</p>
                                            <p className="font-bold text-base text-white mt-1">€{property.price.toLocaleString()}</p>
                                        </div>
                                        <Link2 className="h-5 w-5 text-white/70 group-hover:text-white" />
                                    </div>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
