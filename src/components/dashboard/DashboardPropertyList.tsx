
'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { ArrowRight, Building2 } from 'lucide-react';
import type { Property } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';

interface DashboardPropertyListProps {
    title: string;
    properties: Property[] | null;
    variant?: 'default' | 'mobile';
}

export function DashboardPropertyList({ title, properties, variant = 'default' }: DashboardPropertyListProps) {
    
    const renderContent = () => {
        if (!properties || properties.length === 0) {
            return <p className="text-sm text-center text-muted-foreground py-4">Nicio proprietate de afișat.</p>
        }

        return (
            <div className="space-y-2">
                {properties.map((prop) => (
                    <Link href={`/properties/${prop.id}`} key={prop.id} className="flex items-center gap-4 group p-2 rounded-md hover:bg-accent">
                         <div className="relative h-14 w-14 shrink-0">
                            <Image 
                                src={prop.images?.[0]?.url || 'https://placehold.co/100x100'} 
                                alt={prop.title}
                                fill
                                sizes="56px"
                                className="rounded-md object-cover"
                            />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-medium text-sm truncate">{prop.title}</p>
                             <p className="text-sm text-primary font-bold">
                                €{prop.price.toLocaleString()}
                            </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </Link>
                ))}
            </div>
        )
    }
    
    if (variant === 'mobile') {
        return (
             <Card className="shadow-2xl shadow-[#f8f8f9]/20 rounded-2xl border-none">
                <CardHeader className="bg-[#152a47] text-white p-3 rounded-t-2xl flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold text-white">{title}</CardTitle>
                    <Link href="/properties" className="text-sm text-white hover:underline">Vezi tot</Link>
                </CardHeader>
                <CardContent className="p-2 bg-card rounded-b-2xl">
                    {renderContent()}
                </CardContent>
            </Card>
        )
    }
    
    return (
        <Card className="shadow-2xl shadow-[#f8f8f9]/20 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
                <Link href="/properties" className="text-sm text-primary hover:underline">Vezi tot</Link>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
        </Card>
    );
}
