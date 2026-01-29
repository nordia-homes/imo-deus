
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Property = {
    id: string;
    address: string;
    price: number;
    imageUrl: string;
    imageHint: string;
    status: string;
}

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/properties/${property.id}`}>
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="p-0 relative">
                <Image
                    src={property.imageUrl}
                    alt={property.address}
                    width={400}
                    height={250}
                    className="object-cover w-full aspect-[4/3]"
                    data-ai-hint={property.imageHint}
                />
                 <Badge className="absolute top-2 right-2">{property.status}</Badge>
            </CardHeader>
            <CardContent className="p-4">
                <h3 className="font-semibold truncate">{property.address}</h3>
                <p className="text-primary font-bold text-lg">€{property.price.toLocaleString()}</p>
            </CardContent>
        </Card>
    </Link>
  );
}
