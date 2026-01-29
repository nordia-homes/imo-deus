
import AiInsightCard from "@/components/ai/AiInsightCard";
import { PropertyDetails } from "@/components/properties/PropertyDetails";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyContractsTab } from "@/components/properties/PropertyContractsTab";
import { PropertyPromotionsTab } from "@/components/properties/PropertyPromotionsTab";
import { PropertyPresentationsTab } from "@/components/properties/PropertyPresentationsTab";
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Share2, Heart } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

export default function PropertyDetailPage({ params }: { params: { propertyId: string }}) {
    // Placeholder data - replace with Firestore data
    const property = {
        id: params.propertyId,
        title: 'Apartament 2 camere, decomandat, zona Dristor',
        price: 120000,
        location: 'Dristor, București',
        images: [
            'https://picsum.photos/seed/detail1/1200/800',
            'https://picsum.photos/seed/detail2/600/400',
            'https://picsum.photos/seed/detail3/600/400',
            'https://picsum.photos/seed/detail4/600/400',
            'https://picsum.photos/seed/detail5/600/400',
            'https://picsum.photos/seed/detail6/800/600',
            'https://picsum.photos/seed/detail7/800/600',
            'https://picsum.photos/seed/detail8/800/600',
            'https://picsum.photos/seed/detail9/800/600',
            'https://picsum.photos/seed/detail10/800/600',
            'https://picsum.photos/seed/detail11/800/600',
            'https://picsum.photos/seed/detail12/800/600',
            'https://picsum.photos/seed/detail13/800/600',
            'https://picsum.photos/seed/detail14/800/600',
            'https://picsum.photos/seed/detail15/800/600',
            'https://picsum.photos/seed/detail16/800/600',
        ],
        surface: 55,
        rooms: 2,
        floor: '3/8',
        year: 2010,
        comfort: '1',
        description: 'Vă prezentăm spre vânzare un apartament de 2 camere, situat în zona Dristor, la 5 minute de metrou. Apartamentul este decomandat, se află la etajul 3 al unui imobil cu 8 niveluri construit în 2010 și dispune de o suprafață utilă de 55 mp.\n\nSe vinde mobilat și utilat complet. Dispune de centrală proprie, aer condiționat și loc de parcare inclus în preț. Apartamentul este luminos și spațios, cu finisaje de calitate superioară. Zona este liniștită, cu acces facil la parcuri, școli și centre comerciale.',
        latitude: 44.42,
        longitude: 26.14,
        status: 'De vânzare',
        agent: { name: 'Mihai Ionescu' },
        aiInsights: {
            marketScore: 85,
            pricingFeedback: 'Prețul este cu 5% peste media zonei, dar justificat de finisaje și locul de parcare.',
            buyerProfile: 'Ideal pentru tineri profesioniști sau cupluri care lucrează în zona centrală sau de est a orașului.'
        }
    }

    return (
        <div className="max-w-7xl mx-auto">
             {/* Title Section */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold">{property.title}</h1>
                    <p className="text-muted-foreground hover:underline cursor-pointer mt-1">{property.location}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Share2 className="mr-2 h-4 w-4" />
                        Distribuie
                    </Button>
                    <Button variant="outline">
                         <Heart className="mr-2 h-4 w-4" />
                        Salvează
                    </Button>
                </div>
            </div>

            {/* Image Gallery */}
            <PropertyGallery images={property.images} title={property.title} />

            {/* Main Content */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
                 <div className="lg:col-span-2">
                    <PropertyDetails property={property} />
                    <Separator className="my-8"/>
                    <h2 className="text-2xl font-headline font-semibold mb-4">Management Proprietate</h2>
                    <Tabs defaultValue="contracts" className="w-full">
                        <TabsList>
                            <TabsTrigger value="contracts">Contracte</TabsTrigger>
                            <TabsTrigger value="promotions">Promovare</TabsTrigger>
                            <TabsTrigger value="presentations">Prezentări PDF</TabsTrigger>
                        </TabsList>
                        <TabsContent value="contracts" className="mt-6">
                            <PropertyContractsTab propertyId={property.id} />
                        </TabsContent>
                        <TabsContent value="promotions" className="mt-6">
                            <PropertyPromotionsTab propertyId={property.id} />
                        </TabsContent>
                        <TabsContent value="presentations" className="mt-6">
                            <PropertyPresentationsTab propertyId={property.id} />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Sticky Right Column */}
                 <div className="lg:col-span-1">
                    <div className="sticky top-24">
                         <Card>
                            <CardHeader>
                                <CardTitle className="text-2xl">€{property.price.toLocaleString()}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button className="w-full" size="lg">Contactează Agentul</Button>
                            </CardContent>
                        </Card>
                        <div className="mt-6">
                            <AiInsightCard insights={property.aiInsights} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
