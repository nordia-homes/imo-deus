'use client';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
    const [mainImage, setMainImage] = useState(images[0]);

    if (!images || images.length === 0) {
        return (
             <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">No images available</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {/* Main Image */}
            <div className="relative w-full h-[400px] md:h-[550px] rounded-lg overflow-hidden">
                <Image
                    key={mainImage} // Add key to force re-render on change
                    src={mainImage}
                    alt={title}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 80vw"
                />
            </div>
            
            {/* Thumbnails */}
            {images.length > 1 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {images.map((src, index) => (
                        <div 
                            key={index}
                            className={cn(
                                "relative aspect-video rounded-md overflow-hidden cursor-pointer border-2",
                                mainImage === src ? 'border-primary' : 'border-transparent'
                            )}
                            onClick={() => setMainImage(src)}
                        >
                            <Image
                                src={src}
                                alt={`${title} thumbnail ${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="20vw"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
