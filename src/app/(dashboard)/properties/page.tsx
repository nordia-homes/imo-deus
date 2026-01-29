
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyCard } from "@/components/properties/PropertyCard";

export default function PropertiesPage() {
    // Placeholder data
    const properties = [
        { id: 'p1', address: '123 Strada Lalelelor', price: 145000, imageUrl: 'https://picsum.photos/seed/prop1/300/200', status: 'De vânzare', imageHint: 'apartament modern' },
        { id: 'p2', address: '456 Bulevardul Unirii', price: 155000, imageUrl: 'https://picsum.photos/seed/prop2/300/200', status: 'Vândut', imageHint: 'apartament centru' },
        { id: 'p3', address: '789 Aleea Trandafirilor', price: 250000, imageUrl: 'https://picsum.photos/seed/prop3/300/200', status: 'De vânzare', imageHint: 'casă cu grădină' },
    ];
  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-headline font-bold">Proprietăți</h1>
                <p className="text-muted-foreground">
                    Vezi și gestionează portofoliul de proprietăți.
                </p>
            </div>
            <AddPropertyDialog />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map(prop => (
                <PropertyCard key={prop.id} property={prop} />
            ))}
        </div>
    </div>
  );
}
