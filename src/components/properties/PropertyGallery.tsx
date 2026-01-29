
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
                <p className="text-muted-foreground">Nicio imagine disponibilă</p>
            </div>
        )
    }

    const mainImage = images[0];
    const otherImages = images.slice(1, 5);

    return (
        <Dialog>
            <div className="relative">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-lg overflow-hidden h-[450px]">
                    {/* Main Image */}
                    <DialogTrigger asChild className="col-span-2 row-span-2 relative group cursor-pointer">
                        <div>
                             <Image
                                src={mainImage}
                                alt={title}
                                fill
                                className="object-cover w-full h-full"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </DialogTrigger>

                    {/* Other Images */}
                    {otherImages.map((src, index) => (
                         <DialogTrigger asChild key={index} className="relative group cursor-pointer hidden md:block">
                            <div>
                                <Image
                                    src={src}
                                    alt={`${title} ${index + 2}`}
                                    fill
                                    className="object-cover w-full h-full"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </DialogTrigger>
                    ))}
                </div>
                 <DialogTrigger asChild>
                    <Button variant="secondary" className="absolute bottom-4 right-4">
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Vezi toate pozele
                    </Button>
                </DialogTrigger>
            </div>
             <DialogContent className="max-w-7xl h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Fotografiile proprietății: {title}</DialogTitle>
                </DialogHeader>
                 <ScrollArea className="h-full">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                        {images.map((src, index) => (
                             <div key={index} className="aspect-[4/3] relative">
                                <Image
                                    src={src}
                                    alt={`${title} ${index + 1}`}
                                    fill
                                    className="object-cover w-full h-full rounded-md"
                                />
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
