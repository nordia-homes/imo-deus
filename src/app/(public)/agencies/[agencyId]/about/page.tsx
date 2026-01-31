'use client';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { useFirestore } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Building, Users } from 'lucide-react';

export default function AgencyAboutPage() {
  const { agency, isAgencyLoading } = usePublicAgency();
  const firestore = useFirestore();
  const [agents, setAgents] = useState<UserProfile[]>([]);
  const [areAgentsLoading, setAreAgentsLoading] = useState(true);

  useEffect(() => {
    if (isAgencyLoading) return;

    if (!agency?.agentIds || agency.agentIds.length === 0) {
      setAreAgentsLoading(false);
      return;
    }

    const fetchAgents = async () => {
      setAreAgentsLoading(true);
      try {
        const agentPromises = agency.agentIds!.map(id => getDoc(doc(firestore, 'users', id)));
        const agentDocs = await Promise.all(agentPromises);
        const agentProfiles = agentDocs
            .filter(docSnap => docSnap.exists())
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserProfile));
        setAgents(agentProfiles);
      } catch (error) {
        console.error("Error fetching agent profiles:", error);
      } finally {
        setAreAgentsLoading(false);
      }
    };

    fetchAgents();
  }, [agency, isAgencyLoading, firestore]);

  const isLoading = isAgencyLoading || areAgentsLoading;

  if (isLoading) {
    return (
        <div className="container mx-auto py-12 px-4 space-y-12">
            <div className="max-w-4xl mx-auto text-center">
                <Skeleton className="h-10 w-64 mx-auto mb-4" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-5 w-4/5 mx-auto" />
            </div>
            <div className="max-w-5xl mx-auto">
                <Skeleton className="h-8 w-48 mb-6" />
                 <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="space-y-3">
                            <Skeleton className="aspect-square w-full rounded-full" />
                            <Skeleton className="h-6 w-3/4 mx-auto" />
                            <Skeleton className="h-4 w-1/2 mx-auto" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="bg-background">
        <div className="container mx-auto py-12 px-4 space-y-16">
            <section className="max-w-4xl mx-auto text-center">
                <Building className="mx-auto h-12 w-12 text-primary mb-4" />
                <h1 className="text-4xl font-bold mb-4">Despre {agency?.name}</h1>
                <p className="text-lg text-muted-foreground whitespace-pre-wrap">
                    {agency?.agencyDescription || 'Aflați mai multe despre misiunea și valorile noastre.'}
                </p>
            </section>
            
            <section className="max-w-6xl mx-auto">
                 <div className="text-center mb-12">
                    <Users className="mx-auto h-12 w-12 text-primary mb-4" />
                    <h2 className="text-4xl font-bold">Echipa Noastră de Experți</h2>
                    <p className="text-lg text-muted-foreground mt-2">Oamenii din spatele succesului clienților noștri.</p>
                </div>
                
                {agents.length > 0 ? (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-12">
                        {agents.map(agent => (
                            <div key={agent.id} className="text-center flex flex-col items-center">
                                <div className="relative h-40 w-40 mb-4">
                                     <Image
                                        src={agent.photoUrl || `https://i.pravatar.cc/150?u=${agent.id}`}
                                        alt={agent.name}
                                        fill
                                        sizes="160px"
                                        className="rounded-full object-cover border-4 border-background shadow-lg"
                                    />
                                </div>
                                <h3 className="text-xl font-semibold">{agent.name}</h3>
                                <p className="text-primary font-medium">{agent.role === 'admin' ? 'Manager' : 'Agent Imobiliar'}</p>
                                <p className="text-muted-foreground text-sm mt-2 min-h-[60px]">
                                    {agent.agentBio || 'Agent dedicat cu experiență în piața locală.'}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground">Echipa agenției nu a putut fi încărcată.</p>
                )}
            </section>
        </div>
    </div>
  );
}
