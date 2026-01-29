
import { properties } from "@/lib/data";
import { PropertyCard } from "./PropertyCard";

export function PropertyList() {
    if (!properties || properties.length === 0) {
        return <p>Nu există proprietăți de afișat.</p>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map(property => (
                <PropertyCard key={property.id} property={property} />
            ))}
        </div>
    )
}
