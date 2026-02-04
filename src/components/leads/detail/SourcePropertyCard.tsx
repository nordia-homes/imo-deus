'use client';

import type { Property } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

interface SourcePropertyCardProps {
    property: Property | null;
    isLoading: boolean;
}

export function SourcePropertyCard({ property, isLoading }: SourcePropertyCardProps) {

    if (isLoading) {
        return (
            <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="aspect-video w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-9 w-full" />
                </CardContent>
            </Card>
        );
    }
    
    if (!property) {
        return (
             <Card className="rounded-2xl shadow-sm border-dashed">
                <CardHeader>
                    <CardTitle className="text-base">Proprietate Inițială</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-6">
                     <p className="text-sm">Nicio proprietate sursă asociată.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader>
                <CardTitle className="text-base">Proprietate Inițială</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="relative aspect-video rounded-md overflow-hidden group">
                    <Link href={`/properties/${property.id}`}>
                        <Image
                            src={property.images?.[0]?.url || 'https://placehold.co/400x300'}
                            alt={property.title || 'Imagine proprietate'}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                        />
                    </Link>
                </div>
                <h4 className="font-semibold text-sm truncate">{property.title}</h4>
                 <p className="text-sm font-bold text-primary">€{property.price.toLocaleString()}</p>
                 <Button asChild size="sm" className="w-full">
                    <Link href={`/properties/${property.id}`}>
                        Vezi Proprietatea
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
