'use client';

import type { Property } from '@/lib/types';
import {
    BedDouble,
    Bath,
    Ruler,
    Building,
    CalendarDays,
    Layers,
    Car,
    HandCoins
} from "lucide-react";

const FeatureButton = ({ icon, value, label }: { icon: React.ReactNode, value?: string | number | null, label: string }) => {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
             <div className="flex items-center justify-center h-8 w-8 rounded-md bg-background text-primary shrink-0">
                {icon}
            </div>
            <p className="text-sm text-muted-foreground">
                {label}: <span className="font-bold text-card-foreground">{value}</span>
            </p>
        </div>
    )
}

export function EssentialFeatures({ property }: { property: Property }) {
    return (
        <div className="grid grid-cols-2 gap-4">
            <FeatureButton icon={<HandCoins />} value={property.transactionType} label="Tranzacție" />
            <FeatureButton icon={<Building />} value={property.propertyType} label="Tip" />
            <FeatureButton icon={<Ruler />} value={`${property.squareFootage} mp`} label="Suprafață" />
            <FeatureButton icon={<BedDouble />} value={property.bedrooms} label="Dormitoare" />
            <FeatureButton icon={<Bath />} value={property.bathrooms} label="Băi" />
            <FeatureButton icon={<CalendarDays />} value={property.constructionYear} label="An" />
            <FeatureButton icon={<Layers />} value={property.floor} label="Etaj" />
            <FeatureButton icon={<Car />} value={property.parking} label="Parcare" />
        </div>
    )
}
