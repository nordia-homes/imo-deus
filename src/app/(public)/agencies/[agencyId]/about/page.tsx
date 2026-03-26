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
    <div className="bg-transparent">
        <div className="container mx-auto space-y-16 px-4 py-12">
            <section className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] px-8 py-12 text-center shadow-[0_28px_80px_-44px_rgba(0,0,0,0.78)]">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/10 text-[#f2d27a]">
                  <Building className="h-8 w-8" />
                </div>
                <h1 className="mb-4 text-4xl font-bold tracking-tight text-stone-100">Despre {agency?.name}</h1>
                <p className="whitespace-pre-wrap text-lg text-stone-300">
                    {agency?.agencyDescription || 'Aflați mai multe despre misiunea și valorile noastre.'}
                </p>
            </section>
            
            <section className="max-w-6xl mx-auto">
                 <div className="text-center mb-12">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/10 text-[#f2d27a]">
                      <Users className="h-8 w-8" />
                    </div>
                    <h2 className="text-4xl font-bold tracking-tight text-stone-100">Echipa noastră de experți</h2>
                    <p className="mt-2 text-lg text-stone-300">Oamenii din spatele succesului clienților noștri.</p>
                </div>
                
                {agents.length > 0 ? (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-12">
                        {agents.map(agent => (
                            <div key={agent.id} className="flex flex-col items-center rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-6 py-8 text-center shadow-[0_20px_60px_-38px_rgba(0,0,0,0.72)]">
                                <div className="relative h-40 w-40 mb-4">
                                     <Image
                                        src={agent.photoUrl || `https://i.pravatar.cc/150?u=${agent.id}`}
                                        alt={agent.name}
                                        fill
                                        sizes="160px"
                                        className="rounded-full object-cover border-4 border-[#1b1b1f] shadow-lg"
                                    />
                                </div>
                                <h3 className="text-xl font-semibold text-stone-100">{agent.name}</h3>
                                <p className="font-medium text-[#f2d27a]">{agent.role === 'admin' ? 'Manager' : 'Agent Imobiliar'}</p>
                                <p className="mt-2 min-h-[60px] text-sm text-stone-300">
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
