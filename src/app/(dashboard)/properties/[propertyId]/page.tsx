
import AiInsightCard from "@/components/ai/AiInsightCard";
import { PropertyDetails } from "@/components/properties/PropertyDetails";
import { PropertyGallery } from "@/components/properties/PropertyGallery";

export default function PropertyDetailPage({ params }: { params: { propertyId: string }}) {
    // Placeholder data - replace with Firestore data
    const property = {
        id: params.propertyId,
        title: 'Apartament 2 camere, decomandat, zona Dristor',
        price: 120000,
        location: 'Dristor, București',
        images: [
            'https://picsum.photos/seed/detail1/800/600',
            'https://picsum.photos/seed/detail2/800/600',
            'https://picsum.photos/seed/detail3/800/600',
        ],
        surface: 55,
        rooms: 2,
        floor: '3/8',
        year: 2010,
        comfort: '1',
        description: 'Vă prezentăm spre vânzare un apartament de 2 camere, situat în zona Dristor, la 5 minute de metrou. Apartamentul este decomandat, se află la etajul 3 al unui imobil cu 8 niveluri construit în 2010 și dispune de o suprafață utilă de 55 mp. Se vinde mobilat și utilat complet. Dispune de centrală proprie, aer condiționat și loc de parcare inclus în preț.',
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
        <div className="space-y-8">
            <PropertyGallery images={property.images} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <PropertyDetails property={property} />
                </div>
                <div>
                    <AiInsightCard insights={property.aiInsights} />
                </div>
            </div>
        </div>
    )
}
