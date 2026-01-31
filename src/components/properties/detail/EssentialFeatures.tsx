'use client';

import { Button } from '@/components/ui/button';
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
        <Button variant="outline" className="pointer-events-none w-full justify-start h-auto px-3 py-2">
            {icon}
            <span className="text-muted-foreground">{label}: <span className="font-semibold text-foreground">{value}</span></span>
        </Button>
    );
};

export function EssentialFeatures({ property }: { property: Property }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <FeatureButton icon={<HandCoins />} value={property.transactionType} label="Tranzacție" />
            <FeatureButton icon={<Building />} value={property.propertyType} label="Tip" />
            <FeatureButton icon={<Ruler />} value={`${property.squareFootage} mp`} label="Suprafață" />
            <FeatureButton icon={<BedDouble />} value={property.bedrooms} label="Dormitoare" />
            <FeatureButton icon={<Bath />} value={property.bathrooms} label="Băi" />
            <FeatureButton icon={<CalendarDays />} value={property.constructionYear} label="An" />
            <FeatureButton icon={<Layers />} value={property.floor} label="Etaj" />
            <FeatureButton icon={<Car />} value={property.parking} label="Parcare" />
        </div>
    );
}
