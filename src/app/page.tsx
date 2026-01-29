
import { properties } from "@/lib/data";
import { PropertyCard } from "@/components/properties/PropertyCard";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Find Your Next Dream Home
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Exclusive listings of apartments, houses, and penthouses.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}
