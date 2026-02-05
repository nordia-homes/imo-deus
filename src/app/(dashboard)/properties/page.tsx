'use client';
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyList } from "@/components/properties/PropertyList";
import { PropertyStatCard } from "@/components/properties/PropertyStatCard";
import { Home, DollarSign, TrendingUp, Building, MapPin, PlusCircle } from "lucide-react";
import { useState } from 'react';
import { Button } from "@/components/ui/button";

export default function PropertiesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Proprietăți</h1>
            </div>
            <Button onClick={() => setIsAddOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adaugă Proprietate
            </Button>
        </div>
        
        <AddPropertyDialog 
          isOpen={isAddOpen} 
          onOpenChange={setIsAddOpen}
          property={null}
        />
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <PropertyStatCard label="Proprietăți" value="142" icon={<Home />} />
            <PropertyStatCard label="Valoare Portofoliu" value="€3.2M" icon={<DollarSign />} />
            <PropertyStatCard label="Noi luna asta" value="+18" icon={<TrendingUp />} />
            <PropertyStatCard label="2+ camere" value=">100k€" icon={<Building />} />
            <PropertyStatCard label="Active azi" value="12" subValue="București" icon={<MapPin />} />
        </div>
        
        <PropertyList />
    </div>
  );
}
