
'use client';
import Image from 'next/image';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

export function PropertyGallery({ images }: { images: string[] }) {
    if (!images || images.length === 0) {
        return null;
    }
  return (
    <Carousel className="w-full">
      <CarouselContent>
        {images.map((src, index) => (
          <CarouselItem key={index}>
            <Image
              src={src}
              alt={`Imagine proprietate ${index + 1}`}
              width={1200}
              height={800}
              className="w-full object-cover rounded-lg aspect-video"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
