
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Contact } from '@/lib/types';
import { Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface SimilarLeadsCardProps {
    leads: Contact[];
}

export function SimilarLeadsCard({ leads: cumparatori }: SimilarLeadsCardProps) {

    if (cumparatori.length === 0) {
        return null; // Don't render the card if there are no similar leads
    }

    return (
        <Card className="rounded-2xl shadow-2xl bg-[#152A47] border-none text-white">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                    <Users className="h-5 w-5 text-primary" />
                    <span>Cumpărători Similari</span>
                </CardTitle>
                <CardDescription className="text-white/70">
                    Alți clienți cu bugete și zone de interes similare.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {cumparatori.map(cumparator => (
                    <Link href={`/leads/${cumparator.id}`} key={cumparator.id} className="flex items-center justify-between p-3 rounded-lg border border-white/20 hover:bg-white/10 group">
                        <div>
                            <p className="font-semibold text-sm text-white group-hover:text-primary">{cumparator.name}</p>
                            <p className="text-xs text-white/70">Buget: €{cumparator.budget?.toLocaleString()}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-white/70 group-hover:translate-x-1 transition-transform" />
                    </Link>
                ))}
            </CardContent>
        </Card>
    );
}
