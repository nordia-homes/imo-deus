import Image from "next/image";
import { properties } from "@/lib/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";

function getBadgeVariant(status: 'For Sale' | 'Sold' | 'Pending') {
    switch(status) {
        case 'For Sale': return 'default';
        case 'Sold': return 'destructive';
        case 'Pending': return 'secondary';
        default: return 'default';
    }
}

export default function PropertiesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-headline font-bold">Properties</h1>
            <p className="text-muted-foreground">
                Manage your property listings.
            </p>
        </div>
        <AddPropertyDialog />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((property) => (
          <Card key={property.id} className="flex flex-col">
            <CardHeader className="p-0">
                <div className="relative">
                    <Image
                        src={property.imageUrl}
                        alt={property.address}
                        width={600}
                        height={400}
                        className="rounded-t-lg object-cover aspect-[3/2]"
                        data-ai-hint={property.imageHint}
                    />
                    <Badge variant={getBadgeVariant(property.status)} className="absolute top-2 right-2">{property.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4 flex-1">
              <CardTitle className="font-headline text-xl mb-1">{property.address}</CardTitle>
              <p className="text-lg font-semibold text-primary">${property.price.toLocaleString()}</p>
              <CardDescription className="mt-2 text-sm line-clamp-3">{property.description}</CardDescription>
            </CardContent>
            <CardFooter className="p-4 pt-0 border-t mt-4">
                <div className="text-xs text-muted-foreground grid grid-cols-3 gap-4 w-full text-center">
                    <div><span className="font-bold text-foreground">{property.bedrooms}</span> beds</div>
                    <div><span className="font-bold text-foreground">{property.bathrooms}</span> baths</div>
                    <div><span className="font-bold text-foreground">{property.squareFootage.toLocaleString()}</span> sqft</div>
                </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
