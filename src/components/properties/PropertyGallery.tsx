
'use client';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
    if (!images || images.length === 0) {
        return (
             <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">No images available</p>
            </div>
        )
    }

    const mainImage = images[0];
    const otherImages = images.slice(1, 5); // Show up to 4 other images in the grid

    return (
        <Dialog>
            <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-2 rounded-lg overflow-hidden h-[550px]">
                    {/* Main Image */}
                    <DialogTrigger asChild>
                        <div className="md:col-span-2 md:row-span-2 relative group cursor-pointer">
                             <Image
                                src={mainImage}
                                alt={title}
                                fill
                                className="object-cover"
                                priority
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </DialogTrigger>

                    {/* Other Images */}
                    {otherImages.map((src, index) => (
                         <DialogTrigger asChild key={index}>
                            <div className="relative group cursor-pointer hidden md:block">
                                <Image
                                    src={src}
                                    alt={`${title} ${index + 2}`}
                                    fill
                                    className="object-cover"
                                    sizes="25vw"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </DialogTrigger>
                    ))}
                </div>
                 <DialogTrigger asChild>
                    <Button variant="secondary" className="absolute bottom-4 right-4">
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Show all photos
                    </Button>
                </DialogTrigger>
            </div>
             <DialogContent className="max-w-7xl h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Photos for: {title}</DialogTitle>
                </DialogHeader>
                 <ScrollArea className="h-full">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                        {images.map((src, index) => (
                             <div key={index} className="aspect-video relative">
                                <Image
                                    src={src}
                                    alt={`${title} ${index + 1}`}
                                    fill
                                    className="object-cover rounded-md"
                                    sizes="(max-width: 1400px) 50vw, 33vw"
                                />
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

    