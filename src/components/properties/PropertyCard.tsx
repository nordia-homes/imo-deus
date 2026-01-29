
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

type Property = {
  id: string;
  title: string;
  tagline: string;
  price: number;
  images: { url: string; alt: string }[];
}

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/properties/${property.id}`} className="group">
      <Card className="overflow-hidden h-full flex flex-col">
        <Carousel className="w-full">
            <CarouselContent>
                {property.images.map((image, index) => (
                    <CarouselItem key={index}>
                        <div className="aspect-square relative">
                            <Image
                                src={image.url}
                                alt={image.alt}
                                fill
                                className="object-cover rounded-t-lg transition-transform group-hover:scale-105"
                            />
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
        </Carousel>
        <CardHeader>
          <CardTitle className="text-lg truncate">{property.title}</CardTitle>
          <CardDescription>{property.tagline}</CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto">
          <p className="font-semibold text-lg">€{property.price.toLocaleString()}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}
