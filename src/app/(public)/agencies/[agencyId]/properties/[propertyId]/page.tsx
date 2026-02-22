'use client';

import { useParams, notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Property, UserProfile } from '@/lib/types';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

import { PublicPropertyHeader } from '@/components/public/PublicPropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { PublicInfoColumn } from '@/components/public/PublicInfoColumn';
import { PublicActionsColumn } from '@/components/public/PublicActionsColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bed, Ruler, Calendar, Layers, TrendingUp } from 'lucide-react';
import { PriceStatusCard } from '@/components/properties/detail/actions/PriceStatusCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';


const PageSkeleton = () => (
    <div className="space-y-6 lg:p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="space-y-2 w-full"> <Skeleton className="h-8 w-3/4" /> <Skeleton className="h-5 w-1/2" /></div>
            <div className="flex gap-2 w-full justify-start md:justify-end"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-10" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-6">
             <div className="lg:col-span-8 space-y-6"> <Skeleton className="h-[250px] md:h-[550px] bg-white/10" /> <Skeleton className="h-96 bg-white/10" /> </div>
             <div className="lg:col-span-4 space-y-4"> <Skeleton className="h-[700px] bg-white/10" /> </div>
        </div>
    </div>
);

export default function PublicPropertyDetailPage() {
    const params = useParams();
    const { agencyId, propertyId } = params as { agencyId: string, propertyId: string };
    const firestore = useFirestore();
    const isMobile = useIsMobile();

    const [agentProfile, setAgentProfile] = useState<UserProfile | null>(null);
    const [isAgentLoading, setIsAgentLoading] = useState(true);

    const propertyDocRef = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
    }, [firestore, agencyId, propertyId]);
    const { data: property, isLoading: isPropertyLoading, error } = useDoc<Property>(propertyDocRef);

    useEffect(() => {
        if (!property?.agentId || !firestore) {
            setIsAgentLoading(false);
            return;
        }

        const fetchAgent = async () => {
            setIsAgentLoading(true);
            try {
                const agentDocRef = doc(firestore, 'users', property.agentId!);
                const agentSnap = await getDoc(agentDocRef);
                if (agentSnap.exists()) {
                    setAgentProfile({ id: agentSnap.id, ...agentSnap.data() } as UserProfile);
                } else {
                    setAgentProfile(null);
                }
            } catch (error) {
                console.error("Error fetching agent profile:", error);
                setAgentProfile(null);
            } finally {
                setIsAgentLoading(false);
            }
        };

        fetchAgent();
    }, [property, firestore]);
    
    const isLoading = isPropertyLoading || isAgentLoading;
    
    if (isLoading) {
        return <div className="h-full bg-background lg:bg-[#0F1E33] text-white"><PageSkeleton /></div>;
    }
    
    if (!property || error || property.status !== 'Activ') {
        notFound();
        return null;
    }

    if (isMobile) {
        return (
          <div className="bg-[#0F1E33] -mt-6 pb-6 min-h-screen text-white">
             <div className="space-y-4">
                 <MediaColumn property={property} />

                <div className="space-y-4 px-2">
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                        <CardContent className="p-3">
                            <div className="flex justify-around items-center text-sm">
                                <div className="flex items-center gap-2"><Bed className="h-5 w-5 text-primary" /> <span className="font-semibold">{property.rooms}</span></div>
                                <div className="flex items-center gap-2"><Ruler className="h-5 w-5 text-primary" /> <span className="font-semibold">{property.squareFootage} mp</span></div>
                                {property.constructionYear && (<div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> <span className="font-semibold">{property.constructionYear}</span></div>)}
                                {property.floor && (<div className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> <span className="font-semibold">{property.floor}</span></div>)}
                            </div>
                        </CardContent>
                    </Card>
                    
                    <PriceStatusCard property={property} isMobile={isMobile}/>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline"
                          className="w-full bg-transparent border-cyan-400/50 text-cyan-300 shadow-[0_0_25px_-5px_rgba(100,220,255,0.6)] hover:bg-cyan-400/10 hover:text-cyan-200"
                        >
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Evalueaza Pretul cu ImoDeus.ai
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#0F1E33] text-white border-white/20">
                          <DialogHeader>
                              <DialogTitle>Evaluare Preț AI (Demo)</DialogTitle>
                              <DialogDescription className="text-white/70">
                                  Această funcționalitate este în curs de dezvoltare. Într-o versiune viitoare, aici veți vedea o analiză detaliată a prețului proprietății, comparat cu piața.
                              </DialogDescription>
                          </DialogHeader>
                      </DialogContent>
                    </Dialog>
                    
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-xl font-bold">{property.title}</CardTitle>
                            <CardDescription className="text-sm text-white/70">{property.address}</CardDescription>
                        </CardHeader>
                    </Card>

                    <PublicInfoColumn property={property} isMobile={true} />
                    <PublicActionsColumn property={property} agentProfile={agentProfile} agencyId={agencyId} isMobile={true} />
                </div>
            </div>
          </div>
        );
    }

    return (
        <div className={cn("bg-[#0F1E33] text-white animated-glow")}>
             <div className="container mx-auto px-4 py-8">
                <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="col-span-12 lg:col-span-8 space-y-8">
                        <PublicPropertyHeader property={property} />
                        <MediaColumn property={property} />
                        <PublicInfoColumn property={property} isMobile={false} />
                    </div>

                    <div className="col-span-12 lg:col-span-4 lg:sticky top-24">
                         <PublicActionsColumn property={property} agentProfile={agentProfile} agencyId={agencyId} isMobile={false}/>
                    </div>
                </main>
             </div>
        </div>
    );
}
