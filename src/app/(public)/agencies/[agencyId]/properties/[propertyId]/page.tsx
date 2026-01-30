
import { properties as staticProperties } from '@/lib/data';
import type { Property } from '@/lib/types';
import { notFound } from 'next/navigation';
import { PropertyGallery } from '@/components/properties/PropertyGallery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BedDouble, Bath, Ruler, Building, CalendarDays, MapPin, HandCoins, CheckCircle2 } from 'lucide-react';
import React from 'react';

const FeatureItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value?: string | number | null }) => {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-start gap-3">
            <div className="text-primary pt-1">{icon}</div>
            <div>
                <p className="font-semibold text-card-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
            </div>
        </div>
    );
};

const PropertyContactForm = () => (
    <div className="text-center bg-muted p-8 rounded-lg">
        <p>Placeholder for Property Contact Form</p>
    </div>
);


export default async function PublicPropertyDetailPage({ params }: { params: { agencyId: string, propertyId: string } }) {

  const property = staticProperties.find(p => p.id === params.propertyId);

  if (!property) {
    notFound();
  }
  
  const allImages = (property.images || []).map(img => img.url).filter(Boolean);
  const defaultImages = ['https://placehold.co/1200x800'];
  
  return (
    <div className="container mx-auto py-12 px-4">
        <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight">{property.title}</h1>
            <p className="text-lg text-muted-foreground mt-2 flex items-center gap-2">
                <MapPin className="h-5 w-5"/>
                {property.address}
            </p>
        </div>
        
        <PropertyGallery images={allImages.length > 0 ? allImages : defaultImages} title={property.title || 'Proprietate'} />

        <div className="grid lg:grid-cols-3 gap-12 mt-12">
            <div className="lg:col-span-2 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Detalii Esențiale</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                        <FeatureItem icon={<HandCoins size={32} className="mx-auto mb-2" />} label="Tranzacție" value={property.transactionType} />
                        <FeatureItem icon={<Building size={32} className="mx-auto mb-2" />} label="Tip Proprietate" value={property.propertyType} />
                        <FeatureItem icon={<BedDouble size={32} className="mx-auto mb-2" />} label="Dormitoare" value={property.bedrooms} />
                        <FeatureItem icon={<Bath size={32} className="mx-auto mb-2" />} label="Băi" value={property.bathrooms} />
                        <FeatureItem icon={<Ruler size={32} className="mx-auto mb-2" />} label="Suprafață" value={`${property.squareFootage} mp`} />
                        <FeatureItem icon={<CalendarDays size={32} className="mx-auto mb-2" />} label="An Construcție" value={property.constructionYear} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{property.description}</p>
                    </CardContent>
                </Card>
                
                 {property.amenities && property.amenities.length > 0 && (
                    <Card>
                        <CardHeader><CardTitle>Dotări și Facilități</CardTitle></CardHeader>
                        <CardContent className="columns-2 md:columns-3 gap-x-8 gap-y-4 space-y-2">
                            {property.amenities.map(amenity => (
                                <div key={amenity} className="flex items-center gap-3 break-inside-avoid">
                                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                                    <span>{amenity}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                  )}

                <Card>
                    <CardHeader><CardTitle>Locație pe Hartă</CardTitle></CardHeader>
                    <CardContent>
                        {(property.latitude && property.longitude) ? (
                            <iframe
                                className="w-full aspect-video rounded-md border"
                                loading="lazy"
                                allowFullScreen
                                src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&hl=ro&z=15&output=embed`}
                            ></iframe>
                        ) : (
                            <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                                <p className="text-muted-foreground">Locația nu este disponibilă pe hartă.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <div className="lg:col-span-1">
                <Card className="sticky top-24">
                    <CardHeader>
                        <CardTitle className="text-4xl">€{property.price.toLocaleString()}</CardTitle>
                        <p className="text-muted-foreground">{property.transactionType}</p>
                    </CardHeader>
                    <CardContent>
                         <PropertyContactForm />
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
