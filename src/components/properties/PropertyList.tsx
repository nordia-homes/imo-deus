'use client';
import type { Property } from '@/lib/types';
import { PropertyCard } from "./PropertyCard";
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

interface PropertyListProps {
    properties: Property[] | null;
    isLoading: boolean;
    onDeleteRequest?: (property: Property) => void;
    agencyId?: string;
}

export function PropertyList({ properties, isLoading, onDeleteRequest, agencyId }: PropertyListProps) {

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
                <Card className="shadow-lg rounded-2xl mt-4 bg-transparent lg:bg-card">
                    <CardContent className="p-10 text-center text-muted-foreground">
                        Nicio proprietate nu corespunde filtrelor selectate.
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
                        onDeleteRequest={onDeleteRequest ? () => onDeleteRequest(property) : undefined}
                        agencyId={agencyId}
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
