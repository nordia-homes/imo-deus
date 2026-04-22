'use client';

import PortalStatusCard from "@/components/portal/PortalStatusCard";
import ImobiliareIntegrationCard from "@/components/portal/ImobiliareIntegrationCard";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Property } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from "@/context/AgencyContext";

const PORTALS = [
    { id: 'imobiliare', name: 'Imobiliare.ro' },
    { id: 'storia', name: 'Storia.ro' },
    { id: 'olx', name: 'OLX.ro' },
];

export default function PortalSyncPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);

    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    const portalStats = useMemo(() => {
        if (!properties) {
            return PORTALS.map(portal => ({
                id: portal.id,
                name: portal.name,
                connected: false,
                lastSync: '-',
                listings: 0,
                leads: 0,
                errors: 0
            }));
        }

        return PORTALS.map(portal => {
            let listings = 0;
            let errors = 0;
            let mostRecentSync: string | null = null;
            let connected = false;

            for (const prop of properties) {
                const promo = prop.promotions?.[portal.id];
                if (promo) {
                    connected = true; // If any property has a promotion for this portal, we consider it "connected"
                    if (promo.status === 'published') {
                        listings++;
                    }
                    if (promo.status === 'error') {
                        errors++;
                    }
                    if (promo.lastSync) {
                        if (!mostRecentSync || new Date(promo.lastSync) > new Date(mostRecentSync)) {
                            mostRecentSync = promo.lastSync;
                        }
                    }
                }
            }

            const formatLastSync = (syncDate: string | null) => {
                if (!syncDate) return '-';
                const date = new Date(syncDate);
                const now = new Date();
                const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
                
                if (diffSeconds < 2) return 'chiar acum';
                if (diffSeconds < 60) return `acum ${diffSeconds} secunde`;
                
                const diffMinutes = Math.round(diffSeconds / 60);
                if (diffMinutes < 60) return `acum ${diffMinutes} minute`;

                const diffHours = Math.round(diffMinutes / 60);
                if (diffHours < 24) return `acum ${diffHours} ore`;
                
                return date.toLocaleDateString('ro-RO');
            };

            return {
                id: portal.id,
                name: portal.name,
                connected,
                lastSync: formatLastSync(mostRecentSync),
                listings,
                leads: 0, // Not tracked yet
                errors,
            };
        });

    }, [properties]);


  return (
    <div className="agentfinder-integrations-page space-y-6 bg-[#0F1E33] text-white p-4 lg:p-6">
       <div className="agentfinder-integrations-hero text-center">
            <h1 className="text-3xl font-headline font-bold text-white">Integrări Portale</h1>
            <p className="text-white/70">
                Sincronizează anunțurile și lead-urile cu principalele portaluri imobiliare.
            </p>
        </div>

        <div className="agentfinder-integrations-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
                [...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-[250px] w-full bg-white/10" />
                ))
            ) : (
                portalStats.map(portal => (
                    portal.id === 'imobiliare' ? (
                        <ImobiliareIntegrationCard
                            key={portal.name}
                            listings={portal.listings}
                            errors={portal.errors}
                            lastSync={portal.lastSync}
                        />
                    ) : (
                        <PortalStatusCard key={portal.name} {...portal} />
                    )
                ))
            )}
        </div>
    </div>
  );
}
