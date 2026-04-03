
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Contact } from '@/lib/types';
import { Users, ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';

interface SimilarLeadsCardProps {
    leads: Contact[];
}

export function SimilarLeadsCard({ leads: cumparatori }: SimilarLeadsCardProps) {

    if (cumparatori.length === 0) {
        return null; // Don't render the card if there are no similar leads
    }

    return (
        <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#132844_0%,#0f2036_62%,#0b1727_100%)] text-white shadow-[0_30px_80px_-38px_rgba(0,0,0,0.9)]">
            <CardHeader className="p-5 pb-3">
                <CardTitle className="flex items-center gap-2 text-white">
                    <Users className="h-5 w-5 text-primary" />
                    <span>Cumpărători Similari</span>
                </CardTitle>
                <CardDescription className="text-white/70">
                    Alți clienți cu bugete și zone de interes similare.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
                {cumparatori.map(cumparator => (
                    <Link href={`/leads/${cumparator.id}`} key={cumparator.id} className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 p-3 hover:bg-white/10">
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-sm text-white group-hover:text-primary">{cumparator.name}</p>
                            <p className="mt-1 text-xs text-white/70">Buget: €{cumparator.budget?.toLocaleString()}</p>
                            {(cumparator.city || (cumparator.zones?.length ?? 0) > 0) && (
                                <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-white/55">
                                    <MapPin className="h-3 w-3" />
                                    {cumparator.city || cumparator.zones?.[0]}
                                </p>
                            )}
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-1" />
                    </Link>
                ))}
            </CardContent>
        </Card>
    );
}
